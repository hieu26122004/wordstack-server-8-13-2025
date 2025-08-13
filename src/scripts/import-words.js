import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dbProm from "../models/index.js";
import {
  fetchWordFromAPI,
  findOrCreateRelatedWord,
  processAPIData,
} from "../controllers/word.controller.js";

const db = await dbProm;
const {
  Word,
  WordDefinition,
  WordExample,
  WordSynonym,
  WordAntonym,
  sequelize,
} = db;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const batchSize = 10;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const importWordsFromFile = async () => {
  const filePath = path.join(__dirname, "../../english.txt");
  const fileContent = fs.readFileSync(filePath, { encoding: "utf-8" });

  const words = fileContent
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);

  const results = {
    totalWords: words.length,
    successCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
    processedWords: [],
    hitRate: 0,
    missRate: 0,
  };

  for (let i = 0; i < words.length; i += batchSize) {
    const batch = words.slice(i, i + batchSize);

    const batchPromises = batch.map(async (word) => {
      try {
        const existingWord = await Word.findOne({
          where: { word: word },
        });

        if (existingWord) {
          results.skippedCount++;
          results.processedWords.push({
            word: word,
            status: "skipped",
            reason: "Word already exists",
          });
          return;
        }

        const apiData = await fetchWordFromAPI(word, 100);

        if (!apiData) {
          results.errorCount++;
          results.errors.push(`No data found for word: ${word}`);
          results.processedWords.push({
            word: word,
            status: "error",
            reason: "No data from API",
          });
          return;
        }

        const processedData = processAPIData(apiData, word);

        if (!processedData) {
          results.errorCount++;
          results.errors.push(`Failed to process data for word: ${word}`);
          results.processedWords.push({
            word: word,
            status: "error",
            reason: "Failed to process API data",
          });
          return;
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

            if (
              Array.isArray(defData.examples) &&
              defData.examples.length > 0
            ) {
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
          word: word,
          status: "success",
          definitionsCount: processedData.definitions.length,
        });
      } catch (error) {
        results.errorCount++;
        results.errors.push(
          `Error processing word "${word}": ${error.message}`
        );
        results.processedWords.push({
          word: word,
          status: "error",
          reason: error.message,
        });
      }
    });

    await Promise.all(batchPromises);

    if (i + batchSize < words.length) {
      await delay(5000);
    }

    console.log(
      `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        words.length / batchSize
      )}`
    );
  }

  results.hitRate = (results.successCount / results.totalWords).toFixed(2);
  results.missRate = (results.errorCount / results.totalWords).toFixed(2);

  console.log("Finish: ", results);
};

// importWordsFromFile();

function deepToJSON(instanceOrArray) {
  if (Array.isArray(instanceOrArray)) {
    return instanceOrArray.map(deepToJSON);
  }

  if (instanceOrArray?.toJSON) {
    const plain = instanceOrArray.toJSON();

    for (const key in plain) {
      const value = plain[key];
      if (Array.isArray(value)) {
        plain[key] = value.map(deepToJSON);
      } else if (value?.toJSON) {
        plain[key] = deepToJSON(value);
      }
    }

    return plain;
  }

  return instanceOrArray;
}

const test = async () => {
  const words = await Word.findAll({
    limit: 10,
    include: [
      {
        model: WordDefinition,
        as: "definitions",
        include: [{ model: WordExample, as: "examples" }],
        required: true,
      },
      { model: WordSynonym, as: "synonyms" },
      { model: WordAntonym, as: "antonyms" },
    ],
  });

  const plainWords = deepToJSON(words);

  console.log(JSON.stringify(plainWords, null, 2));
};

test();
