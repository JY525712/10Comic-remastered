function renderSites() {
    const e = (0, siteRules.eT)(), t = Array.isArray(e.originalInfo) ? e.originalInfo.slice() : [], n = Array.isArray(e.userWebInfo) ? e.userWebInfo.slice() : [], r = 0 === state.sourceMode ? t : n;
    one(".ten-source").style.setProperty("--source", state.sourceMode), all(".ten-source button").forEach(e => e.classList.toggle("is-active", Number(e.dataset.source) === state.sourceMode)), 
    byId("ten-rule-manage").hidden = 0 === state.sourceMode, byId("ten-rule-count").textContent = `已导入 ${n.length} 条规则 · 可逐条删除`, 
    function(e = []) {
        state.searchSites = (Array.isArray(e) ? e : []).map((e, t) => ({
            site: e,
            order: t
        })).sort((e, t) => Number(Boolean(t.site?.searchTemplate_1)) - Number(Boolean(e.site?.searchTemplate_1)) || e.order - t.order).map(e => e.site), 
        state.selectedSearchIndex = -1;
        const t = state.searchSites.filter(e => e && e.searchTemplate_1).length, n = 0 === state.sourceMode ? "全部内置站点" : "全部导入站点";
        byId("ten-search-site-label").textContent = n, byId("ten-search-btn").disabled = 0 === t, 
        byId("ten-search-site-menu").innerHTML = [ `<button class="ten-search-site-option is-all is-selected" type="button" role="option" data-search-index="-1" ${t ? "" : "disabled"}><span>${n}</span><small>${t} 个可搜索</small></button>`, ...state.searchSites.map((e, t) => `<button class="ten-search-site-option" type="button" role="option" data-search-index="${t}" ${e.searchTemplate_1 ? "" : "disabled"}><span>${escapeHtml(e.webName)}</span><small>${e.searchTemplate_1 ? "可搜索" : "仅浏览"}</small></button>`) ].join(""), 
        closeSearchSiteMenu();
    }(r), byId("ten-site-list").innerHTML = r.length ? r.map((e, t) => 0 === state.sourceMode ? `<button class="ten-list-item" type="button" data-url="${escapeAttr(e.homepage)}"><span class="ten-name">${escapeHtml(e.webName)}</span><span class="ten-site-kind">内置</span><span class="ten-meta">${escapeHtml(e.webDesc || "打开站点")}</span></button>` : `<div class="ten-rule-item"><button class="ten-list-item ten-rule-open" type="button" data-url="${escapeAttr(e.homepage)}"><span class="ten-name">${escapeHtml(e.webName)}</span><span class="ten-meta">${escapeHtml(e.webDesc || e.domain || "导入规则")}</span></button><button class="ten-icon-btn ten-rule-edit" type="button" data-edit-rule="${t}" title="编辑规则" aria-label="编辑 ${escapeAttr(e.webName)}">${icon("edit")}</button><button class="ten-icon-btn ten-rule-delete" type="button" data-delete-rule="${t}" title="删除规则" aria-label="删除 ${escapeAttr(e.webName)}">${icon("trash")}</button></div>`).join("") : empty("暂无导入规则");
}

function deleteImportedRule(e) {
    const t = e.target.closest("[data-edit-rule]");
    if (t) return void function(e) {
        const t = safeGet("userWebInfo", []), n = (Array.isArray(t) ? t : [])[e];
        n && (state.editRuleIndex = e, state.editRuleBase = {
            ...n
        }, byId("ten-rule-name").value = n.webName || "", byId("ten-rule-domain").value = Array.isArray(n.domain) ? n.domain.join(", ") : n.domain || "", 
        byId("ten-rule-homepage").value = n.homepage || "", byId("ten-rule-desc").value = n.webDesc || "", 
        byId("ten-rule-title-selector").value = n.comicNameCss || "", byId("ten-rule-chapter-selector").value = n.chapterCss || "", 
        byId("ten-rule-image-selector").value = n.imageCss || "", byId("ten-rule-use-frame").checked = Boolean(n.useFrame), 
        byId("ten-rule-getimgs").value = n.simpleRule ? "" : "function" == typeof n.getImgs ? n.getImgs.toString() : n.getImgs || "", 
        setRuleReadType(n.readtype), byId("ten-rule-advanced").open = !n.simpleRule, byId("ten-rule-save").textContent = "更新规则", 
        byId("ten-rule-cancel-edit").hidden = !1, activateTab("settings"), expandRuleEditor(), 
        setTimeout(() => byId("ten-rule-editor-card").scrollIntoView({
            behavior: "smooth",
            block: "start"
        }), 80));
    }(Number(t.dataset.editRule));
    const n = e.target.closest("[data-delete-rule]");
    if (n) return void async function(e) {
        const t = safeGet("userWebInfo", []), n = Array.isArray(t) ? t.slice() : [];
        n[e] && await showConfirm("删除自定义规则", `确认删除规则“${n[e].webName || n[e].domain || "未命名规则"}”？`, "删除") && (n.splice(e, 1), 
        (0, configModule.po)("userWebInfo", n), renderSites(), toast("规则已删除"));
    }(Number(n.dataset.deleteRule));
    const a = e.target.closest("[data-url]");
    a && a.dataset.url && window.open(a.dataset.url, "_blank");
}

async function searchComics() {
    const e = byId("ten-search-input").value.trim();
    if (!e || state.searching) return;
    const t = state.searchSites.filter(e => e && e.searchTemplate_1), n = state.selectedSearchIndex >= 0 ? state.searchSites[state.selectedSearchIndex] : null, r = n && n.searchTemplate_1 ? [ n ] : t;
    if (!r.length) return void toast(0 === state.sourceMode ? "当前没有可搜索的内置站点" : "导入规则没有配置搜索功能");
    state.searching = !0, closeSearchSiteMenu();
    const a = byId("ten-search-results"), i = n ? n.webName : 0 === state.sourceMode ? "全部内置站点" : "全部导入站点";
    !function(e) {
        const t = byId("ten-search-panel");
        byId("ten-search-panel-subtitle").textContent = e, t.classList.add("is-open"), t.setAttribute("aria-hidden", "false");
    }(i), a.innerHTML = `<div class="ten-status">${r.length > 1 ? "正在搜索多个站点…" : `正在搜索 ${escapeHtml(i)}…`}</div>`;
    const o = [];
    for (const t of r) {
        try {
            const n = await (0, siteRules.Ni)(t, e);
            n && n.length && o.push({
                site: t.webName,
                results: n
            });
        } catch (e) {
            console.warn(`10漫画：${t.webName} 搜索失败。`, e);
        }
        renderSearchGroups(o, a);
    }
    o.length || (a.innerHTML = empty("没有找到结果")), state.searching = !1;
}

function toggleSearchSiteMenu(e) {
    e.stopPropagation();
    const t = byId("ten-search-site-menu"), n = t.hidden;
    t.hidden = !n, byId("ten-search-site-picker").classList.toggle("is-open", n), byId("ten-search-site-trigger").setAttribute("aria-expanded", String(n));
}

function handleSearchSiteChoice(e) {
    const t = e.target.closest("[data-search-index]");
    if (!t || t.disabled) return;
    const n = Number(t.dataset.searchIndex);
    state.selectedSearchIndex = n, byId("ten-search-site-label").textContent = n < 0 ? 0 === state.sourceMode ? "全部内置站点" : "全部导入站点" : state.searchSites[n].webName, 
    all(".ten-search-site-option").forEach(e => e.classList.toggle("is-selected", Number(e.dataset.searchIndex) === n)), 
    closeSearchSiteMenu();
}

function closeSearchSiteMenuOnOutsideClick(e) {
    const t = byId("ten-search-site-picker");
    t && !t.contains(e.target) && closeSearchSiteMenu();
}

function closeSearchSiteMenu() {
    const e = byId("ten-search-site-menu");
    e && (e.hidden = !0, byId("ten-search-site-picker").classList.remove("is-open"), 
    byId("ten-search-site-trigger").setAttribute("aria-expanded", "false"));
}

function closeSearchPanel() {
    const e = byId("ten-search-panel");
    e && (e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true"));
}

function renderSearchGroups(e, t) {
    t.innerHTML = e.map(e => `<div class="ten-section-title">${escapeHtml(e.site)}</div><div class="ten-result-grid">${e.results.map(e => `<button class="ten-result" type="button" data-url="${escapeAttr(e.url || "")}"><img src="${escapeAttr(e.imageUrl || "")}" alt="" loading="lazy"><span>${escapeHtml(e.name || "未命名")}</span></button>`).join("")}</div>`).join(""), 
    all(".ten-result", t).forEach(e => e.addEventListener("click", () => window.open(e.dataset.url, "_blank")));
}
