import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import redis from "../config/redis.config.js";
import { getRTKey } from "./keys.js";
import {
  JWT_ACCESS_EXPIRES_IN,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_EXPIRES_IN,
  JWT_REFRESH_SECRET,
} from "../config/app.config.js";

export const hashPassword = (password, salt = 10) =>
  bcrypt.hash(password, salt);

export const comparePassword = (password, hashedPassword) =>
  bcrypt.compare(password, hashedPassword);

export const generateAT = (payload) =>
  jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN });

export const verifyAT = (token) =>
  new Promise((resolve, reject) => {
    jwt.verify(token, JWT_ACCESS_SECRET, (err, decoded) => {
      if (err) {
        reject(
          new Error("Token is invalid or has expired. Please log in again.")
        );
      } else {
        resolve(decoded);
      }
    });
  });

export const generateRT = (payload) =>
  jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN });

export const verifyRT = (token) =>
  new Promise((resolve, reject) => {
    jwt.verify(token, JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) {
        reject(
          new Error("Token is invalid or has expired. Please log in again.")
        );
      } else {
        resolve(decoded);
      }
    });
  });

export const saveRT = async (token, data) => {
  await redis.hset(getRTKey(token), data);
  await redis.expire(
    getRTKey(token),
    Math.floor(JWT_REFRESH_EXPIRES_IN / 1000)
  );
};

export const isValidRT = async (token) => {
  try {
    const decoded = await verifyRT(token);
    const exists = await redis.exists(getRTKey(token));
    if (!exists) throw new Error("Refresh token was revoked");
    return decoded;
  } catch (error) {
    throw new Error("Refresh token is invalid or expired");
  }
};

export const revokeRT = async (token) => redis.del(getRTKey(token));

export const generateAuthToken = async (userId, userAgent, ipAddress) => {
  const rt = generateRT({ userId });
  const at = generateAT({ userId, userAgent, ipAddress });
  await saveRT(rt, { userId, userAgent, ipAddress });
  return { rt, at };
};
