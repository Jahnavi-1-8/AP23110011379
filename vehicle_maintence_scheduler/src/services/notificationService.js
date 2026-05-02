const apiService = require('./apiService');
const MinHeap = require('../utils/minHeap');
const { Log } = require('../config/logger');
const AppError = require('../utils/errorHandler');

/**
 * Calculates priority score of a notification based on its type and recency
 * 
/**
 * Calculates priority score of a notification based on its type and recency
 * 
 * Base Score:
 * - Placement: 100
 * - Result: 80
 * - Event: 40
 * - Default: 20
 * 
 * Recency Penalty: -1 point per hour old (instead of minute)
 * 
 * @param {Object} notif 
 */
function calculatePriorityScore(notif) {
  let baseScore = 20;
  if (notif.Type === 'Placement') baseScore = 100;
  else if (notif.Type === 'Result') baseScore = 80;
  else if (notif.Type === 'Event') baseScore = 40;

  // Assuming notif.Timestamp exists, otherwise calculate using Date.now() if simulated
  const timestamp = notif.Timestamp ? new Date(notif.Timestamp).getTime() : Date.now();
  const hoursOld = (Date.now() - timestamp) / (1000 * 60 * 60);
  
  // Decaying priority: older notifications lose urgency (1 point per hour)
  return Math.max(0, Math.floor(baseScore - hoursOld));
}

/**
 * Process notifications stream to extract top 10 Priority Inbox
 */
exports.getPriorityInbox = async () => {
  const startTime = Date.now();
  await Log('backend', 'info', 'service', 'Fetching notifications stream');

  try {
    const data = await apiService.fetchNotifications();
    const notifications = Array.isArray(data) ? data : (data.notifications || []);
    
    if (!notifications.length) {
      await Log('backend', 'info', 'service', 'No notifications found');
      return [];
    }

    // Initialize Min-Heap bounded to Top 10 items
    const k = 10;
    const minHeap = new MinHeap(k);

    // Stream process all notifications in O(N log K) time
    for (const notif of notifications) {
      const score = calculatePriorityScore(notif);
      minHeap.push({ ...notif, score });
    }

    // Retrieve strictly the top K elements
    const topNotifications = minHeap.getSortedArray();

    const executionTime = Date.now() - startTime;
    await Log('backend', 'info', 'service', `Processed priority inbox in ${executionTime}ms`.substring(0, 48));

    return topNotifications;
  } catch (error) {
    await Log('backend', 'error', 'service', `Inbox processing failed: ${error.message}`.substring(0, 48));
    throw error;
  }
};
