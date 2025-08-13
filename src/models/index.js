import fs from "fs";
import path, { basename } from "path";
import Sequelize from "sequelize";
import { fileURLToPath } from "url";
import { pathToFileURL } from "url";
import { ENV } from "../config/app.config.js";
import database from "../config/database.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const currentFile = basename(__filename);

const config = database[ENV];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

const files = fs
  .readdirSync(__dirname)
  .filter(
    (file) =>
      file.indexOf(".") !== 0 &&
      file !== currentFile &&
      file.slice(-3) === ".js" &&
      file.indexOf(".test.js") === -1
  );

const loadModels = async () => {
  for (const file of files) {
    const filePath = path.join(__dirname, file);
    const fileUrl = pathToFileURL(filePath).href;
    const modelImport = await import(fileUrl);
    const model = modelImport.default(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  }
  Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });

  db.sequelize = sequelize;
  db.Sequelize = Sequelize;

  return db;
};

const dbPromise = loadModels();

export default dbPromise;
