const handleErrors = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    
    const message = err.message || "An unexpected error occurred";
    
    const errorDetails =
      process.env.NODE_ENV === "development"
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
  
  const handle404 = (req, res, next) => {
    res.status(404).json({
      status: "error",
      statusCode: 404,
      message: "Resource not found",
    });
  };
  
  module.exports = { handleErrors, handle404 };
  