// src/config/index.js
require('dotenv').config(); // Load environment variables from .env file

const config = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  aiServiceBaseUrl: process.env.AI_SERVICE_BASE_URL,
  mainServiceBaseUrl: process.env.MAIN_SERVICE_BASE_URL,
  logLevel: process.env.LOG_LEVEL || 'info', // Default log level
  nodeEnv: process.env.NODE_ENV || 'development', // Node environment (development, production, test)
  // Add other configurations as needed, e.g., timeouts, API keys
  scraperTimeoutMs: parseInt(process.env.SCRAPER_TIMEOUT_MS || '30000', 10), // 30 seconds
  queueProcessingIntervalMs: parseInt(process.env.QUEUE_PROCESSING_INTERVAL_MS || '5000', 10), // 5 seconds
};

// Validate essential configurations
if (!config.databaseUrl) {
  console.error('FATAL ERROR: DATABASE_URL is not defined in environment variables.');
  process.exit(1);
}
if (!config.aiServiceBaseUrl) {
  console.error('FATAL ERROR: AI_SERVICE_BASE_URL is not defined in environment variables.');
  process.exit(1);
}
if (!config.mainServiceBaseUrl) {
  console.error('FATAL ERROR: MAIN_SERVICE_BASE_URL is not defined in environment variables.');
  process.exit(1);
}

module.exports = config;