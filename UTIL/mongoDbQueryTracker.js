// BACKEND/UTIL/mongoDbQueryTracker.js - NEW FILE

import mongoose from 'mongoose';

class MongoDBQueryTracker {
    constructor() {
        this.queryMetrics = {
            totalQueries: 0,
            totalTime: 0,
            avgTime: 0,
            byRoute: {},      // Queries grouped by route
            byCollection: {},  // Queries grouped by collection
            slowQueries: []    // Queries taking > 100ms
        };

        // Intercept Mongoose operations
        this.interceptMongoose();
    }

    /**
     * Intercept and track all Mongoose queries
     */
    interceptMongoose() {
        const self = this;

        // Hook into Mongoose query execution
        mongoose.Query.prototype.exec = (function(_exec) {
            return async function() {
                const startTime = Date.now();
                const queryType = this.op;
                const collection = this.mongooseCollection?.name || 'unknown';
                const currentRoute = global.currentRoute || '/unknown';

                // Execute actual query
                return _exec.apply(this, arguments)
                    .then(result => {
                        const duration = Date.now() - startTime;
                        self.recordQuery(queryType, collection, currentRoute, duration);
                        return result;
                    })
                    .catch(error => {
                        const duration = Date.now() - startTime;
                        self.recordQuery(queryType, collection, currentRoute, duration, error);
                        throw error;
                    });
            };
        })(mongoose.Query.prototype.exec);
    }

    /**
     * Record a database query
     */
    recordQuery(queryType, collection, route, duration, error = null) {
        // Update total metrics
        this.queryMetrics.totalQueries++;
        this.queryMetrics.totalTime += duration;
        this.queryMetrics.avgTime = this.queryMetrics.totalTime / this.queryMetrics.totalQueries;

        // Track by route
        if (!this.queryMetrics.byRoute[route]) {
            this.queryMetrics.byRoute[route] = {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                operations: {}
            };
        }

        this.queryMetrics.byRoute[route].count++;
        this.queryMetrics.byRoute[route].totalTime += duration;
        this.queryMetrics.byRoute[route].avgTime = 
            this.queryMetrics.byRoute[route].totalTime / this.queryMetrics.byRoute[route].count;

        // Track operations within route
        if (!this.queryMetrics.byRoute[route].operations[queryType]) {
            this.queryMetrics.byRoute[route].operations[queryType] = {
                count: 0,
                avgTime: 0,
                totalTime: 0
            };
        }
        this.queryMetrics.byRoute[route].operations[queryType].count++;
        this.queryMetrics.byRoute[route].operations[queryType].totalTime += duration;
        this.queryMetrics.byRoute[route].operations[queryType].avgTime =
            this.queryMetrics.byRoute[route].operations[queryType].totalTime / 
            this.queryMetrics.byRoute[route].operations[queryType].count;

        // Track by collection
        if (!this.queryMetrics.byCollection[collection]) {
            this.queryMetrics.byCollection[collection] = {
                count: 0,
                totalTime: 0,
                avgTime: 0
            };
        }
        this.queryMetrics.byCollection[collection].count++;
        this.queryMetrics.byCollection[collection].totalTime += duration;
        this.queryMetrics.byCollection[collection].avgTime =
            this.queryMetrics.byCollection[collection].totalTime / 
            this.queryMetrics.byCollection[collection].count;

        // Track slow queries (> 100ms)
        if (duration > 100) {
            this.queryMetrics.slowQueries.push({
                type: queryType,
                collection,
                route,
                duration,
                timestamp: new Date(),
                error: error ? error.message : null
            });

            // Keep only last 100 slow queries
            if (this.queryMetrics.slowQueries.length > 100) {
                this.queryMetrics.slowQueries = this.queryMetrics.slowQueries.slice(-100);
            }
        }

        // Debug logging (optional)
        if (duration > 50) {
            console.log(`📊 Query [${queryType}] on [${collection}] took ${duration}ms at [${route}]`);
        }
    }

    /**
     * Get metrics by route
     */
    getMetricsByRoute() {
        const metrics = {};
        
        for (const [route, data] of Object.entries(this.queryMetrics.byRoute)) {
            metrics[route] = {
                totalQueries: data.count,
                avgQueryTime: Math.round(data.avgTime * 100) / 100,
                totalQueryTime: data.totalTime,
                operations: data.operations
            };
        }

        return metrics;
    }

    /**
     * Get metrics by collection
     */
    getMetricsByCollection() {
        const metrics = {};
        
        for (const [collection, data] of Object.entries(this.queryMetrics.byCollection)) {
            metrics[collection] = {
                totalQueries: data.count,
                avgQueryTime: Math.round(data.avgTime * 100) / 100,
                totalQueryTime: data.totalTime
            };
        }

        return metrics;
    }

    /**
     * Get slow queries
     */
    getSlowQueries(limit = 20) {
        return this.queryMetrics.slowQueries
            .slice(-limit)
            .reverse();
    }

    /**
     * Get overall metrics
     */
    getOverallMetrics() {
        return {
            totalQueries: this.queryMetrics.totalQueries,
            avgQueryTime: Math.round(this.queryMetrics.avgTime * 100) / 100,
            totalQueryTime: this.queryMetrics.totalTime,
            routeCount: Object.keys(this.queryMetrics.byRoute).length,
            collectionCount: Object.keys(this.queryMetrics.byCollection).length,
            slowQueriesCount: this.queryMetrics.slowQueries.length
        };
    }

    /**
     * Reset metrics
     */
    reset() {
        this.queryMetrics = {
            totalQueries: 0,
            totalTime: 0,
            avgTime: 0,
            byRoute: {},
            byCollection: {},
            slowQueries: []
        };
    }

    /**
     * Get detailed report
     */
    getDetailedReport() {
        return {
            overall: this.getOverallMetrics(),
            byRoute: this.getMetricsByRoute(),
            byCollection: this.getMetricsByCollection(),
            slowQueries: this.getSlowQueries(20)
        };
    }
}

export default new MongoDBQueryTracker();