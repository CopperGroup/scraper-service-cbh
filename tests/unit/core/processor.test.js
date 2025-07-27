// tests/unit/core/processor.test.js
const Processor = require('../../../src/core/processor');
const ScrapedPathRepository = require('../../../src/db/repositories/scrapedPathRepository');
const Scraper = require('../../../src/core/scraper');
const AiService = require('../../../src/services/aiService');
const MainService = require('../../../src/services/mainService');
const logger = require('../../../src/utils/logger');
const { SCRAPE_STATUS } = require('../../../src/utils/constants');

// Mock all external dependencies
jest.mock('../../../src/db/repositories/scrapedPathRepository');
jest.mock('../../../src/core/scraper');
jest.mock('../../../src/services/aiService');
jest.mock('../../../src/services/mainService');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Processor', () => {
  let mockScrapeRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScrapeRequest = {
      id: 'mock-uuid-123',
      websiteId: 'mock-website-id',
      pathName: '/test-path',
      baseUrl: 'https://mock-website.com',
    };
  });

  it('should successfully process a scrape request from start to finish', async () => {
    const fullUrl = `${mockScrapeRequest.baseUrl}${mockScrapeRequest.pathName}`;
    const mockScrapedData = { text: 'Mock text', forms: [], buttons: [] };
    const mockFreshSummary = 'Fresh AI summary';
    const mockPreviousSummary = 'Previous AI summary';
    const mockMergedSummary = 'Merged AI summary';

    // Mock successful calls
    Scraper.scrapePage.mockResolvedValue(mockScrapedData);
    AiService.getSummary.mockResolvedValue({ summary: mockFreshSummary });
    MainService.getPreviousAiSummary.mockResolvedValue({ previousSummary: mockPreviousSummary });
    AiService.mergeSummaries.mockResolvedValue({ mergedSummary: mockMergedSummary });
    MainService.sendNewSummary.mockResolvedValue({});
    ScrapedPathRepository.updateStatus.mockResolvedValue([1]); // Indicates 1 row updated

    await Processor.processScrapeRequest(mockScrapeRequest);

    // Verify status updates
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.SCRAPING);
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.SCAPED);

    // Verify scraping
    expect(Scraper.scrapePage).toHaveBeenCalledWith(fullUrl);

    // Verify AI service calls
    expect(AiService.getSummary).toHaveBeenCalledWith(mockScrapedData);
    expect(MainService.getPreviousAiSummary).toHaveBeenCalledWith(mockScrapeRequest.websiteId);
    expect(AiService.mergeSummaries).toHaveBeenCalledWith(mockFreshSummary, mockPreviousSummary, mockScrapedData);

    // Verify main service call
    expect(MainService.sendNewSummary).toHaveBeenCalledWith(mockScrapeRequest.websiteId, mockMergedSummary);

    // Verify logging
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Starting processing'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Status updated to '${SCRAPE_STATUS.SCRAPING}'`));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Page scraped successfully'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Received fresh AI summary'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Received previous AI summary'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Received merged AI summary'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Sent new merged summary'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(`Status updated to '${SCRAPE_STATUS.SCAPED}'`));
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should update status to FAILED if scraping fails', async () => {
    const scrapingError = new Error('Failed to fetch page');
    Scraper.scrapePage.mockRejectedValue(scrapingError);
    ScrapedPathRepository.updateStatus.mockResolvedValue([1]); // Mock success for status updates

    await Processor.processScrapeRequest(mockScrapeRequest);

    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.SCRAPING);
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.FAILED);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error processing scrape request'));
  });

  it('should update status to FAILED if AI summary call fails', async () => {
    const aiError = new Error('AI service down');
    Scraper.scrapePage.mockResolvedValue({});
    AiService.getSummary.mockRejectedValue(aiError);
    ScrapedPathRepository.updateStatus.mockResolvedValue([1]);

    await Processor.processScrapeRequest(mockScrapeRequest);

    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.SCRAPING);
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.FAILED);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error processing scrape request'));
  });

  it('should update status to FAILED if main service previous summary call fails', async () => {
    const mainServiceError = new Error('Main service unresponsive');
    Scraper.scrapePage.mockResolvedValue({});
    AiService.getSummary.mockResolvedValue({ summary: 'fresh' });
    MainService.getPreviousAiSummary.mockRejectedValue(mainServiceError);
    ScrapedPathRepository.updateStatus.mockResolvedValue([1]);

    await Processor.processScrapeRequest(mockScrapeRequest);

    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.SCRAPING);
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.FAILED);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error processing scrape request'));
  });

  it('should update status to FAILED if AI merge call fails', async () => {
    const aiMergeError = new Error('AI merge logic error');
    Scraper.scrapePage.mockResolvedValue({});
    AiService.getSummary.mockResolvedValue({ summary: 'fresh' });
    MainService.getPreviousAiSummary.mockResolvedValue({ previousSummary: 'prev' });
    AiService.mergeSummaries.mockRejectedValue(aiMergeError);
    ScrapedPathRepository.updateStatus.mockResolvedValue([1]);

    await Processor.processScrapeRequest(mockScrapeRequest);

    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.SCRAPING);
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.FAILED);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error processing scrape request'));
  });

  it('should update status to FAILED if sending new summary to main service fails', async () => {
    const sendSummaryError = new Error('Main service update failed');
    Scraper.scrapePage.mockResolvedValue({});
    AiService.getSummary.mockResolvedValue({ summary: 'fresh' });
    MainService.getPreviousAiSummary.mockResolvedValue({ previousSummary: 'prev' });
    AiService.mergeSummaries.mockResolvedValue({ mergedSummary: 'merged' });
    MainService.sendNewSummary.mockRejectedValue(sendSummaryError);
    ScrapedPathRepository.updateStatus.mockResolvedValue([1]);

    await Processor.processScrapeRequest(mockScrapeRequest);

    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.SCRAPING);
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.FAILED);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error processing scrape request'));
  });

  it('should handle failure to update status to FAILED gracefully', async () => {
    const initialError = new Error('Initial processing error');
    Scraper.scrapePage.mockRejectedValue(initialError);

    // Mock updateStatus to throw an error ONLY when trying to set to FAILED
    ScrapedPathRepository.updateStatus.mockImplementation(async (id, status) => {
      if (status === SCRAPE_STATUS.FAILED) {
        // Return a rejected promise instead of directly throwing to better simulate async DB error
        throw new Error('DB update failed');
      }
      return Promise.resolve([1]);
    });

    await Processor.processScrapeRequest(mockScrapeRequest);

    // Assert that the initial status update was attempted
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.SCRAPING);
    // Assert that the final status update to FAILED was attempted
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(mockScrapeRequest.id, SCRAPE_STATUS.FAILED);

    // Assert that the error handler for updating to FAILED was called
    // We expect logger.error to be called for the initial processing error AND the DB update error
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Error processing scrape request ID: ${mockScrapeRequest.id}`)
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to update status to 'failed' for ID: ${mockScrapeRequest.id}. DB Error: DB update failed`)
    );
    // The test should pass if the error was handled, which is checked by the logger calls.
  });
});