// tests/unit/services/aiService.test.js
const AiService = require('../../../src/services/aiService');
const axios = require('axios');
const config = require('src/config'); // FIX: Use absolute path from src/
const { ServiceError } = require('src/utils/errors'); // FIX: Use absolute path
const logger = require('src/utils/logger'); // FIX: Use absolute path

jest.mock('axios');
// FIX: Mock config with a path Jest can resolve from test file
jest.mock('src/config', () => ({
  aiServiceBaseUrl: 'http://mock-ai-service.com',
  scraperTimeoutMs: 5000,
}));
jest.mock('src/utils/logger', () => ({ // FIX: Use absolute path
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('AiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSummary', () => {
    it('should successfully get a summary from the AI service', async () => {
      const mockScrapedData = { text: 'some text', forms: [], buttons: [] };
      const mockAiResponse = { summary: 'This is a summary.' };
      axios.post.mockResolvedValue({ status: 200, data: mockAiResponse });

      const result = await AiService.getSummary(mockScrapedData);

      expect(axios.post).toHaveBeenCalledWith(
        `${config.aiServiceBaseUrl}/summary`,
        { data: mockScrapedData },
        { timeout: config.scraperTimeoutMs }
      );
      expect(result).toEqual(mockAiResponse);
      expect(logger.info).toHaveBeenCalledWith('Successfully received summary from AI service.');
    });

    it('should throw a ServiceError if AI service returns non-200 status', async () => {
      axios.post.mockResolvedValue({ status: 500, data: 'Internal Server Error' });
      const mockScrapedData = { text: 'some text' };

      await expect(AiService.getSummary(mockScrapedData)).rejects.toThrow(ServiceError);
      await expect(AiService.getSummary(mockScrapedData)).rejects.toHaveProperty('message', expect.stringContaining('Failed to get summary: AI service returned non-200 status: 500'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error calling AI service /summary'));
    });

    it('should throw a ServiceError if AI service call fails (network error)', async () => {
      axios.post.mockRejectedValue(new Error('Network Down'));
      const mockScrapedData = { text: 'some text' };

      await expect(AiService.getSummary(mockScrapedData)).rejects.toThrow(ServiceError);
      await expect(AiService.getSummary(mockScrapedData)).rejects.toHaveProperty('message', expect.stringContaining('Failed to get summary: Network Down'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error calling AI service /summary'));
    });
  });

  describe('mergeSummaries', () => {
    it('should successfully merge summaries with the AI service', async () => {
      const freshSummary = 'Fresh summary.';
      const previousSummary = 'Old summary.';
      const scrapedData = { text: 'context' };
      const mockMergedResponse = { mergedSummary: 'Combined summary.' };
      axios.post.mockResolvedValue({ status: 200, data: mockMergedResponse });

      const result = await AiService.mergeSummaries(freshSummary, previousSummary, scrapedData);

      expect(axios.post).toHaveBeenCalledWith(
        `${config.aiServiceBaseUrl}/merge`,
        { freshSummary, previousSummary, scrapedData },
        { timeout: config.scraperTimeoutMs }
      );
      expect(result).toEqual(mockMergedResponse);
      expect(logger.info).toHaveBeenCalledWith('Successfully received merged summary from AI service.');
    });

    it('should throw a ServiceError if AI service merge returns non-200 status', async () => {
      axios.post.mockResolvedValue({ status: 500, data: 'Internal Server Error' });
      const freshSummary = 'Fresh summary.';
      const previousSummary = 'Old summary.';
      const scrapedData = { text: 'context' };

      await expect(AiService.mergeSummaries(freshSummary, previousSummary, scrapedData)).rejects.toThrow(ServiceError);
      await expect(AiService.mergeSummaries(freshSummary, previousSummary, scrapedData)).rejects.toHaveProperty('message', expect.stringContaining('Failed to merge summaries: AI service returned non-200 status: 500'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error calling AI service /merge'));
    });

    it('should throw a ServiceError if AI service merge call fails (network error)', async () => {
      axios.post.mockRejectedValue(new Error('Connection refused'));
      const freshSummary = 'Fresh summary.';
      const previousSummary = 'Old summary.';
      const scrapedData = { text: 'context' };

      await expect(AiService.mergeSummaries(freshSummary, previousSummary, scrapedData)).rejects.toThrow(ServiceError);
      await expect(AiService.mergeSummaries(freshSummary, previousSummary, scrapedData)).rejects.toHaveProperty('message', expect.stringContaining('Failed to merge summaries: Connection refused'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error calling AI service /merge'));
    });
  });
});