const notificationService = require('../services/notificationService');
const { Log } = require('../config/logger');

exports.getPriorityInbox = async (req, res, next) => {
  try {
    await Log('backend', 'info', 'controller', 'Received Priority Inbox request');
    
    const inbox = await notificationService.getPriorityInbox();

    res.status(200).json({
      status: 'success',
      data: inbox
    });
  } catch (error) {
    next(error);
  }
};
