import httpStatus from "http-status";
import passport from "passport";
import { Op } from "sequelize";
import { returnError, returnSuccess } from "../utils/formatter.js";
import { handleAsyncError } from "../utils/async.js";
import dbProm from "../models/index.js";
import {
  hashPassword,
  comparePassword,
  generateAuthToken,
  isValidRT,
  generateAT,
  revokeRT,
} from "../utils/crypto.js";
import {
  ENV,
  JWT_REFRESH_EXPIRES_IN,
  CLIENT_URI,
} from "../config/app.config.js";

const db = await dbProm;
const { User } = db;

export const register = handleAsyncError(async (req, res) => {
  const { email, password, username } = req.body;

  let user = await User.findOne({
    where: {
      [Op.or]: [{ email }, { username }],
    },
  });

  if (user) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json(
        returnError(
          user.email === email
            ? "Email is already in use."
            : "Username is already taken."
        )
      );
  }

  const hashedPassword = await hashPassword(password);
  user = await User.create({
    email,
    password: hashedPassword,
    username,
    lastLoginAt: Date.now(),
    isActive: true,
  });

  user = user.toJSON();
  delete user.password;

  return res
    .status(httpStatus.CREATED)
    .json(returnSuccess("Registration successful.", user));
});

export const login = handleAsyncError(async (req, res) => {
  const { email, password } = req.body;

  let user = await User.findOne({ where: { email } });

  if (!user) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json(returnError("Invalid email or password."));
  }
  if (!user.password) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json(
        returnError(
          "This account was registered with Google. Please sign in with Google."
        )
      );
  }

  const isMatching = await comparePassword(password, user.password);
  if (!isMatching) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json(returnError("Invalid email or password."));
  }

  user = user.toJSON();
  delete user.password;

  const { at, rt } = await generateAuthToken(
    user.id,
    req.headers["user-agent"],
    req.ip
  );

  res.cookie("rt", rt, {
    httpOnly: true,
    secure: ENV === "production",
    maxAge: JWT_REFRESH_EXPIRES_IN,
    sameSite: "strict",
  });

  return res
    .status(httpStatus.OK)
    .json(returnSuccess("Login successful.", { at, user }));
});

export const refreshToken = handleAsyncError(async (req, res) => {
  const { rt } = req.cookies;

  console.log("rt", rt);

  if (!rt) {
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json(returnError("Refresh token is missing."));
  }

  try {
    const { userId } = await isValidRT(rt);
    const at = generateAT({ userId });

    return res
      .status(httpStatus.OK)
      .json(returnSuccess("Token refreshed.", at));
  } catch (err) {
    console.log("err", err);
    res.clearCookie("rt");
    return res
      .status(httpStatus.UNAUTHORIZED)
      .json(returnError("Invalid or expired refresh token."));
  }
});

export const loginWithGoogle = handleAsyncError(async (req, res, next) => {
  passport.authenticate(
    "google",
    { session: false },
    async (err, user, info) => {
      if (err || !user) {
        return res
          .status(httpStatus.UNAUTHORIZED)
          .json(returnError("Google authentication failed."));
      }

      let userINST = await User.findOne({
        where: {
          [Op.or]: [{ email: user.emails[0].value }, { googleId: user.id }],
        },
      });
      if (!userINST) {
        userINST = await User.create({
          email: user.emails[0].value,
          username: user.displayName,
          googleId: user.id,
          avatarUrl: user.photos?.[0]?.value,
          lastLoginAt: Date.now(),
          isActive: true,
        });
      }

      userINST = userINST.toJSON();
      delete userINST.password;

      const { at, rt } = await generateAuthToken(
        userINST.id,
        req.headers["user-agent"],
        req.ip
      );

      res.cookie("rt", rt, {
        httpOnly: true,
        secure: ENV === "production",
        maxAge: JWT_REFRESH_EXPIRES_IN,
        sameSite: "strict",
      });
      res.send(`
        <!DOCTYPE html>
        <html>
          <body>
            <script>
              window.opener.postMessage(${JSON.stringify({
                at,
                user: userINST,
              })}, "${CLIENT_URI}");
      
              window.close(); 
            </script>
          </body>
        </html>
      `);
    }
  )(req, res, next);
});

export const logout = handleAsyncError(async (req, res) => {
  const { rt } = req.cookies;

  res.clearCookie("rt", {
    httpOnly: true,
    secure: ENV === "production",
    sameSite: "strict",
  });

  if (rt) {
    await revokeRT(rt);
  }

  return res.status(httpStatus.OK).json(returnSuccess("Logout successful."));
});
