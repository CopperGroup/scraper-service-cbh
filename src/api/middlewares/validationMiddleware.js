// src/api/middlewares/validationMiddleware.js
const { ValidationError } = require('../../utils/errors');
const logger = require('../../utils/logger');

/**
 * Middleware to validate request body against a Joi schema.
 * @param {Joi.ObjectSchema} schema - The Joi schema to validate against.
 * @returns {function} Express middleware function.
 */
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false, // Collect all errors, not just the first one
    allowUnknown: false // Disallow unknown keys
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    logger.warn(`Validation error: ${JSON.stringify(errors)}`);
    return next(new ValidationError('Invalid request payload.', errors));
  }

  // If validation passes, replace req.body with the validated value (which might have defaults applied)
  req.body = value;
  next();
};

module.exports = { validate };