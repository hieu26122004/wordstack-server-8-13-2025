import httpStatus from "http-status";
import passport from "passport";
import { handleAsyncError } from "../utils/async.js";
import { returnError } from "../utils/formatter.js";
import { verifyAT } from "../utils/crypto.js";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dbProm from "../models/index.js";
import redis from "../config/redis.config.js";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} from "../config/app.config.js";

const db = await dbProm;
const { User } = db;

export const authenticate = handleAsyncError(async (req, res, next) => {
  const headerAuth = req.headers.authorization;
  if (!headerAuth || !headerAuth.startsWith("Bearer ")) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json(returnError("Please log in to access this resource"));
  }

  const token = headerAuth.split(" ")[1];

  if (!token) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json(returnError("Please log in to access this resource"));
  }

  const decoded = await verifyAT(token);

  const user = await User.findByPk(decoded.userId);

  if (!user) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json(returnError("User does not exist"));
  }

  req.user = user;
  next();
});

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_REDIRECT_URI,
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        done(null, profile);
      } catch (error) {
        console.error("Error in Google Strategy:", error);
        return done(error, null);
      }
    }
  )
);

export const cache = (keyGenerator, defaultTtl = 3600) => {
  return async (req, res, next) => {
    const key = keyGenerator(req);

    try {
      const cachedData = await redis.get(key);

      if (cachedData) {
        return res.status(httpStatus.OK).json(JSON.parse(cachedData));
      }

      res._cache = async (data, ttl = defaultTtl) => {
        await redis.set(key, JSON.stringify(data), "EX", ttl);
        return res.status(httpStatus.OK).json(data);
      };

      next();
    } catch (error) {
      console.error("There was an error during cache:", error.message);
      next();
    }
  };
};
