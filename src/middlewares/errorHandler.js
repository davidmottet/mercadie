import config from '../../config/default.js';

const handleErrors = (err, _req, res) => {
  const statusCode = err.statusCode || 500;

  const message = err.message || "An unexpected error occurred";

  const errorDetails =
    config.app.environment === "development"
      ? {
        stack: err.stack,
        error: err,
      }
      : undefined;

  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    ...(errorDetails && { details: errorDetails }),
  });

  console.error(`[Error] ${message}`, err);
};

const handle404 = (_req, res) => {
  res.status(404).json({
    status: "error",
    statusCode: 404,
    message: "Resource not found",
  });
};

export { handleErrors, handle404 };