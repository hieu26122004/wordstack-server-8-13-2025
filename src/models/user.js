import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
  }
  User.init(
    {
      username: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      avatarUrl: DataTypes.TEXT,
      googleId: DataTypes.STRING,
      isAdmin: DataTypes.BOOLEAN,
      isActive: DataTypes.BOOLEAN,
      lastLoginAt: DataTypes.DATE,
    },
    {
      underscored: true,
      sequelize,
      modelName: "User",
    }
  );
  return User;
};
