import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class QuizSession extends Model {
    static associate(models) {
      QuizSession.hasMany(models.QuizQuestion, {
        foreignKey: "quizSessionId",
        as: "questions",
      });
      QuizSession.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });
    }
  }
  QuizSession.init(
    {
      userId: DataTypes.INTEGER,
      totalQuestions: DataTypes.INTEGER,
      correctCount: DataTypes.INTEGER,
      wrongCount: DataTypes.INTEGER,
      score: DataTypes.DECIMAL(5, 2),
      quizType: DataTypes.STRING,
      endedAt: DataTypes.DATE,
    },
    {
      underscored: true,
      sequelize,
      modelName: "QuizSession",
    }
  );
  return QuizSession;
};
