module.exports = () => {
    "use strict";
    var downloadUtils = __webpack_require__(624), configModule = __webpack_require__(390);
    class TaskCancelledError extends Error {
        constructor() {
            super("下载任务已取消"), this.name = "TaskCancelledError";
        }
    }
    const yieldToBrowser = e => Number(e) > 0 ? new Promise(t => setTimeout(t, e)) : "object" == typeof scheduler && scheduler && "function" == typeof scheduler.yield ? scheduler.yield() : "function" == typeof MessageChannel ? new Promise(e => {
        const t = new MessageChannel;
        t.port1.onmessage = () => {
            t.port1.close(), t.port2.close(), e();
        }, t.port2.postMessage(0);
    }) : Promise.resolve();
    /*__QUEUE_CLASS__*/    class DownloadQueue {}
    var siteRules = __webpack_require__(872);
    const ROOT_ID = "ten-comic-root", PANEL_ID = "ten-panel", LAUNCHER_ID = "ten-comic-launcher", PENDING_TASKS_KEY = "pendingTasks", BACKUP_KEYS = [ "appLoadDefault", "maxChapterNum", "maxPictureNum", "downType", "directDownloadFlow", "sanitizePathNames", "maxSplicingHeight", "imgIndexBitNum", "imgSplicingFlag", "imgDownRange", "historyLimit", "downloadNotification", "effectLevel", "themePreset", "appearanceAxes" ], THEMES = {
        glass: [ "深海流光", "青紫通透 · 经典" ],
        mist: [ "晨雾晶璃", "白色玻璃 · 柔光折射" ],
        cloud: [ "云白浮雕", "柔白拟态 · 轻盈触感" ],
        expressive: [ "星雾紫", "柔和圆角 · 层叠色面" ],
        carbon: [ "霓虹炭黑", "蓝粉边光 · 精密组件" ],
        garden: [ "晴白庭院", "暖白留光 · 鼠尾草绿" ]
    }, TAB_ORDER = [ "sites", "chapters", "tasks", "settings" ], TAB_TITLES = {
        sites: [ "漫画站点", "站点索引" ],
        chapters: [ "章节选择", "章节管理" ],
        tasks: [ "下载任务", "下载队列" ],
        settings: [ "偏好设置", "系统设置" ]
    }, state = {
        ready: !1,
        visible: !1,
        launcherVisible: !1,
        pendingLauncher: !1,
        activeTab: "chapters",
        sourceMode: 0,
        searchSites: [],
        selectedSearchIndex: -1,
        comicName: "------",
        webName: "未匹配",
        chapters: [],
        chaptersLoading: !1,
        lastSelected: null,
        editMode: !1,
        optionsOpen: !1,
        searching: !1,
        editRuleIndex: -1,
        editRuleBase: null,
        ruleReadType: 1,
        rulePicking: null,
        rulePickElement: null,
        rulePickFrame: null,
        iconTipTarget: null,
        iconTipTimer: null,
        miniNodes: null,
        drawerAnchor: null,
        drawerContent: null,
        toastUndo: null,
        queue: null,
        dirHandle: null,
        toastTimer: null,
        confirmResolve: null,
        diagnosticItem: null,
        recoveryTasks: [],
        persistTimer: null,
        lastHistoryId: null,
        historyFilter: "all",
        historyRaw: null,
        historyCache: [],
        historyRenderKey: "",
        particleCount: -1,
        settings: null
    };
    function normalizeThemePreset(value) {
        const preset = value === "porcelain" ? "cloud" : value === "ink" || value === "paper" ? "garden" : value;
        return Object.prototype.hasOwnProperty.call(THEMES, preset) ? preset : "glass";
    }
    function readSettings() {
        const e = safeGet("appLoadDefault", {}), t = e && "object" == typeof e ? e : {}, n = safeGet("imgDownRange", [ 1, -1 ]), r = Array.isArray(n) && n.length >= 2 ? n : [ 1, -1 ], a = safeGet("themePreset", "glass"), i = safeGet("appearanceAxes", {}), o = i && "object" == typeof i ? i : {};
        return {
            autoOpen: Boolean(t.isShowUI),
            hotkey: String(t.loadHotKey || "V").slice(0, 1).toUpperCase(),
            scale: boundedNumber(t.rightSize, 100, 75, 125),
            maxChapters: boundedNumber(safeGet("maxChapterNum", 2), 2, 1, 3),
            concurrentImages: boundedNumber(safeGet("maxPictureNum", 3), 3, 1, 5),
            downloadType: boundedNumber(safeGet("downType", 0), 0, 0, 2),
            directFlow: boundedNumber(safeGet("directDownloadFlow", 0), 0, 0, 1),
            sanitizePaths: Boolean(safeGet("sanitizePathNames", !0)),
            maxSplicingHeight: boundedNumber(safeGet("maxSplicingHeight", 2e4), 2e4, 1e4, 65530),
            digits: boundedNumber(safeGet("imgIndexBitNum", 3), 3, 1, 8),
            historyLimit: boundedNumber(safeGet("historyLimit", 100), 100, 10, 500),
            notifyComplete: Boolean(safeGet("downloadNotification", !0)),
            effectLevel: boundedNumber(safeGet("effectLevel", 1), 1, 0, 2),
            themePreset: normalizeThemePreset(a),
            appearance: {
                density: [ "compact", "standard", "comfortable" ].includes(o.density) ? o.density : "standard",
                shape: [ "sharp", "standard", "round" ].includes(o.shape) ? o.shape : "standard",
                motion: [ "calm", "standard", "spring" ].includes(o.motion) ? o.motion : "standard"
            },
            imageRange: r,
            splicePage: Boolean(safeGet("imgSplicingFlag", !0))
        };
    }
    function boundedNumber(e, t, n, r) {
        const a = Number(e);
        return Number.isFinite(a) ? Math.max(n, Math.min(r, a)) : t;
    }
    function safeGet(e, t) {
        try {
            const n = (0, configModule.cF)(e);
            return null == n ? t : n;
        } catch (e) {
            return t;
        }
    }
    function expandRuleEditor() {
        const editor = byId("ten-rule-editor-card");
        if (editor) editor.open = true;
    }
    function openUnsupportedRuleEditor() {
        initializeAppStorage();
        state.settings || (state.settings = readSettings()), injectStyle(), showUI(), activateTab("settings"), expandRuleEditor();
        const e = window.location.hostname.toLowerCase();
        byId("ten-rule-domain").value || (byId("ten-rule-domain").value = e), byId("ten-rule-homepage").value || (byId("ten-rule-homepage").value = `${window.location.protocol}//${window.location.host}/`), 
        setTimeout(() => byId("ten-rule-editor-card").scrollIntoView({
            behavior: "smooth",
            block: "start"
        }), 80), toast("已进入当前网站规则编辑，可使用可视化选择");
    }
    function handleGlobalHotkey(e) {
        if (handleModalKeydown(e)) return;
        if (!e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
        const t = String(e.key || "").toUpperCase(), n = String(e.code || "").toUpperCase(), r = state.settings ? state.settings.hotkey : "V";
        "V" !== t && "KEYV" !== n && t !== r && n !== `KEY${r}` || (e.preventDefault(), 
        e.stopPropagation(), toggleUI()
        
        );
    }
    /*__UI_SHELL__*/
    /*__UI_SITES__*/
    /*__UI_CHAPTERS__*/
    /*__UI_TASKS__*/
    /*__UI_RULES__*/
    /*__UI_ACCESSIBILITY__*/
    function injectStyle() {
        if (!document.body) return;
        const e = document.getElementById(ROOT_ID);
        if (e && state.ready) return;
        resetModalFocus();
        e && e.remove(), function() {
            if (document.getElementById("ten-comic-style")) return;
            const e = document.createElement("style");
            e.id = "ten-comic-style", e.textContent = /*__UI_STYLE__*/ "", (document.head || document.documentElement).appendChild(e);
        }(), (0, siteRules.HL)(window.location.href);
        const t = document.createElement("div");
        t.id = ROOT_ID, t.innerHTML = renderShell(), document.body.appendChild(t), state.historyRenderKey = "", 
        state.miniNodes = null, createParticles(), function() {
            const e = one(".ten-rule-intro");
            e && !byId("ten-rule-pick-actions") && e.insertAdjacentHTML("afterend", `<details id="ten-rule-template-library" class="ten-rule-templates"><summary>规则模板库 <span>先选类型，再点选网页元素</span></summary><div class="ten-rule-template-grid"><button \
type="button" data-rule-template="basic"><strong>基础卷轴</strong><small>普通图片列表</small></button><button type="button" \
data-rule-template="lazy"><strong>懒加载阅读</strong><small>data-src 等属性</small></button><button type="button" \
data-rule-template="frame"><strong>隐藏页面</strong><small>等待网页脚本渲染</small></button><button type="button" \
data-rule-template="paged"><strong>翻页阅读</strong><small>需要高级解析函数</small></button></div></details><div id="ten-rule-pick-actions" class="ten-rule-pick-actions" \
role="group" aria-label="可视化规则选择"><button type="button" data-rule-pick="title">${icon("target")}<span>选择标题</span></button><button type="button" data-rule-pick="chapters">${icon("target")}<span>选择章节</span></button><button type="button" data-rule-pick="images">${icon("target")}<span>选择图片</span></button></div>`);
        }(), byId(LAUNCHER_ID).addEventListener("click", showUI), byId("ten-mini-open").addEventListener("click", () => {
            showUI(), activateTab("tasks");
        }), byId("ten-mini-toggle").addEventListener("click", toggleMiniTasks), byId("ten-rule-pick-cancel").addEventListener("click", cancelRulePicking), 
        all("[data-rule-pick]").forEach(e => e.addEventListener("click", () => function(e) {
            const t = RULE_PICK_CONFIG[e];
            if (!t || state.rulePicking) return;
            closeRuleGuide(), state.rulePicking = t, state.rulePickElement = null, document.documentElement.classList.add("ten-rule-picking-page"), 
            byId(ROOT_ID).classList.add("is-rule-picking");
            const n = byId("ten-rule-pick-layer");
            n.classList.remove("is-hidden"), n.setAttribute("aria-hidden", "false"), byId("ten-rule-pick-title").textContent = `请选择${t.label}`, 
            byId("ten-rule-pick-selector").textContent = "移动鼠标并点击，Esc 取消", document.addEventListener("pointermove", handleRulePickMove, !0), 
            document.addEventListener("click", handleRulePickClick, !0), document.addEventListener("keydown", handleRulePickKey, !0), 
            window.addEventListener("scroll", refreshRulePickBox, !0), window.addEventListener("resize", refreshRulePickBox, !0), 
            syncMiniTaskBar();
        }(e.dataset.rulePick))), all("[data-rule-template]").forEach(e => e.addEventListener("click", () => function(e) {
            const t = RULE_TEMPLATES[e];
            t && (t.imageCss && (byId("ten-rule-image-selector").value = t.imageCss), byId("ten-rule-use-frame").checked = t.useFrame, 
            setRuleReadType(t.readtype), byId("ten-rule-advanced").open = 0 === t.readtype || t.useFrame, 
            all("[data-rule-template]").forEach(t => t.classList.toggle("is-active", t.dataset.ruleTemplate === e)), 
            toast(0 === t.readtype ? "已应用翻页模板，请在高级设置填写图片解析函数" : `已应用${t.name}模板`));
        }(e.dataset.ruleTemplate))), byId(ROOT_ID).addEventListener("pointerover", scheduleIconTooltip), 
        byId(ROOT_ID).addEventListener("pointerout", handleIconTooltipLeave), byId(ROOT_ID).addEventListener("focusin", showIconTooltip), 
        byId(ROOT_ID).addEventListener("focusout", handleIconTooltipLeave), byId(ROOT_ID).addEventListener("click", hideIconTooltip), 
        window.addEventListener("scroll", hideIconTooltip, !0), window.addEventListener("resize", handleLayoutResize), 
        byId("ten-close").addEventListener("click", hideUI), byId("ten-toast-action").addEventListener("click", runToastUndo), 
        all("[data-drawer-close]").forEach(e => e.addEventListener("click", closeMobileDrawer)), 
        one("summary", byId("ten-rule-advanced")).addEventListener("click", openRuleAdvancedDrawer), 
        all(".ten-tab").forEach(e => e.addEventListener("click", () => activateTab(e.dataset.tab))), 
        all(".ten-source button").forEach(e => e.addEventListener("click", () => {
            state.sourceMode = Number(e.dataset.source), renderSites();
        })), byId("ten-site-list").addEventListener("click", deleteImportedRule), byId("ten-rule-clear-all").addEventListener("click", clearRules), 
        byId("ten-search-site-trigger").addEventListener("click", toggleSearchSiteMenu), 
        byId("ten-search-site-menu").addEventListener("click", handleSearchSiteChoice), 
        document.addEventListener("click", closeSearchSiteMenuOnOutsideClick), byId("ten-search-btn").addEventListener("click", searchComics), 
        byId("ten-search-close").addEventListener("click", closeSearchPanel), byId("ten-search-input").addEventListener("keydown", e => {
            "Enter" === e.key && searchComics();
        }), byId("ten-load-chapters").addEventListener("click", loadChapters), byId("ten-reload-chapters").addEventListener("click", reloadChapters), 
        byId("ten-select-all").addEventListener("click", () => selectAllChapters(!0)), byId("ten-clear-select").addEventListener("click", () => selectAllChapters(!1)), 
        byId("ten-reverse-list").addEventListener("click", reverseChapters), byId("ten-edit-list").addEventListener("click", toggleChapterEdit), 
        byId("ten-toggle-options").addEventListener("click", toggleOptions), byId("ten-download-selected").addEventListener("click", downloadSelected), 
        byId("ten-download-current").addEventListener("click", downloadCurrentChapter), 
        all(".ten-mode").forEach(e => e.addEventListener("click", () => setDownloadMode(Number(e.dataset.mode)))), 
        byId("ten-add-sequence").addEventListener("change", updateChapterSequence), byId("ten-reverse-sequence").addEventListener("change", updateChapterSequence), 
        byId("ten-clear-history").addEventListener("click", clearHistory), byId("ten-toggle-all-active").addEventListener("click", toggleAllActiveTasks), 
        byId("ten-cancel-all-active").addEventListener("click", cancelAllActiveTasks), byId("ten-remove-all-waiting").addEventListener("click", removeAllWaitingTasks), 
        byId("ten-recovery-restore").addEventListener("click", restorePendingTasks), byId("ten-recovery-discard").addEventListener("click", discardPendingTasks), 
        byId("ten-active-tasks").addEventListener("click", handleTaskAction), byId("ten-waiting-tasks").addEventListener("click", handleTaskAction), 
        byId("ten-history").addEventListener("click", handleHistoryClick), byId("ten-history-filter").addEventListener("click", handleHistoryFilter), 
        byId("ten-confirm-ok").addEventListener("click", () => closeConfirm(!0)), all("[data-confirm-cancel]").forEach(e => e.addEventListener("click", () => closeConfirm(!1))), 
        all("[data-diagnostic-close]").forEach(e => e.addEventListener("click", closeDiagnostic)), 
        byId("ten-rule-guide-open").addEventListener("click", openRuleGuide), all("[data-rule-guide-close]").forEach(e => e.addEventListener("click", closeRuleGuide)), 
        byId("ten-diagnostic-copy").addEventListener("click", copyDiagnostic), byId("ten-copy-failures").addEventListener("click", () => copyFailureList(state.diagnosticItem)), 
        all(".ten-task-title-button").forEach(e => e.addEventListener("click", () => toggleTaskGroup(e))), 
        all(".ten-task-arrow-button").forEach(e => e.addEventListener("click", e => toggleTaskGroup(e.currentTarget))), 
        all('.ten-setting input[type="number"]').forEach(e => {
            if (e.parentElement.classList.contains("ten-number-control")) return;
            const t = document.createElement("div");
            t.className = "ten-number-control", e.before(t), t.appendChild(e);
            const n = document.createElement("span");
            n.className = "ten-number-steps", n.innerHTML = '<button type="button" data-number-step="1" aria-label="增加数值"><i></i></button><button type="button" data-number-step="-1" aria-label="减少数值"><i></i></button>', 
            t.appendChild(n), n.addEventListener("click", t => {
                const n = t.target.closest("[data-number-step]");
                n && (Number(n.dataset.numberStep) > 0 ? e.stepUp() : e.stepDown(), e.dispatchEvent(new Event("change", {
                    bubbles: !0
                })));
            });
        }), all("[data-theme-choice]").forEach(e => e.addEventListener("click", () => setThemePreset(e.dataset.themeChoice, !0))), 
        all("[data-appearance-axis]").forEach(e => e.addEventListener("click", () => function(e, t) {
            const n = {
                density: [ "compact", "standard", "comfortable" ],
                shape: [ "sharp", "standard", "round" ],
                motion: [ "calm", "standard", "spring" ]
            };
            n[e] && n[e].includes(t) && (state.settings.appearance[e] = t, applyAppearance(state.settings.appearance), 
            (0, configModule.po)("appearanceAxes", state.settings.appearance), toast("主题外观已更新"));
        }(e.dataset.appearanceAxis, e.dataset.appearanceValue))), bindChange("ten-auto-open", e => saveLoadSetting("isShowUI", e.target.checked)), 
        bindChange("ten-hotkey", e => {
            const t = String(e.target.value || "V").slice(-1).toUpperCase();
            e.target.value = t, state.settings.hotkey = t, saveLoadSetting("loadHotKey", t);
        }), byId("ten-scale").addEventListener("input", e => applyScale(Number(e.target.value), !1)), 
        byId("ten-scale").addEventListener("change", e => applyScale(Number(e.target.value), !0)), 
        all("[data-effect-level]").forEach(e => e.addEventListener("click", () => setEffectLevel(Number(e.dataset.effectLevel), !0))), 
        bindNumber("ten-max-chapters", "maxChapterNum", 1, 3, e => {
            state.settings.maxChapters = e, syncQueueLimits();
        }), bindNumber("ten-concurrent-images", "maxPictureNum", 1, 5, e => {
            state.settings.concurrentImages = e, syncQueueLimits();
        }), byId("ten-default-mode-trigger").addEventListener("click", toggleDefaultModeMenu), 
        byId("ten-default-mode-menu").addEventListener("click", chooseDefaultMode), all("[data-direct-flow]").forEach(e => e.addEventListener("click", () => setDirectFlow(Number(e.dataset.directFlow), !0))), 
        document.addEventListener("click", closeDefaultModeMenuOnOutsideClick), bindNumber("ten-max-height", "maxSplicingHeight", 1e4, 65530, e => {
            state.settings.maxSplicingHeight = e;
        }), bindNumber("ten-digits", "imgIndexBitNum", 1, 8, e => {
            state.settings.digits = e;
        }), bindNumber("ten-history-limit", "historyLimit", 10, 500, e => {
            state.settings.historyLimit = e, trimHistory();
        }), bindChange("ten-range-start", saveImageRange), bindChange("ten-range-end", saveImageRange), 
        bindChange("ten-splice-page", e => {
            state.settings.splicePage = e.target.checked, (0, configModule.po)("imgSplicingFlag", state.settings.splicePage), 
            applyPageSplicing();
        }), bindChange("ten-notify-complete", e => {
            state.settings.notifyComplete = e.target.checked, (0, configModule.po)("downloadNotification", state.settings.notifyComplete);
        }), bindChange("ten-sanitize-paths", e => {
            state.settings.sanitizePaths = e.target.checked, (0, configModule.po)("sanitizePathNames", state.settings.sanitizePaths);
        }), byId("ten-choose-dir").addEventListener("click", chooseDirectory), all("[data-rule-readtype]").forEach(e => e.addEventListener("click", () => setRuleReadType(Number(e.dataset.ruleReadtype)))), 
        byId("ten-rule-test").addEventListener("click", testRuleEditor), byId("ten-rule-save").addEventListener("click", saveRuleEditor), 
        byId("ten-rule-cancel-edit").addEventListener("click", resetRuleEditor), byId("ten-import-rules").addEventListener("click", importRules), 
        byId("ten-backup-export").addEventListener("click", exportSettingsBackup), byId("ten-backup-import").addEventListener("click", () => byId("ten-backup-file").click()), 
        byId("ten-backup-file").addEventListener("change", importSettingsBackup), byId("ten-reset").addEventListener("click", resetSettings), 
        byId(ROOT_ID).addEventListener("click", addRipple), applySettingsToUI(), detectComicInfo(), 
        renderSites(), renderChapters(), renderTasks(), async function() {
            if ("function" != typeof window.showDirectoryPicker) return void (byId("ten-dir-name").textContent = "浏览器默认下载目录");
            const e = await (0, downloadUtils.oZ)();
            if (e) try {
                "granted" === await e.queryPermission({
                    mode: "readwrite"
                }) && (state.dirHandle = e, window.__tenComicDirectoryHandle = e, byId("ten-dir-name").textContent = e.name);
            } catch (e) {
                byId("ten-dir-name").textContent = "请重新选择目录";
            }
        }(), state.ready = !0, function() {
            const e = safeGet(PENDING_TASKS_KEY, []), t = window.location.hostname.toLowerCase();
            state.recoveryTasks = uniqueTaskSnapshots(Array.isArray(e) ? e : []).filter(e => taskHost(e) === t), 
            renderRecoveryTasks();
        }(), activateTab(state.activeTab), state.settings.autoOpen ? showUI() : state.pendingLauncher && showLauncher();
    }
    function icon(e) {
        return `<svg class="ten-icon" aria-hidden="true"><use href="#ten-i-${e}"></use></svg>`;
    }
    function navButton(e, t, n) {
        return `<button class="ten-tab" type="button" data-tab="${e}">${icon(t)}<span>${n}</span></button>`;
    }
    function appearanceAxesSection() {
        const e = (e, t, n) => `<div class="ten-setting ten-appearance-setting"><label>${t}</label><div class="ten-appearance-axis" role="group" aria-label="${t}">${n.map(([t, n]) => `<button type="button" data-appearance-axis="${e}" data-appearance-value="${t}">${n}</button>`).join("")}</div></div>`;
        return `<section class="ten-settings-section ten-appearance-card"><div class="ten-card-title">外观调整</div>${e("density", "界面密度", [ [ "compact", "紧凑" ], [ "standard", "标准" ], [ "comfortable", "舒适" ] ])}${e("shape", "圆角风格", [ [ "sharp", "利落" ], [ "standard", "标准" ], [ "round", "圆润" ] ])}${e("motion", "动效节奏", [ [ "calm", "克制" ], [ "standard", "标准" ], [ "spring", "弹性" ] ])}</section>`;
    }
    function settingCheck(e, t) {
        return `<div class="ten-setting ten-setting-check"><label for="${e}">${t}</label><input id="${e}" type="checkbox"></div>`;
    }
    function bindChange(e, t) {
        byId(e).addEventListener("change", t);
    }
    function bindNumber(e, t, n, a, i) {
        bindChange(e, e => {
            const o = Math.max(n, Math.min(a, Number(e.target.value)));
            e.target.value = o, (0, configModule.po)(t, o), i(o);
        });
    }
    function setDirectFlow(e, t = !1) {
        const n = 1 === Number(e) ? 1 : 0;
        state.settings.directFlow = n, all("[data-direct-flow]").forEach(e => {
            const t = Number(e.dataset.directFlow) === n;
            e.classList.toggle("is-active", t), e.setAttribute("aria-pressed", String(t));
        }), t && (0, configModule.po)("directDownloadFlow", n);
    }
    function syncQueueLimits() {
        state.queue && state.queue.updateLimits(state.settings.maxChapters, state.settings.concurrentImages);
    }
    function toggleDefaultModeMenu(e) {
        e.stopPropagation();
        const t = byId("ten-default-mode"), n = byId("ten-default-mode-menu"), r = n.hidden;
        n.hidden = !r, t.classList.toggle("is-open", r), byId("ten-default-mode-trigger").setAttribute("aria-expanded", String(r)), 
        r && closeSearchSiteMenu();
    }
    function chooseDefaultMode(e) {
        const t = e.target.closest("[data-default-mode]");
        t && (setDownloadMode(Number(t.dataset.defaultMode), !0), closeDefaultModeMenu());
    }
    function closeDefaultModeMenuOnOutsideClick(e) {
        const t = byId("ten-default-mode");
        t && !t.contains(e.target) && closeDefaultModeMenu();
    }
    function closeDefaultModeMenu() {
        const e = byId("ten-default-mode-menu");
        e && (e.hidden = !0, byId("ten-default-mode").classList.remove("is-open"), byId("ten-default-mode-trigger").setAttribute("aria-expanded", "false"));
    }
    function applySettingsToUI() {
        const e = state.settings;
        setThemePreset(e.themePreset, !1), applyAppearance(e.appearance), byId("ten-auto-open").checked = e.autoOpen, 
        byId("ten-hotkey").value = e.hotkey, byId("ten-scale").value = e.scale, byId("ten-scale-value").textContent = `${e.scale}%`, 
        byId("ten-max-chapters").value = e.maxChapters, byId("ten-concurrent-images").value = e.concurrentImages, 
        byId("ten-max-height").value = e.maxSplicingHeight, byId("ten-digits").value = e.digits, 
        byId("ten-history-limit").value = e.historyLimit, byId("ten-range-start").value = e.imageRange[0], 
        byId("ten-range-end").value = e.imageRange[1], byId("ten-splice-page").checked = e.splicePage, 
        byId("ten-notify-complete").checked = e.notifyComplete, byId("ten-sanitize-paths").checked = e.sanitizePaths;
        byId("ten-rule-text").value = "", resetRuleEditor(), applyScale(e.scale, !1), setEffectLevel(e.effectLevel, !1), 
        setDownloadMode(e.downloadType, !1), setDirectFlow(e.directFlow, !1), applyPageSplicing();
    }
    function showUI() {
        state.ready && (state.visible = !0, byId(PANEL_ID).inert = false, byId(PANEL_ID).classList.add("is-open"), 
        byId(PANEL_ID).setAttribute("aria-hidden", "false"), byId(LAUNCHER_ID).classList.add("is-hidden"), 
        syncMiniTaskBar(), refreshQueueOnVisibility(), state.recoveryTasks.length && toast(`发现 ${state.recoveryTasks.length} 个未完成任务`));
    }
    function hideUI() {
        state.ready && (state.rulePicking && finishRulePicking(), state.visible = !1, byId(PANEL_ID).inert = true, 
        byId(PANEL_ID).classList.remove("is-open"), byId(PANEL_ID).setAttribute("aria-hidden", "true"), 
        byId(LAUNCHER_ID).classList.toggle("is-hidden", !state.launcherVisible), closeSearchPanel(), 
        closeDefaultModeMenu(), closeDiagnostic(), closeRuleGuide(), closeMobileDrawer(), 
        state.confirmResolve && closeConfirm(!1), syncMiniTaskBar(), refreshQueueOnVisibility());
    }
    function toggleUI() {
        return state.ready && !byId(PANEL_ID) && (state.ready = !1), state.ready ? state.visible ? (state.launcherVisible = !1, 
        void hideUI()) : void (state.launcherVisible ? state.ready && (state.launcherVisible = !1, 
        byId(LAUNCHER_ID).classList.add("is-hidden"), syncMiniTaskBar()) : showLauncher()) : (state.pendingLauncher = !0, 
        void injectStyle());
    }
    function showLauncher() {
        state.ready && (state.launcherVisible = !0, state.pendingLauncher = !1, byId(LAUNCHER_ID).classList.remove("is-hidden"), 
        syncMiniTaskBar());
    }
    function activateTab(e) {
        if (!TAB_ORDER.includes(e)) return;
        state.activeTab = e, all(".ten-view").forEach(t => t.classList.toggle("is-active", t.dataset.view === e)), 
        all(".ten-tab").forEach(t => t.classList.toggle("is-active", t.dataset.tab === e));
        const t = TAB_ORDER.indexOf(e);
        one(".ten-nav").style.setProperty("--tab", t), byId("ten-title").textContent = TAB_TITLES[e][0], 
        byId("ten-subtitle").textContent = TAB_TITLES[e][1], "tasks" === e && renderTasks()
        
        ;
    }
    function toggleOptions() {
        isNarrowLayout() ? byId("ten-mobile-drawer").classList.contains("is-open") ? closeMobileDrawer() : openMobileDrawer("下载选项", byId("ten-options")) : (state.optionsOpen = !state.optionsOpen, 
        byId("ten-options").classList.toggle("is-open", state.optionsOpen));
    }
    function handleLayoutResize() {
        hideIconTooltip();
        if (state.drawerContent && !isNarrowLayout()) closeMobileDrawer();
    }
    function isNarrowLayout() {
        return window.matchMedia("(max-width: 560px)").matches;
    }
    function openMobileDrawer(e, t) {
        if (!t || state.drawerContent) return;
        const n = byId("ten-mobile-drawer"), r = document.createComment("ten-mobile-drawer-anchor");
        t.before(r), byId("ten-mobile-drawer-content").appendChild(t), state.drawerAnchor = r, 
        state.drawerContent = t, "ten-options" === t.id && (state.optionsOpen = !0), t.classList.add("is-open", "is-mobile-drawer-content"), 
        byId("ten-mobile-drawer-title").textContent = e, n.classList.add("is-open"), n.setAttribute("aria-hidden", "false"), 
        activateModalFocus(n.id), setTimeout(() => {
            byId("ten-mobile-drawer-content").scrollTop = 0;
        }, 0);
    }
    function closeMobileDrawer() {
        const e = byId("ten-mobile-drawer");
        if (!e) return;
        e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true");
        const t = state.drawerContent;
        t && state.drawerAnchor?.parentNode && (t.classList.remove("is-open", "is-mobile-drawer-content"), 
        state.drawerAnchor.replaceWith(t)), "ten-options" === t?.id && (state.optionsOpen = !1), 
        t?.classList.contains("ten-rule-advanced-body") && (byId("ten-rule-advanced").open = !1), 
        state.drawerContent = null, state.drawerAnchor = null;
        releaseModalFocus("ten-mobile-drawer");
    }
    function openRuleAdvancedDrawer(e) {
        if (!isNarrowLayout()) return;
        e.preventDefault();
        const t = byId("ten-rule-advanced");
        t.open = !0, openMobileDrawer("复杂站点设置", one(".ten-rule-advanced-body", t));
    }
    function setDownloadMode(e, t = !1) {
        state.settings.downloadType = e, all(".ten-mode").forEach(t => t.classList.toggle("is-active", Number(t.dataset.mode) === e));
        const n = [ "直接下载", "压缩下载", "图片拼接" ];
        byId("ten-default-mode-label") && (byId("ten-default-mode-label").textContent = n[e] || n[0]), 
        all("[data-default-mode]").forEach(t => t.classList.toggle("is-selected", Number(t.dataset.defaultMode) === e)), 
        t && (0, configModule.po)("downType", e);
    }
    function updateChapterSequence() {
        const e = byId("ten-add-sequence").checked, t = byId("ten-reverse-sequence").checked, r = state.chapters.length;
        state.chapters.forEach((a, i) => {
            a.chapterNumStr = e ? (0, downloadUtils.xo)(t ? r - i : i + 1, 3) : "";
        }), renderChapters();
    }
    function showChapterName(e) {
        return e.chapterNumStr ? `${e.chapterNumStr}${e.chapterName ? `-${e.chapterName}` : ""}` : e.chapterName;
    }
    function downloadSelected() {
        const e = state.chapters.filter(e => e.isSelect && canSelectChapter(e)).map(e => function(e) {
            const t = Object.assign({}, e);
            return t.downChapterName = showChapterName(t), t.downType = state.settings.downloadType, 
            t.downHeaders = siteRules.Po && siteRules.Po.downHeaders, t.batchDelay = siteRules.Po && siteRules.Po.batchDelay, 
            t.directFlow = state.settings.directFlow, t.directRemoteDownload = Boolean(siteRules.Po && siteRules.Po.directRemoteDownload), 
            t.heavyCanvasExport = Boolean(siteRules.Po && siteRules.Po.heavyCanvasExport), t;
        }(e));
        e.length ? (enqueueDownloads(e), state.chapters.forEach(e => {
            e.isSelect = !1;
        }), renderChapters()) : toast("请先选择章节");
    }
    function downloadCurrentChapter() {
        if (!siteRules.Po) return void toast("当前网站没有匹配规则");
        const e = byId("ten-current-comic").value.trim(), t = byId("ten-current-chapter").value.trim();
        e && t ? (enqueueDownloads([ {
            comicName: e,
            chapterName: t,
            downChapterName: t,
            url: window.location.href,
            characterType: "one",
            readtype: siteRules.Po.readtype,
            isPay: Boolean(siteRules.Po.hasSpend),
            downType: state.settings.downloadType,
            downHeaders: siteRules.Po.downHeaders,
            batchDelay: siteRules.Po.batchDelay,
            directFlow: state.settings.directFlow,
            directRemoteDownload: Boolean(siteRules.Po.directRemoteDownload),
            heavyCanvasExport: Boolean(siteRules.Po.heavyCanvasExport)
        } ]), state.optionsOpen = !1, byId("ten-options").classList.remove("is-open")) : toast("请输入漫画名和章节名");
    }
    async function enqueueDownloads(e) {
        siteRules.Po && void 0 !== siteRules.Po.batchDelay && e.forEach(e => {
            void 0 === e.batchDelay && (e.batchDelay = siteRules.Po.batchDelay);
        }), e.forEach(e => {
            void 0 === e.directFlow && (e.directFlow = state.settings.directFlow), void 0 === e.directRemoteDownload && (e.directRemoteDownload = Boolean(siteRules.Po && siteRules.Po.directRemoteDownload)), 
            void 0 === e.heavyCanvasExport && (e.heavyCanvasExport = Boolean(siteRules.Po && siteRules.Po.heavyCanvasExport));
        }), "function" != typeof window.showDirectoryPicker || await (0, downloadUtils.Oh)() || toast("未选择保存目录，将使用浏览器默认下载目录"), 
        e.forEach(e => {
            e.useDirectory = Boolean(window.__tenComicDirectoryHandle || window.__ylDirectoryHandle);
        }), state.queue || (state.queue = new DownloadQueue(state.settings.maxChapters, state.settings.concurrentImages, state.settings.digits, {
            getHistoryData: renderTasks,
            $forceUpdate: scheduleTaskRender,
            persistTasks: scheduleTaskPersist,
            notifyTask: notifyDownloadTask
        })), state.queue, state.queue.addList(e), state.queue.run(), activateTab("tasks"), 
        renderTasks();
    }
    function taskHost(e) {
        if (e && e.originHost) return String(e.originHost).toLowerCase();
        try {
            return new URL(e && e.url || "", window.location.href).hostname.toLowerCase();
        } catch (e) {
            return window.location.hostname.toLowerCase();
        }
    }
    function uniqueTaskSnapshots(e) {
        const t = new Set;
        return e.filter(e => {
            if (!e || !e.url) return !1;
            const n = JSON.stringify([ taskHost(e), e.comicName || "", e.downChapterName || e.chapterName || "", e.url ]);
            return !t.has(n) && (t.add(n), !0);
        });
    }
    function renderRecoveryTasks() {
        state.ready && (byId("ten-recovery").hidden = 0 === state.recoveryTasks.length, 
        byId("ten-recovery-count").textContent = state.recoveryTasks.length ? `${state.recoveryTasks.length} 个任务可恢复` : "");
    }
    async function restorePendingTasks() {
        const e = state.recoveryTasks.slice();
        e.length && (state.recoveryTasks = [], renderRecoveryTasks(), await enqueueDownloads(e), 
        toast(`已恢复 ${e.length} 个任务`));
    }
    async function discardPendingTasks() {
        state.recoveryTasks.length && await showConfirm("放弃未完成任务", `将删除当前站点的 ${state.recoveryTasks.length} 个恢复点。`, "放弃任务") && (state.recoveryTasks = [], 
        persistQueueState(), renderRecoveryTasks(), toast("未完成任务已放弃"));
    }
    function scheduleTaskPersist() {
        clearTimeout(state.persistTimer), state.persistTimer = setTimeout(persistQueueState, 750);
    }
    function persistQueueState() {
        clearTimeout(state.persistTimer), state.persistTimer = null;
        const e = window.location.hostname.toLowerCase(), t = safeGet(PENDING_TASKS_KEY, []), n = (Array.isArray(t) ? t : []).filter(t => taskHost(t) !== e), a = state.queue ? state.queue.pendingTasks() : state.recoveryTasks;
        (0, configModule.po)(PENDING_TASKS_KEY, uniqueTaskSnapshots(n.concat(a)));
    }
    function handlePageHide() {
        (state.queue || state.recoveryTasks.length) && persistQueueState();
    }
    function initializeAppStorage() {
        try {
            (0, configModule.Iq)();
        } catch (e) {
            console.warn("10漫画：初始化存储失败。", e);
        }
    }
    !function() {
        (0, siteRules.HL)(window.location.href), siteRules.Po ? (initializeAppStorage(), 
        state.settings = readSettings(), window.addEventListener("keydown", handleGlobalHotkey, {
            capture: !0,
            passive: !1
        }), window.addEventListener("pageshow", injectStyle), window.addEventListener("pagehide", handlePageHide), 
        document.addEventListener("visibilitychange", refreshQueueOnVisibility), function() {
            try {
                GM_registerMenuCommand("显示/隐藏 10漫画入口", toggleUI, {
                    accessKey: "v",
                    autoClose: !0
                }), GM_registerMenuCommand("重置 10漫画设置", resetSettings);
            } catch (e) {
                console.warn("10漫画：菜单注册失败。", e);
            }
        }(), "loading" === document.readyState ? document.addEventListener("DOMContentLoaded", injectStyle, {
            once: !0
        }) : injectStyle()) : function() {
            try {
                GM_registerMenuCommand("为当前网站添加自定义规则", openUnsupportedRuleEditor);
            } catch (e) {
                console.warn("10漫画：自定义规则菜单注册失败。", e);
            }
        }();
    }();
        function showConfirm(e, t, n = "确认") {
        state.confirmResolve && closeConfirm(!1), byId("ten-confirm-title").textContent = e, 
        byId("ten-confirm-message").textContent = t, byId("ten-confirm-ok").textContent = n;
        const r = byId("ten-confirm");
        return r.classList.add("is-open"), r.setAttribute("aria-hidden", "false"), activateModalFocus(r.id, "#ten-confirm-cancel"), 
        new Promise(e => {
            state.confirmResolve = e;
        });
    }
    function closeConfirm(e) {
        const t = state.confirmResolve;
        state.confirmResolve = null;
        const n = byId("ten-confirm");
        n && (n.classList.remove("is-open"), n.setAttribute("aria-hidden", "true")), releaseModalFocus("ten-confirm"), 
        t && t(e);
    }
    function openRuleGuide() {
        const e = byId("ten-rule-guide");
        e && (e.classList.add("is-open"), e.setAttribute("aria-hidden", "false"), activateModalFocus(e.id));
    }
    function closeRuleGuide() {
        releaseModalFocus("ten-rule-guide");
        const e = byId("ten-rule-guide");
        e && (e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true"));
    }
    function openDiagnostic(e) {
        if (!e) return;
        state.diagnosticItem = e;
        const t = Array.isArray(e.diagnostics) ? e.diagnostics : [], n = Array.isArray(e.failedImages) ? e.failedImages : Array.isArray(e.failures) ? e.failures : [], r = e.stage || (e.hasError ? "存在下载错误" : "没有发现错误"), a = [ `漫画：${e.comicName || "未知"}`, `章节：${e.downChapterName || e.chapterName || "未知"}`, `状态：${r}`, `页面：${e.comicPageUrl || e.url || window.location.href}`, `失败图片：${n.length} 张`, "" ];
        t.length ? (a.push("诊断详情："), t.forEach((e, t) => {
            const n = e.time ? new Date(e.time).toLocaleString() : "未知时间";
            a.push(`${t + 1}. [${n}] ${e.stage || "下载"}：${e.message || "未知错误"}`), e.imgIndex && a.push(`   图片序号：${e.imgIndex}`), 
            e.url && a.push(`   地址：${e.url}`);
        })) : a.push(e.hasError ? "这是旧版记录，没有保存详细错误信息。" : "当前没有错误详情。"), byId("ten-diagnostic-summary").textContent = `${e.comicName || "未知漫画"} · ${e.downChapterName || e.chapterName || "未知章节"}`, 
        byId("ten-diagnostic-content").textContent = a.join("\n");
        const i = byId("ten-diagnostic");
        i.classList.add("is-open"), i.setAttribute("aria-hidden", "false"), activateModalFocus(i.id);
    }
    function closeDiagnostic() {
        releaseModalFocus("ten-diagnostic");
        const e = byId("ten-diagnostic");
        e && (e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true"));
    }
    function copyDiagnostic() {
        copyText(byId("ten-diagnostic-content").textContent, "诊断信息已复制");
    }
    function copyFailureList(e) {
        const t = Array.isArray(e && e.failedImages) ? e.failedImages : Array.isArray(e && e.failures) ? e.failures : [];
        if (!t.length) return toast("没有失败图片可复制");
        const n = [ `漫画：${e.comicName || "未知"}`, `章节：${e.downChapterName || e.chapterName || "未知"}`, `失败图片：${t.length} 张`, "" ];
        t.forEach((e, t) => n.push(`${t + 1}. 序号：${e.imgIndex || "未知"}\n   原因：${e.reason || "未知错误"}\n   地址：${e.url || "无"}`)), 
        copyText(n.join("\n"), "失败清单已复制");
    }
    function copyText(e, t) {
        try {
            GM_setClipboard(e, "text"), toast(t);
        } catch (n) {
            navigator.clipboard && "function" == typeof navigator.clipboard.writeText ? navigator.clipboard.writeText(e).then(() => toast(t)).catch(() => toast("复制失败")) : toast("复制失败");
        }
    }
    function saveLoadSetting(e, t) {
        const n = safeGet("appLoadDefault", {}), a = n && "object" == typeof n ? n : {};
        a[e] = t, (0, configModule.po)("appLoadDefault", a), "isShowUI" === e && (state.settings.autoOpen = t);
    }
    function applyScale(e, t) {
        state.settings.scale = e, byId(PANEL_ID).style.setProperty("--ten-scale", e / 100), 
        byId("ten-scale-value").textContent = `${e}%`, t && saveLoadSetting("rightSize", e);
    }
    function setEffectLevel(e, t) {
        const n = Math.max(0, Math.min(2, Number(e) || 0));
        state.settings.effectLevel = n, byId(ROOT_ID).dataset.effects = String(n), createParticles(n), 
        all("[data-effect-level]").forEach(e => {
            const t = Number(e.dataset.effectLevel) === n;
            e.classList.toggle("is-active", t), e.setAttribute("aria-pressed", String(t));
        }), t && ((0, configModule.po)("effectLevel", n), toast([ "特效已关闭", "已切换为轻量特效", "已切换为标准特效" ][n]));
    }
    function setThemePreset(e, t) {
        const n = normalizeThemePreset(e);
        state.settings.themePreset = n, byId(ROOT_ID).dataset.theme = n, all("[data-theme-choice]").forEach(e => e.setAttribute("aria-pressed", String(e.dataset.themeChoice === n))), 
        t && ((0, configModule.po)("themePreset", n), toast(`已切换为${THEMES[n][0]}`));
    }
    function applyAppearance(e) {
        const t = byId(ROOT_ID), n = e || {};
        t.dataset.density = n.density || "standard", t.dataset.shape = n.shape || "standard", 
        t.dataset.motion = n.motion || "standard", all("[data-appearance-axis]").forEach(e => {
            const t = e.dataset.appearanceValue === n[e.dataset.appearanceAxis];
            e.classList.toggle("is-active", t), setAttribute(e, "aria-pressed", String(t));
        });
    }
    function saveImageRange() {
        const e = Math.max(1, Math.trunc(Number(byId("ten-range-start").value) || 1)), t = Math.trunc(Number(byId("ten-range-end").value) || -1), n = -1 === t ? -1 : Math.max(e, t);
        state.settings.imageRange = [ e, n ], byId("ten-range-start").value = e, byId("ten-range-end").value = n, 
        (0, configModule.po)("imgDownRange", state.settings.imageRange);
    }
    function exportSettingsBackup() {
        const e = Object.fromEntries(BACKUP_KEYS.map(e => [ e, safeGet(e, null) ])), n = {
            format: "10Comic-settings-backup",
            version: 1,
            exportedAt: (new Date).toISOString(),
            settings: e,
            rules: Array.isArray(safeGet("userWebInfo", [])) ? safeGet("userWebInfo", []) : []
        }, r = (new Date).toISOString().slice(0, 10);
        !function(e, t) {
            const n = URL.createObjectURL(e);
            let r = !1, a = !1;
            const i = () => {
                r || (r = !0, URL.revokeObjectURL(n));
            }, o = () => {
                if (r || a) return;
                a = !0;
                const e = document.createElement("a");
                e.href = n, e.download = t, e.hidden = !0, document.body.appendChild(e), e.click(), 
                e.remove(), setTimeout(i, 1e3), toast("设置与规则备份已导出");
            };
            try {
                GM_download({
                    url: n,
                    name: t,
                    saveAs: !0,
                    onload: () => {
                        i(), toast("设置与规则备份已导出");
                    },
                    onerror: o,
                    ontimeout: o
                });
            } catch (e) {
                o();
            }
        }(new Blob([ JSON.stringify(n, null, 2) ], {
            type: "application/json"
        }), `10Comic-设置与规则备份-${r}.json`);
    }
    async function importSettingsBackup(e) {
        const t = e.target.files && e.target.files[0];
        if (e.target.value = "", t) try {
            const e = JSON.parse(await t.text());
            if (!e || "10Comic-settings-backup" !== e.format || !e.settings || !Array.isArray(e.rules)) throw new Error("不是有效的 10漫画备份文件");
            const n = e => (Array.isArray(e) ? e : [ e ]).some(e => String(e || "").trim());
            if (e.rules.some(e => !e || !n(e.domain))) throw new Error("备份中的规则域名无效");
            if (!await showConfirm("导入设置与规则", `将使用备份中的设置和 ${e.rules.length} 条规则覆盖当前配置。`, "确认导入")) return;
            BACKUP_KEYS.forEach(t => {
                void 0 !== e.settings[t] && null !== e.settings[t] && (0, configModule.po)(t, e.settings[t]);
            }), (0, configModule.po)("userWebInfo", e.rules), state.settings = readSettings(), 
            applySettingsToUI(), trimHistory(), renderSites(), toast(`备份已导入，共 ${e.rules.length} 条规则`);
        } catch (e) {
            toast(e.message || "备份文件读取失败");
        }
    }
    function applyPageSplicing() {
        let e = document.getElementById("ten-comic-page-style");
        e || (e = document.createElement("style"), e.id = "ten-comic-page-style", document.head.appendChild(e)), 
        e.textContent = state.settings.splicePage && siteRules.Po && siteRules.Po.readCssText ? siteRules.Po.readCssText : "";
    }
    async function chooseDirectory() {
        if ("function" == typeof window.showDirectoryPicker) try {
            const e = await (0, downloadUtils.IJ)();
            e && (state.dirHandle = e, byId("ten-dir-name").textContent = e.name, toast("保存目录已更新"));
        } catch (e) {
            e && "AbortError" !== e.name && toast("目录选择失败");
        } else toast("当前浏览器将使用默认下载目录");
    }
    function refreshQueueOnVisibility() {
        byId(ROOT_ID)?.classList.toggle("is-page-hidden", document.hidden);
        document.hidden || state.queue && state.queue.refresh();
    }
        async function resetSettings() {
        await showConfirm("重置全部设置", "界面、下载和规则设置都将恢复默认值。", "确认重置") && (await (0, configModule.zU)(), 
        state.settings = readSettings(), state.ready && (applySettingsToUI(), toast("设置已重置")));
    }
    function createParticles(e = (state.settings ? state.settings.effectLevel : 1)) {
        const t = 0 === e ? 0 : 1 === e ? 11 : 22, n = byId("ten-particle-field");
        if (state.particleCount === t && n.childElementCount === t) return;
        state.particleCount = t;
        const r = [ "#5ff6ff", "#5b8cff", "#9c6cff", "#ff5fac" ];
        n.innerHTML = Array.from({
            length: t
        }, (e, t) => `<i style="--x:${(37 * t + 11) % 100}%;--y:${(61 * t + 7) % 100}%;--s:${1 + t % 3}px;--tx:${13 * t % 34 - 16}px;--ty:${17 * t % 46 - 22}px;--d:${4 + t % 5}s;--delay:-${t % 7}s;--c:${r[t % r.length]}"></i>`).join("");
    }
    function addRipple(e) {
        const t = e.target.closest(".ten-btn");
        if (!t || t.disabled || 0 === state.settings.effectLevel) return;
        const n = t.getBoundingClientRect(), r = document.createElement("span"), a = Math.max(n.width, n.height);
        r.className = "ten-ripple", r.style.width = r.style.height = `${a}px`, r.style.left = e.clientX - n.left - a / 2 + "px", 
        r.style.top = e.clientY - n.top - a / 2 + "px", t.appendChild(r), r.addEventListener("animationend", () => r.remove(), {
            once: !0
        });
    }
    function toast(e, t = null) {
        if (!state.ready) return;
        const n = byId("ten-toast"), r = byId("ten-toast-action");
        setText(byId("ten-toast-text"), e), state.toastUndo = "function" == typeof t ? t : null, 
        r.hidden = !state.toastUndo, n.classList.add("is-show"), clearTimeout(state.toastTimer), 
        state.toastTimer = setTimeout(() => {
            n.classList.remove("is-show"), state.toastUndo = null, r.hidden = !0;
        }, state.toastUndo ? 6500 : 2200);
    }
    function runToastUndo() {
        const e = state.toastUndo;
        e && (state.toastUndo = null, clearTimeout(state.toastTimer), byId("ten-toast-action").hidden = !0, 
        e(), toast("已撤销刚才的操作"));
    }
    function notifyDownloadTask(e) {
        const t = e.downChapterName || e.chapterName || "未命名章节", n = "failed" === e.status || "partial" === e.status || e.hasError, r = n ? `${t} 下载结束，存在失败图片` : `${t} 下载完成`;
        if (!state.visible || document.hidden) {
            if (state.settings.notifyComplete) try {
                GM_notification({
                    title: n ? "10漫画：下载存在错误" : "10漫画：下载完成",
                    text: r,
                    timeout: 6e3,
                    silent: !1,
                    onclick: () => {
                        showUI(), activateTab("tasks");
                    }
                });
            } catch (e) {
                console.warn("10漫画：系统通知发送失败。", e);
            }
        } else toast(r);
    }
    function empty(e) {
        return `<div class="ten-empty">${escapeHtml(e)}</div>`;
    }
    function byId(e) {
        return document.getElementById(e);
    }
    function setText(e, t) {
        const n = String(t);
        e && e.textContent !== n && (e.textContent = n);
    }
    function setAttribute(e, t, n) {
        e && e.getAttribute(t) !== n && e.setAttribute(t, n);
    }
    function setStyle(e, t, n) {
        e && e.style.getPropertyValue(t) !== n && e.style.setProperty(t, n);
    }
    function one(e, t = document) {
        return t.querySelector(e);
    }
    function all(e, t = document) {
        return Array.from(t.querySelectorAll(e));
    }
    function escapeHtml(e) {
        return String(null == e ? "" : e).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function escapeAttr(e) {
        return escapeHtml(e).replace(/`/g, "&#96;");
    }
};
