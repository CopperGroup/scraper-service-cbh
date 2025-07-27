// tests/unit/core/queueManager.test.js
// No `require` for QueueManager at the top, we'll require it inside beforeEach
const Processor = require('../../../src/core/processor');
const ScrapedPathRepository = require('../../../src/db/repositories/scrapedPathRepository');
const { SCRAPE_STATUS } = require('../../../src/utils/constants');
const logger = require('../../../src/utils/logger');

// Mock external dependencies
jest.mock('../../../src/core/processor');
jest.mock('../../../src/db/repositories/scrapedPathRepository');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// jest.useFakeTimers(); // REMOVE THIS LINE if `fakeTimers: { enableGlobally: true }` in jest.config.js

describe('QueueManager', () => {
  let QueueManagerInstance; // Declare a variable to hold the fresh QueueManager instance

  beforeEach(() => {
    jest.resetModules(); // Reset module registry to get a fresh instance of QueueManager
    // Now, require QueueManager AFTER resetting modules
    QueueManagerInstance = require('../../../src/core/queueManager');

    // Ensure mocks are cleared after module reset (important for spies/mocks)
    jest.clearAllMocks();

    // Re-apply fake timers if not global (but with global, this is redundant)
    // If you keep jest.useFakeTimers() here, ensure it's called *after* jest.resetModules()
    // and before any code that uses timers.
    // If `enableGlobally: true` is in jest.config.js, this line is not needed.
  });

  afterEach(() => {
    // These are now handled globally by jest.config.js if enableGlobally is true
    // If not global, keep these lines:
    // jest.runOnlyPendingTimers();
    // jest.useRealTimers();
  });

  describe('addRequest', () => {
    const mockRequestData = {
      websiteId: 'test-website-id',
      paths: [
        { path: '/blog', needsScraping: true },
        { path: '/about', needsScraping: true },
        { path: '/contact', needsScraping: false }, // Should be skipped
      ],
      baseWebsiteUrl: 'https://test.com',
    };

    it('should add new paths to the queue and database', async () => {
      ScrapedPathRepository.findByUniqueIdentifiers.mockResolvedValue(null);
      ScrapedPathRepository.create.mockImplementation(data => Promise.resolve({ id: `new-${data.pathName}`, ...data }));

      const results = await QueueManagerInstance.addRequest(mockRequestData);

      // EXPECT 2 calls for findByUniqueIdentifiers, because one path is skipped (needsScraping: false)
      expect(ScrapedPathRepository.findByUniqueIdentifiers).toHaveBeenCalledTimes(2);
      expect(ScrapedPathRepository.create).toHaveBeenCalledTimes(2); // Only for needsScraping: true
      expect(ScrapedPathRepository.create).toHaveBeenCalledWith(expect.objectContaining({ pathName: '/blog', status: SCRAPE_STATUS.QUEUED }));
      expect(ScrapedPathRepository.create).toHaveBeenCalledWith(expect.objectContaining({ pathName: '/about', status: SCRAPE_STATUS.QUEUED }));

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({ pathName: '/blog', status: SCRAPE_STATUS.QUEUED });
      expect(results[1]).toMatchObject({ pathName: '/about', status: SCRAPE_STATUS.QUEUED });
      expect(results[2]).toMatchObject({ pathName: '/contact', status: 'skipped' });

      expect(QueueManagerInstance.getQueueSize()).toBe(2);
    });

    it('should re-queue an existing path if its status is FAILED', async () => {
      const failedPath = {
        id: 'failed-path-id',
        websiteId: 'test-website-id',
        pathName: '/blog',
        baseUrl: 'https://test.com',
        status: SCRAPE_STATUS.FAILED,
      };
      ScrapedPathRepository.findByUniqueIdentifiers.mockResolvedValue(failedPath);
      ScrapedPathRepository.updateStatus.mockResolvedValue([1]);

      const results = await QueueManagerInstance.addRequest({
        websiteId: 'test-website-id',
        paths: [{ path: '/blog', needsScraping: true }],
        baseWebsiteUrl: 'https://test.com',
      });

      expect(ScrapedPathRepository.findByUniqueIdentifiers).toHaveBeenCalledWith('test-website-id', '/blog', 'https://test.com');
      expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith('failed-path-id', SCRAPE_STATUS.QUEUED);
      expect(results[0]).toMatchObject({ pathName: '/blog', status: SCRAPE_STATUS.QUEUED, message: 'Re-queued failed path.' });
      expect(QueueManagerInstance.getQueueSize()).toBe(1);
    });

    it('should re-queue an existing path if its status is SCAPED (for re-scrape)', async () => {
      const scrapedPath = {
        id: 'scraped-path-id',
        websiteId: 'test-website-id',
        pathName: '/blog',
        baseUrl: 'https://test.com',
        status: SCRAPE_STATUS.SCAPED,
      };
      ScrapedPathRepository.findByUniqueIdentifiers.mockResolvedValue(scrapedPath);
      ScrapedPathRepository.updateStatus.mockResolvedValue([1]);

      const results = await QueueManagerInstance.addRequest({
        websiteId: 'test-website-id',
        paths: [{ path: '/blog', needsScraping: true }],
        baseWebsiteUrl: 'https://test.com',
      });

      expect(ScrapedPathRepository.findByUniqueIdentifiers).toHaveBeenCalledWith('test-website-id', '/blog', 'https://test.com');
      expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith('scraped-path-id', SCRAPE_STATUS.QUEUED);
      expect(results[0]).toMatchObject({ pathName: '/blog', status: SCRAPE_STATUS.QUEUED, message: 'Re-queued existing path.' });
      expect(QueueManagerInstance.getQueueSize()).toBe(1);
    });

    it('should not re-queue a path if its status is QUEUED or SCRAPING', async () => {
      const queuedPath = {
        id: 'queued-path-id',
        websiteId: 'test-website-id',
        pathName: '/blog',
        baseUrl: 'https://test.com',
        status: SCRAPE_STATUS.QUEUED,
      };
      ScrapedPathRepository.findByUniqueIdentifiers.mockResolvedValue(queuedPath);

      const results = await QueueManagerInstance.addRequest({
        websiteId: 'test-website-id',
        paths: [{ path: '/blog', needsScraping: true }],
        baseWebsiteUrl: 'https://test.com',
      });

      expect(ScrapedPathRepository.findByUniqueIdentifiers).toHaveBeenCalledWith('test-website-id', '/blog', 'https://test.com');
      expect(ScrapedPathRepository.updateStatus).not.toHaveBeenCalled();
      expect(results[0]).toMatchObject({ pathName: '/blog', status: SCRAPE_STATUS.QUEUED, message: 'Already in queue or being scraped.' });
      expect(QueueManagerInstance.getQueueSize()).toBe(0); // Queue should not grow
    });

    it('should handle database errors during addRequest', async () => {
      ScrapedPathRepository.findByUniqueIdentifiers.mockRejectedValue(new Error('DB connection lost'));

      const results = await QueueManagerInstance.addRequest({
        websiteId: 'test-website-id',
        paths: [{ path: '/blog', needsScraping: true }],
        baseWebsiteUrl: 'https://test.com',
      });

      expect(results[0]).toMatchObject({ pathName: '/blog', status: SCRAPE_STATUS.FAILED, message: expect.stringContaining('Failed to queue') });
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error adding path'));
      expect(QueueManagerInstance.getQueueSize()).toBe(0);
    });
  });

  describe('startProcessing and processNextItem', () => {
    it('should start processing and call Processor for queued items', async () => {
      // Add items to the queue directly for testing processing
      await QueueManagerInstance.addRequest({ websiteId: 'w1', paths: [{ path: '/p1', needsScraping: true }], baseWebsiteUrl: 'http://example.com' });
      await QueueManagerInstance.addRequest({ websiteId: 'w1', paths: [{ path: '/p2', needsScraping: true }], baseWebsiteUrl: 'http://example.com' });

      Processor.processScrapeRequest.mockResolvedValue(); // Mock successful processing

      QueueManagerInstance.startProcessing(100); // Process every 100ms

      expect(QueueManagerInstance.getQueueSize()).toBe(2);
      expect(Processor.processScrapeRequest).not.toHaveBeenCalled(); // Not yet called

      jest.advanceTimersByTime(100); // Advance time by 1 interval
      expect(Processor.processScrapeRequest).toHaveBeenCalledTimes(1);
      expect(Processor.processScrapeRequest).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String), pathName: '/p1' }));
      expect(QueueManagerInstance.getQueueSize()).toBe(1);

      jest.advanceTimersByTime(100); // Advance time by another interval
      expect(Processor.processScrapeRequest).toHaveBeenCalledTimes(2);
      expect(Processor.processScrapeRequest).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String), pathName: '/p2' }));
      expect(QueueManagerInstance.getQueueSize()).toBe(0);

      jest.advanceTimersByTime(100); // Advance again, queue should be empty
      expect(Processor.processScrapeRequest).toHaveBeenCalledTimes(2); // No more calls
      expect(logger.debug).toHaveBeenCalledWith('Queue is empty. Waiting for new requests.');
    });

    it('should log an error if Processor fails to process an item', async () => {
      await QueueManagerInstance.addRequest({ websiteId: 'w1', paths: [{ path: '/p1', needsScraping: true }], baseWebsiteUrl: 'http://example.com' });

      Processor.processScrapeRequest.mockRejectedValue(new Error('Processor failed'));

      QueueManagerInstance.startProcessing(100);
      jest.advanceTimersByTime(100);

      expect(Processor.processScrapeRequest).toHaveBeenCalledTimes(1);
      // The error is handled internally by Processor and logged there, not re-thrown by QueueManager
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error processing scrape request'));
      expect(QueueManagerInstance.getQueueSize()).toBe(0); // Item is removed from queue regardless of success/failure
    });

    it('should not start processing if already active', () => {
      QueueManagerInstance.startProcessing(100);
      expect(setInterval).toHaveBeenCalledTimes(1);

      QueueManagerInstance.startProcessing(100); // Call again
      expect(logger.warn).toHaveBeenCalledWith('Queue processing is already active.');
      expect(setInterval).toHaveBeenCalledTimes(1); // Only one interval should be set
    });
  });

  describe('stopProcessing', () => {
    it('should stop the queue processing interval', () => {
      QueueManagerInstance.startProcessing(100);
      expect(setInterval).toHaveBeenCalledTimes(1);

      QueueManagerInstance.stopProcessing();
      expect(clearInterval).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Queue processing stopped.');

      // Calling stop again should do nothing
      QueueManagerInstance.stopProcessing();
      expect(clearInterval).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('getQueueSize', () => {
    it('should return the current size of the queue', async () => {
      expect(QueueManagerInstance.getQueueSize()).toBe(0);

      await QueueManagerInstance.addRequest({ websiteId: 'w1', paths: [{ path: '/p1', needsScraping: true }], baseWebsiteUrl: 'http://example.com' });
      expect(QueueManagerInstance.getQueueSize()).toBe(1);

      await QueueManagerInstance.addRequest({ websiteId: 'w1', paths: [{ path: '/p2', needsScraping: true }], baseWebsiteUrl: 'http://example.com' });
      expect(QueueManagerInstance.getQueueSize()).toBe(2);

      // Simulate processing one item
      Processor.processScrapeRequest.mockResolvedValue();
      QueueManagerInstance.startProcessing(100);
      jest.advanceTimersByTime(100);
      expect(QueueManagerInstance.getQueueSize()).toBe(1);
    });
  });
});