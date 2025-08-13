import httpStatus from "http-status";
import { returnError } from "./formatter.js";

export const handleAsyncError = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      console.log("Caught error >>>>>", err);
      return res
        .status(httpStatus.INTERNAL_SERVER_ERROR)
        .json(returnError("Something went wrong"));
    });
  };
};
