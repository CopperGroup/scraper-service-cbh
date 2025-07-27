const Joi = require('joi');

// Custom Joi extension for MongoDB ObjectId validation
// Define it immediately with Joi.extend
const JoiObjectId = Joi.extend((joi) => ({
  type: 'objectId',
  base: joi.string(),
  messages: {
    'objectId.invalid': '{{#label}} must be a valid MongoDB ObjectId',
  },
  validate(value, helpers) {
    // MongoDB ObjectId is a 24-character hexadecimal string
    if (!/^[0-9a-fA-F]{24}$/.test(value)) {
      return helpers.error('objectId.invalid');
    }
    return value;
  },
}));

// Main schema for the scrape request payload (for POST /scrape-queue)
const scrapeRequestSchema = Joi.object({
  websiteId: JoiObjectId.string() // Use custom ObjectId validation
    .required()
    .messages({
      'any.required': 'websiteId is required.',
    }),
  paths: Joi.array()
    .items(Joi.object({ // Define pathSchema inline or ensure it's defined before use
      path: Joi.string()
        .pattern(/^\/[a-zA-Z0-9\-_./]*$/) // Basic regex for a path, adjust as needed
        .required()
        .messages({
          'string.pattern.base': 'Path must start with / and contain valid URL characters.',
          'string.empty': 'Path cannot be empty.',
          'any.required': 'Path is required.'
        }),
      needsScraping: Joi.boolean()
        .required()
        .messages({
          'boolean.base': 'needsScraping must be a boolean.',
          'any.required': 'needsScraping is required.'
        })
    }))
    .min(1) // At least one path must be provided
    .required()
    .messages({
      'array.base': 'Paths must be an array.',
      'array.min': 'At least one path is required.',
      'any.required': 'Paths are required.'
    }),
  baseWebsiteUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] }) // Ensure it's a valid HTTP/HTTPS URL
    .required()
    .messages({
      'string.uri': 'baseWebsiteUrl must be a valid URL.',
      'string.empty': 'baseWebsiteUrl cannot be empty.',
      'any.required': 'baseWebsiteUrl is required.'
    })
});

// Schema for validating websiteId from URL parameters (for GET /website-paths/:websiteId)
const websiteIdParamSchema = Joi.object({ // Wrap in Joi.object for req.params validation
  websiteId: JoiObjectId.string() // Use custom ObjectId validation
    .required()
    .messages({
      'any.required': 'websiteId in URL is required.',
    }),
});


module.exports = {
  scrapeRequestSchema,
  websiteIdParamSchema
};