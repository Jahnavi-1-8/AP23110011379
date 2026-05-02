/**
 * 0/1 Knapsack Algorithm Implementation
 * 
 * Time Complexity: O(N * W) where N is number of tasks, W is MechanicHours capacity.
 * Space Complexity: O(N * W) for the DP table. (Can be optimized to O(W) if we only need max impact, 
 * but we need the actual items chosen, so O(N * W) space is required to track choices).
 * 
 * Note: If capacity is extremely large or fractional, an approximation algorithm (like Greedy with fractions) 
 * or scaling down values might be necessary due to memory constraints.
 * 
 * @param {Array} tasks - Array of task objects: { TaskId, Duration, Impact }
 * @param {Number} capacity - Available MechanicHours
 * @returns {Object} - Selected tasks, total impact, and total duration used
 */
function solveKnapsack(tasks, capacity) {
  const n = tasks.length;
  // Initialize DP table with 0s
  // dp[i][w] represents max impact using first i tasks with weight limit w
  const dp = Array(n + 1).fill(null).map(() => Array(capacity + 1).fill(0));

  // Build table dp[][] in bottom-up manner
  for (let i = 1; i <= n; i++) {
    const task = tasks[i - 1];
    const weight = task.Duration;
    const value = task.Impact;

    for (let w = 1; w <= capacity; w++) {
      if (weight <= w) {
        // Maximize between including current task or excluding it
        dp[i][w] = Math.max(value + dp[i - 1][w - weight], dp[i - 1][w]);
      } else {
        // Cannot include task due to weight constraint
        dp[i][w] = dp[i - 1][w];
      }
    }
  }

  // Reconstruct the selected items
  const selectedTasks = [];
  let res = dp[n][capacity];
  let w = capacity;
  let totalDuration = 0;

  for (let i = n; i > 0 && res > 0; i--) {
    // If result came from the top, the item is not included
    if (res !== dp[i - 1][w]) {
      // This item is included
      const includedTask = tasks[i - 1];
      selectedTasks.push(includedTask);
      
      // Since this item is included, its value is deducted
      res -= includedTask.Impact;
      w -= includedTask.Duration;
      totalDuration += includedTask.Duration;
    }
  }

  // selectedTasks is populated backwards, reverse it for chronological order if needed
  return {
    selectedTasks: selectedTasks.reverse(),
    totalImpact: dp[n][capacity],
    totalDuration: totalDuration,
    remainingHours: capacity - totalDuration
  };
}

module.exports = { solveKnapsack };
