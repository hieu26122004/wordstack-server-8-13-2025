import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Word extends Model {
    static associate(models) {
      Word.hasMany(models.WordDefinition, {
        foreignKey: "wordId",
        as: "definitions",
      });
      Word.hasMany(models.WordSynonym, {
        foreignKey: "wordId",
        as: "synonyms",
      });
      Word.hasMany(models.WordAntonym, {
        foreignKey: "wordId",
        as: "antonyms",
      });
    }
  }
  Word.init(
    {
      word: DataTypes.STRING,
      phonetic: DataTypes.STRING,
      pronunciationUrl: DataTypes.TEXT,
    },
    {
      underscored: true,
      sequelize,
      modelName: "Word",
    }
  );
  return Word;
};
