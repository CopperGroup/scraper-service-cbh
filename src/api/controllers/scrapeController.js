// src/api/controllers/scrapeController.js
const QueueManager = require('../../core/queueManager');
const ScrapedPathRepository = require('../../db/repositories/scrapedPathRepository'); // Import the repository
const logger = require('../../utils/logger');
const { CustomError, NotFoundError } = require('../../utils/errors'); // For consistent error handling

class ScrapeController {
  /**
   * Handles the POST request to queue new scraping tasks.
   * Expected request body:
   * {
   * websiteId: "externalIdFromAnotherDb",
   * paths: [{ path: "/blog", needsScraping: true }, { path: "/help", needsScraping: false }],
   * baseWebsiteUrl: "https://my-website.com"
   * }
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   * @param {function} next - Express next middleware function.
   */
  static async queueScrapeRequest(req, res, next) {
    const { websiteId, paths, baseWebsiteUrl } = req.body;
    logger.info(`Received scrape request for websiteId: ${websiteId}, baseWebsiteUrl: ${baseWebsiteUrl}`);

    try {
      // Add the request to the queue manager
      const results = await QueueManager.addRequest({ websiteId, paths, baseWebsiteUrl });

      // Respond with the status of each path
      res.status(202).json({
        message: 'Scrape request received and paths are being processed or queued.',
        queuedPaths: results,
        queueSize: QueueManager.getQueueSize()
      });
      logger.info(`Scrape request processed for websiteId: ${websiteId}. Queue size: ${QueueManager.getQueueSize()}`);
    } catch (error) {
      logger.error(`Error in queueScrapeRequest for websiteId ${websiteId}: ${error.message}`);
      // Pass the error to the error handling middleware
      next(new CustomError('Failed to queue scrape request.', 500, 'QUEUE_PROCESSING_ERROR', error));
    }
  }

  /**
   * Handles the GET request to retrieve all path statuses for a given websiteId.
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   * @param {function} next - Express next middleware function.
   */
  static async getWebsitePathStatuses(req, res, next) {
    const { websiteId } = req.params;
    logger.info(`Received request for path statuses for websiteId: ${websiteId}`);

    try {
      const paths = await ScrapedPathRepository.findByWebsiteId(websiteId);

      if (!paths || paths.length === 0) {
        logger.warn(`No paths found for websiteId: ${websiteId}`);
        return next(new NotFoundError(`No paths found for websiteId: ${websiteId}`));
      }

      res.status(200).json({
        websiteId: websiteId,
        paths: paths.map(path => ({
          id: path.id,
          pathName: path.pathName,
          baseUrl: path.baseUrl,
          status: path.status,
          updatedAt: path.updatedAt,
          createdAt: path.createdAt
        }))
      });
      logger.info(`Returned ${paths.length} paths for websiteId: ${websiteId}`);
    } catch (error) {
      logger.error(`Error in getWebsitePathStatuses for websiteId ${websiteId}: ${error.message}`);
      next(new CustomError('Failed to retrieve website path statuses.', 500, 'DB_FETCH_ERROR', error));
    }
  }

  /**
   * Optional: Health check endpoint.
   * @param {object} req - Express request object.
   * @param {object} res - Express response object.
   */
  static healthCheck(req, res) {
    res.status(200).json({ status: 'ok', message: 'Scraper microservice is running.' });
  }
}

module.exports = ScrapeController;