module.exports = class RuleRepository {
  constructor(storage, model) {
    this.storage = storage;
    this.model = model;
    this.key = "userWebInfo";
    this.historyKey = "tenComic.ruleHistory.v1";
    this.draftPrefix = "tenComic.ruleDraft.v1:";
    this.warnings = [];
  }
  clone(value) {
    const seen = new WeakSet();
    const copy = (value, depth = 0) => {
      if (depth > 30) throw new Error("规则数据嵌套过深");
      if (typeof value === "function") return value.toString();
      if (!value || typeof value !== "object") return value;
      if (Object.prototype.toString.call(value) === "[object RegExp]") return new RegExp(value.source, value.flags);
      if (seen.has(value)) throw new Error("规则包含循环引用，不能保存");
      seen.add(value);
      const result = Array.isArray(value) ? value.map(item => copy(item, depth + 1)) : Object.fromEntries(Object.entries(value).filter(([key]) => !["__proto__", "prototype", "constructor"].includes(key)).map(([key,item]) => [key,copy(item,depth + 1)]));
      seen.delete(value);
      return result;
    };
    return copy(value);
  }
  read() { return this.model.migrate(this.clone(this.storage.get(this.key) || [])); }
  stamp() { return JSON.stringify(this.read(), (_key,value) => Object.prototype.toString.call(value) === "[object RegExp]" ? { source: value.source, flags: value.flags } : value); }
  history() {
    const records = this.storage.get(this.historyKey);
    return (Array.isArray(records) ? records : []).filter(entry => entry && Array.isArray(entry.before) && (entry.state === "committed" || JSON.stringify(this.read()) === JSON.stringify(entry.after)));
  }
  commit(next, reason, expectedStamp) {
    if (expectedStamp !== undefined && expectedStamp !== this.stamp()) throw new Error("规则列表已变化，请重新预览后应用");
    const before = this.read(), after = this.model.migrate(this.clone(next));
    const history = this.history();
    const entry = { id: this.model.createId(), updatedAt: this.model.now(), reason, before, after, state: "prepared" };
    this.warnings = [];
    this.storage.set(this.historyKey, [entry,...history].slice(0,20));
    try { this.storage.set(this.key, after); }
    catch (error) { try { this.storage.set(this.historyKey, history); } catch (ignored) {} throw error; }
    try { this.storage.set(this.historyKey, [{ ...entry, state: "committed" },...history].slice(0,20)); }
    catch (error) { this.warnings.push(error); }
    return after;
  }
  save(input, options = {}) {
    const result = this.model.validate(input);
    if (result.errors.length) throw new Error(result.errors.map(error => error.message).join("；"));
    const list = this.read(), index = options.id ? list.findIndex(rule => rule.id === options.id) : -1;
    if (options.id && index < 0) throw new Error("该规则已删除，请另存副本");
    if (index >= 0 && list[index].version !== options.baseVersion) throw new Error("规则已在其他位置修改，版本冲突，请恢复最新内容或另存副本");
    const rule = { ...result.rule, id: index >= 0 ? list[index].id : this.model.createId(), version: index >= 0 ? list[index].version + 1 : 1, updatedAt: this.model.now() };
    if (index >= 0) list[index] = rule; else list.unshift(rule);
    this.commit(list, index >= 0 ? "编辑规则：" + rule.webName : "新增规则：" + rule.webName);
    return rule;
  }
  update(id, changes, reason) {
    const list = this.read(), index = list.findIndex(rule => rule.id === id);
    if (index < 0) throw new Error("规则不存在或已被删除");
    list[index] = { ...list[index], ...changes, id, version: list[index].version + 1, updatedAt: this.model.now() };
    return this.commit(list, reason);
  }
  remove(id) { return this.commit(this.read().filter(rule => rule.id !== id), "删除规则"); }
  restore(id) {
    const snapshot = this.history().find(entry => entry.id === id);
    if (!snapshot) throw new Error("恢复点不存在或已过期");
    const current = this.read();
    const restored = this.model.migrate(snapshot.before).map(rule => ({ ...rule, version: Math.max(rule.version, current.find(item => item.id === rule.id)?.version || 0) + 1, updatedAt: this.model.now() }));
    return this.commit(restored, "恢复规则版本");
  }
  applyImport(rows, expectedStamp) {
    const list = this.read();
    const replaced = new Set();
    for (const row of rows) {
      if (row.action === "skip") continue;
      if (row.kind === "invalid" || row.errors?.length) throw new Error("不能导入无效规则");
      const result = this.model.validate(row.rule);
      if (result.errors.length) throw new Error(result.errors[0].message);
      if (row.action === "replace") {
        const id = row.targetId || row.targets?.[0]?.id;
        const index = list.findIndex(rule => rule.id === id);
        if (index < 0 || replaced.has(id)) throw new Error("替换目标不存在或被重复选择，请重新预览");
        replaced.add(id);
        list[index] = { ...result.rule, id, version: list[index].version + 1, updatedAt: this.model.now() };
      } else if (row.action === "add") list.unshift({ ...result.rule, id: this.model.createId(), version: 1, updatedAt: this.model.now() });
      else throw new Error("导入操作无效");
    }
    return this.commit(list, "选择性导入规则", expectedStamp);
  }
  saveDraft(id, draft) {
    this.storage.set(this.draftPrefix + id, this.clone({ ...draft, id }));
    const drafts = this.drafts(draft.host);
    for (const old of drafts.slice(10)) this.removeDraft(old.id);
  }
  drafts(host) {
    return this.storage.keys().filter(key => key.startsWith(this.draftPrefix)).map(key => this.storage.get(key)).filter(draft => draft && draft.host === host && draft.fields).sort((a,b) => b.updatedAt - a.updatedAt);
  }
  removeDraft(id) { this.storage.remove(this.draftPrefix + id); }
};
