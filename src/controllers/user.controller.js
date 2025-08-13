import httpStatus from "http-status";
import bcrypt from "bcrypt";
import dbProm from "../models/index.js";
import { handleAsyncError } from "../utils/async.js";
import { returnError, returnSuccess } from "../utils/formatter.js";
import { comparePassword, hashPassword } from "../utils/crypto.js";

const db = await dbProm;
const { User } = db;

export const getUserProfile = handleAsyncError(async (req, res) => {
  const userId = req.user.id;

  const user = await User.findByPk(userId, {
    attributes: [
      "id",
      "username",
      "email",
      "avatarUrl",
      "isAdmin",
      "isActive",
      "lastLoginAt",
      "createdAt",
      "updatedAt",
    ],
  });

  if (!user) {
    return res.status(httpStatus.NOT_FOUND).json(returnError("User not found"));
  }

  return res
    .status(httpStatus.OK)
    .json(returnSuccess("User profile retrieved successfully", user));
});

export const updateUserProfile = handleAsyncError(async (req, res) => {
  const userId = req.user.id;
  const { username, currentPassword, newPassword } = req.body;

  const user = await User.findByPk(userId, {
    attributes: ["id", "username", "email", "password"],
  });

  if (!user) {
    return res.status(httpStatus.NOT_FOUND).json(returnError("User not found"));
  }

  const updateData = {};
  let requiresPasswordAuth = false;

  if (username) {
    const existingUser = await User.findOne({
      where: {
        id: {
          [db.Sequelize.Op.ne]: userId,
        },
        username,
      },
    });

    if (existingUser) {
      return res
        .status(httpStatus.CONFLICT)
        .json(returnError("Username already exists"));
    }
    updateData.username = username;
    requiresPasswordAuth = true;
  }

  if (newPassword) {
    if (!user.password) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json(
          returnError(
            "Cannot update password for social login accounts. Please use your social provider to change your password."
          )
        );
    }
    const isSamePassword = await comparePassword(newPassword, user.password);

    if (isSamePassword) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json(
          returnError("New password must be different from current password")
        );
    }

    const hashedNewPassword = await hashPassword(newPassword);
    updateData.password = hashedNewPassword;
    requiresPasswordAuth = true;
  }

  if (requiresPasswordAuth && user.password) {
    if (!currentPassword) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json(returnError("Current password is required for this operation"));
    }

    const isCurrentPasswordValid = await comparePassword(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json(returnError("Current password is incorrect"));
    }
  }

  const [updatedRowsCount] = await User.update(updateData, {
    where: { id: userId },
  });

  if (updatedRowsCount === 0) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json(returnError("Failed to update user credentials"));
  }

  let message = "Credentials updated successfully";
  if (username && newPassword) {
    message = "Username and password updated successfully";
  } else if (username) {
    message = "Username updated successfully";
  } else if (newPassword) {
    message = "Password updated successfully";
  }

  const updatedUser = await User.findByPk(userId, {
    attributes: [
      "id",
      "username",
      "email",
      "avatarUrl",
      "isAdmin",
      "isActive",
      "lastLoginAt",
      "createdAt",
      "updatedAt",
    ],
  });

  return res.status(httpStatus.OK).json(returnSuccess(message, updatedUser));
});

export const getUserStats = handleAsyncError(async (req, res) => {
  const userId = req.user.id;

  const [monthlyStats] = await db.sequelize.query(
    `
      WITH months AS (
        SELECT generate_series(1, 12) AS month
      ),
      stats AS (
        SELECT
          DATE_PART('month', usw.created_at)::INT AS month,
          COUNT(usw.id) AS "totalSavedWords",
          COUNT(CASE WHEN wlp.mastery_level >= 1 THEN 1 END) AS "startedWords",
          COUNT(CASE WHEN wlp.mastery_level >= 3 THEN 1 END) AS "intermediateWords",
          COUNT(CASE WHEN wlp.mastery_level >= 5 THEN 1 END) AS "masteredWords",
          ROUND(COALESCE(AVG(wlp.mastery_level), 0), 2) AS "averageMasteryLevel"
        FROM user_saved_words usw
        LEFT JOIN word_learning_progresses wlp 
          ON wlp.user_saved_word_id = usw.id
        WHERE usw.user_id = :userId
          AND DATE_PART('year', usw.created_at) = DATE_PART('year', NOW())
        GROUP BY DATE_PART('month', usw.created_at)
      )
      SELECT 
        TRIM(TO_CHAR(DATE_TRUNC('year', NOW()) + (m.month - 1) * INTERVAL '1 month', 'Month')) AS month,
        COALESCE(s."totalSavedWords", 0)::INT AS "totalSavedWords",
        COALESCE(s."startedWords", 0)::INT AS "startedWords",
        COALESCE(s."intermediateWords", 0)::INT AS "intermediateWords",
        COALESCE(s."masteredWords", 0)::INT AS "masteredWords",
        COALESCE(s."averageMasteryLevel", 0)::INT AS "averageMasteryLevel"
      FROM months m
      LEFT JOIN stats s 
        ON s.month = m.month
      ORDER BY m.month;
   
    `,
    {
      replacements: {
        userId,
      },
    }
  );

  const [wordStats] = await db.sequelize.query(
    `
      SELECT
        COUNT(usw.id)::INT AS "totalSavedWords",
        COUNT(CASE WHEN wlp.mastery_level >= 1 THEN 1 END)::INT AS "wordsReviewed"
      FROM user_saved_words usw
      LEFT JOIN word_learning_progresses wlp ON wlp.user_saved_word_id = usw.id
      WHERE usw.user_id = :userId
    `,
    { replacements: { userId } }
  );

  const learningStats = {
    totalSavedWords: wordStats[0].totalSavedWords,
    wordsReviewed: wordStats[0].wordsReviewed,
    monthlyStats,
  };

  return res
    .status(httpStatus.OK)
    .json(
      returnSuccess("Learning statistics retrieved successfully", learningStats)
    );
});
