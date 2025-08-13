import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class WordDefinition extends Model {
    static associate(models) {
      WordDefinition.belongsTo(models.Word, {
        foreignKey: "wordId",
        as: "word",
      });
      WordDefinition.hasMany(models.WordExample, {
        foreignKey: "wordDefinitionId",
        as: "examples",
      });
    }
  }
  WordDefinition.init(
    {
      definition: DataTypes.TEXT,
      partOfSpeech: DataTypes.STRING,
      wordId: DataTypes.TEXT,
    },
    {
      underscored: true,
      sequelize,
      modelName: "WordDefinition",
    }
  );
  return WordDefinition;
};
