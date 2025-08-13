import dotenv from "dotenv";
dotenv.config();

// App Configuration
export const APP_NAME = process.env.APP_NAME;
export const PORT = process.env.PORT || 3000;
export const ENV = process.env.NODE_ENV || "development";
export const CLIENT_URI = process.env.CLIENT_URI || "http://localhost:5173";

// JWT Configuration
export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
export const JWT_ACCESS_EXPIRES_IN =
  Number(process.env.JWT_ACCESS_EXPIRES_IN) || 900000;
export const JWT_REFRESH_EXPIRES_IN =
  Number(process.env.JWT_REFRESH_EXPIRES_IN) || 604800000;
export const SESSION_SECRET = process.env.SESSION_SECRET;

// Database Configuration
export const DB_USER = process.env.DB_USER;
export const DB_PASS = process.env.DB_PASS;
export const DB_NAME = process.env.DB_NAME;
export const DB_HOST = process.env.DB_HOST;
export const DB_PORT = process.env.DB_PORT;

// Third-party APIs
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
export const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Gemini Configuration
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Redis Configuration
export const REDIS_HOST = process.env.REDIS_HOST;
export const REDIS_PORT = process.env.REDIS_PORT;
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

export const WORDS_API_KEY = process.env.WORDS_API_KEY;
export const MERRIAM_WEBSTER_API_KEY = process.env.MERRIAM_WEBSTER_API_KEY;
