const express = require('express');
const { validate } = require('../middlewares/validationMiddleware');
// Import the specific schema directly to ensure it's loaded
const { scrapeRequestSchema, websiteIdParamSchema } = require('../validators/scrapeRequestValidator');
const ScrapeController = require('../controllers/scrapeController');
const { ValidationError } = require('../../utils/errors'); // Import ValidationError directly

const router = express.Router();

// Route to queue a new scrape request (POST /api/scrape-queue)
router.post('/scrape-queue', validate(scrapeRequestSchema), ScrapeController.queueScrapeRequest);

// Route to get all path statuses for a given website ID (GET /api/website-paths/:websiteId)
router.get(
  '/website-paths/:websiteId',
  (req, res, next) => {
    // Validate req.params specifically for websiteId
    // Use websiteIdParamSchema directly
    const { error, value } = websiteIdParamSchema.validate(req.params, { // This line is causing the error
      abortEarly: false,
      allowUnknown: false
    });
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return next(new ValidationError('Invalid websiteId parameter.', errors));
    }
    req.params = value; // Assign validated params back
    next();
  },
  ScrapeController.getWebsitePathStatuses
);

// Health check route (GET /api/health)
router.get('/health', ScrapeController.healthCheck);

module.exports = router;