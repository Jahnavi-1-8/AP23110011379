require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  API_BASE_URL: process.env.API_BASE_URL || 'http://mock-api.local',
  AUTH_TOKEN: process.env.AUTH_TOKEN || 'dummy-token',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
