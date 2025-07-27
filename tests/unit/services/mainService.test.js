// tests/unit/services/mainService.test.js
const MainService = require('../../../src/services/mainService');
const axios = require('axios');
const config = require('src/config'); // FIX: Use absolute path
const { ServiceError } = require('src/utils/errors'); // FIX: Use absolute path
const logger = require('src/utils/logger'); // FIX: Use absolute path

jest.mock('axios');
// FIX: Mock config with a path Jest can resolve from test file
jest.mock('src/config', () => ({
  mainServiceBaseUrl: 'http://mock-main-service.com',
  scraperTimeoutMs: 5000,
}));
jest.mock('src/utils/logger', () => ({ // FIX: Use absolute path
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('MainService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPreviousAiSummary', () => {
    const websiteId = 'test-website-id-123';

    it('should successfully get previous AI summary from main service', async () => {
      const mockMainServiceResponse = { previousSummary: 'This is an old summary.' };
      axios.get.mockResolvedValue({ status: 200, data: mockMainServiceResponse });

      const result = await MainService.getPreviousAiSummary(websiteId);

      expect(axios.get).toHaveBeenCalledWith(
        `${config.mainServiceBaseUrl}/websites/${websiteId}/summary`,
        { timeout: config.scraperTimeoutMs }
      );
      expect(result).toEqual(mockMainServiceResponse);
      // FIX: Changed to toHaveBeenLastCalledWith to match the last info log
      expect(logger.info).toHaveBeenLastCalledWith('Successfully received previous AI summary from main service for websiteId: test-website-id-123');
    });

    it('should return { previousSummary: null } if main service returns 404', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } }); // Simulate 404 error
      const result = await MainService.getPreviousAiSummary(websiteId);

      expect(axios.get).toHaveBeenCalledWith(
        `${config.mainServiceBaseUrl}/websites/${websiteId}/summary`,
        { timeout: config.scraperTimeoutMs }
      );
      expect(result).toEqual({ previousSummary: null });
      expect(logger.warn).toHaveBeenCalledWith('No previous AI summary found for websiteId: test-website-id-123.');
    });

    it('should throw a ServiceError if main service returns non-200/404 status', async () => {
      axios.get.mockResolvedValue({ status: 500, data: 'Internal Server Error' });

      await expect(MainService.getPreviousAiSummary(websiteId)).rejects.toThrow(ServiceError);
      await expect(MainService.getPreviousAiSummary(websiteId)).rejects.toHaveProperty('message', expect.stringContaining('Failed to get previous AI summary: Main service returned non-200 status: 500'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error calling Main service to get previous AI summary'));
    });

    it('should throw a ServiceError if main service call fails (network error)', async () => {
      axios.get.mockRejectedValue(new Error('Connection timeout'));

      await expect(MainService.getPreviousAiSummary(websiteId)).rejects.toThrow(ServiceError);
      await expect(MainService.getPreviousAiSummary(websiteId)).rejects.toHaveProperty('message', expect.stringContaining('Failed to get previous AI summary: Connection timeout'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error calling Main service to get previous AI summary'));
    });
  });

  describe('sendNewSummary', () => {
    const websiteId = 'test-website-id-123';
    const newSummary = 'This is a new merged summary.';

    it('should successfully send new summary to main service', async () => {
      axios.put.mockResolvedValue({ status: 200, data: { message: 'Summary updated.' } });

      const result = await MainService.sendNewSummary(websiteId, newSummary);

      expect(axios.put).toHaveBeenCalledWith(
        `${config.mainServiceBaseUrl}/websites/${websiteId}/summary`,
        { newSummary },
        { timeout: config.scraperTimeoutMs }
      );
      expect(result).toEqual({ message: 'Summary updated.' });
      expect(logger.info).toHaveBeenCalledWith('Successfully sent new summary to Main service for websiteId: test-website-id-123');
    });

    it('should throw a ServiceError if main service returns non-200/204 status', async () => {
      axios.put.mockResolvedValue({ status: 400, data: 'Bad Request' });

      await expect(MainService.sendNewSummary(websiteId, newSummary)).rejects.toThrow(ServiceError);
      await expect(MainService.sendNewSummary(websiteId, newSummary)).rejects.toHaveProperty('message', expect.stringContaining('Failed to send new summary: Main service returned non-200/204 status: 400'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error calling Main service to send new summary'));
    });

    it('should throw a ServiceError if main service call fails (network error)', async () => {
      axios.put.mockRejectedValue(new Error('Network unreachable'));

      await expect(MainService.sendNewSummary(websiteId, newSummary)).rejects.toThrow(ServiceError);
      await expect(MainService.sendNewSummary(websiteId, newSummary)).rejects.toHaveProperty('message', expect.stringContaining('Failed to send new summary: Network unreachable'));
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error calling Main service to send new summary'));
    });
  });
});