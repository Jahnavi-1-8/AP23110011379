const schedulerService = require('../services/schedulerService');
const logger = require('../config/logger');

exports.getSchedule = async (req, res, next) => {
  try {
    const { depotId } = req.params;

    if (!depotId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Depot ID is required'
      });
    }

    logger.info(`Generating schedule for depot: ${depotId}`);
    
    // Call service to generate optimal schedule
    const schedule = await schedulerService.generateOptimalSchedule(depotId);

    res.status(200).json({
      status: 'success',
      data: schedule
    });
  } catch (error) {
    next(error); // Pass to global error middleware
  }
};
