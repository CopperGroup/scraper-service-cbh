// tests/unit/core/scraper.test.js
const Scraper = require('../../../src/core/scraper');
const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../../src/utils/logger');

jest.mock('axios');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Scraper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scrapePage', () => {
    it('should successfully scrape text, forms, and buttons from a simple HTML page', async () => {
      const mockHtml = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Hello World</h1>
            <p>This is some text.</p>
            <form action="/submit" method="POST">
              <input type="text" name="username" placeholder="Enter username">
              <textarea name="message"></textarea>
              <button type="submit">Send</button>
            </form>
            <button class="btn-info" value="Click Me">Info Button</button>
            <a href="/link" role="button">Link Button</a>
          </body>
        </html>
      `;
      axios.get.mockResolvedValue({ status: 200, data: mockHtml });

      const url = 'http://test.com/page';
      const result = await Scraper.scrapePage(url);

      expect(axios.get).toHaveBeenCalledWith(url, expect.any(Object));
      expect(result.text).toContain('Hello World This is some text.');
      expect(result.forms).toHaveLength(1);
      expect(result.forms[0].action).toBe('/submit');
      expect(result.forms[0].method).toBe('POST');
      expect(result.forms[0].inputs).toHaveLength(2);
      expect(result.forms[0].inputs[0]).toMatchObject({ type: 'text', name: 'username' });
      expect(result.forms[0].inputs[1]).toMatchObject({ type: 'textarea', name: 'message' });
      expect(result.buttons).toHaveLength(3); // Submit button inside form, standalone button, and link button
      expect(result.buttons[0]).toMatchObject({ text: 'Send', type: 'submit' });
      expect(result.buttons[1]).toMatchObject({ text: 'Info Button', type: 'button' });
      expect(result.buttons[2]).toMatchObject({ text: 'Link Button', type: 'a', href: '/link' });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully scraped URL'));
    });

    it('should throw an error if fetching the page fails', async () => {
      const url = 'http://test.com/error-page';
      axios.get.mockRejectedValue(new Error('Network error'));

      await expect(Scraper.scrapePage(url)).rejects.toThrow('Scraping failed for http://test.com/error-page: Network error');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error scraping URL'));
    });

    it('should throw an error if the response status is not 200', async () => {
      const url = 'http://test.com/bad-status';
      axios.get.mockResolvedValue({ status: 404, data: 'Not Found' });

      await expect(Scraper.scrapePage(url)).rejects.toThrow('Scraping failed for http://test.com/bad-status: Failed to fetch page, status: 404');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error scraping URL'));
    });

    it('should handle pages with no forms or buttons gracefully', async () => {
      const mockHtml = `
        <html>
          <body>
            <p>Just text.</p>
          </body>
        </html>
      `;
      axios.get.mockResolvedValue({ status: 200, data: mockHtml });

      const url = 'http://test.com/no-forms-buttons';
      const result = await Scraper.scrapePage(url);

      expect(result.text).toContain('Just text.');
      expect(result.forms).toHaveLength(0);
      expect(result.buttons).toHaveLength(0);
    });

    it('should extract text correctly, ignoring script and style tags', async () => {
      const mockHtml = `
        <html>
          <body>
            <p>Visible text.</p>
            <script>console.log('hidden script');</script>
            <style>body { color: red; }</style>
            <span>More visible text.</span>
          </body>
        </html>
      `;
      axios.get.mockResolvedValue({ status: 200, data: mockHtml });

      const url = 'http://test.com/text-only';
      const result = await Scraper.scrapePage(url);

      expect(result.text).toContain('Visible text. More visible text.');
      expect(result.text).not.toContain('hidden script');
      expect(result.text).not.toContain('color: red');
    });
  });
});