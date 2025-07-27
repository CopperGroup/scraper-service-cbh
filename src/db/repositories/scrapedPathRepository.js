// src/db/repositories/scrapedPathRepository.js
const ScrapedPath = require('../models/ScrapedPath');
const { Op } = require('sequelize'); // Import Op for advanced queries

class ScrapedPathRepository {
  /**
   * Finds a scraped path by its websiteId, pathName, and baseUrl.
   * @param {string} websiteId
   * @param {string} pathName
   * @param {string} baseUrl
   * @returns {Promise<ScrapedPath|null>} The found ScrapedPath instance or null.
   */
  static async findByUniqueIdentifiers(websiteId, pathName, baseUrl) {
    return ScrapedPath.findOne({
      where: {
        websiteId,
        pathName,
        baseUrl
      }
    });
  }

  /**
   * Creates a new scraped path record.
   * @param {object} data - Data for the new path (websiteId, pathName, baseUrl, status).
   * @returns {Promise<ScrapedPath>} The created ScrapedPath instance.
   */
  static async create(data) {
    return ScrapedPath.create(data);
  }

  /**
   * Updates the status of a scraped path by its ID.
   * @param {string} id - The UUID of the scraped path.
   * @param {string} newStatus - The new status ('queued', 'scraping', 'scraped', 'failed').
   * @returns {Promise<[number, ScrapedPath[]]>} An array where the first element is the number of affected rows.
   */
  static async updateStatus(id, newStatus) {
    return ScrapedPath.update(
      { status: newStatus },
      { where: { id } }
    );
  }

  /**
   * Finds paths that need scraping (e.g., 'queued' status).
   * @returns {Promise<ScrapedPath[]>} An array of ScrapedPath instances.
   */
  static async findPathsToScrape() {
    return ScrapedPath.findAll({
      where: {
        status: 'queued' // Or any other status indicating it needs processing
      }
    });
  }

  /**
   * Updates the status of a path identified by its unique identifiers.
   * @param {string} websiteId
   * @param {string} pathName
   * @param {string} baseUrl
   * @param {string} newStatus
   * @returns {Promise<[number, ScrapedPath[]]>}
   */
  static async updateStatusByUniqueIdentifiers(websiteId, pathName, baseUrl, newStatus) {
    return ScrapedPath.update(
      { status: newStatus },
      {
        where: {
          websiteId,
          pathName,
          baseUrl
        }
      }
    );
  }

  /**
   * Finds a path by its ID.
   * @param {string} id - The UUID of the scraped path.
   * @returns {Promise<ScrapedPath|null>} The found ScrapedPath instance or null.
   */
  static async findById(id) {
    return ScrapedPath.findByPk(id);
  }

  /**
   * Finds all scraped paths associated with a given websiteId.
   * @param {string} websiteId - The external ID of the website.
   * @returns {Promise<ScrapedPath[]>} An array of ScrapedPath instances.
   */
  static async findByWebsiteId(websiteId) {
    return ScrapedPath.findAll({
      where: {
        websiteId: websiteId
      },
      attributes: ['id', 'pathName', 'baseUrl', 'status', 'updatedAt', 'createdAt'] // Select specific fields to return
    });
  }
}

module.exports = ScrapedPathRepository;