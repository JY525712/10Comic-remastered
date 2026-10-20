module.exports = class RecoveryStore {
  constructor(storage, options) {
    this.storage = storage;
    this.host = options.host;
    this.origin = options.origin;
    this.id = options.id;
    this.key = "pendingTasks.session." + this.id;
    this.locks = options.locks;
    this.protected = Boolean(this.locks && this.locks.request);
    this.closed = false;
    this.transfers = {};
    this.ready = new Promise(resolve => {
      if (!this.protected) return resolve();
      try { this.locks.request(this.lockName(this.key), { ifAvailable: true }, lock => {
        if (!lock) { this.protected = false; resolve(); return; }
        return new Promise(release => { this.release = release; resolve(); });
      }).catch(() => { this.protected = false; resolve(); }); }
      catch (error) { this.protected = false; resolve(); }
    });
  }
  lockName(key) { return "10comic-recovery:" + key; }
  persist(tasks) {
    if (this.closed) return;
    if (!tasks.length && !Object.keys(this.transfers).length) { this.storage.remove(this.key); return; }
    const previous = this.storage.get(this.key);
    const next = { version: 1, host: this.host, origin: this.origin, updatedAt: Date.now(), protected: this.protected, transfers: { ...this.transfers }, tasks };
    if (previous && JSON.stringify(previous.tasks) === JSON.stringify(tasks) && JSON.stringify(previous.transfers || {}) === JSON.stringify(this.transfers) && Date.now() - previous.updatedAt < 30000) return;
    this.storage.set(this.key, next);
  }
  read(key) {
    if (key === "pendingTasks.legacy." + this.host) {
      const source = this.storage.get("pendingTasks"), marker = this.storage.get(key) || {};
      const tasks = (Array.isArray(source) ? source : []).filter(task => {
        let host = task && task.originHost;
        if (!host) try { host = new URL(task.url).hostname; } catch (ignored) {}
        return String(host || "").toLowerCase() === this.host;
      });
      const fingerprint = JSON.stringify(tasks);
      if (!tasks.length || marker.consumed === fingerprint) return null;
      return { claimedBy: marker.claimedBy, updatedAt: marker.updatedAt, host: this.host, origin: this.origin, tasks, legacy: true, fingerprint };
    }
    const record = this.storage.get(key);
    return record && record.host === this.host && Array.isArray(record.tasks) && record.tasks.length ? record : null;
  }
  async available(key, record, callback) {
    const owner = record.claimedBy || key;
    if (owner === this.key) return callback();
    if (this.protected && (!record.origin || record.origin === this.origin) && (record.protected || record.claimedBy || record.legacy)) {
      return this.locks.request(this.lockName(owner), { ifAvailable: true }, lock => lock ? callback() : null);
    }
    if ((!record.legacy || record.claimedBy) && Date.now() - (record.updatedAt || 0) < 120000) return null;
    return callback();
  }
  async candidates() {
    await this.ready;
    const keys = this.storage.keys().filter(key => key.startsWith("pendingTasks.session."));
    keys.push("pendingTasks.legacy." + this.host);
    const found = [];
    for (const key of keys) {
      if (key === this.key) continue;
      const record = this.read(key);
      if (!record) continue;
      const owner = record.claimedBy && this.storage.get(record.claimedBy);
      if (owner?.transfers?.[key] === JSON.stringify(record.tasks)) continue;
      await this.available(key, record, () => {
        found.push({ key, version: JSON.stringify(record), tasks: record.tasks.map((task, index) => ({ ...task, taskId: task.taskId || key + ":" + index })) });
      });
    }
    return found;
  }
  async claim(refs, adopt, discard = false) {
    await this.ready;
    this.warnings = [];
    let count = 0;
    for (const ref of refs) {
      const record = this.read(ref.key);
      if (!record || JSON.stringify(record) !== ref.version) continue;
      await this.available(ref.key, record, async () => {
        const fresh = this.read(ref.key);
        if (!fresh || JSON.stringify(fresh) !== ref.version) return;
        const owner = fresh.claimedBy && this.storage.get(fresh.claimedBy);
        if (owner?.transfers?.[ref.key] === JSON.stringify(fresh.tasks)) return;
        const claimed = { ...record, claimedBy: this.key, updatedAt: Date.now() };
        this.storage.set(ref.key, claimed);
        if (!discard) this.transfers[ref.key] = JSON.stringify(record.tasks);
        try {
          if (!discard) await adopt(ref.tasks);
        } catch (error) {
          delete this.transfers[ref.key];
          this.storage.set(ref.key, record);
          throw error;
        }
        try {
          if (record.legacy) this.storage.set(ref.key, { consumed: record.fingerprint });
          else this.storage.remove(ref.key);
          delete this.transfers[ref.key];
        } catch (error) {
          if (discard) { this.storage.set(ref.key, record); throw error; }
          this.warnings.push(error);
        }
        count += ref.tasks.length;
      });
    }
    return count;
  }
  close() { this.closed = true; this.release && this.release(); }
};
