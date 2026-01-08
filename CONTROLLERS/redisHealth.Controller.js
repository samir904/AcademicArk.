// BACKEND/CONTROLLERS/redisHealthController.js

import redisHealth from '../UTIL/redisHealth.js';
import Apperror from '../UTIL/error.util.js';

/**
 * Get Redis health status
 * Returns: connection status, memory, clients, performance
 */
export const getRedisHealth = async (req, res, next) => {
    try {
        const health = await redisHealth.checkHealth();

        res.status(200).json({
            success: true,
            message: 'Redis health retrieved successfully',
            data: health
        });
    } catch (error) {
        console.error('Redis health error:', error);
        return next(new Apperror('Failed to get Redis health', 500));
    }
};

/**
 * Get memory statistics
 * Returns: memory usage, peak, percentage
 */
export const getMemoryStats = async (req, res, next) => {
    try {
        const stats = await redisHealth.getMemoryStats();

        res.status(200).json({
            success: true,
            message: 'Memory statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        console.error('Memory stats error:', error);
        return next(new Apperror('Failed to get memory stats', 500));
    }
};

/**
 * Get key statistics
 * Returns: total keys, expired, evicted
 */
export const getKeyStats = async (req, res, next) => {
    try {
        const stats = await redisHealth.getKeyStats();

        res.status(200).json({
            success: true,
            message: 'Key statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        console.error('Key stats error:', error);
        return next(new Apperror('Failed to get key stats', 500));
    }
};

/**
 * Get hit/miss statistics
 * Returns: hit rate, hits, misses
 */
export const getHitMissStats = async (req, res, next) => {
    try {
        const stats = redisHealth.getHitMissStats();

        res.status(200).json({
            success: true,
            message: 'Hit/Miss statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        console.error('Hit/Miss stats error:', error);
        return next(new Apperror('Failed to get hit/miss stats', 500));
    }
};

/**
 * Get cache performance
 * Returns: commands per sec, evictions, connected clients
 */
export const getCachePerformance = async (req, res, next) => {
    try {
        const performance = redisHealth.getCachePerformance();

        res.status(200).json({
            success: true,
            message: 'Cache performance retrieved successfully',
            data: performance
        });
    } catch (error) {
        console.error('Cache performance error:', error);
        return next(new Apperror('Failed to get cache performance', 500));
    }
};