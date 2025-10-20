import os from 'os';
import osUtils from 'os-utils';

class ServerMetrics {
    constructor() {
        this.requestCount = 0;
        this.responseTimes = [];
        this.errors = [];
        this.startTime = Date.now();
    }

    // Track request
    incrementRequest() {
        this.requestCount++;
    }

    // Track response time
    addResponseTime(time) {
        this.responseTimes.push(time);
        // Keep only last 100 response times
        if (this.responseTimes.length > 100) {
            this.responseTimes.shift();
        }
    }

    // Track error
    addError(error) {
        this.errors.push({
            message: error.message,
            stack: error.stack,
            timestamp: new Date()
        });
        // Keep only last 50 errors
        if (this.errors.length > 50) {
            this.errors.shift();
        }
    }

    // Get CPU usage (async)
    getCpuUsage() {
        return new Promise((resolve) => {
            osUtils.cpuUsage((usage) => {
                resolve((usage * 100).toFixed(2));
            });
        });
    }

    // Get memory usage
    getMemoryUsage() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        return {
            total: (totalMem / 1024 / 1024 / 1024).toFixed(2), // GB
            used: (usedMem / 1024 / 1024 / 1024).toFixed(2), // GB
            free: (freeMem / 1024 / 1024 / 1024).toFixed(2), // GB
            percentage: ((usedMem / totalMem) * 100).toFixed(2)
        };
    }

    // Get average response time
    getAvgResponseTime() {
        if (this.responseTimes.length === 0) return 0;
        const sum = this.responseTimes.reduce((a, b) => a + b, 0);
        return (sum / this.responseTimes.length).toFixed(2);
    }

    // Get uptime
    getUptime() {
        const uptime = Date.now() - this.startTime;
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        return { hours, minutes, milliseconds: uptime };
    }

    // Get all metrics
    async getMetrics() {
        const cpuUsage = await this.getCpuUsage();
        const memoryUsage = this.getMemoryUsage();
        const uptime = this.getUptime();
        
        return {
            cpu: {
                usage: cpuUsage,
                cores: os.cpus().length
            },
            memory: memoryUsage,
            uptime,
            requests: {
                total: this.requestCount,
                avgResponseTime: this.getAvgResponseTime()
            },
            errors: {
                total: this.errors.length,
                recent: this.errors.slice(-10)
            },
            system: {
                platform: os.platform(),
                nodeVersion: process.version,
                hostname: os.hostname()
            }
        };
    }

    // Reset metrics
    reset() {
        this.requestCount = 0;
        this.responseTimes = [];
        this.errors = [];
    }
}

export default new ServerMetrics();


//will you please expain me this code 