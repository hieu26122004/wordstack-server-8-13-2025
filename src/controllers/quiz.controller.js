import httpStatus from "http-status";
import dbProm from "../models/index.js";
import { handleAsyncError } from "../utils/async.js";
import { returnError, returnSuccess } from "../utils/formatter.js";

const db = await dbProm;

const { QuizSession, QuizQuestion, UserSavedWord, WordLearningProgress } = db;

export const createQuizSession = handleAsyncError(async (req, res) => {
  const userId = req.user.id;
  const { quizType, questionPerSession } = req.body;

  const activeSession = await QuizSession.findOne({
    where: {
      userId,
      endedAt: null,
    },
    include: [
      {
        model: QuizQuestion,
        attributes: ["id", "questionType", "questionText", "options"],
        as: "questions",
      },
    ],
    attributes: [
      ["id", "sessionId"],
      "totalQuestions",
      [db.sequelize.literal("true"), "hasActiveSession"],
    ],
  });

  if (activeSession) {
    return res
      .status(httpStatus.OK)
      .json(
        returnSuccess("You already have an active quiz session", activeSession)
      );
  }

  const [words] = await db.sequelize.query(
    `
        WITH need_to_review AS (
        SELECT usw.word_id
        FROM user_saved_words usw
        LEFT JOIN word_learning_progresses wlp 
            ON wlp.user_saved_word_id = usw.id 
            AND wlp.next_review_at::DATE <= CURRENT_DATE
        WHERE usw.user_id = :userId
        ),
        definitions_cte AS (
        SELECT 
            wd.word_id,
            JSON_AGG(JSON_BUILD_OBJECT('id', wd.id, 'definition', wd.definition)) AS definitions
        FROM word_definitions wd
        GROUP BY wd.word_id
        ),
        synonyms_cte AS (
        SELECT 
            ws.word_id,
            JSON_AGG(DISTINCT s.word) AS synonyms
        FROM word_synonyms ws
        JOIN words s ON s.id = ws.synonymy_id
        GROUP BY ws.word_id
        ),
        antonyms_cte AS (
        SELECT 
            wa.word_id,
            JSON_AGG(DISTINCT a.word) AS antonyms
        FROM word_antonyms wa
        JOIN words a ON a.id = wa.antonym_id
        GROUP BY wa.word_id
        )
        SELECT 
        w.*,
        COALESCE(defs.definitions, '[]'::json) AS definitions,
        COALESCE(syns.synonyms, '[]'::json) AS synonyms,
        COALESCE(ants.antonyms, '[]'::json) AS antonyms
        FROM words w
        LEFT JOIN definitions_cte defs ON defs.word_id = w.id
        LEFT JOIN synonyms_cte syns     ON syns.word_id = w.id
        LEFT JOIN antonyms_cte ants     ON ants.word_id = w.id
        WHERE w.id IN (SELECT word_id FROM need_to_review)
        ORDER BY RANDOM()
        LIMIT :questionPerSession
    `,
    {
      replacements: {
        userId,
        questionPerSession,
      },
    }
  );

  if (!words.length) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json(
        returnError("No words available for quiz. All words are up to date!")
      );
  }

  const result = await db.sequelize.transaction(async (t) => {
    const quizSession = await QuizSession.create(
      {
        userId,
        totalQuestions: words.length,
        correctCount: 0,
        wrongCount: 0,
        score: 0,
        quizType,
      },
      { transaction: t }
    );

    const parsedQuizSession = quizSession.toJSON();

    const questionGenerators = {
      definition_to_word: generateDTWQuestion,
      word_to_definition: generateWTDQuestion,
      fill_in_blank: generateFIBQuestion,
      mixed: generateMixedQuestion,
    };

    const generateQuestion =
      questionGenerators[quizType] || generateMixedQuestion;

    const questionsData = await Promise.all(
      words.map(async (word) => {
        const questionData = await generateQuestion(word);
        return {
          quizSessionId: parsedQuizSession.id,
          wordId: word.id,
          questionType: questionData.questionType,
          questionText: questionData.questionText,
          correctAnswer: questionData.correctAnswer,
          options: questionData.options || null,
        };
      })
    );

    const questions = await QuizQuestion.bulkCreate(questionsData, {
      transaction: t,
      returning: true,
    });

    const formattedQuestions = questions.map((q) => {
      const parsedQuestion = q.toJSON();
      return {
        id: parsedQuestion.id,
        questionType: parsedQuestion.questionType,
        questionText: parsedQuestion.questionText,
        options: parsedQuestion.options,
      };
    });

    return {
      session: parsedQuizSession,
      questions: formattedQuestions,
    };
  });

  return res.status(httpStatus.CREATED).json(
    returnSuccess("Quiz session created successfully.", {
      sessionId: result.session.id,
      totalQuestions: result.session.totalQuestions,
      questions: result.questions,
    })
  );
});

export const getQuestion = handleAsyncError(async (req, res) => {
  const { sessionId, questionId } = req.params;
  const userId = req.user.id;

  const [result] = await db.sequelize.query(
    `
      SELECT 
        qq.*,
        qs.user_id,
        qs.total_questions,
        qs.correct_count,
        qs.wrong_count
      FROM quiz_questions qq
      JOIN quiz_sessions qs 
        ON qs.id = qq.quiz_session_id 
       AND qs.id = :sessionId
       AND qs.user_id = :userId
      WHERE qq.id = :questionId
    `,
    {
      replacements: { sessionId, questionId, userId },
    }
  );

  const questionEntry = result[0];
  console.log("questionEntry", questionEntry);

  if (!questionEntry) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json(returnError("Question not found"));
  }

  if (questionEntry.user_id !== userId) {
    return res
      .status(httpStatus.FORBIDDEN)
      .json(returnError("You don't have permission to access this question"));
  }

  const formattedQuestion = {
    id: questionEntry.id,
    quizSessionId: questionEntry.quiz_session_id,
    questionType: questionEntry.question_type,
    questionText: questionEntry.question_text,
    options: questionEntry.options,
    userAnswer: questionEntry.user_answer,
    correctAnswer: questionEntry.user_answer
      ? questionEntry.correct_answer
      : null,
    isCorrecte: questionEntry.is_correct,
    hasSubmitted: questionEntry.user_answer ? true : false,
    createdAt: questionEntry.created_at,
    updatedAt: questionEntry.updated_at,
    sessionProgress: {
      totalQuestions: questionEntry.total_questions,
      correctAnswers: questionEntry.correct_count,
      wrongAnswers: questionEntry.wrong_count,
      answeredQuestions:
        questionEntry.correct_count + questionEntry.wrong_count,
      percentage: questionEntry.total_questions
        ? ((questionEntry.correct_count + questionEntry.wrong_count) /
            questionEntry.total_questions) *
          100
        : 0,
    },
  };

  if (formattedQuestion.hasSubmitted) {
    formattedQuestion.nextQuestion = await getNextQuestion(sessionId);
  }

  return res
    .status(httpStatus.OK)
    .json(returnSuccess("Question retrieved successfully", formattedQuestion));
});

export const cancelQuizSession = handleAsyncError(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  const session = await QuizSession.findOne({
    where: { id: sessionId, userId },
  });

  if (!session) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json(returnError("Quiz session not found"));
  }

  if (session.endedAt) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json(returnError("Session already ended"));
  }

  await session.update({
    endedAt: new Date(),
  });

  return res
    .status(httpStatus.OK)
    .json(returnSuccess("Quiz session cancelled"));
});

export const submitAnswer = handleAsyncError(async (req, res) => {
  const { sessionId, questionId } = req.params;
  const { userAnswer } = req.body;
  const userId = req.user.id;

  const questionData = await QuizQuestion.findOne({
    where: { id: questionId },
    include: [
      { model: QuizSession, as: "quizsession", where: { id: sessionId } },
    ],
  });

  const { quizsession: session, ...question } = questionData.toJSON();

  if (!question) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json(returnError("Question not found or not accessible."));
  }

  if (session.userId !== userId) {
    return res
      .status(httpStatus.FORBIDDEN)
      .json(returnError("You are not authorized to answer this question."));
  }

  if (question.userAnswer) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json(returnError("Question already answered."));
  }

  if (session.endedAt) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json(returnError("Quiz session has already ended."));
  }

  const result = await db.sequelize.transaction(async (t) => {
    const trimmedAnswer = userAnswer.trim();
    const isCorrect =
      trimmedAnswer.toLowerCase() === question.correctAnswer.toLowerCase();

    await QuizQuestion.update(
      {
        userAnswer: trimmedAnswer,
        isCorrect,
        updatedAt: new Date(),
      },
      {
        where: { id: question.id },
        transaction: t,
      }
    );

    const updateField = isCorrect ? "correct_count" : "wrong_count";
    await db.sequelize.query(
      `UPDATE quiz_sessions 
       SET ${updateField} = ${updateField} + 1 
       WHERE id = :sessionId`,
      {
        replacements: { sessionId: session.id },
        transaction: t,
      }
    );
    await updateLearningProgress(userId, question.wordId, isCorrect, t);

    const remainingCount = await QuizQuestion.count({
      where: {
        quizSessionId: session.id,
        userAnswer: null,
      },
      transaction: t,
    });

    if (remainingCount === 0) {
      return handleSessionCompletion(
        session,
        question,
        isCorrect,
        trimmedAnswer,
        t
      );
    }

    const nextQuestion = await getNextQuestion(session.id, t);

    return {
      question: {
        id: question.id,
        userAnswer: trimmedAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
      },
      sessionComplete: false,
      nextQuestion,
      sessionProgress: {
        answeredQuestions: session.totalQuestions - remainingCount,
        totalQuestions: session.totalQuestions,
        correctAnswers: session.correctCount + (isCorrect ? 1 : 0),
        wrongAnswers: session.wrongCount + (isCorrect ? 0 : 1),
        percentage:
          ((session.totalQuestions - remainingCount) / session.totalQuestions) *
          100,
      },
    };
  });

  return res
    .status(httpStatus.OK)
    .json(
      returnSuccess(
        result.sessionComplete
          ? "Answer submitted successfully. Quiz completed!"
          : "Answer submitted successfully.",
        result
      )
    );
});

export const getQuizResult = handleAsyncError(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  const session = await QuizSession.findOne({
    where: {
      id: sessionId,
      userId,
    },
    include: [{ model: QuizQuestion, as: "questions" }],
  });

  if (!session) {
    return res
      .status(httpStatus.NOT_FOUND)
      .json(returnError("Quiz session not found or not completed yet"));
  }

  return res
    .status(httpStatus.OK)
    .json(returnSuccess("Quiz results retrieved successfully", session));
});

////////////////////////////////////////////////////////////////// HELPER FUNCTIONS //////////////////////////////////////////////////////////////////

const updateSpacedRepetitionProgress = (progress, isCorrect) => {
  const intervalLevel = {
    0: [1, 3],
    1: [5, 10],
    2: [14, 21],
    3: [30],
    4: [60],
    5: [90],
  };

  let {
    masteryLevel = 0,
    reviewInterval = 0,
    correctCount = 0,
    wrongCount = 0,
    lastReviewedAt = null,
  } = progress;

  const intervals = intervalLevel[masteryLevel];
  const currentIndex = intervals.findIndex((i) => i === reviewInterval);

  if (isCorrect) {
    correctCount += 1;

    if (currentIndex === -1) {
      reviewInterval = intervals[0];
    } else if (currentIndex < intervals.length - 1) {
      reviewInterval = intervals[currentIndex + 1];
    } else if (masteryLevel < 5) {
      masteryLevel += 1;
      reviewInterval = intervalLevel[masteryLevel][0];
    }
  } else {
    wrongCount += 1;

    if (masteryLevel > 0) {
      masteryLevel -= 1;
    }
    reviewInterval = intervalLevel[masteryLevel][0];
  }

  lastReviewedAt = new Date();
  const nextReviewAt = new Date(
    lastReviewedAt.getTime() + reviewInterval * 24 * 60 * 60 * 1000
  );

  return {
    masteryLevel,
    reviewInterval,
    correctCount,
    wrongCount,
    lastReviewedAt,
    nextReviewAt,
  };
};

const generateDTWQuestion = async (word) => {
  const randomDefinition =
    word.definitions[Math.floor(Math.random() * word.definitions.length)];

  const [distractions] = await db.sequelize.query(
    `
      SELECT JSON_AGG(word) AS "distractions"
      FROM (
          SELECT w.word
          FROM words w
          WHERE w.id != :wordId
          ORDER BY RANDOM()
          LIMIT 10
      ) AS random_words
    `,
    {
      replacements: {
        wordId: word.id,
      },
    }
  );

  const distractionsEntry = distractions[0].distractions;
  const distractionWords = distractionsEntry
    .filter((w) => w !== word.word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const options = [...distractionWords, word.word].sort(
    () => Math.random() - 0.5
  );

  return {
    questionType: "definition_to_word",
    questionText: `Which word matches this definition?\n\n"${randomDefinition.definition}"`,
    correctAnswer: word.word,
    options,
  };
};

const generateWTDQuestion = async (word, userId) => {
  const randomDefinition =
    word.definitions[Math.floor(Math.random() * word.definitions.length)];

  const [distractions] = await db.sequelize.query(
    `    SELECT 
            JSON_AGG(definition) AS "distractions" 
        FROM (
            SELECT 
                wd.definition AS "definition"
            FROM words w 
            JOIN word_definitions wd ON wd.word_id = w.id
            WHERE w.id != :wordId
            ORDER BY RANDOM()
            LIMIT 10
            )
    `,
    {
      replacements: {
        wordId: word.id,
      },
    }
  );

  const distractionsEntry = distractions[0].distractions;

  const distractionDefinitions = distractionsEntry
    .filter((definition) => definition !== randomDefinition.definition)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const options = [randomDefinition.definition, ...distractionDefinitions].sort(
    () => Math.random() - 0.5
  );

  return {
    questionType: "word_to_definition",
    questionText: `What is the correct definition for the word "${word.word}"?`,
    correctAnswer: randomDefinition.definition,
    options,
  };
};

const generateSynonymQuestion = async (word, userId) => {
  if (!word.synonyms || word.synonyms.length === 0) {
    throw new Error(`Word "${word.word}" does not have any synonyms.`);
  }

  const randomSynonym =
    word.synonyms[Math.floor(Math.random() * word.synonyms.length)];

  const [distractions] = await db.sequelize.query(
    `
      SELECT 
        JSON_AGG(word) AS "distractions"
      FROM (
        SELECT
          w.word AS "word"
        FROM word_synonyms ws 
        JOIN words w ON w.id = ws.word_id
        WHERE NOT (ws.word_id = :wordId OR ws.synonymy_id = :wordId)
        ORDER BY RANDOM()
        LIMIT 10 
      ) subquery
  `,
    {
      replacements: {
        wordId: word.id,
      },
    }
  );

  const distractionsEntry = distractions[0].distractions;

  const selectedDistractions = [...new Set(distractionsEntry)]
    .filter((dis) => dis !== randomSynonym)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  if (selectedDistractions.length < 3) {
    throw new Error(
      `Not enough distractions to generate a valid question for word "${word.word}". Required: 3, Found: ${selectedDistractions.length}`
    );
  }

  const options = [randomSynonym, ...selectedDistractions].sort(
    () => Math.random() - 0.5
  );

  return {
    questionType: "synonym",
    questionText: `Which word is a synonym of "${word.word}"?`,
    correctAnswer: randomSynonym,
    options,
  };
};

const generateAntonymQuestion = async (word, userId) => {
  if (!word.antonyms || word.antonyms.length === 0) {
    throw new Error(`Word "${word.word}" does not have any antonyms.`);
  }

  const randomAntonym =
    word.antonyms[Math.floor(Math.random() * word.antonyms.length)];

  const [distractions] = await db.sequelize.query(
    `
      SELECT 
        JSON_AGG(word) AS "distractions"
      FROM (
        SELECT
          w.word AS "word"
        FROM word_antonyms ws 
        JOIN words w ON w.id = ws.word_id
        WHERE NOT (ws.word_id = :wordId OR ws.antonym_id = :wordId)
        ORDER BY RANDOM()
        LIMIT 10 
      ) subquery
    `,
    {
      replacements: {
        wordId: word.id,
      },
    }
  );

  const distractionsEntry = distractions[0].distractions;

  const selectedDistractions = [...new Set(distractionsEntry)]
    .filter((dis) => dis !== randomAntonym && dis !== word.word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  if (selectedDistractions.length < 3) {
    throw new Error(
      `Not enough distractions to generate a valid question for word "${word.word}". Required: 3, Found: ${selectedDistractions.length}`
    );
  }

  const options = [randomAntonym, ...selectedDistractions].sort(
    () => Math.random() - 0.5
  );

  return {
    questionType: "antonym",
    questionText: `Which word is an antonym of "${word.word}"?`,
    correctAnswer: randomAntonym,
    options,
  };
};

const generateFIBQuestion = (word) => {};

const generateMixedQuestion = async (word) => {
  const generators = [
    () => generateDTWQuestion(word),
    () => generateWTDQuestion(word),
    () => generateSynonymQuestion(word),
    () => generateAntonymQuestion(word),
  ];

  const shuffledGenerators = generators.sort(() => Math.random() - 0.5);

  for (const generator of shuffledGenerators) {
    try {
      const question = await generator();
      if (question) return question;
    } catch (error) {
      console.log("Erorr during generator question", error);
    }
  }

  return await generateDTWQuestion(word);
};

const updateLearningProgress = async (
  userId,
  wordId,
  isCorrect,
  transaction
) => {
  const savedWord = await UserSavedWord.findOne({
    where: { userId, wordId },
    include: [{ model: WordLearningProgress, as: "learningProgress" }],
    transaction,
  });

  const progress = savedWord.learningProgress;
  const updatedProgress = updateSpacedRepetitionProgress(
    progress.toJSON(),
    isCorrect
  );
  await progress.update(updatedProgress, { transaction });

  return updatedProgress;
};

const handleSessionCompletion = async (
  session,
  question,
  isCorrect,
  userAnswer,
  transaction
) => {
  const totalAnswered = session.totalQuestions;
  const finalCorrectCount = session.correctCount + (isCorrect ? 1 : 0);
  const finalScore =
    totalAnswered > 0
      ? ((finalCorrectCount / totalAnswered) * 100).toFixed(2)
      : 0;

  await db.sequelize.query(
    `
      UPDATE quiz_sessions
      SET
        ended_at = NOW(),
        score = :finalScore,
        correct_count = :finalCorrectCount,
        wrong_count = :finalWrongCount,
        updated_at = NOW()
      WHERE id = :sessionId
    `,
    {
      replacements: {
        finalScore,
        finalCorrectCount,
        finalWrongCount: totalAnswered - finalCorrectCount,
        sessionId: session.id,
      },
      transaction,
    }
  );

  return {
    question: {
      id: question.id,
      userAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
    },
    sessionComplete: true,
    finalStats: {
      totalQuestions: totalAnswered,
      correctAnswers: finalCorrectCount,
      wrongAnswers: totalAnswered - finalCorrectCount,
      answeredQuestions: totalAnswered,
      percentage: 100,
      score: finalScore,
    },
  };
};

const getNextQuestion = async (sessionId, transaction = null) => {
  const queryOptions = {
    where: {
      quizSessionId: sessionId,
      userAnswer: null,
    },
    order: db.sequelize.random(),
    attributes: [
      "id",
      "quizSessionId",
      "questionType",
      "questionText",
      "options",
      "createdAt",
      "updatedAt",
    ],
  };

  if (transaction) {
    queryOptions.transaction = transaction;
  }

  const nextQuestion = await QuizQuestion.findOne(queryOptions);
  return nextQuestion ? nextQuestion.toJSON() : null;
};
