import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class WordAntonym extends Model {
    static associate(models) {
      WordAntonym.belongsTo(models.Word, {
        foreignKey: "wordId",
        as: "word",
      });
      WordAntonym.belongsTo(models.Word, {
        foreignKey: "antonymId",
        as: "wordAntonym",
      });
    }
  }
  WordAntonym.init(
    {
      wordId: DataTypes.INTEGER,
      antonymId: DataTypes.INTEGER,
    },
    {
      underscored: true,
      sequelize,
      modelName: "WordAntonym",
    }
  );
  return WordAntonym;
};
