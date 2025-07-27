// tests/unit/db/scrapedPathRepository.test.js
const ScrapedPathRepository = require('../../../src/db/repositories/scrapedPathRepository');
const ScrapedPath = require('../../../src/db/models/ScrapedPath'); // The actual model
const { SCRAPE_STATUS } = require('../../../src/utils/constants');

// Mock the ScrapedPath Sequelize model methods
jest.mock('../../../src/db/models/ScrapedPath', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

describe('ScrapedPathRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockPathData = {
    id: 'test-uuid-123',
    websiteId: 'website-abc',
    pathName: '/test-path',
    baseUrl: 'https://test.com',
    status: SCRAPE_STATUS.QUEUED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('findByUniqueIdentifiers', () => {
    it('should find a path by unique identifiers', async () => {
      ScrapedPath.findOne.mockResolvedValue(mockPathData);
      const result = await ScrapedPathRepository.findByUniqueIdentifiers(
        mockPathData.websiteId,
        mockPathData.pathName,
        mockPathData.baseUrl
      );
      expect(ScrapedPath.findOne).toHaveBeenCalledWith({
        where: {
          websiteId: mockPathData.websiteId,
          pathName: mockPathData.pathName,
          baseUrl: mockPathData.baseUrl,
        },
      });
      expect(result).toEqual(mockPathData);
    });

    it('should return null if no path is found', async () => {
      ScrapedPath.findOne.mockResolvedValue(null);
      const result = await ScrapedPathRepository.findByUniqueIdentifiers('non-existent', '/path', 'http://none.com');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new scraped path record', async () => {
      const newData = {
        websiteId: 'new-website',
        pathName: '/new-path',
        baseUrl: 'https://new.com',
        status: SCRAPE_STATUS.QUEUED,
      };
      const createdInstance = { id: 'new-uuid', ...newData };
      ScrapedPath.create.mockResolvedValue(createdInstance);

      const result = await ScrapedPathRepository.create(newData);
      expect(ScrapedPath.create).toHaveBeenCalledWith(newData);
      expect(result).toEqual(createdInstance);
    });
  });

  describe('updateStatus', () => {
    it('should update the status of a scraped path by ID', async () => {
      ScrapedPath.update.mockResolvedValue([1]); // Sequelize update returns [affectedRowsCount]
      const result = await ScrapedPathRepository.updateStatus(mockPathData.id, SCRAPE_STATUS.SCRAPING);
      expect(ScrapedPath.update).toHaveBeenCalledWith(
        { status: SCRAPE_STATUS.SCRAPING },
        { where: { id: mockPathData.id } }
      );
      expect(result).toEqual([1]);
    });
  });

  describe('findPathsToScrape', () => {
    it('should find all paths with "queued" status', async () => {
      const queuedPaths = [
        { ...mockPathData, id: 'q1', status: SCRAPE_STATUS.QUEUED },
        { ...mockPathData, id: 'q2', pathName: '/another', status: SCRAPE_STATUS.QUEUED },
      ];
      ScrapedPath.findAll.mockResolvedValue(queuedPaths);
      const result = await ScrapedPathRepository.findPathsToScrape();
      expect(ScrapedPath.findAll).toHaveBeenCalledWith({
        where: {
          status: SCRAPE_STATUS.QUEUED,
        },
      });
      expect(result).toEqual(queuedPaths);
    });
  });

  describe('updateStatusByUniqueIdentifiers', () => {
    it('should update status using unique identifiers', async () => {
      ScrapedPath.update.mockResolvedValue([1]);
      const result = await ScrapedPathRepository.updateStatusByUniqueIdentifiers(
        mockPathData.websiteId,
        mockPathData.pathName,
        mockPathData.baseUrl,
        SCRAPE_STATUS.FAILED
      );
      expect(ScrapedPath.update).toHaveBeenCalledWith(
        { status: SCRAPE_STATUS.FAILED },
        {
          where: {
            websiteId: mockPathData.websiteId,
            pathName: mockPathData.pathName,
            baseUrl: mockPathData.baseUrl,
          },
        }
      );
      expect(result).toEqual([1]);
    });
  });

  describe('findById', () => {
    it('should find a path by its primary key (ID)', async () => {
      ScrapedPath.findByPk.mockResolvedValue(mockPathData);
      const result = await ScrapedPathRepository.findById(mockPathData.id);
      expect(ScrapedPath.findByPk).toHaveBeenCalledWith(mockPathData.id);
      expect(result).toEqual(mockPathData);
    });

    it('should return null if no path found by ID', async () => {
      ScrapedPath.findByPk.mockResolvedValue(null);
      const result = await ScrapedPathRepository.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('findByWebsiteId', () => {
    it('should find all paths for a given websiteId', async () => {
      const pathsForWebsite = [
        { ...mockPathData, id: 'p1', pathName: '/home' },
        { ...mockPathData, id: 'p2', pathName: '/products' },
      ];
      ScrapedPath.findAll.mockResolvedValue(pathsForWebsite);

      const result = await ScrapedPathRepository.findByWebsiteId(mockPathData.websiteId);

      expect(ScrapedPath.findAll).toHaveBeenCalledWith({
        where: {
          websiteId: mockPathData.websiteId,
        },
        attributes: ['id', 'pathName', 'baseUrl', 'status', 'updatedAt', 'createdAt'],
      });
      expect(result).toEqual(pathsForWebsite);
    });

    it('should return an empty array if no paths are found for the websiteId', async () => {
      ScrapedPath.findAll.mockResolvedValue([]);
      const result = await ScrapedPathRepository.findByWebsiteId('non-existent-website');
      expect(result).toEqual([]);
    });
  });
});