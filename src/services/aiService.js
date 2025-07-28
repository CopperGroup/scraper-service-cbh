// src/services/aiService.js
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { ServiceError } = require('../utils/errors');

const AI_SERVICE_BASE_URL = config.aiServiceBaseUrl;

class AiService {
  /**
   * Sends extracted data to the AI service to get an initial summary.
   * @param {object} scrapedData - The data extracted from the web page (text, forms, buttons).
   * @param {object} path
   * @returns {Promise<object>} The response from the AI service, expected to contain a 'summary' field.
   * @throws {ServiceError} If the AI service call fails.
   */
  static async getSummary(scrapedData, path) {
    const url = `${AI_SERVICE_BASE_URL}/summary`;
    logger.info(`Calling AI service for summary: ${url}`);
    try {
      const response = await axios.post(url, { data: {...scrapedData, path} }
        // REMOVED: , { timeout: config.scraperTimeoutMs }
      );
      if (response.status !== 200) {
        throw new Error(`AI service returned non-200 status: ${response.status}`);
      }
      logger.info('Successfully received summary from AI service.');
      return response.data; // Assuming response.data contains the summary
    } catch (error) {
      logger.error(`Error calling AI service /summary: ${error.message}`);
      throw new ServiceError('AI Service', `Failed to get summary: ${error.message}`, error);
    }
  }

  /**
   * Sends fresh and previous summaries along with scraped data to the AI service for merging.
   * @param {string} freshSummary - The newly generated AI summary.
   * @param {string|null} previousSummary - The previous AI summary for the website, or null.
   * @param {object} scrapedData - The raw scraped data for context.
   * @returns {Promise<object>} The response from the AI service, expected to contain a 'mergedSummary' field.
   * @throws {ServiceError} If the AI service call fails.
   */
  static async mergeSummaries(freshSummary, previousSummary, scrapedData, websiteId) {
    const url = `${AI_SERVICE_BASE_URL}/merge`;
    logger.info(`Calling AI service for merging summaries: ${url}`);
    try {
      const response = await axios.post(url, {
        freshSummary,
        previousSummary,
        scrapedData: {...scrapedData, path: ""}, // Provide raw data for AI to use as context for merging
        websiteId
      }
        // REMOVED: , { timeout: config.scraperTimeoutMs }
      );
      if (response.status !== 200) {
        throw new Error(`AI service returned non-200 status: ${response}`);
      }
      logger.info('Successfully received merged summary from AI service.');
      return response.data; // Assuming response.data contains the merged summary
    } catch (error) {
      logger.error(`Error calling AI service /merge: ${error.message}`);
      throw new ServiceError('AI Service', `Failed to merge summaries: ${error.message}`, error);
    }
  }
}

module.exports = AiService;