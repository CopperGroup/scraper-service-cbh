// src/core/processor.js
const ScrapedPathRepository = require('../db/repositories/scrapedPathRepository');
const Scraper = require('./scraper');
const AiService = require('../services/aiService');
const MainService = require('../services/mainService');
const logger = require('../utils/logger');
const { SCRAPE_STATUS } = require('../utils/constants'); // Import status constants

class Processor {
  /**
   * Processes a single scrape request from the queue.
   * This involves scraping the page, interacting with AI and main services,
   * and updating the scraping status in the database.
   * @param {object} scrapeRequest - The scrape request object.
   * @param {string} scrapeRequest.id - The UUID of the ScrapedPath record.
   * @param {string} scrapeRequest.websiteId - The external website ID.
   * @param {string} scrapeRequest.pathName - The path to scrape (e.g., "/blog").
   * @param {string} scrapeRequest.baseUrl - The base URL of the website.
   */
  static async processScrapeRequest(scrapeRequest) {
    const { id, websiteId, pathName, baseUrl } = scrapeRequest;
    const fullUrl = `${baseUrl}${pathName}`;

    logger.info(`Starting processing for scrape request ID: ${id}, URL: ${fullUrl}`);

    try {
      // 1. Update status to 'scraping'
      await ScrapedPathRepository.updateStatus(id, SCRAPE_STATUS.SCRAPING);
      logger.info(`Status updated to '${SCRAPE_STATUS.SCRAPING}' for ID: ${id}`);

      // 2. Scrape the page
      const scrapedData = await Scraper.scrapePage(fullUrl);
      logger.info(`Page scraped successfully for ID: ${id}. Data size: ${JSON.stringify(scrapedData).length} bytes`);

      // 3. Send extracted data to AI service for initial summary
      const aiSummaryResponse = await AiService.getSummary(scrapedData, pathName, websiteId);
      const freshAiSummary = aiSummaryResponse.summary; // Assuming AI service returns { summary: "..." }
      logger.info(`Received fresh AI summary for ID: ${id}`);

      // 4. Get previous AI summary from main service
      const mainServiceResponse = await MainService.getPreviousAiSummary(websiteId);
      const previousAiSummary = mainServiceResponse.previousSummary || null; // Handle case where no previous summary exists
      logger.info(`Received previous AI summary from main service for ID: ${id}`);

      // 5. Send fresh and previous data to AI service for merging
      const aiMergeResponse = await AiService.mergeSummaries(freshAiSummary, previousAiSummary, scrapedData, websiteId);
      const newMergedSummary = aiMergeResponse.mergedSummary; // Assuming AI service returns { mergedSummary: "..." }
      logger.info(`Received merged AI summary for ID: ${id}`);

      // 6. Send new merged summary back to the main service
      await MainService.sendNewSummary(websiteId, newMergedSummary);
      logger.info(`Sent new merged summary to main service for ID: ${id}`);

      // 7. Update status to 'scraped'
      await ScrapedPathRepository.updateStatus(id, SCRAPE_STATUS.SCAPED);
      logger.info(`Processing completed. Status updated to '${SCRAPE_STATUS.SCAPED}' for ID: ${id}`);

    } catch (error) {
      logger.error(`Error processing scrape request ID: ${id}, URL: ${fullUrl}. Error: ${error.message}`);
      // Update status to 'failed' in case of any error during the process
      await ScrapedPathRepository.updateStatus(id, SCRAPE_STATUS.FAILED)
        .catch(dbError => logger.error(`Failed to update status to 'failed' for ID: ${id}. DB Error: ${dbError.message}`));
    }
  }
}

module.exports = Processor;