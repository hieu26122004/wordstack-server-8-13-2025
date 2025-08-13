import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class WordSynonym extends Model {
    static associate(models) {
      WordSynonym.belongsTo(models.Word, {
        foreignKey: "wordId",
        as: "word",
      });
      WordSynonym.belongsTo(models.Word, {
        foreignKey: "synonymyId",
        as: "wordSynonym",
      });
    }
  }
  WordSynonym.init(
    {
      wordId: DataTypes.INTEGER,
      synonymyId: DataTypes.INTEGER,
    },
    {
      underscored: true,
      sequelize,
      modelName: "WordSynonym",
    }
  );
  return WordSynonym;
};
