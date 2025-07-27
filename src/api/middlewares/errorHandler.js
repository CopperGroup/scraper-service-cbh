// src/api/middlewares/errorHandler.js
const logger = require('../../utils/logger');
const { CustomError } = require('../../utils/errors');

/**
 * Centralized error handling middleware.
 * @param {Error} err - The error object.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next middleware function.
 */
const errorHandler = (err, req, res, next) => {
  // Log the error details
  logger.error(`Error caught by error handler: ${err.message}`, {
    stack: err.stack,
    statusCode: err.statusCode || 500,
    errorCode: err.errorCode || 'INTERNAL_SERVER_ERROR',
    requestUrl: req.originalUrl,
    requestMethod: req.method,
    requestBody: req.body // Be careful with sensitive data here
  });

  // Determine status code and error message based on error type
  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred.';
  let details = err.details || undefined; // For validation errors

  // If it's not a custom error, treat it as a generic server error
  if (!(err instanceof CustomError)) {
    statusCode = 500;
    errorCode = 'INTERNAL_SERVER_ERROR';
    message = 'An unexpected server error occurred.';
    details = undefined;
  }

  // Send the error response
  res.status(statusCode).json({
    status: 'error',
    code: errorCode,
    message: message,
    details: details
  });
};

module.exports = errorHandler;