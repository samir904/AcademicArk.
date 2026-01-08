// BACKEND/CONTROLLERS/mongoDbHealthController.js

import mongoDbHealth from '../UTIL/mongoDbHealth.js';
import Apperror from '../UTIL/error.util.js';

/**
 * Get MongoDB database health
 * Returns: connection status, uptime, size, operations, memory
 */
export const getMongoDBHealth = async (req, res, next) => {
    try {
        const health = await mongoDbHealth.checkHealth();

        res.status(200).json({
            success: true,
            message: 'MongoDB health retrieved successfully',
            data: health
        });
    } catch (error) {
        console.error('MongoDB health error:', error);
        return next(new Apperror('Failed to get MongoDB health', 500));
    }
};

/**
 * Get database statistics
 * Returns: size, indexes, collections count
 */
export const getDatabaseStats = async (req, res, next) => {
    try {
        const stats = await mongoDbHealth.getDatabaseStats();

        res.status(200).json({
            success: true,
            message: 'Database statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        console.error('Database stats error:', error);
        return next(new Apperror('Failed to get database stats', 500));
    }
};

/**
 * Get performance metrics
 * Returns: connections, network, operations
 */
export const getPerformanceMetrics = async (req, res, next) => {
    try {
        const metrics = await mongoDbHealth.getPerformanceMetrics();

        res.status(200).json({
            success: true,
            message: 'Performance metrics retrieved successfully',
            data: metrics
        });
    } catch (error) {
        console.error('Performance metrics error:', error);
        return next(new Apperror('Failed to get performance metrics', 500));
    }
};

/**
 * Get connection details
 * Returns: host, port, name, collections
 */
export const getConnectionDetails = async (req, res, next) => {
    try {
        const details = mongoDbHealth.getConnectionDetails();

        res.status(200).json({
            success: true,
            message: 'Connection details retrieved successfully',
            data: details
        });
    } catch (error) {
        console.error('Connection details error:', error);
        return next(new Apperror('Failed to get connection details', 500));
    }
};