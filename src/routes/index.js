import express from "express";
import authRouter from "./auth.router.js";
import wordRouter from "./word.router.js";
import quizRouter from "./quiz.router.js";
import userRouter from "./user.router.js";

const router = express.Router();

const routers = [
  { prefix: "/auth", handler: authRouter },
  { prefix: "/word", handler: wordRouter },
  { prefix: "/quiz", handler: quizRouter },
  { prefix: "/user", handler: userRouter },
];

routers.forEach((r) => router.use(r.prefix, r.handler));

export default router;
