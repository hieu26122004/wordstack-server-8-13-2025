import { APP_NAME } from "../config/app.config.js";

export const getRTKey = (rt) => `${APP_NAME}:refresh-tokens:${rt}`;

export const getGetWordsKey = (userId, url) =>
  `${APP_NAME}:get-words:user-${userId}:${url}`;
