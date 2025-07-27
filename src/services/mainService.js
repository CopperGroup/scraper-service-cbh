// src/services/mainService.js
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { ServiceError } = require('../utils/errors');

const MAIN_SERVICE_BASE_URL = config.mainServiceBaseUrl;

class MainService {
  /**
   * Fetches the previous AI summary for a given website ID from the main service.
   * @param {string} websiteId - The external ID of the website.
   * @returns {Promise<object>} The response from the main service, expected to contain a 'previousSummary' field.
   * @throws {ServiceError} If the main service call fails.
   */
  static async getPreviousAiSummary(websiteId) {
    // Assuming the main service has an endpoint like /websites/{websiteId}/summary
    const url = `${MAIN_SERVICE_BASE_URL}/websites/${websiteId}/summary`;
    logger.info(`Calling Main service to get previous AI summary for websiteId: ${websiteId}`);
    try {
      const response = await axios.get(url, {
        timeout: config.scraperTimeoutMs
      });
      if (response.status !== 200) {
        throw new Error(`Main service returned non-200 status: ${response.status}`);
      }
      logger.info(`Successfully received previous AI summary for websiteId: ${websiteId}`);
      return response.data; // Assuming response.data contains { previousSummary: "..." }
    } catch (error) {
      // Handle 404 specifically if it means no previous summary exists vs. a true error
      if (error.response && error.response.status === 404) {
        logger.warn(`No previous AI summary found for websiteId: ${websiteId}.`);
        return { previousSummary: null }; // Return null if not found, not an error
      }
      logger.error(`Error calling Main service to get previous AI summary for websiteId ${websiteId}: ${error.message}`);
      throw new ServiceError('Main Service', `Failed to get previous AI summary: ${error.message}`, error);
    }
  }

  /**
   * Sends the newly merged AI summary back to the main service for a given website ID.
   * @param {string} websiteId - The external ID of the website.
   * @param {string} newSummary - The new merged AI summary.
   * @returns {Promise<object>} The response from the main service.
   * @throws {ServiceError} If the main service call fails.
   */
  static async sendNewSummary(websiteId, newSummary) {
    // Assuming the main service has an endpoint like /websites/{websiteId}/summary to update
    const url = `${MAIN_SERVICE_BASE_URL}/websites/${websiteId}/summary`;
    logger.info(`Calling Main service to send new summary for websiteId: ${websiteId}`);
    try {
      const response = await axios.put(url, { newSummary }, { // Use PUT for updating a resource
        timeout: config.scraperTimeoutMs
      });
      if (response.status !== 200 && response.status !== 204) { // 200 OK or 204 No Content for successful update
        throw new Error(`Main service returned non-200/204 status: ${response.status}`);
      }
      logger.info(`Successfully sent new summary to Main service for websiteId: ${websiteId}`);
      return response.data;
    } catch (error) {
      logger.error(`Error calling Main service to send new summary for websiteId ${websiteId}: ${error.message}`);
      throw new ServiceError('Main Service', `Failed to send new summary: ${error.message}`, error);
    }
  }
}

module.exports = MainService;