// BACKEND/UTIL/redisHealth.js - DEBUGGING & FIXED VERSION

import redisClient from '../CONFIG/redisClient.js';

class RedisHealthTracker {
    constructor() {
        this.healthData = {
            status: 'disconnected',
            connected: false,
            connectionTime: null,
            responseTime: 0,
            uptime: 0,
            startTime: Date.now(),
            memory: {
                used: 0,
                peak: 0,
                total: 0,
                percentage: 0,
                fragmentation: 0
            },
            clients: {
                connected: 0,
                blocked: 0
            },
            keys: {
                total: 0,
                expired: 0,
                evicted: 0
            },
            stats: {
                totalCommands: 0,
                commandsPerSec: 0,
                hitRate: '0%',
                hits: 0,
                misses: 0,
                evictions: 0
            },
            replication: {
                role: 'master',
                connectedSlaves: 0
            },
            persistence: {
                lastSave: null,
                lastBgSave: null,
                rdbChanges: 0
            }
        };
    }

    /**
     * Check Redis connection health
     */
    async checkHealth() {
        try {
            const startTime = Date.now();

            // Ping Redis
            try {
                await redisClient.ping();
                this.healthData.status = 'connected';
                this.healthData.connected = true;
                this.healthData.connectionTime = new Date().toISOString();
            } catch (error) {
                this.healthData.status = 'disconnected';
                this.healthData.connected = false;
                this.healthData.responseTime = Date.now() - startTime;
                return this.healthData;
            }

            // Get INFO command data
            try {
                const info = await redisClient.info('all');
                this.parseInfo(info);
            } catch (error) {
                console.error('Error getting Redis info:', error.message);
            }

            this.healthData.responseTime = Date.now() - startTime;
            return this.healthData;
        } catch (error) {
            console.error('Redis health check error:', error);
            this.healthData.status = 'error';
            this.healthData.connected = false;
            return this.healthData;
        }
    }

    /**
     * Parse Redis INFO output - COMPLETELY FIXED
     */
    parseInfo(info) {
        try {
            const lines = info.split('\r\n');

            // Debug: Log the raw info
            // console.log('📊 DEBUG: Raw INFO output length:', lines.length, 'lines');

            // Store all parsed values
            let used_memory = 0;
            let used_memory_peak = 0;
            let total_system_memory = 0;
            let maxmemory = 0;
            let mem_fragmentation_ratio = 0;
            let connected_clients = 0;
            let blocked_clients = 0;
            let db0Info = null;
            let total_commands_processed = 0;
            let instantaneous_ops_per_sec = 0;
            let keyspace_hits = 0;
            let keyspace_misses = 0;
            let evicted_keys = 0;
            let role = 'master';
            let connected_slaves = 0;
            let last_save_time = null;
            let rdb_changes_since_last_save = 0;
            let uptime_in_seconds = 0;

            // Parse all lines
            for (const line of lines) {
                // Skip comments and empty lines
                if (!line || line.trim() === '' || line.startsWith('#')) {
                    continue;
                }

                // Skip lines without colon
                if (!line.includes(':')) {
                    continue;
                }

                const [key, value] = line.split(':');
                const trimmedKey = key.trim();
                const trimmedValue = value.trim();

                // ✅ Memory stats - Handle multiple possible keys
                if (trimmedKey === 'used_memory') {
                    used_memory = parseInt(trimmedValue) || 0;
                    // console.log('✓ used_memory:', used_memory);
                }
                if (trimmedKey === 'used_memory_peak') {
                    used_memory_peak = parseInt(trimmedValue) || 0;
                    // console.log('✓ used_memory_peak:', used_memory_peak);
                }
                if (trimmedKey === 'total_system_memory') {
                    total_system_memory = parseInt(trimmedValue) || 0;
                    // console.log('✓ total_system_memory:', total_system_memory);
                }
                if (trimmedKey === 'maxmemory') {
                    maxmemory = parseInt(trimmedValue) || 0;
                    // console.log('✓ maxmemory:', maxmemory);
                }
                if (trimmedKey === 'mem_fragmentation_ratio') {
                    mem_fragmentation_ratio = parseFloat(trimmedValue) || 0;
                    // console.log('✓ mem_fragmentation_ratio:', mem_fragmentation_ratio);
                }

                // Client stats
                if (trimmedKey === 'connected_clients') {
                    connected_clients = parseInt(trimmedValue) || 0;
                }
                if (trimmedKey === 'blocked_clients') {
                    blocked_clients = parseInt(trimmedValue) || 0;
                }

                // Key stats
                if (trimmedKey.startsWith('db')) {
                    db0Info = trimmedValue;
                    // console.log('✓ db info:', db0Info);
                }

                // Stats
                if (trimmedKey === 'total_commands_processed') {
                    total_commands_processed = parseInt(trimmedValue) || 0;
                }
                if (trimmedKey === 'instantaneous_ops_per_sec') {
                    instantaneous_ops_per_sec = parseInt(trimmedValue) || 0;
                }
                if (trimmedKey === 'keyspace_hits') {
                    keyspace_hits = parseInt(trimmedValue) || 0;
                }
                if (trimmedKey === 'keyspace_misses') {
                    keyspace_misses = parseInt(trimmedValue) || 0;
                }
                if (trimmedKey === 'evicted_keys') {
                    evicted_keys = parseInt(trimmedValue) || 0;
                }

                // Replication
                if (trimmedKey === 'role') {
                    role = trimmedValue || 'master';
                }
                if (trimmedKey === 'connected_slaves') {
                    connected_slaves = parseInt(trimmedValue) || 0;
                }

                // Persistence
                if (trimmedKey === 'last_save_time') {
                    last_save_time = new Date(parseInt(trimmedValue) * 1000).toISOString();
                }
                if (trimmedKey === 'rdb_changes_since_last_save') {
                    rdb_changes_since_last_save = parseInt(trimmedValue) || 0;
                }

                // Uptime
                if (trimmedKey === 'uptime_in_seconds') {
                    uptime_in_seconds = parseInt(trimmedValue) || 0;
                }
            }

            // ✅ NOW assign to healthData
            this.healthData.memory.used = used_memory;
            this.healthData.memory.peak = used_memory_peak;
            this.healthData.memory.fragmentation = mem_fragmentation_ratio;

            // ✅ CRITICAL FIX: Calculate percentage with fallback logic
            let percentage = 0;

            // First priority: use total_system_memory
            if (total_system_memory > 0) {
                // console.log('📈 Using total_system_memory for calculation');
                this.healthData.memory.total = total_system_memory;
                percentage = Math.round((used_memory / total_system_memory) * 100);
            }
            // Second priority: use maxmemory (if set)
            else if (maxmemory > 0) {
                // console.log('📈 Using maxmemory for calculation');
                this.healthData.memory.total = maxmemory;
                percentage = Math.round((used_memory / maxmemory) * 100);
            }
            // Third priority: calculate based on system (rough estimate)
            else {
                // console.log('📈 No system memory info, using estimate');
                // Rough estimate if neither key exists
                const estimatedTotal = used_memory_peak * 2;
                this.healthData.memory.total = estimatedTotal;
                if (estimatedTotal > 0) {
                    percentage = Math.round((used_memory / estimatedTotal) * 100);
                }
            }

            this.healthData.memory.percentage = Math.min(percentage, 100); // Cap at 100%
            // console.log('✅ Calculated percentage:', this.healthData.memory.percentage, '%');

            // Clients
            this.healthData.clients.connected = connected_clients;
            this.healthData.clients.blocked = blocked_clients;

            // Keys from db0
            if (db0Info) {
                const dbParts = db0Info.split(',');
                for (const part of dbParts) {
                    if (part.includes('keys=')) {
                        const keys = parseInt(part.split('=')[1]) || 0;
                        this.healthData.keys.total = keys;
                    }
                    if (part.includes('expires=')) {
                        const expires = parseInt(part.split('=')[1]) || 0;
                        this.healthData.keys.expired = expires;
                    }
                }
            }

            // Stats
            this.healthData.stats.totalCommands = total_commands_processed;
            this.healthData.stats.commandsPerSec = instantaneous_ops_per_sec;
            this.healthData.stats.hits = keyspace_hits;
            this.healthData.stats.misses = keyspace_misses;
            this.healthData.stats.evictions = evicted_keys;

            // Calculate hit rate
            const totalRequests = keyspace_hits + keyspace_misses;
            if (totalRequests > 0) {
                this.healthData.stats.hitRate = (
                    (keyspace_hits / totalRequests) * 100
                ).toFixed(2) + '%';
            } else {
                this.healthData.stats.hitRate = '0%';
            }

            // Replication
            this.healthData.replication.role = role;
            this.healthData.replication.connectedSlaves = connected_slaves;

            // Persistence
            this.healthData.persistence.lastSave = last_save_time;
            this.healthData.persistence.rdbChanges = rdb_changes_since_last_save;

            // Uptime
            this.healthData.uptime = uptime_in_seconds;

            // console.log('✅ ParseInfo completed successfully');
            // console.log('📊 Final memory data:', this.healthData.memory);

        } catch (error) {
            console.error('❌ Error parsing Redis info:', error);
        }
    }

    /**
     * Get current health data
     */
    getHealth() {
        return this.healthData;
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
     * Get memory statistics
     */
    async getMemoryStats() {
        try {
            if (!this.healthData.connected) {
                return { error: 'Redis not connected' };
            }

            // console.log('📊 getMemoryStats - returning:', this.healthData.memory);

            return {
                used: this.formatBytes(this.healthData.memory.used),
                peak: this.formatBytes(this.healthData.memory.peak),
                total: this.formatBytes(this.healthData.memory.total),
                percentage: this.healthData.memory.percentage,
                fragmentation: this.healthData.memory.fragmentation
            };
        } catch (error) {
            console.error('Error getting memory stats:', error);
            return { error: error.message };
        }
    }

    /**
     * Get key statistics
     */
    async getKeyStats() {
        try {
            if (!this.healthData.connected) {
                return { error: 'Redis not connected' };
            }

            return {
                total: this.healthData.keys.total,
                expired: this.healthData.keys.expired,
                evicted: this.healthData.stats.evictions,
                ttlAvg: 0
            };
        } catch (error) {
            console.error('Error getting key stats:', error);
            return { error: error.message };
        }
    }

    /**
     * Get hit/miss statistics
     */
    getHitMissStats() {
        return {
            hitRate: this.healthData.stats.hitRate,
            hits: this.healthData.stats.hits,
            misses: this.healthData.stats.misses,
            totalRequests: this.healthData.stats.hits + this.healthData.stats.misses
        };
    }

    /**
     * Get cache performance
     */
    getCachePerformance() {
        return {
            commandsPerSec: this.healthData.stats.commandsPerSec,
            totalCommands: this.healthData.stats.totalCommands,
            evictions: this.healthData.stats.evictions,
            connectedClients: this.healthData.clients.connected
        };
    }
}

// Export singleton instance
export default new RedisHealthTracker();