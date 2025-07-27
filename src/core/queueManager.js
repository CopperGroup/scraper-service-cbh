// src/core/queueManager.js
const Processor = require('./processor');
const ScrapedPathRepository = require('../db/repositories/scrapedPathRepository');
const logger = require('../utils/logger');
const { SCRAPE_STATUS } = require('../utils/constants');

// Simple in-memory queue
// Changed from `const` to `let` to allow reassignment for testing purposes
let scrapeQueue = [];
let isProcessing = false;
let processingInterval = null;

class QueueManager {
  /**
   * Adds a new scrape request to the queue.
   * Before adding, it checks if a similar request (websiteId, pathName, baseUrl)
   * already exists in the database and is not yet 'scraped' or 'failed'.
   * If it exists and is 'queued' or 'scraping', it won't add a duplicate.
   * If it exists and is 'failed', it will re-queue it.
   * @param {object} requestData - The incoming request object from the API.
   * @param {string} requestData.websiteId
   * @param {Array<object>} requestData.paths - [{ path: "/blog", needsScraping: true }]
   * @param {string} requestData.baseWebsiteUrl
   * @returns {Promise<Array<object>>} An array of objects indicating which paths were queued or updated.
   */
  static async addRequest(requestData) {
    const { websiteId, paths, baseWebsiteUrl } = requestData;
    const results = [];

    for (const pathObj of paths) {
      const { path: pathName, needsScraping } = pathObj;

      if (!needsScraping) {
        results.push({ pathName, status: 'skipped', message: 'Scraping not requested for this path.' });
        continue;
      }

      try {
        let scrapedPath = await ScrapedPathRepository.findByUniqueIdentifiers(websiteId, pathName, baseWebsiteUrl);

        if (scrapedPath) {
          // Path already exists in DB
          if (scrapedPath.status === SCRAPE_STATUS.QUEUED || scrapedPath.status === SCRAPE_STATUS.SCRAPING) {
            results.push({ pathName, status: scrapedPath.status, message: 'Already in queue or being scraped.' });
            logger.warn(`Path ${pathName} for website ${websiteId} already in queue or scraping.`);
          } else if (scrapedPath.status === SCRAPE_STATUS.SCAPED) {
            // If already scraped, we might want to re-queue for a fresh scrape or skip
            // For now, let's re-queue if explicitly requested, by updating status to queued
            await ScrapedPathRepository.updateStatus(scrapedPath.id, SCRAPE_STATUS.QUEUED);
            scrapeQueue.push(scrapedPath); // Add existing record to in-memory queue
            results.push({ pathName, status: SCRAPE_STATUS.QUEUED, message: 'Re-queued existing path.' });
            logger.info(`Re-queued existing path ${pathName} for website ${websiteId}.`);
          } else if (scrapedPath.status === SCRAPE_STATUS.FAILED) {
            // If failed, re-queue it
            await ScrapedPathRepository.updateStatus(scrapedPath.id, SCRAPE_STATUS.QUEUED);
            scrapeQueue.push(scrapedPath); // Add existing record to in-memory queue
            results.push({ pathName, status: SCRAPE_STATUS.QUEUED, message: 'Re-queued failed path.' });
            logger.info(`Re-queued failed path ${pathName} for website ${websiteId}.`);
          }
        } else {
          // New path, create in DB and add to queue
          const newScrapedPath = await ScrapedPathRepository.create({
            websiteId,
            pathName,
            baseUrl: baseWebsiteUrl,
            status: SCRAPE_STATUS.QUEUED
          });
          scrapeQueue.push(newScrapedPath);
          results.push({ pathName, status: SCRAPE_STATUS.QUEUED, message: 'New path queued successfully.' });
          logger.info(`New path ${pathName} for website ${websiteId} queued.`);
        }
      } catch (error) {
        logger.error(`Error adding path ${pathName} for website ${websiteId} to queue: ${error.message}`);
        results.push({ pathName, status: SCRAPE_STATUS.FAILED, message: `Failed to queue: ${error.message}` });
      }
    }
    return results;
  }

  /**
   * Starts processing items from the queue at regular intervals.
   * @param {number} intervalMs - The interval in milliseconds between processing attempts.
   */
  static startProcessing(intervalMs = 5000) { // Process every 5 seconds
    if (isProcessing) {
      logger.warn('Queue processing is already active.');
      return;
    }
    isProcessing = true;
    logger.info(`Starting queue processing with interval: ${intervalMs}ms`);
    processingInterval = setInterval(this.processNextItem, intervalMs);
  }

  /**
   * Stops the queue processing.
   */
  static stopProcessing() {
    if (processingInterval) {
      clearInterval(processingInterval);
      processingInterval = null;
      isProcessing = false;
      logger.info('Queue processing stopped.');
    }
  }

  /**
   * Processes the next item in the queue.
   * This method is called repeatedly by the `startProcessing` interval.
   */
  static async processNextItem() {
    if (scrapeQueue.length === 0) {
      logger.debug('Queue is empty. Waiting for new requests.');
      return;
    }

    // Take the first item from the queue
    const requestToProcess = scrapeQueue.shift();
    if (!requestToProcess) {
      return; // Should not happen if queue.length > 0, but good for safety
    }

    logger.info(`Processing item from queue: ID ${requestToProcess.id}, URL: ${requestToProcess.baseUrl}${requestToProcess.pathName}`);
    await Processor.processScrapeRequest(requestToProcess);
  }

  /**
   * Gets the current size of the queue.
   * @returns {number} The number of items currently in the queue.
   */
  static getQueueSize() {
    return scrapeQueue.length;
  }

  /**
   * Resets the internal queue state. For testing purposes.
   * @private
   */
  static _resetQueue() {
    scrapeQueue = []; // Re-initialize the queue
    isProcessing = false;
    if (processingInterval) {
      clearInterval(processingInterval);
      processingInterval = null;
    }
    // logger.debug('QueueManager state reset.'); // Comment out debug log during reset to avoid noise in tests
  }

  // Expose internal state for testing (use with caution in production code)
  static __get__(prop) {
    if (prop === 'scrapeQueue') return scrapeQueue;
    if (prop === 'isProcessing') return isProcessing;
    if (prop === 'processingInterval') return processingInterval;
    return undefined;
  }
  static __set__(prop, value) {
    if (prop === 'scrapeQueue') scrapeQueue = value;
    if (prop === 'isProcessing') isProcessing = value;
    if (prop === 'processingInterval') processingInterval = value;
  }
}

module.exports = QueueManager;

/*
  IMPORTANT NOTE ON QUEUE MANAGEMENT:
  ... (keep the existing important note)
*/