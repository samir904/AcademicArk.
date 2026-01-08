// BACKEND/UTIL/mongoDbHealth.js - FINAL FIXED VERSION

import mongoose from 'mongoose';
import os from 'os';

class MongoDBHealthTracker {
    constructor() {
        this.healthData = {
            status: 'disconnected',
            connected: false,
            connectionTime: null,
            responseTime: 0,
            uptime: 0,
            startTime: Date.now(),
            collections: [],
            indexes: 0,
            dbSize: '0 MB',
            storageEngine: 'wiredTiger',
            version: 'unknown',
            operations: {
                totalInserts: 0,
                totalUpdates: 0,
                totalDeletes: 0,
                totalQueries: 0
            },
            performance: {
                avgQueryTime: 0,
                slowQueries: 0,
                queryCache: 0
            },
            replication: {
                isReplica: false,
                replicas: 0
            },
            memory: {
                resident: 0,
                virtual: 0,
                mapped: 0
            }
        };
    }

    /**
     * Check MongoDB connection health
     */
    async checkHealth() {
        try {
            const startTime = Date.now();

            // Check if connected
            if (mongoose.connection.readyState === 1) {
                this.healthData.status = 'connected';
                this.healthData.connected = true;
                this.healthData.connectionTime = new Date().toISOString();
            } else if (mongoose.connection.readyState === 0) {
                this.healthData.status = 'disconnected';
                this.healthData.connected = false;
            } else if (mongoose.connection.readyState === 2) {
                this.healthData.status = 'connecting';
                this.healthData.connected = false;
            }

            // Get database stats
            if (this.healthData.connected) {
                const db = mongoose.connection.db;
                
                // Get admin database
                const adminDb = db.admin();

                // Get server info
                try {
                    const serverStatus = await adminDb.serverStatus();
                    
                    // console.log('📊 DEBUG: serverStatus received');

                    this.healthData.uptime = serverStatus.uptime || 0;
                    this.healthData.version = serverStatus.version || 'unknown';
                    
                    // ✅ FIX 2: Memory stats from serverStatus.mem
                    if (serverStatus.mem) {
                        // console.log('📈 Memory stats found');
                        this.healthData.memory.resident = serverStatus.mem.resident || 0;
                        this.healthData.memory.virtual = serverStatus.mem.virtual || 0;
                        this.healthData.memory.mapped = serverStatus.mem.mapped || 0;
                        // console.log('✓ resident:', serverStatus.mem.resident);
                        // console.log('✓ virtual:', serverStatus.mem.virtual);
                        // console.log('✓ mapped:', serverStatus.mem.mapped);
                    } else {
                        console.log('⚠️ No mem data in serverStatus');
                    }

                    // Operations
                    if (serverStatus.opcounters) {
                        this.healthData.operations.totalInserts = serverStatus.opcounters.insert || 0;
                        this.healthData.operations.totalUpdates = serverStatus.opcounters.update || 0;
                        this.healthData.operations.totalDeletes = serverStatus.opcounters.delete || 0;
                        this.healthData.operations.totalQueries = serverStatus.opcounters.query || 0;
                    }

                    // Replication info
                    try {
                        const replStatus = await adminDb.replSetGetStatus();
                        if (replStatus) {
                            this.healthData.replication.isReplica = true;
                            this.healthData.replication.replicas = replStatus.members?.length || 0;
                        }
                    } catch (e) {
                        this.healthData.replication.isReplica = false;
                    }
                } catch (error) {
                    console.error('Error getting server status:', error.message);
                }

                // Get collections and calculate database size
                try {
                    const collections = await db.listCollections().toArray();
                    this.healthData.collections = collections.map(c => c.name);

                    // ✅ FIX 3: Count indexes using listIndexes() method (CORRECT API)
                    let totalIndexes = 0;
                    for (const collName of this.healthData.collections) {
                        try {
                            const collection = db.collection(collName);
                            // ✅ CORRECT METHOD: listIndexes() instead of getIndexes()
                            const indexesCursor = await collection.listIndexes();
                            const indexes = await indexesCursor.toArray();
                            const indexCount = indexes.length;
                            totalIndexes += indexCount;
                            // console.log(`✓ Collection "${collName}" has ${indexCount} indexes`);
                        } catch (error) {
                            console.error(`Error getting indexes for ${collName}:`, error.message);
                        }
                    }
                    this.healthData.indexes = totalIndexes;
                    // console.log('✅ Total indexes:', totalIndexes);
                } catch (error) {
                    console.error('Error getting collections:', error.message);
                }

                // ✅ FIX 1: Get database size from db.stats()
                try {
                    const dbStats = await db.stats();
                    // console.log('📊 Database stats received');
                    // console.log('✓ storageSize:', dbStats.storageSize);
                    
                    // Use storageSize for database size (most reliable)
                    if (dbStats.storageSize && dbStats.storageSize > 0) {
                        this.healthData.dbSize = this.formatBytes(dbStats.storageSize);
                        // console.log('✓ dbSize calculated from storageSize:', this.healthData.dbSize);
                    } else if (dbStats.dataSize && dbStats.dataSize > 0) {
                        // Fallback to dataSize
                        this.healthData.dbSize = this.formatBytes(dbStats.dataSize);
                        // console.log('✓ dbSize calculated from dataSize:', this.healthData.dbSize);
                    }
                } catch (error) {
                    // console.error('Error getting database size:', error.message);
                }
            }

            this.healthData.responseTime = Date.now() - startTime;
            // console.log('✅ Health check completed');
            // console.log('📊 Final healthData:', this.healthData);
            return this.healthData;
        } catch (error) {
            console.error('MongoDB health check error:', error);
            this.healthData.status = 'error';
            this.healthData.connected = false;
            this.healthData.responseTime = Date.now() - startTime;
            return this.healthData;
        }
    }

    /**
     * Get current health data
     */
    getHealth() {
        return this.healthData;
    }

    /**
     * Get connection details
     */
    getConnectionDetails() {
        return {
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name,
            readyState: mongoose.connection.readyState,
            collections: this.healthData.collections.length,
            status: this.healthData.status
        };
    }

    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get database statistics
     */
    async getDatabaseStats() {
        try {
            if (!this.healthData.connected) {
                return { error: 'Database not connected' };
            }

            const db = mongoose.connection.db;
            
            // Get dbStats with all size information
            let stats = {};
            try {
                stats = await db.stats();
                // console.log('📊 getDatabaseStats - stats:', stats);
            } catch (error) {
                // console.error('Error getting db.stats():', error.message);
                stats = {
                    dataSize: 0,
                    indexSize: 0,
                    storageSize: 0
                };
            }

            return {
                databases: stats.databases || 0,
                indexes: this.healthData.indexes,
                collections: this.healthData.collections.length,
                dataSize: this.formatBytes(stats.dataSize || 0),
                indexSize: this.formatBytes(stats.indexSize || 0),
                storageSize: this.formatBytes(stats.storageSize || 0),
                // ✅ Include database size from healthData
                dbSize: this.healthData.dbSize,
                // ✅ Include memory info
                memory: {
                    resident: this.formatBytes(this.healthData.memory.resident),
                    virtual: this.formatBytes(this.healthData.memory.virtual),
                    mapped: this.formatBytes(this.healthData.memory.mapped)
                }
            };
        } catch (error) {
            console.error('Error getting database stats:', error);
            return { error: error.message };
        }
    }

    /**
     * Get performance metrics
     */
    async getPerformanceMetrics() {
        try {
            if (!this.healthData.connected) {
                return { error: 'Database not connected' };
            }

            const db = mongoose.connection.db;
            const adminDb = db.admin();
            const serverStatus = await adminDb.serverStatus();

            return {
                connections: serverStatus.connections || {},
                network: serverStatus.network || {},
                opcounters: serverStatus.opcounters || {},
                opcountersRepl: serverStatus.opcountersRepl || {},
                memory: {
                    resident: this.formatBytes(serverStatus.mem?.resident || 0),
                    virtual: this.formatBytes(serverStatus.mem?.virtual || 0),
                    mapped: this.formatBytes(serverStatus.mem?.mapped || 0)
                }
            };
        } catch (error) {
            console.error('Error getting performance metrics:', error);
            return { error: error.message };
        }
    }

    /**
     * Get memory statistics
     */
    async getMemoryStats() {
        try {
            if (!this.healthData.connected) {
                return { error: 'Database not connected' };
            }

            const db = mongoose.connection.db;
            const adminDb = db.admin();
            const serverStatus = await adminDb.serverStatus();

            // console.log('📊 Getting memory stats');
            // console.log('✓ serverStatus.mem:', serverStatus.mem);

            return {
                resident: this.formatBytes(serverStatus.mem?.resident || 0),
                virtual: this.formatBytes(serverStatus.mem?.virtual || 0),
                mapped: this.formatBytes(serverStatus.mem?.mapped || 0),
                residentMB: serverStatus.mem?.resident ? Math.round(serverStatus.mem.resident) : 0,
                virtualMB: serverStatus.mem?.virtual ? Math.round(serverStatus.mem.virtual) : 0,
                mappedMB: serverStatus.mem?.mapped ? Math.round(serverStatus.mem.mapped) : 0
            };
        } catch (error) {
            console.error('Error getting memory stats:', error);
            return { error: error.message };
        }
    }
}

// Export singleton instance
export default new MongoDBHealthTracker();