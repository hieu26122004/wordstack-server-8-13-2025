import express from "express";
import { authenticate } from "../middlewares/app.middleware.js";
import {
  createQuizSessionValidator,
  submitAnswerValidator,
} from "../utils/validator.js";
import * as quizController from "../controllers/quiz.controller.js";

const router = express.Router();

router.post(
  "/",
  createQuizSessionValidator,
  authenticate,
  quizController.createQuizSession
);

router.get(
  "/:sessionId/question/:questionId",
  authenticate,
  quizController.getQuestion
);

router.delete(
  "/:sessionId/cancel",
  authenticate,
  quizController.cancelQuizSession
);

router.post(
  "/:sessionId/question/:questionId/check-answer",
  submitAnswerValidator,
  authenticate,
  quizController.submitAnswer
);

router.get("/:sessionId/result", authenticate, quizController.getQuizResult);

export default router;
