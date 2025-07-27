// tests/unit/api/scrapeController.test.js
const ScrapeController = require('../../../src/api/controllers/scrapeController');
const QueueManager = require('../../../src/core/queueManager');
const ScrapedPathRepository = require('../../../src/db/repositories/scrapedPathRepository');
const { NotFoundError, ValidationError } = require('../../../src/utils/errors');

// Mock external dependencies
jest.mock('../../../src/core/queueManager');
jest.mock('../../../src/db/repositories/scrapedPathRepository');
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('ScrapeController', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('queueScrapeRequest', () => {
    it('should successfully queue a scrape request and return 202', async () => {
      const requestBody = {
        websiteId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        paths: [{ path: '/test', needsScraping: true }],
        baseWebsiteUrl: 'https://example.com',
      };
      mockReq.body = requestBody;

      QueueManager.addRequest.mockResolvedValue([
        { pathName: '/test', status: 'queued', message: 'New path queued successfully.' },
      ]);
      QueueManager.getQueueSize.mockReturnValue(1);

      await ScrapeController.queueScrapeRequest(mockReq, mockRes, mockNext);

      expect(QueueManager.addRequest).toHaveBeenCalledWith(requestBody);
      expect(mockRes.status).toHaveBeenCalledWith(202);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Scrape request received and paths are being processed or queued.',
        queuedPaths: [{ pathName: '/test', status: 'queued', message: 'New path queued successfully.' }],
        queueSize: 1,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next with an error if queueing fails', async () => {
      const requestBody = {
        websiteId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        paths: [{ path: '/test', needsScraping: true }],
        baseWebsiteUrl: 'https://example.com',
      };
      mockReq.body = requestBody;
      const mockError = new Error('Database connection failed');
      QueueManager.addRequest.mockRejectedValue(mockError);

      await ScrapeController.queueScrapeRequest(mockReq, mockRes, mockNext);

      expect(QueueManager.addRequest).toHaveBeenCalledWith(requestBody);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toContain('Failed to queue scrape request.');
    });
  });

  describe('getWebsitePathStatuses', () => {
    it('should return path statuses for a given websiteId', async () => {
      const websiteId = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
      mockReq.params = { websiteId };
      const mockPaths = [
        {
          id: 'path1-uuid',
          websiteId,
          pathName: '/blog',
          baseUrl: 'https://example.com',
          status: 'scraped',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'path2-uuid',
          websiteId,
          pathName: '/about',
          baseUrl: 'https://example.com',
          status: 'queued',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      ScrapedPathRepository.findByWebsiteId.mockResolvedValue(mockPaths);

      await ScrapeController.getWebsitePathStatuses(mockReq, mockRes, mockNext);

      expect(ScrapedPathRepository.findByWebsiteId).toHaveBeenCalledWith(websiteId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        websiteId,
        paths: mockPaths.map(p => ({
          id: p.id,
          pathName: p.pathName,
          baseUrl: p.baseUrl,
          status: p.status,
          updatedAt: p.updatedAt,
          createdAt: p.createdAt,
        })),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next with NotFoundError if no paths are found', async () => {
      const websiteId = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
      mockReq.params = { websiteId };
      ScrapedPathRepository.findByWebsiteId.mockResolvedValue([]);

      await ScrapeController.getWebsitePathStatuses(mockReq, mockRes, mockNext);

      expect(ScrapedPathRepository.findByWebsiteId).toHaveBeenCalledWith(websiteId);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(mockNext.mock.calls[0][0].message).toContain('No paths found for websiteId');
    });

    it('should call next with an error if database query fails', async () => {
      const websiteId = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
      mockReq.params = { websiteId };
      const mockError = new Error('Database error');
      ScrapedPathRepository.findByWebsiteId.mockRejectedValue(mockError);

      await ScrapeController.getWebsitePathStatuses(mockReq, mockRes, mockNext);

      expect(ScrapedPathRepository.findByWebsiteId).toHaveBeenCalledWith(websiteId);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toContain('Failed to retrieve website path statuses.');
    });
  });

  describe('healthCheck', () => {
    it('should return 200 OK for health check', () => {
      ScrapeController.healthCheck(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ status: 'ok', message: 'Scraper microservice is running.' });
    });
  });
});