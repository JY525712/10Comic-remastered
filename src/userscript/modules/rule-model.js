module.exports = dependencies => {
  "use strict";
  dependencies = dependencies || {};
  const now = dependencies.now || Date.now;
  const createId = dependencies.createId || (() => "rule-" + now().toString(36) + "-" + Math.random().toString(36).slice(2));
  const selectorCheck = dependencies.validateSelector || (selector => { if (typeof document !== "undefined") document.querySelector(selector); });
  const functionCache = new Set();
  const domains = value => [...new Set((Array.isArray(value) ? value : String(value || "").split(/[,，\s]+/)).map(value => {
    const input = String(value || "").trim().toLowerCase().replace(/^\*\./, "");
    if (!input) return "";
    const url = new URL(/^[a-z]+:\/\//i.test(input) ? input : "https://" + input);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) throw new Error("请填写有效域名，不含账号或端口");
    return url.hostname;
  }).filter(Boolean))];
  function matches(value, host) {
    try { return domains(value).some(domain => host === domain || host.endsWith("." + domain)); } catch (error) { return false; }
  }
  function hash(text) {
    let value = 2166136261;
    for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
    return (value >>> 0).toString(36);
  }
  function migrate(list) {
    const used = new Set();
    return (Array.isArray(list) ? list : []).filter(rule => rule && typeof rule === "object" && !Array.isArray(rule)).map(raw => {
      const rule = { ...raw };
      for (const field of ["getImgs", "getComicInfo"]) if (typeof rule[field] === "function") rule[field] = rule[field].toString();
      const base = typeof rule.id === "string" && /^[\w:-]{1,120}$/.test(rule.id) ? rule.id : "legacy-" + hash(JSON.stringify([rule.domain, rule.webName, rule.homepage, rule.imageCss, rule.getImgs]));
      let id = base, suffix = 1;
      while (used.has(id)) id = base + "-" + suffix++;
      used.add(id);
      return { ...rule, id, schemaVersion: 1, version: Math.max(1, Math.trunc(Number(rule.version) || 1)), enabled: rule.enabled !== false, preferCustom: rule.preferCustom === true };
    });
  }
  function checkFunction(source) {
    if (functionCache.has(source)) return;
    if (typeof source !== "string" || source.length > 100000) throw new Error("解析函数必须是长度合理的函数文本");
    const program = dependencies.parse('"use strict";(' + source + "\n)", { ecmaVersion: "latest" });
    const node = program.body?.[1]?.expression;
    if (program.body.length !== 2 || !node || !["FunctionExpression", "ArrowFunctionExpression"].includes(node.type) || node.generator) throw new Error("只接受函数本身，不接受立即调用或其他表达式");
    if (functionCache.size >= 200) functionCache.clear();
    functionCache.add(source);
  }
  async function simpleImages(context, task = {}) {
    const frame = task.frameId ? document.getElementById(task.frameId) : null;
    const root = task.document || frame?.contentDocument || (context && typeof context.querySelectorAll === "function" ? context : new DOMParser().parseFromString(String(context || ""), "text/html"));
    const base = task.url || location.href;
    const signal = task.signal;
    const checkAbort = () => { if (signal?.aborted) throw new Error("下载已取消"); };
    checkAbort();
    if (this.readySelector && !root.querySelector(this.readySelector)) {
      if (!frame && !task.document) throw new Error("等待元素未找到；动态页面请启用隐藏页面读取");
      const deadline = Date.now() + (this.waitTimeoutMs || 10000);
      while (!root.querySelector(this.readySelector)) {
        checkAbort();
        if (Date.now() >= deadline) throw new Error("等待元素超时：" + this.readySelector);
        await new Promise((resolve, reject) => {
          const abort = () => { clearTimeout(timer); signal?.removeEventListener?.("abort", abort); reject(new Error("下载已取消")); };
          const timer = setTimeout(() => { signal?.removeEventListener?.("abort", abort); resolve(); }, 100);
          signal?.addEventListener?.("abort", abort, { once: true });
        });
      }
    }
    checkAbort();
    const attributes = this.imageAttributes?.length ? this.imageAttributes : ["data-src", "data-original", "data-url", "data-lazy-src", "currentSrc", "srcset", "data-srcset", "src"];
    const urls = [];
    for (const image of root.querySelectorAll(this.imageCss)) {
      if (image.closest("#ten-comic-root")) continue;
      if (this.imageExcludeCss && (image.matches(this.imageExcludeCss) || image.closest(this.imageExcludeCss))) continue;
      let value = "";
      for (const attribute of attributes) {
        value = attribute === "currentSrc" ? image.currentSrc : image.getAttribute(attribute);
        if (value && /srcset$/i.test(attribute)) value = (value.trim().split(/\s*,\s*/).pop() || "").trim().split(/\s+/)[0];
        if (value) break;
      }
      if (!value) continue;
      try {
        const url = new URL(value, base);
        if (["http:", "https:", "blob:"].includes(url.protocol) || /^data:image\//i.test(url.href)) urls.push(url.href);
      } catch (error) {}
    }
    return [...new Set(urls)];
  }
  function validate(input) {
    const errors = [];
    if (!input || typeof input !== "object" || Array.isArray(input)) return { rule: null, errors: [{ field: "rule", message: "规则必须是对象" }] };
    const rule = { ...input };
    const error = (field, message) => errors.push({ field, message });
    rule.webName = String(rule.webName || "").trim();
    if (!rule.webName || rule.webName.length > 120) error("webName", "请填写站点名称（最多120字）");
    try { const values = domains(rule.domain); if (!values.length) throw new Error("请填写域名"); rule.domain = values.length === 1 ? values[0] : values; }
    catch (reason) { error("domain", reason.message); }
    const primary = Array.isArray(rule.domain) ? rule.domain[0] : rule.domain;
    rule.homepage = String(rule.homepage || (primary ? "https://" + primary + "/" : "")).trim();
    try { const url = new URL(rule.homepage); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error(); }
    catch (reason) { error("homepage", "站点首页必须是有效的 http/https 地址"); }
    for (const field of ["comicNameCss", "chapterCss", "imageCss", "readySelector", "imageExcludeCss"]) {
      rule[field] = String(rule[field] || "").trim();
      if (rule[field]) try { selectorCheck(rule[field]); } catch (reason) { error(field, "选择器格式不正确"); }
    }
    rule.readtype = rule.readtype === undefined ? 1 : Number(rule.readtype);
    if (![0, 1].includes(rule.readtype)) error("readtype", "阅读方式无效");
    rule.useFrame = rule.useFrame === true;
    rule.waitTimeoutMs = rule.waitTimeoutMs === undefined || rule.waitTimeoutMs === "" ? 10000 : Number(rule.waitTimeoutMs);
    if (!Number.isFinite(rule.waitTimeoutMs) || rule.waitTimeoutMs < 1000 || rule.waitTimeoutMs > 60000) error("waitTimeoutMs", "等待超时应为1000至60000毫秒");
    const attributes = rule.imageAttributes || [];
    rule.imageAttributes = [...new Set((Array.isArray(attributes) ? attributes : String(attributes).split(/[,，\s]+/)).map(value => String(value).trim()).filter(Boolean))];
    if (rule.imageAttributes.some(value => !/^[\w:-]+$/.test(value))) error("imageAttributes", "图片地址属性只能包含字母、数字、横线、冒号或下划线");
    for (const field of ["chapterUrlIncludes", "chapterUrlExcludes"]) rule[field] = String(rule[field] || "").trim().slice(0, 500);
    rule.simpleRule = Boolean(rule.imageCss && (!rule.getImgs || rule.simpleRule === true));
    if (rule.chapterNameReg != null && typeof rule.chapterNameReg !== "string" && Object.prototype.toString.call(rule.chapterNameReg) !== "[object RegExp]") error("chapterNameReg", "章节名称正则字段已损坏，请重新填写正则表达式");
    for (const field of ["getImgs", "getComicInfo"]) {
      if (typeof rule[field] === "function") rule[field] = rule[field].toString();
      if (field === "getImgs" && rule.simpleRule) rule[field] = simpleImages.toString();
      if (rule[field]) try { checkFunction(rule[field]); } catch (reason) { error(field, reason.message); }
    }
    if (!rule.getImgs) error("getImgs", "请填写图片选择器或解析函数");
    if (rule.simpleRule && rule.readtype === 0) error("readtype", "翻页阅读需要高级解析函数");
    const metadata = migrate([rule])[0];
    if (!input.id && metadata) metadata.id = createId();
    return { rule: metadata, errors };
  }
  function fingerprint(rule) {
    const copy = { ...rule };
    for (const field of ["id", "version", "schemaVersion", "updatedAt"]) delete copy[field];
    const normalized = validate(copy).rule || copy;
    for (const field of ["id", "version", "schemaVersion", "updatedAt"]) delete normalized[field];
    const ordered = value => Object.prototype.toString.call(value) === "[object RegExp]" ? value : Array.isArray(value) ? value.map(ordered) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
    return serialize(ordered(normalized));
  }
  function overlap(first, second) {
    try { return domains(first).some(a => domains(second).some(b => a === b || a.endsWith("." + b) || b.endsWith("." + a))); } catch (error) { return false; }
  }
  function resolve(url, builtins, custom) {
    let host;
    try { host = new URL(url).hostname.toLowerCase(); } catch (error) { return { selected: null, source: "none", candidates: [] }; }
    const builtin = builtins.find(rule => matches(rule.domain, host));
    const candidates = migrate(custom).filter(rule => matches(rule.domain, host));
    const enabled = candidates.filter(rule => rule.enabled);
    const preferred = enabled.find(rule => rule.preferCustom);
    return { selected: preferred || builtin || enabled[0] || null, source: preferred || !builtin && enabled.length ? "custom" : builtin ? "builtin" : "none", candidates, builtin: builtin || null, host };
  }
  // Tagged values are data only. Escape ordinary objects using the reserved tag.
  function serialize(value) {
    const seen = new WeakSet();
    const encode = (value, depth = 0) => {
      if (depth > 30) throw new Error("规则数据嵌套过深");
      if (typeof value === "function") return value.toString();
      if (!value || typeof value !== "object") return value;
      if (Object.prototype.toString.call(value) === "[object RegExp]") return { $tenComicValue: 1, type: "RegExp", source: value.source, flags: value.flags };
      if (seen.has(value)) throw new Error("规则包含循环引用");
      seen.add(value);
      const entries = Array.isArray(value) ? null : Object.entries(value).map(([key,item]) => [key,encode(item,depth+1)]);
      const result = !entries ? value.map(item => encode(item,depth+1)) : Object.hasOwn(value,"$tenComicValue") ? { $tenComicValue: 1, type: "Object", entries } : Object.fromEntries(entries);
      seen.delete(value); return result;
    };
    return JSON.stringify(encode(value),null,2);
  }
  function deserialize(text) {
    if (typeof text !== "string" || text.length > 2000000) throw new Error("规则文本为空或超过大小限制");
    const decode = (value,depth = 0) => {
      if (depth > 30) throw new Error("规则数据嵌套过深");
      if (!value || typeof value !== "object") return value;
      if (Array.isArray(value)) return value.map(item => decode(item,depth+1));
      if (value.$tenComicValue === 1 && value.type === "RegExp" && Object.keys(value).length === 4 && typeof value.source === "string" && typeof value.flags === "string") return new RegExp(value.source,value.flags);
      if (value.$tenComicValue === 1 && value.type === "Object" && Object.keys(value).length === 3 && Array.isArray(value.entries)) {
        if (value.entries.some(entry => !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string")) throw new Error("规则对象编码无效");
        return Object.fromEntries(value.entries.map(([key,item]) => [key,decode(item,depth+1)]));
      }
      return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,decode(item,depth+1)]));
    };
    return decode(JSON.parse(text));
  }
  function parseJSON(text) {
    const value = deserialize(text);
    if (!Array.isArray(value) || value.length > 500) throw new Error("请提供最多500条规则的数组");
    return value;
  }
  function previewImport(incoming, existing) {
    const fingerprints = new Set(existing.map(fingerprint)), incomingRules = [];
    return incoming.map((raw,incomingIndex) => {
      const result = validate(raw);
      if (result.errors.length) return { kind: "invalid", action: "skip", rule: result.rule, errors: result.errors, targets: [] };
      const key = fingerprint(result.rule), duplicate = fingerprints.has(key);
      const targets = existing.filter(rule => overlap(rule.domain, result.rule.domain));
      const incomingConflicts = incomingRules.filter(entry => overlap(entry.rule.domain,result.rule.domain)).map(entry => entry.index);
      const kind = duplicate ? "duplicate" : targets.length || incomingConflicts.length ? "conflict" : "new";
      fingerprints.add(key); incomingRules.push({rule:result.rule,index:incomingIndex+1});
      return { kind, action: kind === "new" ? "add" : "skip", rule: result.rule, errors: [], targets, incomingConflicts };
    });
  }
  function compile(input, helpers = {}) {
    const result = validate(input);
    if (result.errors.length) throw new Error(result.errors.map(error => error.message).join("；"));
    const rule = result.rule;
    for (const field of ["getImgs", "getComicInfo"]) {
      if (field === "getImgs" && rule.simpleRule) rule[field] = simpleImages;
      else if (typeof rule[field] === "string") {
        checkFunction(rule[field]);
        rule[field] = Function("request", "trimSpecial", "funstrToData", '"use strict";return (' + rule[field] + '\n)')(helpers.request, helpers.trimSpecial, helpers.funstrToData);
      }
    }
    return rule;
  }
  return { migrate, validate, checkFunction, parseJSON, serialize, deserialize, matches, overlap, resolve, previewImport, fingerprint, simpleImages, compile, createId, now };
};
