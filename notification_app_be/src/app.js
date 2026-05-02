const express = require('express');
const morgan = require('morgan');
const notificationRoutes = require('./routes/notificationRoutes');
const errorMiddleware = require('./middlewares/errorMiddleware');
const AppError = require('./utils/errorHandler');
const logger = require('./config/logger');
const env = require('./config/env');

const app = express();

// Middleware to parse JSON
app.use(express.json());

// HTTP request logger middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Routes
app.use('/api/v1/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Welcome to the Vehicle Maintenance Scheduler Microservice. Use /api/v1/schedule/:depotId to get a schedule.'
  });
});

// Handle undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handling Middleware
app.use(errorMiddleware);

// Start server
const PORT = env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server is running in ${env.NODE_ENV} mode on port ${PORT}`);
});

// Handle Unhandled Rejections
process.on('unhandledRejection', err => {
  logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;
// Trigger nodemon restart to load fresh JWT token
