function renderManagedRuleList(rules) {
    return `<label class="ten-rule-filter">筛选自定义规则<input id="ten-rule-filter" class="ten-input" placeholder="名称或域名"></label><div id="ten-managed-rule-list">` + (rules.length ? rules.map((rule,index) => `<div class="ten-rule-item ${rule.enabled ? "" : "is-rule-disabled"}" data-rule-id="${escapeAttr(rule.id)}" data-rule-search="${escapeAttr((rule.webName + " " + (Array.isArray(rule.domain) ? rule.domain.join(" ") : rule.domain)).toLowerCase())}"><button class="ten-list-item ten-rule-open" type="button" data-url="${escapeAttr(rule.homepage)}"><span class="ten-name">${escapeHtml(rule.webName || "未命名规则")}</span><span class="ten-meta">${rule.enabled ? "启用" : "停用"}${rule.preferCustom ? " · 优先" : ""} · v${rule.version}<br>${escapeHtml(Array.isArray(rule.domain) ? rule.domain.join(", ") : rule.domain)}</span></button><div class="ten-rule-item-actions"><button class="ten-btn is-small" type="button" data-rule-action="toggle">${rule.enabled ? "停用" : "启用"}</button><button class="ten-btn is-small" type="button" data-rule-action="prefer" aria-pressed="${rule.preferCustom}">${rule.preferCustom ? "取消优先" : "优先"}</button><button class="ten-icon-btn ten-rule-edit" type="button" data-edit-rule="${index}" title="编辑规则" aria-label="编辑 ${escapeAttr(rule.webName)}">${icon("edit")}</button><button class="ten-btn is-small" type="button" data-rule-action="copy">复制</button><button class="ten-btn is-small" type="button" data-rule-action="export">导出</button><button class="ten-icon-btn ten-rule-delete" type="button" data-delete-rule="${index}" title="删除规则" aria-label="删除 ${escapeAttr(rule.webName)}">${icon("trash")}</button></div></div>`).join("") : empty("暂无导入规则")) + "</div>";
}
function filterManagedRules() {
    const query = byId("ten-rule-filter")?.value.trim().toLowerCase() || "";
    all("#ten-managed-rule-list [data-rule-id]").forEach(row => { row.hidden = Boolean(query && !row.dataset.ruleSearch.includes(query)); });
}
async function handleManagedRuleAction(event) {
    const row = event.target.closest("[data-rule-id]"), button = event.target.closest("button");
    if (!button) return;
    if (row) {
        const rule = ruleRepository().read().find(rule => rule.id === row.dataset.ruleId); if (!rule) return toast("规则列表已变化，请刷新");
        try {
            if (button.hasAttribute("data-edit-rule")) return beginRuleEdit(rule.id);
            if (button.hasAttribute("data-delete-rule")) {
                if (await showConfirm("删除自定义规则", `确认删除“${rule.webName}”？可从恢复点还原。`, "删除")) ruleRepository().remove(rule.id);
            } else if (button.dataset.ruleAction === "toggle") ruleRepository().update(rule.id,{ enabled: !rule.enabled },"切换规则启用状态");
            else if (button.dataset.ruleAction === "prefer") ruleRepository().update(rule.id,{ preferCustom: !rule.preferCustom },"调整规则优先级");
            else if (button.dataset.ruleAction === "copy") {
                const copy = { ...rule, webName: rule.webName + "（副本）", enabled: false, preferCustom: false }; delete copy.id;
                ruleRepository().save(copy); toast("副本已创建并停用，可编辑后启用");
            } else if (button.dataset.ruleAction === "export") return exportRuleJSON([rule], "10Comic-单条规则.json");
            else if (button.dataset.url) return window.open(button.dataset.url,"_blank");
            renderSites(); refreshRuleRecoveryLists();
        } catch (error) { toast(error.message); }
    } else if (button.dataset.url) window.open(button.dataset.url,"_blank");
}
function exportRuleJSON(value, name) {
    const blob = new Blob([ruleModel.serialize(value)],{type:"application/json"}), url = URL.createObjectURL(blob);
    const cleanup = () => URL.revokeObjectURL(url);
    const fallback = () => { const link=document.createElement("a");link.href=url;link.download=name;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(cleanup,1000); };
    try { GM_download({url,name,saveAs:true,onload:()=>{cleanup();toast("规则已导出")},onerror:fallback,ontimeout:fallback}); }
    catch (error) { fallback(); }
}
function clearRuleHighlights() {
    clearTimeout(state.ruleHighlightTimer); cancelAnimationFrame(state.ruleHighlightFrame);
    state.ruleHighlightFrame = null;
    window.removeEventListener("scroll", scheduleRuleHighlights,true); window.removeEventListener("resize",scheduleRuleHighlights);
    byId("ten-rule-match-layer")?.remove(); state.ruleHighlightNodes = null;
}
function scheduleRuleHighlights() {
    if (state.ruleHighlightFrame) return;
    state.ruleHighlightFrame = requestAnimationFrame(() => { state.ruleHighlightFrame=null;paintRuleHighlights(); });
}
function paintRuleHighlights() {
    const layer = byId("ten-rule-match-layer"); if (!layer) return;
    layer.replaceChildren();
    for (const node of state.ruleHighlightNodes || []) if (node.isConnected) {
        const rect=node.getBoundingClientRect();if(!rect.width||!rect.height)continue;
        const box=document.createElement("div");box.className="ten-rule-match-box";box.style.cssText=`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;layer.append(box);
    }
}
function highlightRuleSelector(field) {
    clearRuleHighlights();
    const selector = byId(RULE_FORM_IDS[field])?.value.trim(); if (!selector) return toast("请先填写选择器");
    try {
        const nodes=[...document.querySelectorAll(selector)].filter(node=>!node.closest("#ten-comic-root"));
        const fragile=/:nth-|\d{4,}|(?:css|jsx|sc)[-_][\w-]{5,}/i.test(selector);
        byId("ten-rule-selector-hint").textContent=`命中 ${nodes.length} 项${nodes.length>50?"，仅高亮前50项":""}；${fragile?"包含位置、数字或动态类名，可能易失效":"请检查是否包含封面、广告等误选"}`;
        const layer=document.createElement("div");layer.id="ten-rule-match-layer";layer.setAttribute("aria-hidden","true");byId(ROOT_ID).append(layer);state.ruleHighlightNodes=nodes.slice(0,50);paintRuleHighlights();
        window.addEventListener("scroll",scheduleRuleHighlights,true);window.addEventListener("resize",scheduleRuleHighlights);state.ruleHighlightTimer=setTimeout(clearRuleHighlights,5000);
    } catch(error){byId("ten-rule-selector-hint").textContent="选择器无效："+error.message;}
}
