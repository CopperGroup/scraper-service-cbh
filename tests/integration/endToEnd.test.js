// tests/integration/endToEnd.test.js
const request = require('supertest');
const app = require('../../src/app'); // Import your Express app
const { SCRAPE_STATUS } = require('src/utils/constants'); // Use absolute path
const { CustomError, ValidationError, NotFoundError } = require('src/utils/errors'); // Use absolute path
const logger = require('src/utils/logger'); // Use absolute path

// --- Mock DB connection and models to prevent real DB connections during tests ---
// Mock the entire db/connection module
jest.mock('src/db/connection', () => { // Use absolute path
  const Sequelize = require('sequelize');
  return {
    sequelize: { // Mock a basic Sequelize instance
      authenticate: jest.fn().mockResolvedValue(true),
      sync: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(true),
      define: jest.fn(), // Mock define method
    },
    DataTypes: Sequelize.DataTypes, // Use real DataTypes for model definitions
    testDbConnection: jest.fn().mockResolvedValue(true), // Mock the connection test
  };
});

// Mock the ScrapedPath model itself, ensuring its methods are Jest mock functions
jest.mock('src/db/models/ScrapedPath', () => { // Use absolute path
  const { sequelize } = require('src/db/connection'); // Use the mocked connection
  const mockModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  };
  // Ensure sequelize.define returns our mock model
  sequelize.define.mockImplementation((name, attributes, options) => mockModel);
  return mockModel;
});

// Mock the entire ScrapedPathRepository module
jest.mock('src/db/repositories/scrapedPathRepository', () => ({ // Use absolute path
  findByUniqueIdentifiers: jest.fn(),
  create: jest.fn(),
  updateStatus: jest.fn(),
  findPathsToScrape: jest.fn(),
  updateStatusByUniqueIdentifiers: jest.fn(),
  findById: jest.fn(),
  findByWebsiteId: jest.fn(),
}));
// --- End of DB Mocking ---


// Mock external dependencies
jest.mock('src/core/scraper'); // Use absolute path
jest.mock('src/services/aiService'); // Use absolute path
jest.mock('src/services/mainService'); // Use absolute path
jest.mock('src/utils/logger', () => ({ // Use absolute path
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// --- Start of QueueManager Spy/Mock Setup ---
// Get the actual QueueManager module to access its real methods and internal state for spying/resetting
const actualQueueManager = jest.requireActual('src/core/queueManager');

// jest.useFakeTimers(); // REMOVE THIS LINE if `fakeTimers: { enableGlobally: true }` in jest.config.js

describe('End-to-End API Integration Tests', () => {
  const TEST_WEBSITE_ID = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
  const TEST_BASE_URL = 'https://integration-test.com';
  const TEST_PATH_NAME = '/integration-test-page';
  const FULL_TEST_URL = `${TEST_BASE_URL}${TEST_PATH_NAME}`;

  // Spies for QueueManager methods
  let addRequestSpy, startProcessingSpy, stopProcessingSpy, getQueueSizeSpy, processNextItemSpy;

  beforeEach(() => {
    // 1. Reset the actual QueueManager's internal state first
    actualQueueManager._resetQueue();

    // 2. Clear all mocks on previously mocked modules (important for spies/mocks)
    jest.clearAllMocks();

    // 3. Spy on the actual methods of QueueManager
    addRequestSpy = jest.spyOn(actualQueueManager, 'addRequest');
    startProcessingSpy = jest.spyOn(actualQueueManager, 'startProcessing');
    stopProcessingSpy = jest.spyOn(actualQueueManager, 'stopProcessing');
    getQueueSizeSpy = jest.spyOn(actualQueueManager, 'getQueueSize');
    processNextItemSpy = jest.spyOn(actualQueueManager, 'processNextItem');

    // 4. Configure mocks for QueueManager's behavior in tests
    // By default, let addRequest use its real implementation
    addRequestSpy.mockImplementation(actualQueueManager.addRequest);
    // Prevent startProcessing from setting up a real interval
    startProcessingSpy.mockImplementation(() => {
      logger.info('Mocked QueueManager.startProcessing called');
    });
    // Mock processNextItem to allow manual triggering of processing steps
    processNextItemSpy.mockImplementation(async () => {
      const item = actualQueueManager.__get__('scrapeQueue').shift(); // Access internal queue
      if (item) {
        await require('src/core/processor').processScrapeRequest(item); // Call the (mocked) Processor
      }
    });


    // 5. Configure mocks for other dependencies
    ScrapedPathRepository.findByUniqueIdentifiers.mockResolvedValue(null);
    ScrapedPathRepository.create.mockImplementation(data => Promise.resolve({ id: `mock-id-${Math.random()}`, ...data, createdAt: new Date(), updatedAt: new Date() }));
    ScrapedPathRepository.updateStatus.mockResolvedValue([1]);
    ScrapedPathRepository.findByWebsiteId.mockResolvedValue([]);


    Scraper.scrapePage.mockResolvedValue({ text: 'mock text', forms: [], buttons: [] });
    AiService.getSummary.mockResolvedValue({ summary: 'mock fresh summary' });
    MainService.getPreviousAiSummary.mockResolvedValue({ previousSummary: 'mock previous summary' });
    AiService.mergeSummaries.mockResolvedValue({ mergedSummary: 'mock merged summary' });
    MainService.sendNewSummary.mockResolvedValue({});
  });

  afterEach(() => {
    // These are now handled globally by jest.config.js if enableGlobally is true
    // If not global, keep these lines:
    // jest.runOnlyPendingTimers();
    // jest.useRealTimers();

    // Restore the spies after each test to prevent interference
    addRequestSpy.mockRestore();
    startProcessingSpy.mockRestore();
    stopProcessingSpy.mockRestore();
    getQueueSizeSpy.mockRestore();
    processNextItemSpy.mockRestore();
  });

  // Helper to manually advance the queue processing
  const advanceQueueProcessing = async (times = 1) => {
    for (let i = 0; i < times; i++) {
      await processNextItemSpy(); // Call the spied-on/mocked processNextItem
      await new Promise(resolve => setImmediate(resolve)); // Allow async operations within processNextItem to complete
    }
  };

  describe('POST /api/scrape-queue', () => {
    it('should accept a valid scrape request and return 202 status', async () => {
      const payload = {
        websiteId: TEST_WEBSITE_ID,
        paths: [{ path: TEST_PATH_NAME, needsScraping: true }],
        baseWebsiteUrl: TEST_BASE_URL,
      };

      const response = await request(app)
        .post('/api/scrape-queue')
        .send(payload)
        .expect(202);

      expect(response.body.message).toContain('Scrape request received');
      expect(response.body.queuedPaths).toHaveLength(1);
      expect(response.body.queuedPaths[0].pathName).toBe(TEST_PATH_NAME);
      expect(response.body.queuedPaths[0].status).toBe(SCRAPE_STATUS.QUEUED);
      expect(ScrapedPathRepository.create).toHaveBeenCalledTimes(1);
      expect(ScrapedPathRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        websiteId: TEST_WEBSITE_ID,
        pathName: TEST_PATH_NAME,
        baseUrl: TEST_BASE_URL,
        status: SCRAPE_STATUS.QUEUED,
      }));
      expect(addRequestSpy).toHaveBeenCalledTimes(1); // Check the spy
    });

    it('should return 400 for invalid request payload (missing websiteId)', async () => {
      const payload = {
        paths: [{ path: TEST_PATH_NAME, needsScraping: true }],
        baseWebsiteUrl: TEST_BASE_URL,
      };

      const response = await request(app)
        .post('/api/scrape-queue')
        .send(payload)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details[0].field).toBe('websiteId');
    });

    it('should return 400 for invalid path format', async () => {
      const payload = {
        websiteId: TEST_WEBSITE_ID,
        paths: [{ path: 'invalid-path', needsScraping: true }], // Missing leading slash
        baseWebsiteUrl: TEST_BASE_URL,
      };

      const response = await request(app)
        .post('/api/scrape-queue')
        .send(payload)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details[0].field).toBe('paths.0.path');
    });

    it('should return 500 if queue manager fails to add request', async () => {
      const payload = {
        websiteId: TEST_WEBSITE_ID,
        paths: [{ path: TEST_PATH_NAME, needsScraping: true }],
        baseWebsiteUrl: TEST_BASE_URL,
      };
      // Make the addRequest spy reject for this specific test
      addRequestSpy.mockRejectedValue(new Error('Internal queue error'));

      const response = await request(app)
        .post('/api/scrape-queue')
        .send(payload)
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('QUEUE_PROCESSING_ERROR');
      expect(response.body.message).toContain('Failed to queue scrape request.');
    });
  });

  describe('GET /websites/website-paths/:websiteId', () => {
    it('should return path statuses for a valid websiteId', async () => {
      const mockPaths = [
        {
          id: 'path-uuid-1',
          websiteId: TEST_WEBSITE_ID,
          pathName: '/blog',
          baseUrl: TEST_BASE_URL,
          status: SCRAPE_STATUS.SCAPED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'path-uuid-2',
          websiteId: TEST_WEBSITE_ID,
          pathName: '/about',
          baseUrl: TEST_BASE_URL,
          status: SCRAPE_STATUS.QUEUED,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      ScrapedPathRepository.findByWebsiteId.mockResolvedValue(mockPaths);

      const response = await request(app)
        .get(`/websites/website-paths/${TEST_WEBSITE_ID}`)
        .expect(200);

      expect(response.body.websiteId).toBe(TEST_WEBSITE_ID);
      expect(response.body.paths).toHaveLength(2);
      expect(response.body.paths[0].pathName).toBe('/blog');
      expect(response.body.paths[0].status).toBe(SCRAPE_STATUS.SCAPED);
      expect(response.body.paths[1].pathName).toBe('/about');
      expect(response.body.paths[1].status).toBe(SCRAPE_STATUS.QUEUED);
      expect(ScrapedPathRepository.findByWebsiteId).toHaveBeenCalledWith(TEST_WEBSITE_ID);
    });

    it('should return 404 if no paths are found for the websiteId', async () => {
      ScrapedPathRepository.findByWebsiteId.mockResolvedValue([]); // No paths found

      const response = await request(app)
        .get(`/websites/website-paths/${TEST_WEBSITE_ID}`)
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NOT_FOUND');
      expect(response.body.message).toContain('No paths found for websiteId');
      expect(ScrapedPathRepository.findByWebsiteId).toHaveBeenCalledWith(TEST_WEBSITE_ID);
    });

    it('should return 400 for an invalid websiteId format in URL', async () => {
      const invalidWebsiteId = 'not-a-uuid';

      const response = await request(app)
        .get(`/websites/website-paths/${invalidWebsiteId}`)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details[0].field).toBe('websiteId');
      expect(response.body.details[0].message).toContain('websiteId in URL must be a valid UUID');
      expect(ScrapedPathRepository.findByWebsiteId).not.toHaveBeenCalled(); // Should not hit repo if validation fails
    });

    it('should return 500 if database query fails', async () => {
      // Mock the repository call to reject with a CustomError for proper error handling
      ScrapedPathRepository.findByWebsiteId.mockRejectedValue(
          new CustomError('DB connection lost for test', 500, 'DB_FETCH_ERROR')
      );

      const response = await request(app)
        .get(`/websites/website-paths/${TEST_WEBSITE_ID}`)
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('DB_FETCH_ERROR'); // Now this assertion should pass
      expect(response.body.message).toContain('Failed to retrieve website path statuses.');
    });
  });

  describe('GET /api/health', () => {
    it('should return 200 OK for health check', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.message).toBe('Scraper microservice is running.');
    });
  });
});