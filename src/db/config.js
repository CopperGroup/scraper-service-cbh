// src/db/config.js
require('dotenv').config(); // Ensure dotenv is loaded to access process.env.DATABASE_URL

module.exports = {
  development: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: console.log, // Enable logging for development/migrations
    dialectOptions: {
      // Optional: If running locally with a self-signed cert or no SSL
      // ssl: {
      //   require: false,
      //   rejectUnauthorized: false
      // }
    }
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    logging: false, // Disable logging for production for performance
    dialectOptions: {
      ssl: {
        require: true, // Enforce SSL in production
        rejectUnauthorized: false // Adjust based on your cloud provider's SSL certificate setup
      }
    }
  },
  test: {
    url: process.env.TEST_DATABASE_URL || 'postgres://user:password@localhost:5433/test_scraper_db', // Separate DB for tests
    dialect: 'postgres',
    logging: false
  }
};