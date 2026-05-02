const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const env = require('./env');

// We create a dedicated axios instance for logging to prevent infinite loops 
// or shared state issues with the main API client.
const logClient = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 3000, // Short timeout so slow logs don't block the event loop
  headers: {
    'Authorization': `Bearer ${env.AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Configure robust retry logic for transient failures of the logging service
axiosRetry(logClient, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status >= 500;
  }
});

const ALLOWED_LEVELS = ['info', 'debug', 'error', 'fatal'];

const ALLOWED_PACKAGES = [
  "service", "controller", "route", "handler", 
  "middleware", "utils", "auth", "config", 
  "db", "repository", "domain", "cache", "cron_job"
];

/**
 * Production-grade Centralized Logging Function
 * Posts logs to the evaluation-service and acts as a local console fallback.
 * 
 * @param {string} stack - High-level module/context (e.g., "backend")
 * @param {string} level - Must be one of: info, debug, error, fatal
 * @param {string} pkg - Must be an allowed package like "service", "controller"
 * @param {string} message - Descriptive log message (max 48 chars)
 */
async function Log(stack, level, pkg, message) {
  // 1. Validation
  const sanitizedLevel = ALLOWED_LEVELS.includes(level) ? level : 'info';
  const sanitizedPkg = ALLOWED_PACKAGES.includes(pkg) ? pkg : 'utils';
  
  // Truncate message to exactly 48 chars to comply with evaluation API rules
  const sanitizedMessage = String(message).substring(0, 48);

  const payload = {
    stack,
    level: sanitizedLevel,
    package: sanitizedPkg,
    message: sanitizedMessage
  };

  // 2. Local Fallback (for debugging)
  const logPrefix = `[${sanitizedLevel.toUpperCase()}] [${stack}::${sanitizedPkg}]`;
  if (sanitizedLevel === 'error' || sanitizedLevel === 'fatal') {
    console.error(`${logPrefix} ${sanitizedMessage}`);
  } else {
    console.log(`${logPrefix} ${sanitizedMessage}`);
  }

  // 3. Fire-and-Forget External API Call
  try {
    logClient.post('/logs', payload).catch(err => {
      // If the log fails after all 3 retries, we print to standard error
      const responseData = err.response ? JSON.stringify(err.response.data) : err.message;
      console.error(`[LOG_FAILURE] Failed to push to remote server: ${err.message} - Data: ${responseData}`);
    });
  } catch (err) {
    console.error(`[LOG_CRITICAL_FAILURE] ${err.message}`);
  }
}

// Temporary wrapper to prevent app crashes until we refactor the rest of the app to use Log()
const legacyLogger = {
  info: (msg) => Log('backend', 'info', 'middleware', msg),
  error: (msg) => Log('backend', 'error', 'middleware', msg),
  warn: (msg) => Log('backend', 'info', 'middleware', msg),
  debug: (msg) => Log('backend', 'debug', 'middleware', msg)
};

module.exports = { Log, ...legacyLogger };
