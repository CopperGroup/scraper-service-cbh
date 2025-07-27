// src/app.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const { sequelize, testDbConnection } = require('./db/connection');
const scrapeRoutes = require('./api/routes/scrapeRoutes');
const errorHandler = require('./api/middlewares/errorHandler');
const QueueManager = require('./core/queueManager');

const app = express();

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API Routes
app.use('/api', scrapeRoutes);

// Centralized Error Handling Middleware (MUST be last middleware)
app.use(errorHandler);

// Function to start the server
const startServer = async () => {
  try {
    // Test database connection
    await testDbConnection();

    // Sync Sequelize models with the database (only for development/testing, migrations are preferred for production)
    // await sequelize.sync({ alter: true });
    logger.info('Database models synchronized (or migrations handled separately).');

    // Start the queue processing
    QueueManager.startProcessing(config.queueProcessingIntervalMs);

    // Start the Express server
    const server = app.listen(config.port, () => { // Capture the server instance
      logger.info(`Scraper microservice listening on port ${config.port} in ${config.nodeEnv} mode.`);
    });

    // Handle graceful shutdown for the server instance
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      QueueManager.stopProcessing();
      await sequelize.close();
      server.close(() => { // Use server.close()
        logger.info('HTTP server closed. Database connection closed. Queue processing stopped.');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT signal received: closing HTTP server');
      QueueManager.stopProcessing();
      await sequelize.close();
      server.close(() => { // Use server.close()
        logger.info('HTTP server closed. Database connection closed. Queue processing stopped.');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1); // Exit process if server fails to start
  }
};

// Only start the server if this file is run directly (not imported as a module for testing)
if (require.main === module) {
  startServer();
}

module.exports = app; // Export app for testing purposes