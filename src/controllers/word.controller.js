import httpStatus from "http-status";
import dbProm from "../models/index.js";
import { handleAsyncError } from "../utils/async.js";
import { getGetWordsKey } from "../utils/keys.js";
import redis from "../config/redis.config.js";
import {
  returnError,
  returnPagination,
  returnSuccess,
} from "../utils/formatter.js";

const db = await dbProm;
const {
  Word,
  WordDefinition,
  WordExample,
  WordSynonym,
  WordAntonym,
  sequelize,
  UserSavedWord,
  WordLearningProgress,
} = db;

export const createWord = handleAsyncError(async (req, res) => {
  const { word, phonetic, pronunciationUrl, definitions } = req.body;

  const lowercasedWord = word.trim().toLowerCase();
  const exists = await Word.findOne({ where: { word: lowercasedWord } });
  if (exists) {
    return res
      .status(httpStatus.CONFLICT)
      .json(returnError("Word already exists."));
  }

  try {
    const result = await sequelize.transaction(async (t) => {
      const newWord = await Word.create(
        {
          word: lowercasedWord,
          phonetic: phonetic || null,
          pronunciationUrl: pronunciationUrl || null,
        },
        { transaction: t }
      );

      const allDefinitions = [];

      for (const def of definitions) {
        const {
          definition,
          partOfSpeech,
          examples = [],
          synonyms = [],
          antonyms = [],
        } = def;

        const wordDef = await WordDefinition.create(
          {
            definition,
            partOfSpeech,
            wordId: newWord.id,
          },
          { transaction: t }
        );

        const exampleEntries = await Promise.all(
          examples
            .filter((e) => e.exampleText)
            .map((e) =>
              WordExample.create(
                {
                  exampleText: e.exampleText,
                  translation: e.translation || null,
                  wordDefinitionId: wordDef.id,
                },
                { transaction: t }
              )
            )
        );

        const synonymEntries = await Promise.all(
          synonyms
            .filter((s) => s.synonymyId && s.synonymyId !== wordDef.id)
            .map((s) =>
              WordSynonym.create(
                {
                  synonymyId: s.synonymyId,
                  wordId: newWord.id,
                },
                { transaction: t }
              )
            )
        );

        const antonymEntries = await Promise.all(
          antonyms
            .filter((a) => a.antonymId && a.antonymId !== wordDef.id)
            .map((a) =>
              WordAntonym.create(
                {
                  antonymId: a.antonymId,
                  wordId: newWord.id,
                },
                { transaction: t }
              )
            )
        );

        allDefinitions.push({
          ...wordDef.toJSON(),
          examples: exampleEntries.map((e) => e.toJSON()),
          synonyms: synonymEntries.map((s) => s.toJSON()),
          antonyms: antonymEntries.map((a) => a.toJSON()),
        });
      }

      return {
        ...newWord.toJSON(),
        definitions: allDefinitions,
      };
    });

    return res
      .status(httpStatus.CREATED)
      .json(returnSuccess("Word created successfully.", result));
  } catch (err) {
    console.error(`Failed during create new word: \n${err}`);
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json(returnError("Failed to create word."));
  }
});

export const bulkCreateWord = handleAsyncError(async (req, res) => {
  const { words } = req.body;

  const results = {
    totalWords: words.length,
    successCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
    processedWords: [],
  };

  for (const word of words) {
    const cleanWord = word.trim().toLowerCase();

    try {
      const existingWord = await Word.findOne({
        where: { word: cleanWord },
      });

      if (existingWord) {
        results.skippedCount++;
        results.processedWords.push({
          word,
          status: "skipped",
          reason: "Word already exists",
        });
        continue;
      }

      const apiData = await fetchWordFromAPI(word);

      if (!apiData) {
        results.errorCount++;
        results.errors.push(`No data found for word: ${cleanWord}`);
        continue;
      }

      const processedData = processAPIData(apiData, word);

      if (!processedData) {
        results.errorCount++;
        results.errors.push(`Failed to process data for word: ${cleanWord}`);
        continue;
      }

      await sequelize.transaction(async (t) => {
        const newWord = await Word.create(
          {
            word: processedData.word,
            phonetic: processedData.phonetic,
            pronunciationUrl: processedData.pronunciationUrl,
          },
          { transaction: t }
        );

        for (const defData of processedData.definitions) {
          const wordDefinition = await WordDefinition.create(
            {
              definition: defData.definition,
              partOfSpeech: defData.partOfSpeech,
              wordId: newWord.id,
            },
            { transaction: t }
          );

          if (Array.isArray(defData.examples) && defData.examples.length > 0) {
            for (const example of defData.examples) {
              await WordExample.create(
                {
                  exampleText: example.exampleText,
                  translation: example.translation,
                  wordDefinitionId: wordDefinition.id,
                },
                { transaction: t }
              );
            }
          }
        }

        if (
          Array.isArray(processedData.synonyms) &&
          processedData.synonyms.length > 0
        ) {
          for (const synonym of processedData.synonyms) {
            const synonymId = await findOrCreateRelatedWord(
              synonym.synonymText,
              t
            );
            if (!synonymId) continue;

            await WordSynonym.create(
              {
                synonymyId: synonymId,
                wordId: newWord.id,
              },
              { transaction: t }
            );
          }
        }

        if (
          Array.isArray(processedData.antonyms) &&
          processedData.antonyms.length > 0
        ) {
          for (const antonym of processedData.antonyms) {
            const antonymId = await findOrCreateRelatedWord(
              antonym.antonymText,
              t
            );
            await WordAntonym.create(
              {
                antonymId: antonymId,
                wordId: newWord.id,
              },
              { transaction: t }
            );
          }
        }
      });

      results.successCount++;
      results.processedWords.push({
        word: cleanWord,
        status: "success",
        definitionsCount: processedData.definitions.length,
      });
    } catch (error) {
      results.errorCount++;
      results.errors.push(`Error processing word "${word}": ${error.message}`);
    }
  }

  return res
    .status(httpStatus.OK)
    .json(returnSuccess("Words import completed", results));
});

export const gethWords = handleAsyncError(async (req, res) => {
  const userId = req.user.id;
  const {
    query,
    searchType = "prefix",
    limit = 20,
    page = 1,
    includeRelated = true,
    savedStatus,
  } = req.query;

  const parsedLimit = Math.min(parseInt(limit), 100);
  const parsedPage = Math.max(parseInt(page), 1);
  const offset = (parsedPage - 1) * parsedLimit;

  const whereCondition = {};
  const replacements = { userId };
  let order = [["word", "ASC"]];

  // XỬ LÝ KHI CÓ TÌM KIẾM
  if (query?.trim()) {
    const searchQuery = query.trim().toLowerCase();
    const escapedQuery = searchQuery.replace(/[\\%_]/g, "\\$&");

    const searchConditions = {
      exact: { word: searchQuery },
      contains: { word: { [db.Sequelize.Op.like]: `%${escapedQuery}%` } },
      prefix: { word: { [db.Sequelize.Op.like]: `${escapedQuery}%` } },
    };

    Object.assign(
      whereCondition,
      searchConditions[searchType] || searchConditions.prefix
    );

    order = [
      [
        db.sequelize.literal(
          `CASE WHEN "Word"."word" = :searchQuery THEN 0 ELSE 1 END`
        ),
      ],
      [
        db.sequelize.literal(
          `CASE WHEN "Word"."word" LIKE :prefix THEN 0 ELSE 1 END`
        ),
      ],
      [db.sequelize.fn("LENGTH", db.sequelize.col("Word.word")), "ASC"],
      ...order,
    ];

    replacements.searchQuery = searchQuery;
    replacements.prefix = `${escapedQuery}%`;
  }

  // XỬ LÝ KHI CÓ LỌC THEO TRẠNG THÁI LƯU
  if (savedStatus === "saved") {
    whereCondition[db.Sequelize.Op.and] = [
      db.sequelize.literal(`
      EXISTS (
        SELECT 1 FROM user_saved_words 
        WHERE user_id = :userId 
        AND word_id = "Word"."id"
      )
    `),
    ];
  } else if (savedStatus === "unsaved") {
    whereCondition[db.Sequelize.Op.and] = [
      db.sequelize.literal(`
      NOT EXISTS (
        SELECT 1 FROM user_saved_words 
        WHERE user_id = :userId 
        AND word_id = "Word"."id"
      )
    `),
    ];
  }

  //TOÀN BỘ TRUY VẤN
  const wordQuery = {
    where: whereCondition,
    attributes: {
      include: [
        [
          db.sequelize.literal(`
          EXISTS (SELECT 1 FROM user_saved_words 
          WHERE user_id = :userId 
          AND word_id = "Word"."id")
        `),
          "isSaved",
        ],
      ],
    },
    include: [
      {
        model: WordDefinition,
        as: "definitions",
        attributes: ["id", "definition", "partOfSpeech"],
        include: [
          {
            model: WordExample,
            as: "examples",
            attributes: ["id", "exampleText", "translation"],
            limit: 3,
          },
        ],
      },
    ],
    limit: parsedLimit,
    offset,
    order,
    replacements,
    distinct: true,
  };

  const { count, rows: words } = await Word.findAndCountAll(wordQuery);

  const [synonymsMap, antonymsMap] = await Promise.all([
    includeRelated && words.length
      ? getWordRelations(WordSynonym, "synonym", words)
      : Promise.resolve({}),
    includeRelated && words.length
      ? getWordRelations(WordAntonym, "antonym", words)
      : Promise.resolve({}),
  ]);

  const results = words.map((word) => ({
    id: word.id,
    word: word.word,
    phonetic: word.phonetic,
    pronunciationUrl: word.pronunciationUrl,
    isSaved: word.get("isSaved"),
    definitions:
      word.definitions?.map((def) => ({
        id: def.id,
        definition: def.definition,
        partOfSpeech: def.partOfSpeech,
        examples:
          def.examples?.map((ex) => ({
            text: ex.exampleText,
            translation: ex.translation,
          })) || [],
      })) || [],
    ...(includeRelated && {
      synonyms: synonymsMap[word.id] || [],
      antonyms: antonymsMap[word.id] || [],
    }),
  }));

  return res
    .status(httpStatus.OK)
    ._cache(
      returnPagination(
        "Get words successfully.",
        { query, searchType, results },
        { count, page: parsedPage, limit: parsedLimit }
      )
    );
});

export const saveWord = handleAsyncError(async (req, res) => {
  const { notes } = req.body;
  const { wordId } = req.params;
  const userId = req.user.id;

  const word = await Word.findByPk(wordId);
  if (!word) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json(returnError("Word not found"));
  }

  const existingSavedWord = await UserSavedWord.findOne({
    where: {
      userId: userId,
      wordId: wordId,
    },
  });

  if (existingSavedWord) {
    return res
      .status(httpStatus.CONFLICT)
      .json(returnError("Word already saved"));
  }

  const savedWord = await UserSavedWord.create({
    userId: userId,
    wordId: wordId,
    notes: notes || null,
  });

  await WordLearningProgress.create({
    userSavedWordId: savedWord.id,
    masteryLevel: 0,
    correctCount: 0,
    wrongCount: 0,
    reviewInterval: 1,
    nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const savedWordWithDetails = await UserSavedWord.findByPk(savedWord.id, {
    include: [
      {
        model: Word,
        as: "word",
        include: [
          {
            model: WordDefinition,
            as: "definitions",
            include: [
              {
                model: WordExample,
                as: "examples",
                limit: 1,
              },
            ],
          },
        ],
      },
    ],
  });

  await deleteUserGetWordsCache(userId);

  return res
    .status(httpStatus.CREATED)
    .json(returnSuccess("Word saved successfully", savedWordWithDetails));
});

export const unsaveWord = handleAsyncError(async (req, res) => {
  const userId = req.user.id;
  const { wordId } = req.params;

  const savedWord = await UserSavedWord.findOne({
    where: { userId, wordId },
  });

  if (!savedWord) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json(returnError("Saved word not found."));
  }

  await savedWord.destroy();

  await deleteUserGetWordsCache(userId);

  return res
    .status(httpStatus.OK)
    .json(returnSuccess("Word removed from saved list."));
});

export const getSavedWordsStats = handleAsyncError(async (req, res) => {
  const userId = req.user.id;

  const [overallStats, last30DaysActivity, recentlyAdded] = await Promise.all([
    db.sequelize.query(
      `SELECT
        COUNT(usw.id)::INT AS "totalSaved",
        COALESCE(AVG(wlp.mastery_level), 0)::FLOAT AS "averageMastery",
        mastery_level,
        COUNT(*)::INT AS count
      FROM user_saved_words usw
      LEFT JOIN word_learning_progresses wlp ON wlp.user_saved_word_id = usw.id
      WHERE usw.user_id = :userId
      GROUP BY GROUPING SETS ((), (mastery_level))`,
      {
        replacements: { userId },
        type: db.sequelize.QueryTypes.SELECT,
      }
    ),

    db.sequelize.query(
      `WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '29 days', 
          CURRENT_DATE, 
          '1 day'
        )::DATE AS date
      )
      SELECT
        ds.date AS "date",
        COALESCE(COUNT(usw.id), 0)::INT AS "totalSaved"
      FROM date_series ds
      LEFT JOIN user_saved_words usw 
        ON usw.created_at::DATE = ds.date
        AND usw.user_id = :userId
      GROUP BY ds.date
      ORDER BY ds.date`,
      {
        replacements: { userId },
        type: db.sequelize.QueryTypes.SELECT,
      }
    ),

    UserSavedWord.findAll({
      where: {
        user_id: userId,
        created_at: {
          [db.Sequelize.Op.gte]: db.sequelize.literal(
            "CURRENT_DATE - INTERVAL '7 days'"
          ),
        },
      },
      include: [
        {
          model: Word,
          as: "word",
          attributes: ["id", "word"],
        },
      ],
      attributes: ["created_at"],
      order: [["created_at", "DESC"]],
      limit: 10,
      raw: true,
      nest: true,
    }),
  ]);

  const stats = overallStats.reduce(
    (acc, row) => {
      if (row.mastery_level === null) {
        acc.totalSaved = row.totalSaved;
        acc.averageMastery = row.averageMastery;
      } else {
        acc.masteryStats[row.mastery_level] = row.count;
      }
      return acc;
    },
    {
      totalSaved: 0,
      averageMastery: 0,
      masteryStats: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    }
  );

  return res.status(httpStatus.OK).json(
    returnSuccess("Saved words statistics retrieved successfully", {
      totalSaved: stats.totalSaved,
      averageMastery: stats.averageMastery,
      masteryStats: stats.masteryStats,
      last30DaysActivity,
      recentlyAdded: recentlyAdded.map((item) => ({
        id: item.word.id,
        word: item.word.word,
        savedAt: item.created_at,
      })),
    })
  );
});

////////////////////////////////////////////////////////////////// HELPER FUNCTIONS //////////////////////////////////////////////////////////////////

export const fetchWordFromAPI = async (word, retryCount = 3) => {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
    );

    if (response.status === 429) {
      console.warn(
        `Too many requests for "${word}", retrying in ${3000 / 1000}s...`
      );

      if (retryCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return await fetchWordFromAPI(word, retryCount - 1, 3000);
      } else {
        console.error(`Exceeded retry attempts for "${word}"`);
        return null;
      }
    }

    if (!response.ok) {
      console.warn(
        `Failed response for word "${word}" — Status: ${response.status}`
      );
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.warn(`Empty data for word "${word}"`);
      return null;
    }

    return data[0];
  } catch (error) {
    console.error(`Error fetching "${word}": ${error.message}`);
    return null;
  }
};

export const processAPIData = (apiData, originalWord) => {
  if (!apiData) return null;

  const result = {
    word: originalWord.toLowerCase(),
    phonetic: null,
    pronunciationUrl: null,
    definitions: [],
    synonyms: [],
    antonyms: [],
  };

  if (apiData.phonetic) {
    result.phonetic = apiData.phonetic;
  } else if (Array.isArray(apiData.phonetics) && apiData.phonetics.length > 0) {
    result.phonetic = apiData.phonetics.find((p) => p.text)?.text || "N/A";
  }

  if (Array.isArray(apiData.phonetics) && apiData.phonetics.length > 0) {
    result.pronunciationUrl =
      apiData.phonetics.find((p) => p.audio)?.audio || "";
  }

  if (Array.isArray(apiData.meanings) && apiData.meanings.length > 0) {
    apiData.meanings.forEach((meaning) => {
      if (
        Array.isArray(meaning.definitions) &&
        meaning.definitions.length > 0
      ) {
        meaning.definitions.forEach((definition) => {
          const definitionData = {
            definition: definition.definition,
            partOfSpeech: meaning.partOfSpeech,
            examples: [],
          };

          if (definition.example) {
            definitionData.examples.push({
              exampleText: definition.example,
              translation: null,
            });
          }

          result.definitions.push(definitionData);
        });
        if (Array.isArray(meaning.synonyms) && meaning.synonyms.length > 0) {
          const uniqueSynonyms = [...new Set(meaning.synonyms.filter(Boolean))];
          result.synonyms = uniqueSynonyms.map((synonym) => ({
            synonymText: synonym.trim().toLowerCase(),
          }));
        }

        if (Array.isArray(meaning.antonyms) && meaning.antonyms.length > 0) {
          const uniqueAntonyms = [...new Set(meaning.antonyms.filter(Boolean))];
          result.antonyms = uniqueAntonyms.map((antonym) => ({
            antonymText: antonym.trim().toLowerCase(),
          }));
        }
      }
    });
  }

  return result.definitions.length > 0 ? result : null;
};

export const findOrCreateRelatedWord = async (wordText, transaction) => {
  const cleanWord = wordText.trim().toLowerCase();

  let relatedWord = await Word.findOne({
    where: { word: cleanWord },
    transaction,
  });

  if (relatedWord) return relatedWord.id;

  const apiData = await fetchWordFromAPI(wordText);

  const processed = processAPIData(apiData, cleanWord);

  const phonetic = processed?.phonetic || "N/A";
  const pronunciationUrl = processed?.pronunciationUrl || "";

  relatedWord = await Word.create(
    {
      word: cleanWord,
      phonetic,
      pronunciationUrl,
    },
    { transaction }
  );

  return relatedWord.id;
};

const getWordRelations = async (RelationModel, type, words) => {
  const wordIds = words.map((w) => w.id);
  const relations = await RelationModel.findAll({
    where: { wordId: wordIds },
    include: [
      {
        model: Word,
        as: `word${type[0].toUpperCase() + type.slice(1)}`,
        attributes: ["word"],
      },
    ],
    raw: true,
  });

  const resultMap = {};
  relations.forEach((rel) => {
    if (!resultMap[rel.wordId]) resultMap[rel.wordId] = [];
    resultMap[rel.wordId].push(
      rel[`word${type[0].toUpperCase() + type.slice(1)}.word`]
    );
  });

  return resultMap;
};

const deleteUserGetWordsCache = async (userId) => {
  const prefix = getGetWordsKey(userId, "*");
  const keys = await redis.keys(prefix);
  if (Array.isArray(keys) && keys.length > 0) {
    await redis.del(keys);
  }
};
