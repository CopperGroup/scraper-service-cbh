// src/db/connection.js
const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config'); // <<<<----- FIX: Changed from '../../config' to '../config'

// Initialize Sequelize with the connection URI
const sequelize = new Sequelize(config.databaseUrl, { // Use databaseUrl from config
  dialect: config.dialect || 'postgres', // Default to postgres if not specified
  logging: config.logging, // Use the logging setting from config
  dialectOptions: config.dialectOptions,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Function to test the database connection
async function testDbConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    // In a real app, you might want to exit the process or retry
    process.exit(1);
  }
}

// Export the sequelize instance and DataTypes for model definitions
module.exports = {
  sequelize,
  DataTypes,
  testDbConnection
};