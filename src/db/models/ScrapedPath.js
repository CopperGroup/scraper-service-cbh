// src/db/models/ScrapedPath.js
const { sequelize, DataTypes } = require('../connection');

const ScrapedPath = sequelize.define('ScrapedPath', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4, // Use UUID as primary key
    primaryKey: true,
    allowNull: false
  },
  websiteId: {
    type: DataTypes.STRING, // External ID from MongoDB
    allowNull: false
  },
  pathName: {
    type: DataTypes.STRING, // e.g., "/blog", "/help"
    allowNull: false
  },
  baseUrl: {
    type: DataTypes.STRING, // e.g., "https://my-website.com"
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('queued', 'scraping', 'scraped', 'failed'), // Define possible statuses
    defaultValue: 'queued',
    allowNull: false
  }
}, {
  tableName: 'scraped_paths', // Explicitly define the table name
  timestamps: true, // Adds createdAt and updatedAt columns
  indexes: [
    {
      unique: true,
      fields: ['websiteId', 'pathName', 'baseUrl'] // Ensure unique combination for a path on a website
    }
  ]
});

module.exports = ScrapedPath;