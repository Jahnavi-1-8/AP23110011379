const express = require('express');
const router = express.Router();
const schedulerController = require('../controllers/schedulerController');

// GET /api/v1/schedule/:depotId
router.get('/:depotId', schedulerController.getSchedule);

module.exports = router;
