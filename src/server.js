import http from "http";
import app from "./app.js";
import { PORT } from "./config/app.config.js";
import dbProm from "./models/index.js";
import redis from "./config/redis.config.js";

const db = await dbProm;

const server = http.createServer(app);

db.sequelize
  .authenticate()
  .then(() => {
    console.log("✅ Database connection established successfully.");
  })
  .catch((error) => {
    console.error("❌ Unable to connect to the database:", error);
  });

redis.on("connect", () => {
  console.log("✅ Redis connection established successfully.");
});

redis.on("error", (error) => {
  console.log("❌ Unable to connect to the database:", error);
});

server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
