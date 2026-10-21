const RULE_FORM_IDS = {
    webName: "ten-rule-name", domain: "ten-rule-domain", homepage: "ten-rule-homepage", webDesc: "ten-rule-desc",
    comicNameCss: "ten-rule-title-selector", chapterCss: "ten-rule-chapter-selector", imageCss: "ten-rule-image-selector",
    getImgs: "ten-rule-getimgs", readySelector: "ten-rule-ready-selector", waitTimeoutMs: "ten-rule-wait-seconds",
    imageAttributes: "ten-rule-image-attributes", imageExcludeCss: "ten-rule-image-exclude",
    chapterUrlIncludes: "ten-rule-chapter-include", chapterUrlExcludes: "ten-rule-chapter-exclude"
};

function renderCustomRuleEditorAndBackup() {
    return `<details id="ten-rule-editor-card" class="ten-card ten-settings-card ten-settings-disclosure"><summary class="ten-settings-summary">自定义规则</summary><div class="ten-settings-disclosure-body">
      <div class="ten-card-head"><span class="ten-meta">站点解析与规则导入</span><button id="ten-rule-guide-open" class="ten-rule-guide-open" type="button" aria-label="自定义站点设置方法">${icon("guide")}<span>方法</span></button></div>
      <div class="ten-rule-intro"><strong>简单填写</strong><span>填写基本信息、选择页面元素，再检查和预览；复杂函数仍可使用。</span></div>
      <div id="ten-rule-match-status" class="ten-rule-note" role="status"></div>
      <div class="ten-rule-toolbar"><button id="ten-rule-new" class="ten-btn is-small" type="button">新建规则</button><button id="ten-rule-template-undo" class="ten-btn is-small" type="button" disabled>撤销模板</button></div>
      <div id="ten-rule-draft-status" class="ten-meta" role="status">尚未编辑</div>
      <div class="ten-rule-toolbar"><select id="ten-rule-drafts" class="ten-input" aria-label="已保存草稿"><option value="">选择草稿</option></select><button id="ten-rule-draft-restore" class="ten-btn is-small" type="button">恢复草稿</button><button id="ten-rule-draft-discard" class="ten-btn is-small" type="button">删除草稿</button></div>
      <div class="ten-rule-fields">
        <div class="ten-grid-2"><label>站点名称<input id="ten-rule-name" class="ten-input" placeholder="例如：示例漫画"></label><label>域名<input id="ten-rule-domain" class="ten-input" placeholder="example.com，可填写多个域名"></label></div>
        <div class="ten-grid-2"><label>漫画标题选择器<input id="ten-rule-title-selector" class="ten-input" placeholder="例如：h1.title"></label><label>章节列表选择器<input id="ten-rule-chapter-selector" class="ten-input" placeholder="例如：.chapter-list"></label></div>
        <label>章节图片选择器<input id="ten-rule-image-selector" class="ten-input" placeholder="例如：.reader img"></label>
        <div class="ten-rule-toolbar"><button class="ten-btn is-small" data-rule-highlight="comicNameCss" type="button">高亮标题</button><button class="ten-btn is-small" data-rule-highlight="chapterCss" type="button">高亮章节</button><button class="ten-btn is-small" data-rule-highlight="imageCss" type="button">高亮图片</button></div><div id="ten-rule-selector-hint" class="ten-meta" role="status"></div>
        <div class="ten-rule-simple-hint">图片地址默认自动识别；相对地址会补全。常用选项只作用于简单选择器解析。</div>
        <details id="ten-rule-common" class="ten-rule-advanced"><summary>常用解析选项 <span>可选，留空保持自动</span></summary><div class="ten-rule-advanced-body">
          <div class="ten-grid-2"><label>等待元素<input id="ten-rule-ready-selector" class="ten-input" placeholder="可选，例如 .reader.loaded"></label><label>等待超时（秒）<input id="ten-rule-wait-seconds" class="ten-input" type="number" min="1" max="60" value="10"></label></div>
          <label>图片地址属性<input id="ten-rule-image-attributes" class="ten-input" placeholder="留空自动；例如 data-original, src"></label>
          <label>排除图片或容器<input id="ten-rule-image-exclude" class="ten-input" placeholder="可选，例如 .ad, .cover"></label>
          <div class="ten-grid-2"><label>章节地址包含<input id="ten-rule-chapter-include" class="ten-input" placeholder="可选，例如 /chapter/"></label><label>章节地址排除<input id="ten-rule-chapter-exclude" class="ten-input" placeholder="可选，例如 /preview/"></label></div>
          <div class="ten-meta">动态等待用于隐藏页面或当前阅读页；地址属性按填写顺序尝试，多个属性用逗号分隔。</div>
        </div></details>
        <details id="ten-rule-advanced" class="ten-rule-advanced"><summary>复杂站点设置 <span>翻页、隐藏页面或自定义解析</span></summary><div class="ten-rule-advanced-body">
          <label>站点首页<input id="ten-rule-homepage" class="ten-input" placeholder="留空根据域名生成"></label><label>规则说明<input id="ten-rule-desc" class="ten-input" placeholder="可选：使用提示"></label>
          <div><span class="ten-rule-label">阅读方式</span><div class="ten-rule-readtype"><button type="button" data-rule-readtype="1">卷轴阅读</button><button type="button" data-rule-readtype="0">翻页阅读</button></div></div>
          <div class="ten-setting ten-rule-frame"><label for="ten-rule-use-frame">使用隐藏页面读取</label><input id="ten-rule-use-frame" type="checkbox"></div>
          <label>图片解析函数<textarea id="ten-rule-getimgs" class="ten-textarea ten-rule-function" placeholder="留空使用图片选择器；支持 function 或 async function" spellcheck="false"></textarea></label>
        </div></details>
      </div>
      <div class="ten-rule-actions"><button id="ten-rule-test" class="ten-btn" type="button">测试当前页面</button><button id="ten-rule-save" class="ten-btn is-primary" type="button">保存规则</button><button id="ten-rule-save-copy" class="ten-btn" type="button">另存副本</button><button id="ten-rule-cancel-edit" class="ten-btn is-danger" type="button" hidden>取消编辑</button></div>
      <div id="ten-rule-test-result" class="ten-rule-test-result" role="status" hidden></div>
      <div class="ten-rule-preview-controls"><select id="ten-rule-preview-chapter" class="ten-input" aria-label="预览章节"><option value="">当前阅读页</option></select><button id="ten-rule-preview" class="ten-btn" type="button">预览章节图片</button><button id="ten-rule-preview-cancel" class="ten-btn is-small" type="button" hidden>取消预览</button></div><div id="ten-rule-preview-result" class="ten-rule-preview-result" role="status"></div>
      <details class="ten-rule-json"><summary>规则导入 <span>先预览，再选择合并</span></summary><textarea id="ten-rule-text" class="ten-textarea" placeholder="粘贴 JSON 规则数组" autocomplete="off" spellcheck="false"></textarea>
        <label class="ten-rule-check"><input id="ten-rule-legacy-import" type="checkbox">旧版 JavaScript 对象兼容（会执行代码）</label><button id="ten-import-rules" class="ten-btn" type="button">预览导入</button>
      </details>
      <div id="ten-rule-import-preview" class="ten-rule-import-preview" hidden></div>
      <details class="ten-rule-json"><summary>规则恢复点 <span>最近20次变更</span></summary><select id="ten-rule-history" class="ten-input" aria-label="规则恢复点"><option value="">选择恢复点</option></select><div id="ten-rule-history-info" class="ten-meta"></div><button id="ten-rule-history-restore" class="ten-btn" type="button">恢复所选版本</button></details>
    </div></details>
    <div class="ten-card ten-settings-card"><div class="ten-card-title">设置与规则备份</div><div class="ten-backup-actions"><button id="ten-backup-export" class="ten-btn" type="button">导出备份</button><button id="ten-backup-import" class="ten-btn is-primary" type="button">导入备份</button></div><input id="ten-backup-file" type="file" accept="application/json,.json" hidden><div class="ten-settings-hint">包含界面、下载设置和自定义规则；导入前可选择规则</div></div><button id="ten-reset" class="ten-btn is-danger" type="button" style="width:100%">重置全部设置</button></section>`;
}

function ruleRepository() {
    return state.ruleRepository || (state.ruleRepository = new RuleRepository({ get: key => GM_getValue(key), set: (key,value) => GM_setValue(key,value), remove: key => GM_deleteValue(key), keys: () => typeof GM_listValues === "function" ? GM_listValues() : [] }, ruleModel));
}
function readRuleForm() {
    const fields = { ...(state.editRuleBase || {}) };
    for (const [field,id] of Object.entries(RULE_FORM_IDS)) fields[field] = byId(id)?.value || "";
    fields.domain = fields.domain.trim();
    fields.imageAttributes = fields.imageAttributes.split(/[,，\s]+/).filter(Boolean);
    fields.waitTimeoutMs = Number(fields.waitTimeoutMs || 10) * 1000;
    fields.readtype = state.ruleReadType;
    fields.useFrame = Boolean(byId("ten-rule-use-frame")?.checked);
    fields.simpleRule = !fields.getImgs.trim() && Boolean(fields.imageCss.trim());
    if (state.editRuleId) fields.id = state.editRuleId; else delete fields.id;
    return fields;
}
function paintRuleForm(fields = {}) {
    for (const [field,id] of Object.entries(RULE_FORM_IDS)) {
        let value = fields[field] || "";
        if (field === "domain") value = Array.isArray(value) ? value.join(", ") : value;
        if (field === "imageAttributes") value = Array.isArray(value) ? value.join(", ") : value;
        if (field === "waitTimeoutMs") value = Number(fields.waitTimeoutMs || 10000) / 1000;
        if (field === "getImgs" && fields.simpleRule) value = "";
        if (byId(id)) byId(id).value = value;
    }
    byId("ten-rule-use-frame").checked = Boolean(fields.useFrame);
    setRuleReadType(fields.readtype === 0 ? 0 : 1);
    byId("ten-rule-save").textContent = state.editRuleId ? "更新规则" : "保存规则";
    byId("ten-rule-cancel-edit").hidden = !state.editRuleId;
    byId("ten-rule-advanced").open = Boolean(fields.getImgs && !fields.simpleRule || fields.readtype === 0 || fields.useFrame);
    clearRuleFieldErrors();
}
function clearRuleFieldErrors() {
    all("[data-rule-error]").forEach(node => node.remove());
    for (const id of Object.values(RULE_FORM_IDS)) { byId(id)?.removeAttribute("aria-invalid"); byId(id)?.removeAttribute("aria-describedby"); }
}
function validateRuleForm() {
    clearRuleFieldErrors();
    const result = ruleModel.validate(readRuleForm());
    for (const error of result.errors) {
        const input = byId(RULE_FORM_IDS[error.field]);
        if (!input) continue;
        const disclosure = input.closest("details"); if (disclosure) disclosure.open = true;
        input.setAttribute("aria-invalid", "true");
        const message = document.createElement("small");
        message.className = "ten-rule-field-error"; message.dataset.ruleError = error.field; message.id = input.id + "-error";
        message.textContent = error.message; input.setAttribute("aria-describedby", message.id); input.insertAdjacentElement("afterend", message);
    }
    return result;
}
function readRuleEditor() {
    const result = validateRuleForm();
    if (result.errors.length) throw new Error(result.errors.map(error => error.message).join("；"));
    return result.rule;
}
function stopRulePreview(clear = false) {
    state.rulePreviewGeneration = (state.rulePreviewGeneration || 0) + 1;
    state.rulePreviewController?.abort(); state.rulePreviewController = null;
    for (const url of state.rulePreviewObjectUrls || []) URL.revokeObjectURL(url);
    state.rulePreviewObjectUrls = new Set();
    if (state.rulePreviewCleanup) { try { state.rulePreviewCleanup(); } catch (error) {} state.rulePreviewCleanup = null; }
    if (state.rulePreviewFrameCleanup) { state.rulePreviewFrameCleanup(); state.rulePreviewFrameCleanup = null; }
    if (byId("ten-rule-preview-cancel")) byId("ten-rule-preview-cancel").hidden = true;
    if (byId("ten-rule-preview")) byId("ten-rule-preview").disabled = false;
    if (clear && byId("ten-rule-preview-result")) byId("ten-rule-preview-result").replaceChildren();
}
function resetRuleEditor() {
    stopRulePreview(true); clearRuleHighlights();
    clearTimeout(state.ruleDraftTimer); state.ruleDraftFields = null;
    state.rulePreviewLinks = null;
    state.editRuleId = null; state.editRuleBase = null; state.editRuleIndex = -1; state.ruleDirty = false; state.ruleDraftId = null;
    if (!byId("ten-rule-name")) return;
    paintRuleForm(); byId("ten-rule-test-result").hidden = true; byId("ten-rule-draft-status").textContent = "尚未编辑";
    state.ruleTemplateUndo = null; if (byId("ten-rule-template-undo")) byId("ten-rule-template-undo").disabled = true;
}
function scheduleRuleDraft() {
    state.ruleDirty = true; state.ruleDraftId ||= newTaskId();
    state.ruleDraftFields = readRuleForm();
    clearTimeout(state.ruleDraftTimer); state.ruleDraftTimer = setTimeout(flushRuleDraft, 300);
    byId("ten-rule-draft-status").textContent = "有未应用的修改，正在保存草稿…";
    stopRulePreview(true);
    if (!byId("ten-rule-test-result").hidden) byId("ten-rule-test-result").textContent = "规则已修改，请重新检查与预览。";
}
function flushRuleDraft() {
    clearTimeout(state.ruleDraftTimer); state.ruleDraftTimer = null;
    if (!state.ruleDirty) return;
    const fields = byId("ten-rule-name") ? readRuleForm() : state.ruleDraftFields;
    if (!fields) return;
    try {
        ruleRepository().saveDraft(state.ruleDraftId || (state.ruleDraftId = newTaskId()), { host: location.hostname, fields, base: state.editRuleBase, ruleId: state.editRuleId, updatedAt: Date.now() });
        if (byId("ten-rule-draft-status")) byId("ten-rule-draft-status").textContent = "草稿已保存，尚未应用；可稍后恢复。";
        refreshRuleRecoveryLists();
    } catch (error) { if (byId("ten-rule-draft-status")) byId("ten-rule-draft-status").textContent = "草稿保存失败：" + error.message; }
}
function refreshRuleRecoveryLists() {
    if (!byId("ten-rule-drafts")) return;
    try {
        const drafts = ruleRepository().drafts(location.hostname), selected = byId("ten-rule-drafts").value;
        byId("ten-rule-drafts").innerHTML = '<option value="">选择草稿</option>' + drafts.map(draft => `<option value="${escapeAttr(draft.id)}">${escapeHtml(draft.fields.webName || "未命名")} · ${escapeHtml(new Date(draft.updatedAt).toLocaleString())}</option>`).join("");
        if (drafts.some(draft => draft.id === selected)) byId("ten-rule-drafts").value = selected;
        if (!state.ruleDirty && drafts.length) byId("ten-rule-draft-status").textContent = `发现 ${drafts.length} 份草稿，可选择恢复；尚未应用。`;
        const history = ruleRepository().history(), previous = byId("ten-rule-history").value;
        byId("ten-rule-history").innerHTML = '<option value="">选择恢复点</option>' + history.map(entry => `<option value="${escapeAttr(entry.id)}">${escapeHtml(entry.reason)} · ${escapeHtml(new Date(entry.updatedAt).toLocaleString())}</option>`).join("");
        if (history.some(entry => entry.id === previous)) byId("ten-rule-history").value = previous;
    } catch (error) { byId("ten-rule-draft-status").textContent = "无法读取规则恢复记录：" + error.message; }
}
async function beginRuleEdit(id) {
    if (state.ruleDirty && !await showConfirm("切换编辑规则", "当前修改会保留为草稿。", "保留草稿并切换", "继续编辑")) return;
    flushRuleDraft(); closeMobileDrawer();
    const rule = ruleRepository().read().find(rule => rule.id === id);
    if (!rule) return toast("规则已删除，请刷新列表");
    resetRuleEditor(); state.editRuleId = rule.id; state.editRuleBase = rule; paintRuleForm(rule);
    activateTab("settings"); expandRuleEditor(); byId("ten-rule-editor-card").scrollIntoView({ block: "start", behavior: "smooth" }); refreshRuleRecoveryLists();
}
async function startNewRule() {
    if (state.ruleDirty && !await showConfirm("新建规则", "当前修改会保留为草稿。", "保留草稿并新建", "继续编辑")) return;
    flushRuleDraft(); closeMobileDrawer(); resetRuleEditor(); refreshRuleRecoveryLists();
}
function applyRuleTemplate(name) {
    const template = RULE_TEMPLATES[name]; if (!template) return;
    state.ruleTemplateUndo = { fields: readRuleForm(), advanced: byId("ten-rule-advanced").open };
    if (template.imageCss) byId("ten-rule-image-selector").value = template.imageCss;
    byId("ten-rule-use-frame").checked = template.useFrame; setRuleReadType(template.readtype);
    byId("ten-rule-advanced").open = template.readtype === 0 || template.useFrame;
    all("[data-rule-template]").forEach(button => button.classList.toggle("is-active", button.dataset.ruleTemplate === name));
    byId("ten-rule-template-undo").disabled = false; scheduleRuleDraft(); toast("已应用" + template.name + "，可撤销");
}
function saveRuleEditor(asCopy = false) {
    asCopy = asCopy === true;
    try {
        const rule = readRuleEditor();
        ruleRepository().save(rule, asCopy ? {} : state.editRuleId ? { id: state.editRuleId, baseVersion: state.editRuleBase.version } : {});
        if (state.ruleDraftId) ruleRepository().removeDraft(state.ruleDraftId);
        clearTimeout(state.ruleDraftTimer); resetRuleEditor(); state.sourceMode = 1; renderSites(); refreshRuleRecoveryLists(); activateTab("sites");
        toast("规则已保存，重载章节列表后生效；当前任务保留原规则");
    } catch (error) { toast(error.message || "规则保存失败"); }
}
function ruleChapterLinks(rule) {
    if (!rule.chapterCss) return [];
    const found = [], seen = new Set();
    for (const container of document.querySelectorAll(rule.chapterCss)) for (const link of container.querySelectorAll("a[href]")) {
        if (link.closest("#ten-comic-root") || !/^https?:/i.test(link.href) || seen.has(link.href)) continue;
        if (rule.chapterUrlIncludes && !link.href.includes(rule.chapterUrlIncludes) || rule.chapterUrlExcludes && link.href.includes(rule.chapterUrlExcludes)) continue;
        seen.add(link.href); found.push({ url: link.href, name: String(link.textContent || link.getAttribute("title") || "未命名章节").trim() });
    }
    return found;
}
function testRuleEditor() {
    const result = byId("ten-rule-test-result"); result.hidden = false; result.classList.remove("is-success", "is-error");
    try {
        const rule = readRuleEditor(), matched = ruleModel.matches(rule.domain, location.hostname), links = ruleChapterLinks(rule);
        const title = rule.comicNameCss ? document.querySelector(rule.comicNameCss) : null;
        const imageCount = rule.imageCss ? [...document.querySelectorAll(rule.imageCss)].filter(image => !image.closest("#ten-comic-root") && (!rule.imageExcludeCss || !image.matches(rule.imageExcludeCss) && !image.closest(rule.imageExcludeCss))).length : 0;
        result.textContent = `格式检查：通过\n域名匹配：${matched ? "当前页面已匹配" : "当前页面不属于该规则，仅检查当前DOM"}\n漫画标题：${title ? String(title.textContent || "").trim().slice(0,80) : "未找到／尚未验证"}\n目录识别：${links.length} 个有效章节链接\n当前页图片：${imageCount} 张\n阅读页解析：未验证，请点击“预览章节图片”\n${rule.simpleRule ? "使用简单选择器解析" : "高级函数仅检查语法，尚未执行"}`;
        state.rulePreviewLinks = links;
        byId("ten-rule-preview-chapter").innerHTML = '<option value="">当前阅读页</option>' + links.slice(0,500).map((link,index) => `<option value="${index}">${escapeHtml(link.name || link.url)}</option>`).join("");
        if (links.length) byId("ten-rule-preview-chapter").value = "0";
    } catch (error) { result.textContent = "检查失败：" + error.message; result.classList.add("is-error"); }
    refreshRuleMatchStatus();
}
async function previewRuleEditor() {
    let rule;
    try { rule = readRuleEditor(); } catch (error) { testRuleEditor(); return; }
    if (!ruleModel.matches(rule.domain, location.hostname)) return toast("请在该规则匹配的网站中进行阅读页预览");
    if (!state.rulePreviewLinks) testRuleEditor();
    if (!rule.simpleRule && !await showConfirm("运行高级解析预览", "将执行你填写的解析函数。预览不加入下载队列；仅运行自己编写或已审阅的代码。", "运行预览", "取消")) return;
    stopRulePreview(true);
    const generation = state.rulePreviewGeneration, controller = new AbortController(); state.rulePreviewController = controller;
    byId("ten-rule-preview").disabled = true; byId("ten-rule-preview-cancel").hidden = false; byId("ten-rule-preview-result").textContent = "正在解析预览…";
    const selected = byId("ten-rule-preview-chapter").value;
    const chapter = selected === "" ? null : state.rulePreviewLinks?.[Number(selected)];
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 60000);
    try {
        const adapter = ruleModel.compile(rule, { request: downloadUtils.WY, trimSpecial: downloadUtils.Sc, funstrToData: downloadUtils.D });
        const parsed = await downloadUtils.gJ({ url: chapter?.url || location.href, document: chapter ? undefined : document, signal: controller.signal, adapter, preview:true, retainPreviewFrame:release=>{if(generation===state.rulePreviewGeneration&&!controller.signal.aborted)state.rulePreviewFrameCleanup=release;else release();} });
        if (controller.signal.aborted || generation !== state.rulePreviewGeneration) { parsed?.otherData?.cleanup?.(); return; }
        if (parsed?.otherData?.cleanup) state.rulePreviewCleanup = () => parsed.otherData.cleanup();
        const urls = Array.isArray(parsed) ? parsed : parsed?.imgUrlArr;
        if (!Array.isArray(urls) || !urls.length || urls.some(url => typeof url !== "string")) throw new Error("解析未返回有效图片地址列表");
        const container = byId("ten-rule-preview-result"); container.replaceChildren();
        const summary = document.createElement("div");
        let loaded = 0, failed = 0;
        const sampleCount = Math.min(6,urls.length);
        const updateSummary = () => { summary.textContent = `已解析 ${urls.length} 个图片地址${parsed?.nextPageUrl ? `（当前批次，声明总数 ${parsed.imgCount || "未知"}）` : ""} · ${chapter?.name || "当前阅读页"}；样本加载成功 ${loaded}，加载失败 ${failed}，待验证 ${sampleCount-loaded-failed}（仅检查前6张，不保存文件；完整章节尚未验证）`; };
        updateSummary(); container.append(summary);
        const gallery = document.createElement("div"); gallery.className = "ten-rule-preview-grid";
        for (const [index,url] of urls.slice(0,6).entries()) {
            const figure = document.createElement("figure"), image = document.createElement("img"), caption = document.createElement("figcaption");
            image.alt = `图片 ${index + 1}`; caption.textContent = `${index + 1} · 等待加载`; figure.append(image,caption); gallery.append(figure);
        }
        container.append(gallery);
        // Small, bounded sample requests use the rule's own headers and never consume host-owned blob URLs.
        for (const [index,url] of urls.slice(0,6).entries()) {
            if (controller.signal.aborted || generation !== state.rulePreviewGeneration) break;
            const figure = gallery.children[index], image = figure.querySelector("img"), caption = figure.querySelector("figcaption");
            try {
                let blob;
                if (/^https?:/i.test(url)) {
                    const response = await downloadUtils.WY({ method:"get", url, responseType:"blob", headers:rule.downHeaders || rule.headers || { referer:chapter?.url || location.href }, signal:controller.signal, timeout:15000 });
                    if (!response || typeof response !== "object" || response.status >= 400) throw new Error("图片请求失败");
                    blob = response.response;
                } else if (/^blob:|^data:image\//i.test(url)) blob = await (await fetch(url,{signal:controller.signal})).blob();
                else throw new Error("图片地址协议无效");
                if (controller.signal.aborted || generation !== state.rulePreviewGeneration) break;
                if (!(blob instanceof Blob) || !blob.size) throw new Error("图片内容为空");
                const objectUrl = URL.createObjectURL(blob); state.rulePreviewObjectUrls.add(objectUrl); image.src = objectUrl;
                await image.decode();
                if (controller.signal.aborted || generation !== state.rulePreviewGeneration) break;
                loaded++; caption.textContent = `${index+1} · 加载成功`;
            } catch (error) {
                if (controller.signal.aborted || generation !== state.rulePreviewGeneration) break;
                failed++; caption.textContent = `${index+1} · 加载失败`;
            }
            updateSummary();
        }
        if (controller.signal.aborted && generation === state.rulePreviewGeneration) throw new Error("预览已取消");
    } catch (error) {
        if (generation === state.rulePreviewGeneration) { stopRulePreview(true); byId("ten-rule-preview-result").textContent = timedOut ? "预览超过60秒，尚未完成验证。请检查网络、等待元素或解析函数。" : controller.signal.aborted ? "预览已取消" : "预览失败：" + error.message; }
    } finally {
        clearTimeout(timer);
        if (generation === state.rulePreviewGeneration) {
            state.rulePreviewController = null; byId("ten-rule-preview").disabled = false; byId("ten-rule-preview-cancel").hidden = true;
            if (state.rulePreviewFrameCleanup) { state.rulePreviewFrameCleanup(); state.rulePreviewFrameCleanup=null; }
            if (state.rulePreviewCleanup) { try { state.rulePreviewCleanup(); } catch(error) {} state.rulePreviewCleanup=null; }
        }
    }
}
function refreshRuleMatchStatus() {
    const target = byId("ten-rule-match-status"); if (!target) return;
    try {
        const list = siteRules.eT(), resolution = ruleModel.resolve(location.href, list.originalInfo || [], ruleRepository().read());
        const actual = siteRules.Po;
        target.textContent = `当前使用：${actual?.webName || "未匹配"}（${actual?.id ? "自定义" : "内置"}）\n按已保存配置将命中：${resolution.selected?.webName || "未匹配"}（${resolution.source === "custom" ? "自定义" : resolution.source === "builtin" ? "内置" : "无"}）` + (resolution.candidates.length ? `\n同域自定义规则 ${resolution.candidates.length} 条；默认内置优先，勾选“优先”后按自定义列表顺序匹配。` : "") + "\n规则修改在重载章节列表后生效，当前任务保留原规则。";
    } catch (error) { target.textContent = "无法读取规则匹配信息：" + error.message; }
}
function previewRuleImport(incoming, options = {}) {
    const current = ruleRepository().read(), rows = ruleModel.previewImport(incoming, current);
    state.ruleImport = { rows, stamp: ruleRepository().stamp(), settings: options.settings || null };
    activateTab("settings"); expandRuleEditor();
    const target = byId("ten-rule-import-preview"); target.hidden = false;
    const labels = { new: "新增", duplicate: "重复", conflict: "域名冲突", invalid: "无效" };
    target.innerHTML = '<strong>导入预览：选择每条规则的处理方式</strong>' + rows.map((row,index) => `<div class="ten-rule-import-row" data-import-row="${index}"><div><b>${escapeHtml(row.rule?.webName || "未命名规则")}</b> · ${labels[row.kind]}<div class="ten-meta">${escapeHtml(row.errors.map(error => error.message).join("；") || (Array.isArray(row.rule.domain) ? row.rule.domain.join(", ") : row.rule.domain) + (row.incomingConflicts?.length ? "；与本批第 " + row.incomingConflicts.join("、") + " 条规则的域名重叠" : ""))}</div></div><select class="ten-input" data-import-action="${index}" aria-label="处理规则 ${index + 1}" ${row.kind === "invalid" ? "disabled" : ""}><option value="skip">跳过</option><option value="add" ${row.action === "add" ? "selected" : ""}>新增一份</option>${row.targets.length ? '<option value="replace">替换所选目标</option>' : ""}</select>${row.targets.length ? `<select class="ten-input" data-import-target="${index}" aria-label="替换目标 ${index + 1}">${row.targets.map(rule => `<option value="${escapeAttr(rule.id)}">${escapeHtml(rule.webName)}</option>`).join("")}</select>` : ""}</div>`).join("") + (options.settings ? '<label class="ten-rule-check"><input id="ten-rule-import-settings" type="checkbox" checked>同时导入备份中的设置（覆盖对应设置）</label>' : "") + '<div class="ten-rule-toolbar"><button id="ten-rule-import-apply" class="ten-btn is-primary" type="button">应用所选内容</button><button id="ten-rule-import-cancel" class="ten-btn" type="button">取消导入</button></div>';
}
async function importRules() {
    const text = byId("ten-rule-text").value.trim(); if (!text) return toast("请先粘贴规则数组");
    try {
        if (text.length > 2000000) throw new Error("规则文本超过大小限制");
        let incoming;
        if (byId("ten-rule-legacy-import").checked) {
            if (!await showConfirm("旧版 JavaScript 对象兼容", "该兼容方式会执行所粘贴的代码。仅继续处理可信且已审阅的规则。", "继续解析", "取消")) return;
            incoming = Function('"use strict";return (' + text + '\n)')();
            if (!Array.isArray(incoming) || incoming.length > 500) throw new Error("规则必须是最多500条的数组");
        } else incoming = ruleModel.parseJSON(text);
        previewRuleImport(incoming);
    } catch (error) { toast("导入预览失败：" + error.message); }
}
function applyRuleImport() {
    const pending = state.ruleImport; if (!pending) return;
    try {
        if (pending.stamp !== ruleRepository().stamp()) throw new Error("规则列表已变化，请重新预览后应用");
        for (const [index,row] of pending.rows.entries()) {
            row.action = one(`[data-import-action="${index}"]`).value;
            row.targetId = one(`[data-import-target="${index}"]`)?.value;
        }
        const settingsSelected = pending.settings && byId("ten-rule-import-settings")?.checked;
        const previous = settingsSelected ? Object.fromEntries(BACKUP_KEYS.map(key => [key,GM_getValue(key)])) : null;
        if (settingsSelected) {
            try { for (const key of BACKUP_KEYS) if (pending.settings[key] !== undefined && pending.settings[key] !== null) configModule.po(key,pending.settings[key]); }
            catch (error) { for (const [key,value] of Object.entries(previous)) if (value !== undefined) GM_setValue(key,value); else GM_deleteValue(key); throw error; }
        }
        try { ruleRepository().applyImport(pending.rows,pending.stamp); }
        catch (error) { if (previous) for (const [key,value] of Object.entries(previous)) if (value !== undefined) GM_setValue(key,value); else GM_deleteValue(key); throw error; }
        state.ruleImport = null; byId("ten-rule-import-preview").hidden = true; byId("ten-rule-text").value = "";
        if (settingsSelected) { flushRuleDraft(); state.settings = readSettings(); applySettingsToUI(); trimHistory(); }
        state.sourceMode = 1; renderSites(); refreshRuleRecoveryLists(); toast("所选内容已导入，已创建规则恢复点");
    } catch (error) { toast("导入未完成：" + error.message); }
}
async function clearRules() {
    if (await showConfirm("清空自定义规则", "将清空全部自定义规则，并创建恢复点。", "全部清空")) try { ruleRepository().commit([],"清空规则"); renderSites(); refreshRuleRecoveryLists(); toast("规则已清空，可从恢复点还原"); } catch (error) { toast(error.message); }
}
function initializeRuleTools() {
    if (!byId("ten-rule-name")) return;
    state.rulePreviewLinks = null;
    const root = byId(ROOT_ID);
    root.addEventListener("input", event => { if (Object.values(RULE_FORM_IDS).includes(event.target.id)) { state.rulePreviewLinks = null; scheduleRuleDraft(); } if (event.target.id === "ten-rule-filter") filterManagedRules(); });
    root.addEventListener("change", event => { if (event.target.id === "ten-rule-use-frame") scheduleRuleDraft(); });
    root.addEventListener("click", event => {
        const highlight = event.target.closest("[data-rule-highlight]"); if (highlight) highlightRuleSelector(highlight.dataset.ruleHighlight);
        if (event.target.closest("[data-rule-readtype]")) scheduleRuleDraft();
        if (event.target.closest("#ten-rule-import-apply")) applyRuleImport();
        if (event.target.closest("#ten-rule-import-cancel")) { state.ruleImport = null; byId("ten-rule-import-preview").hidden = true; }
    });
    byId("ten-rule-new").addEventListener("click",startNewRule);
    byId("ten-rule-save-copy").addEventListener("click",()=>saveRuleEditor(true));
    byId("ten-rule-template-undo").addEventListener("click",()=>{ if (!state.ruleTemplateUndo) return; const previous=state.ruleTemplateUndo; paintRuleForm(previous.fields); byId("ten-rule-advanced").open=previous.advanced; state.ruleTemplateUndo=null; byId("ten-rule-template-undo").disabled=true; scheduleRuleDraft(); });
    byId("ten-rule-preview").addEventListener("click",previewRuleEditor);
    byId("ten-rule-preview-cancel").addEventListener("click",()=>{ stopRulePreview(); byId("ten-rule-preview-result").textContent="预览已取消"; });
    byId("ten-rule-draft-restore").addEventListener("click",async()=>{
        const draft=ruleRepository().drafts(location.hostname).find(draft=>draft.id===byId("ten-rule-drafts").value); if (!draft) return toast("请选择草稿");
        if (state.ruleDirty && !await showConfirm("恢复草稿","当前修改会先保存为另一份草稿。","保留并恢复","继续编辑")) return;
        flushRuleDraft(); resetRuleEditor(); state.editRuleId=draft.ruleId; state.editRuleBase=draft.base; paintRuleForm(draft.fields); state.ruleDraftId=draft.id; state.ruleDirty=true; state.ruleDraftFields=readRuleForm(); byId("ten-rule-draft-status").textContent="草稿已恢复，尚未应用";
    });
    byId("ten-rule-draft-discard").addEventListener("click",async()=>{const id=byId("ten-rule-drafts").value;if(id&&await showConfirm("删除草稿",id===state.ruleDraftId?"删除当前草稿并清空对应编辑内容；已应用规则不受影响。":"仅删除选中的草稿。","删除")){ruleRepository().removeDraft(id);if(id===state.ruleDraftId)resetRuleEditor();refreshRuleRecoveryLists();}});
    byId("ten-rule-history").addEventListener("change",()=>{const entry=ruleRepository().history().find(entry=>entry.id===byId("ten-rule-history").value);byId("ten-rule-history-info").textContent=entry?`将恢复为 ${entry.before.length} 条规则；当前状态会先创建恢复点。`:"";});
    byId("ten-rule-history-restore").addEventListener("click",async()=>{const id=byId("ten-rule-history").value;if(!id)return toast("请选择恢复点");if(!await showConfirm("恢复规则版本",byId("ten-rule-history-info").textContent||"恢复前会保存当前规则状态。","恢复"))return;try{flushRuleDraft();ruleRepository().restore(id);renderSites();refreshRuleRecoveryLists();toast("规则已恢复，重载章节后生效");}catch(error){toast(error.message)}});
    refreshRuleRecoveryLists(); refreshRuleMatchStatus();
}
