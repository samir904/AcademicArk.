class SessionTracker {
    constructor() {
        // Store active sessions: { userId: lastActivityTime }
        this.activeSessions = new Map();
        // Store max concurrent users
        this.maxConcurrent = 0;
        this.peakTime = null; // Track when max occurred
        this.sessionTimeout = 5 * 60 * 1000; // 5 minutes of inactivity = session expired
        this.concurrentSnapshots = []; // Track concurrent users over time for averaging
        
        // Cleanup expired sessions every minute
        setInterval(() => this.cleanupExpiredSessions(), 60 * 1000);

        // Take snapshot every 5 minutes for averaging
        setInterval(() => this.takeSnapshot(), 5 * 60 * 1000);//what is this snapshot how it is working expain me in detail ok 
    }

    // Record user activity
    recordActivity(userId) {
        if (!userId) return;
        
        this.activeSessions.set(userId, Date.now());
        
        // Update max concurrent if needed
        const currentCount = this.activeSessions.size;
        if (currentCount > this.maxConcurrent) {
            this.maxConcurrent = currentCount;
            this.peakTime = new Date();
        }
    }

    takeSnapshot() {
        this.cleanupExpiredSessions();
        this.concurrentSnapshots.push(this.activeSessions.size);
        // Keep only last 288 snapshots (24 hours worth at 5-minute intervals)
        if (this.concurrentSnapshots.length > 288) {
            this.concurrentSnapshots.shift();
        }
    }

    getAvgConcurrent() {
        if (this.concurrentSnapshots.length === 0) return 0;
        const sum = this.concurrentSnapshots.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.concurrentSnapshots.length);
    }

    // Remove expired sessions
    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [userId, lastActivity] of this.activeSessions.entries()) {
            if (now - lastActivity > this.sessionTimeout) {
                this.activeSessions.delete(userId);
            }
        }
    }

    // Get current concurrent users
    getCurrentConcurrent() {
        this.cleanupExpiredSessions();
        return this.activeSessions.size;
    }

    // Get max concurrent users
    getMaxConcurrent() {
        return this.maxConcurrent;
    }

    getPeakTime() {
        return this.peakTime;
    }

    // Get all active user IDs
    getActiveUsers() {
        this.cleanupExpiredSessions();
        return Array.from(this.activeSessions.keys());
    }

    // Get session metrics
    getMetrics() {
        this.cleanupExpiredSessions();
        return {
            currentConcurrent: this.activeSessions.size,
            maxConcurrent: this.maxConcurrent,
            avgConcurrent: this.getAvgConcurrent(),
            peakTime: this.peakTime,
            activeUsers: Array.from(this.activeSessions.keys()),
            sessionTimeout: this.sessionTimeout / 1000 / 60 // in minutes
        };
    }

    // Remove user session (on logout)
    removeSession(userId) {
        this.activeSessions.delete(userId);
    }

    // Reset max concurrent (useful for daily/weekly resets)
    resetMax() {
        this.maxConcurrent = this.activeSessions.size;
        this.peakTime = null;
        this.concurrentSnapshots = [];
    }
}

export default new SessionTracker();

//expin me this full session tracker code and what is the flow how it works in detail as i'm new devveloper learning these advanced topics for 
//first time 