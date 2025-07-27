// src/core/scraper.js
const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

class Scraper {
  /**
   * Fetches a web page and extracts its text content, form details, and button details.
   * @param {string} url - The URL of the page to scrape.
   * @returns {Promise<object>} An object containing extracted text, forms, and buttons.
   * @throws {Error} If the page cannot be fetched or parsed.
   */
  static async scrapePage(url) {
    logger.info(`Attempting to scrape URL: ${url}`);
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'ChatBot Hub Scraper/1.0 (+https://chatboth.com/scraper-info)' // Good practice to identify your scraper
        },
        timeout: 30000 // 30 seconds timeout
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch page, status: ${response.status}`);
      }

      const $ = cheerio.load(response.data);

      const extractedData = {
        text: this.extractText($),
        forms: this.extractForms($),
        buttons: this.extractButtons($)
      };

      logger.info(`Successfully scraped URL: ${url}`);
      return extractedData;

    } catch (error) {
      logger.error(`Error scraping URL ${url}: ${error.message}`);
      throw new Error(`Scraping failed for ${url}: ${error.message}`);
    }
  }

  /**
   * Extracts all visible text from the page.
   * @param {object} $ - Cheerio loaded object.
   * @returns {string} Concatenated text content.
   */
  static extractText($) {
    // Select all text nodes and filter out script, style, and hidden elements
    const text = $('body').not('script, style, noscript, iframe')
      .find(':not(script, style, noscript, iframe)') // Exclude children as well
      .map((i, el) => $(el).text())
      .get()
      .join(' ')
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    return text;
  }

  /**
   * Extracts details about forms on the page.
   * @param {object} $ - Cheerio loaded object.
   * @returns {Array<object>} An array of form objects.
   */
  static extractForms($) {
    const forms = [];
    $('form').each((i, el) => {
      const $form = $(el);
      const formDetails = {
        action: $form.attr('action') || '',
        method: ($form.attr('method') || 'GET').toUpperCase(),
        inputs: []
      };

      $form.find('input, select, textarea').each((j, inputEl) => {
        const $input = $(inputEl);
        formDetails.inputs.push({
          type: $input.attr('type') || $input.prop('tagName').toLowerCase(),
          name: $input.attr('name') || '',
          value: $input.val() || '',
          placeholder: $input.attr('placeholder') || ''
        });
      });
      forms.push(formDetails);
    });
    return forms;
  }

  /**
   * Extracts details about buttons on the page.
   * @param {object} $ - Cheerio loaded object.
   * @returns {Array<object>} An array of button objects.
   */
  static extractButtons($) {
    const buttons = [];
    $('button, input[type="submit"], input[type="button"], a[role="button"]').each((i, el) => {
      const $button = $(el);
      buttons.push({
        text: $button.text().trim() || $button.attr('value') || '',
        type: $button.attr('type') || $button.prop('tagName').toLowerCase(),
        href: $button.attr('href') || '' // For anchor tags acting as buttons
      });
    });
    return buttons;
  }
}

module.exports = Scraper;