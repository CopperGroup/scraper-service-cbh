// src/utils/logger.js
const { createLogger, format, transports } = require('winston');
const config = require('../config');

const { combine, timestamp, printf, colorize, align } = format;

// Custom log format for console
const consoleLogFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let log = `${timestamp} ${level}: ${message}`;
  if (Object.keys(metadata).length) {
    log += ` ${JSON.stringify(metadata)}`;
  }
  return log;
});

const logger = createLogger({
  level: config.logLevel, // Set log level from config
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
  },
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    // For production, you might want JSON format
    config.nodeEnv === 'production' ? format.json() : colorize(),
    config.nodeEnv === 'production' ? format.uncolorize() : align(), // Align for better readability in dev
    consoleLogFormat
  ),
  transports: [
    new transports.Console(), // Log to console
    // In production, you might add file transports or external logging services (e.g., Papertrail, Splunk)
    // new transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new transports.File({ filename: 'logs/combined.log' })
  ],
  exceptionHandlers: [
    new transports.Console(),
    // new transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new transports.Console(),
    // new transports.File({ filename: 'logs/rejections.log' })
  ]
});

module.exports = logger;