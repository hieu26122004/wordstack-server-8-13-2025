import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class UserSavedWord extends Model {
    static associate(models) {
      UserSavedWord.belongsTo(models.Word, {
        foreignKey: "wordId",
        as: "word",
      });
      UserSavedWord.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });
      UserSavedWord.hasOne(models.WordLearningProgress, {
        foreignKey: "userSavedWordId",
        as: "learningProgress",
      });
    }
  }
  UserSavedWord.init(
    {
      userId: DataTypes.INTEGER,
      wordId: DataTypes.INTEGER,
      notes: DataTypes.TEXT,
    },
    {
      underscored: true,
      sequelize,
      modelName: "UserSavedWord",
    }
  );
  return UserSavedWord;
};
