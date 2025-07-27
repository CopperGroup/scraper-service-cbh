// src/db/migrations/YYYYMMDD_create_scraped_paths_table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('scraped_paths', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      websiteId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      pathName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      baseUrl: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('queued', 'scraping', 'scraped', 'failed'),
        defaultValue: 'queued',
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add a unique constraint to ensure no duplicate paths for the same website
    await queryInterface.addConstraint('scraped_paths', {
      fields: ['websiteId', 'pathName', 'baseUrl'],
      type: 'unique',
      name: 'unique_website_path_baseurl'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('scraped_paths');
  }
};