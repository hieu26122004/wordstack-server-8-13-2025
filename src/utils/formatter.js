export const toCamelCase = (str) =>
  str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export const ObjToCamelCase = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [toCamelCase(k), v]));

export const returnSuccess = (message = "Success", data, meta = null) => ({
  status: "success",
  success: true,
  message,
  data,
  ...(meta && { meta }),
});

export const returnError = (message = "Error", meta = null) => ({
  status: "error",
  success: false,
  message,
  ...(meta && { meta }),
});

export const returnPagination = (message = "Success", data, pagination) => {
  const { count = 0, page = 1, limit = 10 } = pagination;

  const totalPages = Math.ceil(count / limit);
  const currentPage = Number(page);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  return {
    status: "success",
    success: true,
    message,
    data,
    meta: {
      totalItems: count,
      totalPages,
      currentPage,
      limit: Number(limit),
      hasNextPage,
      hasPrevPage,
    },
  };
};

export const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};
