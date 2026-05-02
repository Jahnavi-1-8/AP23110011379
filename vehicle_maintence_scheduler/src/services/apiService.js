const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const env = require('../config/env');
const logger = require('../config/logger');
const AppError = require('../utils/errorHandler');

// Create axios instance
const apiClient = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 5000, // 5 seconds timeout for API calls
  headers: {
    'Authorization': `Bearer ${env.AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Configure exponential backoff retry strategy for failed APIs
axiosRetry(apiClient, {
  retries: 3, // Number of retries
  retryDelay: axiosRetry.exponentialDelay, // Exponential backoff
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status >= 500;
  },
  onRetry: (retryCount, error, requestConfig) => {
    logger.warn(`Retrying API call (${retryCount}/3): ${error.message} - ${requestConfig.url}`);
  }
});

/**
 * Fetch all depots
 * @returns {Promise<Array>} List of depots
 */
exports.fetchDepots = async () => {
  try {
    const response = await apiClient.get('/depots');
    return response.data;
  } catch (error) {
    const status = error.response ? error.response.status : 'N/A';
    const data = error.response ? JSON.stringify(error.response.data) : error.message;
    logger.error(`Error fetching depots (Status: ${status}): ${data}`);
    throw new AppError('Failed to fetch depots from external API', 502);
  }
};

/**
 * Fetch all vehicles with their tasks
 * @returns {Promise<Array>} List of vehicles
 */
exports.fetchVehicles = async () => {
  try {
    const response = await apiClient.get('/vehicles');
    return response.data;
  } catch (error) {
    const status = error.response ? error.response.status : 'N/A';
    const data = error.response ? JSON.stringify(error.response.data) : error.message;
    logger.error(`Error fetching vehicles (Status: ${status}): ${data}`);
    throw new AppError('Failed to fetch vehicles from external API', 502);
  }
};

/**
 * Fetch all priority notifications
 * @returns {Promise<Array>} List of raw notifications
 */
exports.fetchNotifications = async () => {
  try {
    // Assuming the endpoint is /notifications
    const response = await apiClient.get('/notifications');
    return response.data;
  } catch (error) {
    const status = error.response ? error.response.status : 'N/A';
    const data = error.response ? JSON.stringify(error.response.data) : error.message;
    logger.error(`Error fetching notifications (Status: ${status}): ${data}`);
    throw new AppError('Failed to fetch notifications from external API', 502);
  }
};
