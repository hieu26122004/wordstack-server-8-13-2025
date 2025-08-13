import express from "express";
import { authenticate } from "../middlewares/app.middleware.js";
import { updateUserProfileValidator } from "../utils/validator.js";
import * as userController from "../controllers/user.controller.js";

const router = express.Router();

router.get("/me", authenticate, userController.getUserProfile);

router.patch(
  "/me",
  authenticate,
  updateUserProfileValidator,
  userController.updateUserProfile
);

router.get("/me/learning-stats", authenticate, userController.getUserStats);

export default router;
