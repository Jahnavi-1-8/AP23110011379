const apiService = require('./apiService');
const { solveKnapsack } = require('../utils/knapsack');
const AppError = require('../utils/errorHandler');
const { Log } = require('../config/logger');

/**
 * Calculate the optimal maintenance schedule for a specific depot
 * @param {String} depotId 
 */
exports.generateOptimalSchedule = async (depotId) => {
  const startTime = Date.now();
  await Log('backend', 'info', 'service', `Starting schedule gen for depot ${depotId}`);

  try {
    // 1. Fetch data concurrently for performance
    await Log('backend', 'info', 'service', 'Fetching external APIs data');
    const [depotsData, vehiclesData] = await Promise.all([
      apiService.fetchDepots(),
      apiService.fetchVehicles()
    ]);

    const depotsList = typeof depotsData === 'string' ? JSON.parse(depotsData).depots : (depotsData.depots || []);
    const vehiclesList = typeof vehiclesData === 'string' ? JSON.parse(vehiclesData).vehicles : (vehiclesData.vehicles || []);

    // 2. Validate responses
    if (!Array.isArray(depotsList) || !Array.isArray(vehiclesList)) {
      await Log('backend', 'error', 'service', 'Invalid API response format');
      throw new AppError('Invalid response format from external APIs', 502);
    }
    await Log('backend', 'info', 'service', `Fetched depots and tasks successfully`);

    // 3. Find target depot using Number matching as requested
    const targetDepot = depotsList.find(d => Number(d.ID) === Number(depotId));
    
    if (!targetDepot) {
      await Log('backend', 'error', 'service', `Target depot ID ${depotId} not found`);
      throw new AppError(`Depot with ID ${depotId} not found`, 404);
    }

    const mechanicHours = targetDepot.MechanicHours;
    await Log('backend', 'info', 'service', `Depot found with capacity ${mechanicHours}`);

    if (mechanicHours <= 0) {
      await Log('backend', 'error', 'service', `Depot ${depotId} has 0 hours`);
      return {
        depotId,
        selectedTasks: [],
        totalImpact: 0,
        totalDuration: 0,
        remainingHours: 0,
        message: 'No available mechanic hours.'
      };
    }

    // 4. Extract tasks
    let allTasks = vehiclesList;

    if (allTasks.length === 0) {
      await Log('backend', 'error', 'service', `No tasks available`);
      return {
        depotId,
        selectedTasks: [],
        totalImpact: 0,
        totalDuration: 0,
        remainingHours: mechanicHours,
        message: 'No tasks available.'
      };
    }

    // 5. Run 0/1 Knapsack optimization
    const intCapacity = Math.floor(mechanicHours);
    const validTasks = allTasks.filter(t => t.Duration > 0 && t.Impact > 0)
                               .map(t => ({
                                 ...t,
                                 Duration: Math.ceil(t.Duration)
                               }));

    await Log('backend', 'info', 'service', `Starting knapsack optimization`);
    const algoStartTime = Date.now();
    
    const scheduleResult = solveKnapsack(validTasks, intCapacity);
    
    const algoEndTime = Date.now();
    await Log('backend', 'debug', 'service', `Optimization done in ${algoEndTime - algoStartTime}ms`);

    const totalExecutionTime = Date.now() - startTime;
    await Log('backend', 'info', 'service', `Schedule generated in ${totalExecutionTime}ms`);

    return {
      depotId,
      ...scheduleResult
    };

  } catch (error) {
    await Log('backend', 'error', 'service', `Schedule failure: ${error.message}`.substring(0, 48));
    throw error;
  }
};
