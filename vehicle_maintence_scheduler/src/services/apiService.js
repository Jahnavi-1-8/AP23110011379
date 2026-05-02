const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const env = require('../config/env');
const logger = require('../config/logger');
const AppError = require('../utils/errorHandler');

const fallbackData = {
  depots: [
    { ID: 1, MechanicHours: 8 },
    { ID: 2, MechanicHours: 6 }
  ],
  vehicles: [
    { ID: 101, DepotId: 1, Duration: 2, Impact: 30, Task: 'Oil change' },
    { ID: 102, DepotId: 1, Duration: 4, Impact: 60, Task: 'Brake inspection' },
    { ID: 103, DepotId: 2, Duration: 3, Impact: 45, Task: 'Tire replacement' },
    { ID: 104, DepotId: 2, Duration: 1, Impact: 20, Task: 'Battery check' }
  ]
};

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

const handleApiError = (error, resourceName) => {
  const status = error.response?.status || 502;
  const data = error.response ? JSON.stringify(error.response.data) : error.message;
  logger.error(`Error fetching ${resourceName} (Status: ${status}): ${data}`);

  if (status === 401 && env.NODE_ENV !== 'production') {
    logger.warn(`Using local fallback ${resourceName} data because external API auth failed`);
    return fallbackData[resourceName];
  }

  throw new AppError(`Failed to fetch ${resourceName} from external API`, status);
};

/**
 * Fetch all depots
 * @returns {Promise<Array>} List of depots
 */
exports.fetchDepots = async () => {
  try {
    const response = await apiClient.get('/depots');
    return response.data;
  } catch (error) {
    return handleApiError(error, 'depots');
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
    return handleApiError(error, 'vehicles');
  }
};
