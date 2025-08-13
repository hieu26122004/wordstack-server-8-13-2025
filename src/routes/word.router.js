import express from "express";
import * as wordController from "../controllers/word.controller.js";
import {
  createWordValidator,
  bulkCreateWordValidator,
} from "../utils/validator.js";
import { authenticate, cache } from "../middlewares/app.middleware.js";
import { getGetWordsKey } from "../utils/keys.js";

const router = express.Router();

router.post("/", authenticate, createWordValidator, wordController.createWord);

router.post(
  "/bulk-create",
  authenticate,
  bulkCreateWordValidator,
  wordController.bulkCreateWord
);

router.get(
  "",
  authenticate,
  cache((req) => getGetWordsKey(req.user.id, req.originalUrl)),
  wordController.gethWords
);

router.post("/:wordId/save", authenticate, wordController.saveWord);

router.delete("/:wordId/unsave", authenticate, wordController.unsaveWord);

router.get("/statistics", authenticate, wordController.getSavedWordsStats);

export default router;
