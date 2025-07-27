// src/utils/errors.js

/**
 * Base custom error class.
 */
class CustomError extends Error {
    constructor(message, statusCode = 500, errorCode = 'INTERNAL_SERVER_ERROR') {
      super(message);
      this.name = this.constructor.name; // Set the name of the error to the class name
      this.statusCode = statusCode;
      this.errorCode = errorCode;
      Error.captureStackTrace(this, this.constructor); // Capture stack trace
    }
  }
  
  /**
   * Error specifically for issues during the scraping process.
   */
  class ScrapingError extends CustomError {
    constructor(message = 'Failed to scrape the page.', originalError = null) {
      super(message, 500, 'SCRAPING_FAILED');
      this.originalError = originalError;
    }
  }
  
  /**
   * Error for issues when communicating with external services (AI, Main Service).
   */
  class ServiceError extends CustomError {
    constructor(serviceName, message = `Failed to communicate with ${serviceName}.`, originalError = null) {
      super(message, 502, 'EXTERNAL_SERVICE_ERROR'); // 502 Bad Gateway for upstream service errors
      this.serviceName = serviceName;
      this.originalError = originalError;
    }
  }
  
  /**
   * Error for invalid input data (e.g., from API requests).
   */
  class ValidationError extends CustomError {
    constructor(message = 'Invalid input data.', details = []) {
      super(message, 400, 'VALIDATION_ERROR'); // 400 Bad Request for validation errors
      this.details = details; // Array of validation errors
    }
  }
  
  /**
   * Error for when a resource is not found.
   */
  class NotFoundError extends CustomError {
    constructor(message = 'Resource not found.') {
      super(message, 404, 'NOT_FOUND');
    }
  }
  
  module.exports = {
    CustomError,
    ScrapingError,
    ServiceError,
    ValidationError,
    NotFoundError
  };