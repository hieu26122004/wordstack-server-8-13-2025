import express from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import httpStatus from "http-status";
import { ENV, CLIENT_URI } from "./config/app.config.js";
import routes from "./routes/index.js";
import "./middlewares/app.middleware.js";

const app = express();

if (ENV === "development") {
  app.use(morgan("dev"));
}

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: CLIENT_URI,
    credentials: true,
  })
);

app.use("/api/v1", routes);

app.all(/(.*)/, (req, res) => {
  res.status(httpStatus.NOT_FOUND).json({
    status: false,
    code: httpStatus.NOT_FOUND,
    message: `Can't find ${req.originalUrl} on this server!`,
  });
});

export default app;
