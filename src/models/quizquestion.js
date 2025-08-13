import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class QuizQuestion extends Model {
    static associate(models) {
      QuizQuestion.belongsTo(models.QuizSession, {
        foreignKey: "quizSessionId",
        as: "quizsession",
      });
      QuizQuestion.belongsTo(models.Word, {
        foreignKey: "wordId",
        as: "word",
      });
    }
  }
  QuizQuestion.init(
    {
      quizSessionId: DataTypes.INTEGER,
      wordId: DataTypes.INTEGER,
      questionType: DataTypes.STRING,
      questionText: DataTypes.TEXT,
      correctAnswer: DataTypes.TEXT,
      userAnswer: DataTypes.TEXT,
      options: DataTypes.JSONB,
      isCorrect: DataTypes.BOOLEAN,
    },
    {
      underscored: true,
      sequelize,
      modelName: "QuizQuestion",
    }
  );
  return QuizQuestion;
};
