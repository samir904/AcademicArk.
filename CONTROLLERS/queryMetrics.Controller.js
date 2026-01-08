// BACKEND/CONTROLLERS/queryMetrics.Controller.js - NEW FILE

import mongoDbQueryTracker from '../UTIL/mongoDbQueryTracker.js';
import asyncWrap from '../UTIL/asyncWrap.js';

/**
 * Get overall query metrics
 */
export const getOverallQueryMetrics = asyncWrap(async (req, res) => {
    try {
        const metrics = mongoDbQueryTracker.getOverallMetrics();
        
        return res.status(200).json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Error getting query metrics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get query metrics',
            error: error.message
        });
    }
});

/**
 * Get query metrics by route
 * Shows: avg queries per route, total queries, operations breakdown
 */
export const getQueryMetricsByRoute = asyncWrap(async (req, res) => {
    try {
        const metrics = mongoDbQueryTracker.getMetricsByRoute();
        
        // Sort by most queries first
        const sortedMetrics = Object.entries(metrics)
            .sort((a, b) => b[1].totalQueries - a[1].totalQueries)
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});

        return res.status(200).json({
            success: true,
            data: sortedMetrics
        });
    } catch (error) {
        console.error('Error getting route query metrics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get route query metrics',
            error: error.message
        });
    }
});

/**
 * Get query metrics by collection
 * Shows: which collections are most queried
 */
export const getQueryMetricsByCollection = asyncWrap(async (req, res) => {
    try {
        const metrics = mongoDbQueryTracker.getMetricsByCollection();
        
        // Sort by most queries first
        const sortedMetrics = Object.entries(metrics)
            .sort((a, b) => b[1].totalQueries - a[1].totalQueries)
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});

        return res.status(200).json({
            success: true,
            data: sortedMetrics
        });
    } catch (error) {
        console.error('Error getting collection query metrics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get collection query metrics',
            error: error.message
        });
    }
});

/**
 * Get slow queries (> 100ms)
 */
export const getSlowQueries = asyncWrap(async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const slowQueries = mongoDbQueryTracker.getSlowQueries(limit);
        
        return res.status(200).json({
            success: true,
            data: {
                count: slowQueries.length,
                queries: slowQueries
            }
        });
    } catch (error) {
        console.error('Error getting slow queries:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get slow queries',
            error: error.message
        });
    }
});

/**
 * Get detailed query report (all metrics combined)
 */
export const getDetailedQueryReport = asyncWrap(async (req, res) => {
    try {
        const report = mongoDbQueryTracker.getDetailedReport();
        
        return res.status(200).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('Error getting query report:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get query report',
            error: error.message
        });
    }
});

/**
 * Reset query metrics
 */
export const resetQueryMetrics = asyncWrap(async (req, res) => {
    try {
        mongoDbQueryTracker.reset();
        
        return res.status(200).json({
            success: true,
            message: 'Query metrics reset successfully'
        });
    } catch (error) {
        console.error('Error resetting query metrics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reset query metrics',
            error: error.message
        });
    }
});