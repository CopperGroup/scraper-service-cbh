// tests/e2e/scraper.e2e.test.js
const request = require('supertest');
const app = require('../../src/app'); // Your Express app
const ScrapedPathRepository = require('../../src/db/repositories/scrapedPathRepository');
const Scraper = require('../../src/core/scraper');
const AiService = require('../../src/services/aiService');
const MainService = require('../../src/services/mainService');
const { SCRAPE_STATUS } = require('../../src/utils/constants');
const { CustomError } = require('../../src/utils/errors'); // Import CustomError for mocking
const logger = require('../../src/utils/logger');

// --- Mock DB connection and models to prevent real DB connections during tests ---
// Mock the entire db/connection module
jest.mock('../../src/db/connection', () => {
  const Sequelize = require('sequelize'); // Import real Sequelize to get DataTypes
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
jest.mock('../../src/db/models/ScrapedPath', () => {
  const { sequelize } = require('../../src/db/connection'); // Use the mocked connection
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
jest.mock('../../src/db/repositories/scrapedPathRepository', () => ({
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
jest.mock('../../src/core/scraper');
jest.mock('../../src/services/aiService');
jest.mock('../../src/services/mainService');
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// --- Start of QueueManager Spy/Mock Setup ---
// Get the actual QueueManager module to access its real methods and internal state for spying/resetting
const actualQueueManager = jest.requireActual('../../src/core/queueManager');

// jest.useFakeTimers(); // REMOVE THIS LINE if `fakeTimers: { enableGlobally: true }` in jest.config.js

describe('Scraper Microservice E2E Flow', () => {
  const TEST_WEBSITE_ID = 'e1e2e3e4-f5f6-7890-1234-567890abcdef';
  const TEST_BASE_URL = 'http://mock-website-to-scrape.com';
  const TEST_PATH_NAME = '/e2e-test-page';
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
        await require('../../src/core/processor').processScrapeRequest(item); // Call the (mocked) Processor
      }
    });


    // 5. Configure mocks for other dependencies
    ScrapedPathRepository.findByUniqueIdentifiers.mockResolvedValue(null);
    ScrapedPathRepository.create.mockImplementation(data => Promise.resolve({ id: `mock-id-${Math.random()}`, ...data, createdAt: new Date(), updatedAt: new Date() }));
    ScrapedPathRepository.updateStatus.mockResolvedValue([1]);
    ScrapedPathRepository.findByWebsiteId.mockResolvedValue([]);


    Scraper.scrapePage.mockResolvedValue({
      text: `Content from ${FULL_TEST_URL}`,
      forms: [{ name: 'e2e_form' }],
      buttons: [{ text: 'e2e_button' }],
    });
    AiService.getSummary.mockResolvedValue({ summary: 'E2E fresh summary'});
    MainService.getPreviousAiSummary.mockResolvedValue({ previousSummary: 'E2E previous summary' });
    AiService.mergeSummaries.mockResolvedValue({ mergedSummary: 'E2E merged summary' });
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

  it('should successfully process a scrape request from API to final status update', async () => {
    const payload = {
      websiteId: TEST_WEBSITE_ID,
      paths: [{ path: TEST_PATH_NAME, needsScraping: true }],
      baseWebsiteUrl: TEST_BASE_URL,
    };

    // 1. Send the API request to queue the scrape
    const postResponse = await request(app)
      .post('/api/scrape-queue')
      .send(payload)
      .expect(202);

    expect(postResponse.body.message).toContain('Scrape request received');
    expect(postResponse.body.queuedPaths).toHaveLength(1);
    expect(postResponse.body.queuedPaths[0].pathName).toBe(TEST_PATH_NAME);
    expect(postResponse.body.queuedPaths[0].status).toBe(SCRAPE_STATUS.QUEUED);
    expect(ScrapedPathRepository.create).toHaveBeenCalledTimes(1);
    expect(ScrapedPathRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      websiteId: TEST_WEBSITE_ID,
      pathName: TEST_PATH_NAME,
      baseUrl: TEST_BASE_URL,
      status: SCRAPE_STATUS.QUEUED,
    }));
    expect(addRequestSpy).toHaveBeenCalledTimes(1); // Check the spy

    // 2. Simulate the queue processing the item
    await advanceQueueProcessing();

    // Verify the full workflow happened
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(expect.any(String), SCRAPE_STATUS.SCRAPING);
    expect(Scraper.scrapePage).toHaveBeenCalledWith(FULL_TEST_URL);
    expect(AiService.getSummary).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Content from') }));
    expect(MainService.getPreviousAiSummary).toHaveBeenCalledWith(TEST_WEBSITE_ID);
    expect(AiService.mergeSummaries).toHaveBeenCalledWith('E2E fresh summary', 'E2E previous summary', expect.objectContaining({ text: expect.stringContaining('Content from') }));
    expect(MainService.sendNewSummary).toHaveBeenCalledWith(TEST_WEBSITE_ID, 'E2E merged summary');
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(expect.any(String), SCRAPE_STATUS.SCAPED);

    // 3. Verify the status via the GET endpoint
    ScrapedPathRepository.findByWebsiteId.mockResolvedValue([
      {
        id: 'mock-db-id-123', // This would be the actual ID from the create mock
        websiteId: TEST_WEBSITE_ID,
        pathName: TEST_PATH_NAME,
        baseUrl: TEST_BASE_URL,
        status: SCRAPE_STATUS.SCAPED,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ]);

    const getResponse = await request(app)
      .get(`/websites/website-paths/${TEST_WEBSITE_ID}`)
      .expect(200);

    expect(getResponse.body.websiteId).toBe(TEST_WEBSITE_ID);
    expect(getResponse.body.paths).toHaveLength(1);
    expect(getResponse.body.paths[0].pathName).toBe(TEST_PATH_NAME);
    expect(getResponse.body.paths[0].status).toBe(SCRAPE_STATUS.SCAPED);
  });

  it('should update status to FAILED if any step in processing fails', async () => {
    const payload = {
      websiteId: TEST_WEBSITE_ID,
      paths: [{ path: TEST_PATH_NAME, needsScraping: true }],
      baseWebsiteUrl: TEST_BASE_URL,
    };

    // Simulate scraper failure
    Scraper.scrapePage.mockRejectedValue(new Error('Mock scraping failed'));

    await request(app)
      .post('/api/scrape-queue')
      .send(payload)
      .expect(202); // Still 202 because queueing is successful

    await advanceQueueProcessing(); // Let the processing run

    // Verify status update to FAILED
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(expect.any(String), SCRAPE_STATUS.SCRAPING);
    expect(ScrapedPathRepository.updateStatus).toHaveBeenCalledWith(expect.any(String), SCRAPE_STATUS.FAILED);

    // Verify that subsequent steps were not called
    expect(AiService.getSummary).not.toHaveBeenCalled();
    expect(MainService.getPreviousAiSummary).not.toHaveBeenCalled();
    expect(AiService.mergeSummaries).not.toHaveBeenCalled();
    expect(MainService.sendNewSummary).not.toHaveBeenCalled();

    // Verify the status via the GET endpoint
    ScrapedPathRepository.findByWebsiteId.mockResolvedValue([
      {
        id: 'mock-db-id-123',
        websiteId: TEST_WEBSITE_ID,
        pathName: TEST_PATH_NAME,
        baseUrl: TEST_BASE_URL,
        status: SCRAPE_STATUS.FAILED, // Expect FAILED status
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ]);

    const getResponse = await request(app)
      .get(`/websites/website-paths/${TEST_WEBSITE_ID}`)
      .expect(200);

    expect(getResponse.body.paths[0].status).toBe(SCRAPE_STATUS.FAILED);
  });
});