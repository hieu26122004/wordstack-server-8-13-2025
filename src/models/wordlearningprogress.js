import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class WordLearningProgress extends Model {
    static associate(models) {
      WordLearningProgress.belongsTo(models.UserSavedWord, {
        foreignKey: "userSavedWordId",
        as: "userSavedWord",
      });
    }
  }
  WordLearningProgress.init(
    {
      userSavedWordId: DataTypes.INTEGER,
      masteryLevel: DataTypes.INTEGER,
      correctCount: DataTypes.INTEGER,
      wrongCount: DataTypes.INTEGER,
      lastReviewedAt: DataTypes.DATE,
      nextReviewAt: DataTypes.DATE,
      reviewInterval: DataTypes.INTEGER,
    },
    {
      underscored: true,
      sequelize,
      modelName: "WordLearningProgress",
      tableName: "word_learning_progresses",
    }
  );
  return WordLearningProgress;
};
