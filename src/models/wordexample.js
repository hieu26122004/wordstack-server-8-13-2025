import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class WordExample extends Model {
    static associate(models) {
      WordExample.belongsTo(models.WordDefinition, {
        foreignKey: "wordDefinitionId",
        as: "wordDefinition",
      });
    }
  }
  WordExample.init(
    {
      exampleText: DataTypes.TEXT,
      translation: DataTypes.TEXT,
      wordDefinitionId: DataTypes.INTEGER,
    },
    {
      underscored: true,
      sequelize,
      modelName: "WordExample",
    }
  );
  return WordExample;
};
