// BACKEND/UTIL/mongoDbHealth.js — FIXED

import mongoose from 'mongoose';

class MongoDBHealthTracker {
  constructor() {
    this.healthData = {
      status:         'disconnected',
      connected:      false,
      connectionTime: null,
      responseTime:   0,
      uptime:         0,
      startTime:      Date.now(),
      collections:    [],
      indexes:        0,
      dbSize:         '0 Bytes',
      storageEngine:  'wiredTiger',
      version:        'unknown',
      operations: {
        totalInserts: 0,
        totalUpdates: 0,
        totalDeletes: 0,
        totalQueries: 0,
      },
      performance: {
        avgQueryTime: 0,
        slowQueries:  0,
        queryCache:   0,
      },
      replication: {
        isReplica: false,
        replicas:  0,
      },
      memory: {
        residentMB: 0,
        virtualMB:  0,
        mappedMB:   0,
      },
    };
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 Bytes';
    const k     = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i     = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }

  // FIX 1: mem values from serverStatus are already in MB — NOT bytes
  // Previous code passed MB values into formatBytes() → showed "45 Bytes" instead of "45 MB"
  formatMB(mb) {
    if (!mb || mb <= 0) return '0 MB';
    if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
    return mb + ' MB';
  }

  get readyState() {
    return mongoose.connection.readyState;
  }

  // ─────────────────────────────────────────────
  // SAFE ADMIN HELPER
  // Wraps adminDb calls — Atlas free tier can deny
  // serverStatus / replSetGetStatus without crashing
  // ─────────────────────────────────────────────
  async safeAdminCommand(fn, fallback = {}) {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  // ─────────────────────────────────────────────
  // CHECK HEALTH
  // ─────────────────────────────────────────────
  async checkHealth() {
    // FIX 2: startTime declared BEFORE try block
    // Previous code had it inside try{} but catch{} referenced it → ReferenceError crash
    const startTime = Date.now();

    try {
      const state = this.readyState;

      // Update connection status
      if (state === 1) {
        this.healthData.status         = 'connected';
        this.healthData.connected      = true;
        this.healthData.connectionTime = new Date().toISOString();
      } else if (state === 2) {
        this.healthData.status    = 'connecting';
        this.healthData.connected = false;
      } else if (state === 3) {
        this.healthData.status    = 'disconnecting';
        this.healthData.connected = false;
      } else {
        this.healthData.status    = 'disconnected';
        this.healthData.connected = false;
      }

      if (!this.healthData.connected) {
        this.healthData.responseTime = Date.now() - startTime;
        return this.healthData;
      }

      const db      = mongoose.connection.db;
      const adminDb = db.admin();

      // ── 1. Server status — FIX 3: each sub-block isolated ──────────────
      // Previous code — one big try/catch meant ANY failure aborted ALL stats
      // Now each section has its own guard so partial data still saves

      const serverStatus = await this.safeAdminCommand(
        () => adminDb.serverStatus(),
        null
      );

      if (serverStatus) {
        this.healthData.uptime  = serverStatus.uptime  ?? 0;
        this.healthData.version = serverStatus.version ?? 'unknown';

        // FIX 4: mem values are MB not bytes — use formatMB not formatBytes
        if (serverStatus.mem) {
          this.healthData.memory = {
            residentMB: serverStatus.mem.resident ?? 0,
            virtualMB:  serverStatus.mem.virtual  ?? 0,
            mappedMB:   serverStatus.mem.mapped   ?? 0,
          };
        }

        if (serverStatus.opcounters) {
          this.healthData.operations = {
            totalInserts: serverStatus.opcounters.insert ?? 0,
            totalUpdates: serverStatus.opcounters.update ?? 0,
            totalDeletes: serverStatus.opcounters.delete ?? 0,
            totalQueries: serverStatus.opcounters.query  ?? 0,
          };
        }
      }

      // ── 2. Replication — isolated, Atlas may block this ──────────────────
      const replStatus = await this.safeAdminCommand(
        () => adminDb.replSetGetStatus(),
        null
      );
      if (replStatus) {
        this.healthData.replication.isReplica = true;
        this.healthData.replication.replicas  = replStatus.members?.length ?? 0;
      } else {
        this.healthData.replication.isReplica = false;
      }

      // ── 3. Collections — isolated ────────────────────────────────────────
      try {
        const cols = await db.listCollections().toArray();
        this.healthData.collections = cols.map((c) => c.name);
      } catch (err) {
        console.error('[MongoHealth] listCollections failed:', err.message);
        this.healthData.collections = [];
      }

      // ── 4. Index count — FIX 5: listIndexes() is NOT async ───────────────
      // Previous code: await collection.listIndexes() — works but wrong pattern
      // Correct:       collection.listIndexes().toArray() — cursor, then toArray()
      // Also added concurrency limit to avoid hammering Atlas with 20+ simultaneous calls
      if (this.healthData.collections.length > 0) {
        let totalIndexes = 0;

        // Process in batches of 5 to avoid overwhelming Atlas
        const BATCH = 5;
        const names = this.healthData.collections;

        for (let i = 0; i < names.length; i += BATCH) {
          const batch = names.slice(i, i + BATCH);
          const results = await Promise.allSettled(
            batch.map(async (collName) => {
              const col     = db.collection(collName);
              // FIX 5: no await on listIndexes() — it returns a cursor, not a Promise
              const indexes = await col.listIndexes().toArray();
              return indexes.length;
            })
          );
          for (const r of results) {
            if (r.status === 'fulfilled') totalIndexes += r.value;
          }
        }
        this.healthData.indexes = totalIndexes;
      }

      // ── 5. DB size via db.stats() — isolated ─────────────────────────────
      try {
        const dbStats = await db.stats();
        const sizeBytes =
          (dbStats.storageSize > 0 ? dbStats.storageSize : null) ??
          (dbStats.dataSize    > 0 ? dbStats.dataSize    : null) ??
          0;
        this.healthData.dbSize = this.formatBytes(sizeBytes);
      } catch (err) {
        console.error('[MongoHealth] db.stats() failed:', err.message);
      }

      this.healthData.responseTime = Date.now() - startTime;
      return this.healthData;

    } catch (err) {
      // FIX 2 payoff: startTime is now always defined here
      console.error('[MongoHealth] checkHealth fatal error:', err.message);
      this.healthData.status       = 'error';
      this.healthData.connected    = false;
      this.healthData.responseTime = Date.now() - startTime;
      return this.healthData;
    }
  }

  // ─────────────────────────────────────────────
  // GET HEALTH (sync — returns cached data)
  // ─────────────────────────────────────────────
  getHealth() {
    return this.healthData;
  }

  // ─────────────────────────────────────────────
  // GET CONNECTION DETAILS
  // ─────────────────────────────────────────────
  getConnectionDetails() {
    return {
      host:        mongoose.connection.host       ?? 'unknown',
      port:        mongoose.connection.port       ?? null,
      name:        mongoose.connection.name       ?? 'unknown',
      readyState:  this.readyState,
      collections: this.healthData.collections.length,
      status:      this.healthData.status,
    };
  }

  // ─────────────────────────────────────────────
  // GET DATABASE STATS
  // ─────────────────────────────────────────────
  async getDatabaseStats() {
    if (!this.healthData.connected) {
      return { error: 'Database not connected' };
    }
    try {
      const db    = mongoose.connection.db;
      const stats = await db.stats().catch(() => ({
        dataSize: 0, indexSize: 0, storageSize: 0,
      }));

      return {
        collections:  this.healthData.collections.length,
        indexes:      this.healthData.indexes,
        dbSize:       this.healthData.dbSize,
        dataSize:     this.formatBytes(stats.dataSize    ?? 0),
        indexSize:    this.formatBytes(stats.indexSize   ?? 0),
        storageSize:  this.formatBytes(stats.storageSize ?? 0),
        // FIX 4: use formatMB for memory — values are already in MB
        memory: {
          resident: this.formatMB(this.healthData.memory.residentMB),
          virtual:  this.formatMB(this.healthData.memory.virtualMB),
          mapped:   this.formatMB(this.healthData.memory.mappedMB),
        },
      };
    } catch (err) {
      console.error('[MongoHealth] getDatabaseStats error:', err.message);
      return { error: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // GET PERFORMANCE METRICS
  // ─────────────────────────────────────────────
  async getPerformanceMetrics() {
    if (!this.healthData.connected) {
      return { error: 'Database not connected' };
    }
    try {
      const adminDb      = mongoose.connection.db.admin();
      const serverStatus = await this.safeAdminCommand(
        () => adminDb.serverStatus(),
        null
      );

      if (!serverStatus) {
        return { error: 'serverStatus unavailable (Atlas free tier restriction)' };
      }

      return {
        connections:     serverStatus.connections     ?? {},
        network:         serverStatus.network         ?? {},
        opcounters:      serverStatus.opcounters      ?? {},
        opcountersRepl:  serverStatus.opcountersRepl  ?? {},
        // FIX 4: mem is MB not bytes
        memory: {
          resident: this.formatMB(serverStatus.mem?.resident ?? 0),
          virtual:  this.formatMB(serverStatus.mem?.virtual  ?? 0),
          mapped:   this.formatMB(serverStatus.mem?.mapped   ?? 0),
        },
      };
    } catch (err) {
      console.error('[MongoHealth] getPerformanceMetrics error:', err.message);
      return { error: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // GET MEMORY STATS
  // ─────────────────────────────────────────────
  async getMemoryStats() {
    if (!this.healthData.connected) {
      return { error: 'Database not connected' };
    }
    try {
      const adminDb      = mongoose.connection.db.admin();
      const serverStatus = await this.safeAdminCommand(
        () => adminDb.serverStatus(),
        null
      );

      if (!serverStatus?.mem) {
        // Fallback to cached healthData memory
        return {
          resident:   this.formatMB(this.healthData.memory.residentMB),
          virtual:    this.formatMB(this.healthData.memory.virtualMB),
          mapped:     this.formatMB(this.healthData.memory.mappedMB),
          residentMB: this.healthData.memory.residentMB,
          virtualMB:  this.healthData.memory.virtualMB,
          mappedMB:   this.healthData.memory.mappedMB,
        };
      }

      // FIX 4: values are in MB — no bytes conversion needed
      return {
        resident:   this.formatMB(serverStatus.mem.resident ?? 0),
        virtual:    this.formatMB(serverStatus.mem.virtual  ?? 0),
        mapped:     this.formatMB(serverStatus.mem.mapped   ?? 0),
        residentMB: serverStatus.mem.resident ?? 0,
        virtualMB:  serverStatus.mem.virtual  ?? 0,
        mappedMB:   serverStatus.mem.mapped   ?? 0,
      };
    } catch (err) {
      console.error('[MongoHealth] getMemoryStats error:', err.message);
      return { error: err.message };
    }
  }
}

export default new MongoDBHealthTracker();
