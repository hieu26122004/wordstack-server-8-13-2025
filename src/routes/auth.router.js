import express from "express";
import passport from "passport";
import * as authController from "../controllers/auth.controller.js";
import { loginValidator, registerValidator } from "../utils/validator.js";
import { authenticate } from "../middlewares/app.middleware.js";

const router = express.Router();

router
  .post("/register", registerValidator, authController.register)
  .post("/login", loginValidator, authController.login)
  .post("/refresh-token", authController.refreshToken)
  .post("/logout", authenticate, authController.logout)
  .get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  )
  .get("/oauth2/redirect/google", authController.loginWithGoogle);
//auth.loginWithGoogle

export default router;
