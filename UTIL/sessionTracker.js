// src/UTIL/sessionTracker.js

class SessionTracker {
  constructor() {
    this.activeSessions   = new Map(); // userId → lastActivityTime (ms)
    this.maxConcurrent    = 0;
    this.peakTime         = null;
    this.concurrentSnapshots = [];

    // FIX: 10 min timeout — aligns with idle threshold
    // was 5 min → users between 5-10 min (idle) were being deleted
    // presence system needs them in memory to return "idle" without a DB hit
    this.sessionTimeout = 5 * 60 * 1000;

    // Cleanup every minute
    setInterval(() => this.cleanupExpiredSessions(), 60 * 1000);

    // Snapshot every 5 min for avg concurrent calculation
    // Works like this:
    //   Every 5 min → record how many users are currently active
    //   [12, 15, 9, 20, 8] ← stored snapshots
    //   avg = sum / count = 12.8 ← "average concurrent users"
    //   Keeps only last 288 snapshots = 288 × 5min = 1440 min = 24 hours
    //   Old snapshots dropped with .shift() (FIFO)
    setInterval(() => this.takeSnapshot(), 5 * 60 * 1000);
  }

  // ── Record activity ─────────────────────────
  recordActivity(userId) {
    if (!userId) return;

    // FIX: store as string consistently
    // JWT decoded id could be ObjectId string already, but be explicit
    this.activeSessions.set(String(userId), Date.now());

    const currentCount = this.activeSessions.size;
    if (currentCount > this.maxConcurrent) {
      this.maxConcurrent = currentCount;
      this.peakTime      = new Date();
    }
  }

  // ── NEW: get last activity timestamp for a user ──
  // Used by presence controller to determine online vs idle
  // Returns ms timestamp or null if not in memory
  getLastActivity(userId) {
    return this.activeSessions.get(String(userId)) ?? null;
  }

  // ── NEW: direct O(1) online check ───────────
  // Cleaner than building a Set outside — presence controller uses this
  isInMemory(userId) {
    return this.activeSessions.has(String(userId));
  }

  // ── Snapshot ────────────────────────────────
  takeSnapshot() {
    this.cleanupExpiredSessions();
    this.concurrentSnapshots.push(this.activeSessions.size);
    if (this.concurrentSnapshots.length > 288) {
      this.concurrentSnapshots.shift(); // drop oldest (>24h)
    }
  }

  getAvgConcurrent() {
    if (this.concurrentSnapshots.length === 0) return 0;
    const sum = this.concurrentSnapshots.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.concurrentSnapshots.length);
  }

  // ── Cleanup ─────────────────────────────────
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [userId, lastActivity] of this.activeSessions.entries()) {
      if (now - lastActivity > this.sessionTimeout) {
        this.activeSessions.delete(userId);
      }
    }
  }

  // ── Getters ─────────────────────────────────
  getCurrentConcurrent() {
    this.cleanupExpiredSessions();
    return this.activeSessions.size;
  }

  getMaxConcurrent()  { return this.maxConcurrent; }
  getPeakTime()       { return this.peakTime; }

  getActiveUsers() {
    this.cleanupExpiredSessions();
    return Array.from(this.activeSessions.keys());
  }

  getMetrics() {
    this.cleanupExpiredSessions();
    return {
      currentConcurrent: this.activeSessions.size,
      maxConcurrent:     this.maxConcurrent,
      avgConcurrent:     this.getAvgConcurrent(),
      peakTime:          this.peakTime,
      activeUsers:       Array.from(this.activeSessions.keys()),
      sessionTimeout:    this.sessionTimeout / 1000 / 60, // in minutes
    };
  }

  // ── Session control ─────────────────────────
  removeSession(userId) {
    this.activeSessions.delete(String(userId)); // FIX: String() for consistency
  }

  resetMax() {
    this.maxConcurrent       = this.activeSessions.size;
    this.peakTime            = null;
    this.concurrentSnapshots = [];
  }
}

export default new SessionTracker();

//expin me this full session tracker code and what is the flow how it works in detail as i'm new devveloper learning these advanced topics for 
//first time 