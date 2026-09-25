module.exports = () => {
  "use strict";

  var zipModule = __webpack_require__(733),
    zipDefault = __webpack_require__.n(zipModule),
    downloadUtils = __webpack_require__(624),
    configModule = __webpack_require__(390);
  class TaskCancelledError extends Error {
    constructor() {
      super("下载任务已取消"), this.name = "TaskCancelledError";
    }
  }
  const yieldToBrowser = e => Number(e) > 0 ? new Promise(t => setTimeout(t, e)) : "object" == typeof scheduler && scheduler && "function" == typeof scheduler.yield ? scheduler.yield() : "function" == typeof MessageChannel ? new Promise(e => {
    const t = new MessageChannel();
    t.port1.onmessage = () => {
      t.port1.close(), t.port2.close(), e();
    }, t.port2.postMessage(0);
  }) : Promise.resolve();
  /*__QUEUE_CLASS__*/
  class DownloadQueue {}
  var siteRules = __webpack_require__(872);
  const ROOT_ID = "ten-comic-root",
    PANEL_ID = "ten-panel",
    LAUNCHER_ID = "ten-comic-launcher",
    PENDING_TASKS_KEY = "pendingTasks",
    BACKUP_KEYS = ["appLoadDefault", "maxChapterNum", "maxPictureNum", "downType", "directDownloadFlow", "sanitizePathNames", "maxSplicingHeight", "imgIndexBitNum", "imgSplicingFlag", "imgDownRange", "historyLimit", "downloadNotification", "effectLevel", "themePreset", "appearanceAxes"],
    THEMES = {
      glass: ["深海流光", "青紫通透 · 经典"],
      mist: ["晨雾晶璃", "白色玻璃 · 柔光折射"],
      porcelain: ["白瓷简章", "暖白实体 · 清晰秩序"],
      expressive: ["星雾紫", "柔和圆角 · 层叠色面"],
      carbon: ["霓虹炭黑", "蓝粉边光 · 精密组件"],
      ink: ["墨竹书斋", "墨色暖金 · 阅读质感"]
    },
    TAB_ORDER = ["sites", "chapters", "tasks", "settings"],
    TAB_TITLES = {
      sites: ["漫画站点", "站点索引"],
      chapters: ["章节选择", "章节管理"],
      tasks: ["下载任务", "下载队列"],
      settings: ["偏好设置", "系统设置"]
    },
    state = {
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
  function readSettings() {
    const e = safeGet("appLoadDefault", {}),
      t = e && "object" == typeof e ? e : {},
      n = safeGet("imgDownRange", [1, -1]),
      r = Array.isArray(n) && n.length >= 2 ? n : [1, -1],
      a = safeGet("themePreset", "glass"),
      i = safeGet("appearanceAxes", {}),
      o = i && "object" == typeof i ? i : {};
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
      themePreset: Object.prototype.hasOwnProperty.call(THEMES, a) ? a : "glass",
      appearance: {
        density: ["compact", "standard", "comfortable"].includes(o.density) ? o.density : "standard",
        shape: ["sharp", "standard", "round"].includes(o.shape) ? o.shape : "standard",
        motion: ["calm", "standard", "spring"].includes(o.motion) ? o.motion : "standard"
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
  function openUnsupportedRuleEditor() {
    state.settings || (state.settings = readSettings()), injectStyle(), showUI(), activateTab("settings");
    const e = window.location.hostname.toLowerCase();
    byId("ten-rule-domain").value || (byId("ten-rule-domain").value = e), byId("ten-rule-homepage").value || (byId("ten-rule-homepage").value = `${window.location.protocol}//${window.location.host}/`), setTimeout(() => byId("ten-rule-editor-card").scrollIntoView({
      behavior: "smooth",
      block: "start"
    }), 80), toast("已进入当前网站规则编辑，可使用可视化选择");
  }
  function handleGlobalHotkey(e) {
    if ("Escape" === e.key && byId("ten-mobile-drawer")?.classList.contains("is-open")) return e.preventDefault(), void closeMobileDrawer();
    if ("Escape" === e.key && byId("ten-rule-guide")?.classList.contains("is-open")) return e.preventDefault(), void closeRuleGuide();
    if ("Escape" === e.key && state.confirmResolve) return e.preventDefault(), void closeConfirm(!1);
    if (!e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
    const t = String(e.key || "").toUpperCase(),
      n = String(e.code || "").toUpperCase(),
      r = state.settings ? state.settings.hotkey : "V";
    "V" !== t && "KEYV" !== n && t !== r && n !== `KEY${r}` || (e.preventDefault(), e.stopPropagation(), toggleUI());
  }
  function injectStyle() {
    if (!document.body) return;
    const e = document.getElementById(ROOT_ID);
    if (e && state.ready) return;
    e && e.remove(), function () {
      if (document.getElementById("ten-comic-style")) return;
      const e = document.createElement("style");
      e.id = "ten-comic-style", e.textContent = ["#ten-comic-root {\n  --ten-bg: rgba(5, 12, 25, .78);\n  --ten-surface: rgba(23, 38, 62, .55);\n  --ten-surface-strong: rgba(31, 50, 78, .76);\n  --ten-line: rgba(137, 225, 255, .2);\n  --ten-text: #eefaff;\n  --ten-muted: #89a2b7;\n  --ten-cyan: #5ff6ff;\n  --ten-blue: #5b8cff;\n  --ten-violet: #9c6cff;\n  --ten-pink: #ff5fac;\n  --ten-danger: #ff6174;\n  --ten-success:", " #55efb6;\n  --ten-panel-bg: linear-gradient(150deg, rgba(20,42,67,.68), rgba(9,18,36,.78));\n  --ten-panel-border: rgba(133,233,255,.28);\n  --ten-panel-shadow: 0 30px 90px rgba(0,5,15,.5), 0 0 0 1px rgba(255,255,255,.05) inset, 0 0 42px rgba(91,140,255,.12);\n  --ten-header-bg: rgba(4,12,25,.48);\n  --ten-card-bg: rgba(23,38,62,.55);\n  --ten-card-border: rgba(1", "37,225,255,.2);\n  --ten-card-shadow: inset 0 1px rgba(255,255,255,.06);\n  --ten-task-bg: rgba(10,25,46,.52);\n  --ten-list-bg: rgba(23,38,62,.46);\n  --ten-list-hover-bg: rgba(36,61,91,.6);\n  --ten-control-bg: linear-gradient(110deg,rgba(39,68,101,.72),rgba(80,47,123,.65),rgba(31,92,112,.72));\n  --ten-control-hover-bg: rgba(95,246,255,.09);\n  --ten-control-bor", "der: rgba(111,220,255,.2);\n  --ten-primary-bg: linear-gradient(110deg,#5ff6ff,#7fb1ff,#c078ff,#5ff6ff);\n  --ten-primary-text: #04131c;\n  --ten-primary-border: rgba(160,255,255,.72);\n  --ten-danger-bg: rgba(255,97,116,.12);\n  --ten-danger-text: #ffdfe5;\n  --ten-danger-border: rgba(255,97,116,.3);\n  --ten-input-bg: rgba(2,10,22,.42);\n  --ten-popover-bg: linear", "-gradient(150deg,rgba(28,51,75,.98),rgba(10,22,40,.98));\n  --ten-empty-bg: rgba(11,27,49,.38);\n  --ten-info-bg: rgba(2,10,22,.25);\n  --ten-mini-bg: linear-gradient(145deg,rgba(28,51,75,.94),rgba(20,28,52,.95));\n  --ten-overlay-bg: rgba(2,8,19,.62);\n  --ten-tooltip-bg: rgba(5,15,29,.97);\n  --ten-tooltip-text: #eefaff;\n  --ten-tooltip-border: rgba(95,246,255,.", "28);\n  --ten-tooltip-shadow: 0 10px 28px rgba(0,5,15,.38), inset 0 1px rgba(255,255,255,.08);\n  --ten-toast-bg: rgba(5,15,29,.94);\n  --ten-toast-text: #eefaff;\n  --ten-toast-border: rgba(95,246,255,.3);\n  --ten-launcher-bg: linear-gradient(145deg,rgba(28,72,108,.88),rgba(91,54,148,.86));\n  --ten-launcher-border: rgba(111,236,255,.48);\n  --ten-launcher-shadow", ": 0 12px 34px rgba(4,14,30,.3),0 0 25px rgba(95,246,255,.2),inset 0 1px rgba(255,255,255,.18);\n  --ten-radius-launcher: 18px;\n  --ten-focus-ring: 0 0 0 3px rgba(95,246,255,.1);\n  --ten-scroll-thumb: rgba(95,246,255,.3);\n  --ten-radius-panel: 24px;\n  --ten-radius-card: 15px;\n  --ten-radius-control: 11px;\n  --ten-scale: 1;\n  position: fixed;\n  z-index: 2147483", '645;\n  inset: 0;\n  pointer-events: none;\n  color: var(--ten-text);\n  font: 13px/1.5 Inter, "PingFang SC", "Microsoft YaHei", sans-serif;\n}\n#ten-comic-root *, #ten-comic-root *::before, #ten-comic-root *::after { box-sizing: border-box; }\n#ten-comic-launcher {\n  all: initial;\n  position: fixed;\n  z-index: 2147483646;\n  top: 50%;\n  right: 12px;\n  width: 52px;\n', '  height: 52px;\n  display: grid;\n  place-items: center;\n  transform: translateY(-50%);\n  overflow: hidden;\n  color: #efffff;\n  font: 800 12px/1 Inter, "Segoe UI", sans-serif;\n  letter-spacing: .06em;\n  cursor: pointer;\n  pointer-events: auto;\n  border: 1px solid var(--ten-launcher-border);\n  border-radius: var(--ten-radius-launcher);\n  background: var(--ten-', 'launcher-bg);\n  box-shadow: var(--ten-launcher-shadow);\n  backdrop-filter: blur(22px) saturate(1.4);\n  -webkit-backdrop-filter: blur(22px) saturate(1.4);\n  transition: opacity .12s ease, transform .18s cubic-bezier(.22,1,.36,1), box-shadow .2s;\n}\n#ten-comic-launcher::before { content: ""; position: absolute; inset: -65%; background: conic-gradient(from 90deg', ", transparent, rgba(95,246,255,.52), transparent 30%); animation: ten-launcher-orbit 5s linear infinite; }\n#ten-comic-launcher span { position: relative; z-index: 1; }\n#ten-comic-launcher:hover { transform: translateY(-50%) scale(1.08); box-shadow: 0 15px 40px rgba(4,14,30,.38), 0 0 34px rgba(95,246,255,.28); }\n#ten-comic-launcher:active { transform: transla", "teY(-50%) scale(.95); }\n#ten-comic-launcher.is-hidden { opacity: 0; visibility: hidden; pointer-events: none; transform: translate(20px,-50%) scale(.72); }\n.ten-mini-task { position: fixed; z-index: 2147483646; top: 50%; right: 12px; width: min(292px,calc(100vw - 24px)); min-height: 58px; display: grid; grid-template-columns: minmax(0,1fr) 42px; align-items:", " stretch; overflow: hidden; pointer-events: auto; border: 1px solid var(--ten-panel-border); border-radius: var(--ten-radius-card); background: var(--ten-mini-bg); box-shadow: var(--ten-tooltip-shadow); backdrop-filter: blur(24px) saturate(1.3); transform: translateY(-50%); transition: opacity .2s ease,transform .28s cubic-bezier(.22,1,.36,1),visibility .2s;", " }\n.ten-mini-task.is-hidden { opacity: 0; visibility: hidden; pointer-events: none; transform: translate(22px,-50%) scale(.9); }\n.ten-mini-open, .ten-mini-toggle { min-width: 0; padding: 0; color: var(--ten-text); font: inherit; cursor: pointer; border: 0; background: transparent; }\n.ten-mini-open { display: grid; grid-template-columns: 32px minmax(0,1fr); a", "lign-items: center; gap: 8px; padding: 8px 5px 8px 10px; text-align: left; }\n.ten-mini-icon { width: 31px; height: 31px; display: grid; place-items: center; color: var(--ten-cyan); border: 1px solid rgba(95,246,255,.22); border-radius: 10px; background: rgba(95,246,255,.08); }\n.ten-mini-icon .ten-icon { width: 17px; height: 17px; }\n.ten-mini-copy { min-width", ": 0; display: grid; gap: 1px; }\n.ten-mini-copy strong, .ten-mini-copy small { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.ten-mini-copy strong { font-size: 10px; }\n.ten-mini-copy small { color: var(--ten-muted); font-size: 9px; }\n.ten-mini-progress { height: 3px; margin-top: 3px; overflow: hidden; border-radius: 4px; background: rgba(2", "55,255,255,.09); }\n.ten-mini-progress i { display: block; width: 0; height: 100%; border-radius: inherit; background: linear-gradient(90deg,var(--ten-cyan),var(--ten-violet)); box-shadow: 0 0 8px rgba(95,246,255,.36); transition: width .35s ease; }\n.ten-mini-toggle { display: grid; place-items: center; border-left: 1px solid var(--ten-line); transition: colo", "r .18s,background .18s; }\n.ten-mini-toggle:hover { color: var(--ten-cyan); background: rgba(95,246,255,.08); }\n.ten-mini-toggle[hidden] { display: none; }\n.ten-icon-tooltip { position: fixed; z-index: 2147483647; left: 0; top: 0; max-width: min(240px,calc(100vw - 16px)); padding: 5px 8px; overflow: hidden; color: var(--ten-tooltip-text); font: 10px/1.4 Inter", ',"PingFang SC","Microsoft YaHei",sans-serif; white-space: nowrap; text-overflow: ellipsis; pointer-events: none; opacity: 0; visibility: hidden; border: 1px solid var(--ten-tooltip-border); border-radius: 8px; background: var(--ten-tooltip-bg); box-shadow: var(--ten-tooltip-shadow); backdrop-filter: blur(14px) saturate(1.2); transform: translateY(3px) scale(', ".96); transition: opacity .14s ease,transform .18s cubic-bezier(.22,1,.36,1),visibility .14s; }\n.ten-icon-tooltip.is-show { opacity: 1; visibility: visible; transform: translateY(0) scale(1); }\n.ten-rule-pick-layer { position: fixed; z-index: 2147483647; inset: 0; pointer-events: none; }\n.ten-rule-pick-layer.is-hidden { display: none; }\n.ten-rule-pick-box { ", "position: fixed; border: 2px solid var(--ten-cyan); border-radius: 7px; background: rgba(95,246,255,.1); box-shadow: 0 0 0 9999px rgba(2,8,18,.12),0 0 22px rgba(95,246,255,.42); transition: left .08s,top .08s,width .08s,height .08s; }\n.ten-rule-pick-hud { position: fixed; top: 16px; left: 50%; width: min(420px,calc(100vw - 24px)); min-height: 56px; display: ", "grid; grid-template-columns: 34px minmax(0,1fr) auto; align-items: center; gap: 9px; padding: 8px 9px; color: var(--ten-text); border: 1px solid var(--ten-panel-border); border-radius: var(--ten-radius-card); background: var(--ten-mini-bg); box-shadow: var(--ten-tooltip-shadow); backdrop-filter: blur(22px); transform: translateX(-50%); }\n.ten-rule-pick-symbo", "l { width: 32px; height: 32px; display: grid; place-items: center; color: var(--ten-cyan); border: 1px solid rgba(95,246,255,.25); border-radius: 10px; background: rgba(95,246,255,.08); }\n.ten-rule-pick-hud > span:nth-child(2) { min-width: 0; display: grid; }\n.ten-rule-pick-hud strong, .ten-rule-pick-hud small { overflow: hidden; white-space: nowrap; text-ov", "erflow: ellipsis; }\n.ten-rule-pick-hud strong { font-size: 11px; }\n.ten-rule-pick-hud small { color: var(--ten-muted); font: 9px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace; }\n.ten-rule-pick-hud button { min-height: 30px; padding: 4px 10px; color: var(--ten-text); font: inherit; font-size: 10px; cursor: pointer; pointer-events: auto; border: 1px solid", " rgba(255,97,116,.28); border-radius: 9px; background: rgba(255,97,116,.11); }\n#ten-comic-root.is-rule-picking #ten-panel { opacity: 0; pointer-events: none; transform: translate(34px,-50%) scale(.94); }\n#ten-comic-root.is-rule-picking #ten-comic-launcher, #ten-comic-root.is-rule-picking .ten-mini-task { opacity: 0; visibility: hidden; pointer-events: none; ", "}\nhtml.ten-rule-picking-page, html.ten-rule-picking-page * { cursor: crosshair !important; user-select: none !important; }\nhtml.ten-rule-picking-page #ten-rule-pick-cancel { cursor: pointer !important; }\n#ten-panel {\n  position: fixed;\n  top: 50%;\n  right: 14px;\n  width: min(430px, calc(100vw - 44px));\n  height: min(780px, calc(100vh - 28px));\n  display: gri", "d;\n  grid-template-rows: 58px minmax(0,1fr) 66px;\n  transform: translate(28px,-50%) scale(var(--ten-scale));\n  transform-origin: right center;\n  opacity: 0;\n  pointer-events: none;\n  overflow: hidden;\n  isolation: isolate;\n  border: 1px solid var(--ten-panel-border);\n  border-radius: var(--ten-radius-panel);\n  background: var(--ten-panel-bg);\n  box-shadow: v", 'ar(--ten-panel-shadow);\n  backdrop-filter: blur(32px) saturate(1.45);\n  -webkit-backdrop-filter: blur(32px) saturate(1.45);\n  transition: transform .42s cubic-bezier(.22,1,.36,1), opacity .22s ease;\n}\n#ten-panel.is-open { transform: translate(0,-50%) scale(var(--ten-scale)); opacity: 1; pointer-events: auto; }\n#ten-panel::before {\n  content: "";\n  position: ', "absolute;\n  z-index: 1;\n  inset: 0;\n  pointer-events: none;\n  background: radial-gradient(circle at 85% 0, rgba(95,246,255,.17), transparent 30%), radial-gradient(circle at 0 90%, rgba(156,108,255,.17), transparent 34%);\n}\n#ten-particle-field { position: absolute; z-index: 1; inset: 0; overflow: hidden; pointer-events: none; }\n#ten-particle-field i {\n  position: absolute;\n  left: var(--x);\n  top: var(--y);\n  width: var(--s);\n  height: var(--s);\n  border-radius: 50%;\n  opacity: .45;\n  background: var(--c);\n  box-shadow: 0 0 10px var(--c);\n  animation: ten-parti", 'cle var(--d) ease-in-out var(--delay) infinite alternate;\n}\n#ten-comic-root[data-effects="0"] #ten-particle-field { display: none; }\n#ten-comic-root[data-effects="0"] #ten-comic-launcher::before { animation: none; opacity: 0; }\n#ten-comic-root[data-effects="1"] #ten-particle-field i { opacity: .28; }\n#ten-comic-root[data-effects="1"] #ten-particle-field i:nt', 'h-child(n+12) { display: none; }\n#ten-comic-root[data-effects="1"] #ten-comic-launcher::before { animation-duration: 8s; opacity: .6; }\n#ten-search-panel {\n  position: fixed;\n  z-index: 2147483644;\n  top: 50%;\n  right: 456px;\n  width: min(680px, calc(100vw - 486px));\n  height: min(720px, calc(100vh - 44px));\n  display: grid;\n  grid-template-rows: 58px minmax', "(0,1fr);\n  transform: translate(22px,-50%) scale(.98);\n  transform-origin: right center;\n  overflow: hidden;\n  opacity: 0;\n  visibility: hidden;\n  pointer-events: none;\n  color: var(--ten-text);\n  border: 1px solid rgba(133,233,255,.25);\n  border-radius: 22px;\n  background: radial-gradient(circle at 100% 0, rgba(95,246,255,.14), transparent 34%), linear-grad", "ient(150deg, rgba(20,42,67,.74), rgba(7,17,34,.84));\n  box-shadow: 0 26px 80px rgba(0,5,15,.44), inset 0 1px rgba(255,255,255,.07);\n  backdrop-filter: blur(30px) saturate(1.4);\n  -webkit-backdrop-filter: blur(30px) saturate(1.4);\n  transition: transform .38s cubic-bezier(.22,1,.36,1), opacity .24s ease, visibility .24s;\n}\n#ten-search-panel.is-open { transfor", "m: translate(0,-50%) scale(1); opacity: 1; visibility: visible; pointer-events: auto; }\n.ten-search-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 0 13px 0 17px; border-bottom: 1px solid var(--ten-line); background: var(--ten-header-bg); }\n.ten-search-panel-content { min-height: 0; padding: 13px; overflow-y: auto;", " scrollbar-width: thin; scrollbar-color: rgba(95,246,255,.35) transparent; }\n.ten-search-panel-content::-webkit-scrollbar { width: 6px; }\n.ten-search-panel-content::-webkit-scrollbar-thumb { border-radius: 9px; background: var(--ten-scroll-thumb); }\n.ten-header, .ten-content, .ten-nav { position: relative; z-index: 2; }\n.ten-header { display: flex; align-ite", "ms: center; gap: 11px; padding: 0 14px 0 16px; border-bottom: 1px solid var(--ten-line); background: var(--ten-header-bg); }\n.ten-brand-mark { width: 31px; height: 31px; display: grid; place-items: center; border: 1px solid rgba(95,246,255,.48); border-radius: 11px; color: var(--ten-cyan); font-weight: 900; background: rgba(95,246,255,.08); box-shadow: 0 0 2", "0px rgba(95,246,255,.14); }\n.ten-heading { min-width: 0; flex: 1; }\n.ten-title { font-size: 14px; font-weight: 750; letter-spacing: .04em; }\n.ten-subtitle { color: var(--ten-muted); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }\n.ten-icon-btn { width: 34px; height: 34px; display: grid; place-items: center; padding: 0; color: var(--ten-m", "uted); cursor: pointer; border: 1px solid transparent; border-radius: 11px; background: transparent; transition: .2s ease; }\n.ten-icon-btn:hover { color: var(--ten-cyan); border-color: var(--ten-line); background: var(--ten-control-hover-bg); transform: translateY(-1px); }\n.ten-icon { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width:", " 1.8; stroke-linecap: round; stroke-linejoin: round; }\n.ten-content { min-height: 0; overflow: hidden; font-size: inherit !important; }\n.ten-view { display: none; height: 100%; padding: 13px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(95,246,255,.35) transparent; }\n.ten-view.is-active { display: block; animation: ten-view-in .28s ease; }\n.ten-view::-webkit-scrollbar { ", 'width: 6px; }\n.ten-view::-webkit-scrollbar-thumb { border-radius: 9px; background: var(--ten-scroll-thumb); }\n.ten-nav { --tab: 1; display: grid; grid-template-columns: repeat(4,1fr); padding: 7px; border-top: 1px solid var(--ten-line); background: var(--ten-header-bg); }\n.ten-nav::before { content: ""; position: absolute; z-index: 0; top: 7px; bottom: 7px; ', "left: 7px; width: calc((100% - 14px)/4); border: 1px solid rgba(95,246,255,.28); border-radius: 14px; background: linear-gradient(145deg, rgba(95,246,255,.13), rgba(156,108,255,.12)); box-shadow: 0 7px 20px rgba(0,0,0,.18), inset 0 1px rgba(255,255,255,.12); transform: translateX(calc(var(--tab)*100%)); transition: transform .38s cubic-bezier(.22,1,.36,1); }", "\n.ten-tab { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--ten-muted); font: inherit; font-size: 10px; cursor: pointer; border: 0; background: transparent; transition: color .2s, transform .2s; }\n.ten-tab:hover { color: var(--ten-text); }\n.ten-tab.is-active { color: ", "var(--ten-cyan); }\n.ten-tab.is-active .ten-icon { transform: translateY(-1px) scale(1.08); }\n.ten-toolbar, .ten-row { display: flex; align-items: center; gap: 8px; }\n.ten-toolbar { margin-bottom: 11px; }\n.ten-spacer { flex: 1; }\n.ten-card { margin-bottom: 9px; padding: 11px; border: 1px solid var(--ten-card-border); border-radius: var(--ten-radius-card); bac", "kground: var(--ten-card-bg); box-shadow: var(--ten-card-shadow); backdrop-filter: blur(18px); }\n.ten-card-title { margin-bottom: 7px; color: var(--ten-cyan); font-size: 11px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }\n.ten-card-head { min-height: 30px; display: flex; align-items: center; justify-content: space-between; gap: 8px; ma", "rgin-bottom: 7px; }\n.ten-card-head .ten-card-title { margin-bottom: 0; }\n.ten-btn { position: relative; min-height: 35px; padding: 7px 12px; overflow: hidden; color: var(--ten-text); font: inherit; font-weight: 650; cursor: pointer; border: 1px solid var(--ten-control-border); border-radius: var(--ten-radius-control); background: var(--ten-control-bg); backg", 'round-size: 220% 100%; transition: transform .18s, border-color .18s, box-shadow .18s, background-position .35s; }\n.ten-btn::before { content: ""; position: absolute; top: -70%; left: -35%; width: 26%; height: 240%; opacity: 0; pointer-events: none; background: linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent); transform: rotate(18deg); ', "transition: left .45s cubic-bezier(.22,1,.36,1), opacity .2s; }\n.ten-btn:hover:not(:disabled) { transform: translateY(-2px); border-color: rgba(95,246,255,.5); background-position: 100% 50%; box-shadow: 0 9px 24px rgba(29,117,165,.18); }\n.ten-btn:hover::before { left: 112%; opacity: .75; }\n.ten-btn:active:not(:disabled) { transform: scale(.97); }\n.ten-btn:di", "sabled { opacity: .38; cursor: not-allowed; }\n.ten-btn.is-primary { color: var(--ten-primary-text); border-color: var(--ten-primary-border); background: var(--ten-primary-bg); background-size: 260% 100%; }\n.ten-btn.is-danger { color: var(--ten-danger-text); border-color: var(--ten-danger-border); background: var(--ten-danger-bg); }\n.ten-btn.is-small { min-he", "ight: 30px; padding: 5px 9px; font-size: 11px; }\n.ten-icon-label { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }\n.ten-icon-label span { white-space: nowrap; }\n.ten-ripple { position: absolute; border-radius: 50%; pointer-events: none; background: rgba(255,255,255,.36); transform: scale(0); animation: ten-ripple .62s ease-out", "; }\n.ten-input, .ten-select, .ten-textarea { width: 100%; color: var(--ten-text); font: inherit; border: 1px solid var(--ten-line); border-radius: var(--ten-radius-control); outline: 0; background: var(--ten-input-bg); transition: border-color .2s, box-shadow .2s; }\n.ten-input, .ten-select { height: 36px; padding: 0 10px; }\n.ten-textarea { min-height: 110px;", ' padding: 10px; resize: vertical; }\ninput.ten-input[type="number"] { padding-right: 30px; appearance: textfield; -moz-appearance: textfield; }\ninput.ten-input[type="number"]::-webkit-inner-spin-button,\ninput.ten-input[type="number"]::-webkit-outer-spin-button { margin: 0; appearance: none; -webkit-appearance: none; }\n.ten-number-control { position: relative;', " min-width: 0; width: 100%; }\n.ten-number-steps { position: absolute; top: 4px; right: 4px; bottom: 4px; width: 23px; display: grid; grid-template-rows: 1fr 1fr; overflow: hidden; border: 1px solid rgba(95,246,255,.12); border-radius: 7px; opacity: .42; transition: opacity .2s, border-color .2s, box-shadow .2s; }\n.ten-number-control:hover .ten-number-steps,\n", ".ten-number-control:focus-within .ten-number-steps { opacity: 1; border-color: rgba(95,246,255,.38); box-shadow: 0 0 10px rgba(95,246,255,.08); }\n.ten-number-steps button { position: relative; display: grid; place-items: center; padding: 0; color: var(--ten-muted); cursor: pointer; border: 0; background: rgba(95,246,255,.035); transition: color .16s, backgro", "und .16s; }\n.ten-number-steps button + button { border-top: 1px solid rgba(95,246,255,.12); }\n.ten-number-steps button:hover { color: var(--ten-cyan); background: rgba(95,246,255,.12); }\n.ten-number-steps i { width: 5px; height: 5px; border-top: 1.5px solid currentColor; border-left: 1.5px solid currentColor; transform: translateY(1px) rotate(45deg); }\n.ten-", 'number-steps button:last-child i { transform: translateY(-1px) rotate(225deg); }\n.ten-view[data-view="settings"] .ten-settings-card { border-color: rgba(137,225,255,.2); background: linear-gradient(145deg, rgba(61,77,98,.9), rgba(47,60,80,.9)); box-shadow: inset 0 1px rgba(255,255,255,.075), 0 8px 22px rgba(1,9,20,.08); backdrop-filter: blur(18px) saturate(1', '.15); }\n.ten-view[data-view="settings"] .ten-input,\n.ten-view[data-view="settings"] .ten-select,\n.ten-view[data-view="settings"] .ten-textarea { border-color: rgba(137,225,255,.18); background: rgba(6,18,34,.42); }\n.ten-input:focus, .ten-select:focus, .ten-textarea:focus { border-color: var(--ten-cyan); box-shadow: var(--ten-focus-ring); }\n.ten-select option', ' { color: #eafaff; background: #0c1829; }\n.ten-source { --source: 0; position: relative; display: grid; grid-template-columns: repeat(2,1fr); flex: 1; padding: 3px; border-radius: 12px; background: rgba(2,10,22,.34); }\n.ten-source::before { content: ""; position: absolute; inset: 3px auto 3px 3px; width: calc(50% - 3px); border: 1px solid rgba(95,246,255,.25', "); border-radius: 9px; background: linear-gradient(145deg, rgba(95,246,255,.14), rgba(156,108,255,.13)); transform: translateX(calc(var(--source)*100%)); transition: transform .35s cubic-bezier(.22,1,.36,1); }\n.ten-source button { position: relative; z-index: 1; min-height: 33px; color: var(--ten-muted); font: inherit; font-size: 11px; cursor: pointer; borde", "r: 0; background: transparent; }\n.ten-source button.is-active { color: var(--ten-cyan); }\n.ten-search-toolbar .ten-input { width: auto; min-width: 0; flex: 1 1 auto; }\n.ten-search-site-picker { position: relative; z-index: 30; flex: 0 0 126px; width: 126px; min-width: 0; }\n#ten-search-site-trigger { width: 100%; height: 36px; display: flex; align-items: cent", "er; gap: 7px; padding: 0 10px 0 11px; overflow: hidden; color: var(--ten-text); font: inherit; font-size: 11px; cursor: pointer; border: 1px solid rgba(95,246,255,.24); border-radius: 11px; background: linear-gradient(145deg, rgba(18,47,70,.76), rgba(36,38,76,.72)); box-shadow: inset 0 1px rgba(255,255,255,.08); transition: border-color .2s, box-shadow .2s; ", "}\n#ten-search-site-trigger:hover, .ten-search-site-picker.is-open #ten-search-site-trigger { border-color: rgba(95,246,255,.58); box-shadow: 0 0 0 3px rgba(95,246,255,.08), inset 0 1px rgba(255,255,255,.1); }\n#ten-search-site-label { min-width: 0; flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: left; }\n.ten-picker-arrow {", " width: 7px; height: 7px; flex: 0 0 7px; border-right: 1.5px solid var(--ten-cyan); border-bottom: 1.5px solid var(--ten-cyan); transform: rotate(45deg) translateY(-2px); transition: transform .28s cubic-bezier(.22,1,.36,1); }\n.ten-search-site-picker.is-open .ten-picker-arrow { transform: rotate(225deg) translate(-1px,-1px); }\n.ten-search-site-menu { positio", "n: absolute; z-index: 40; top: 43px; left: 0; width: 252px; max-height: 300px; padding: 6px; overflow-y: auto; border: 1px solid var(--ten-panel-border); border-radius: var(--ten-radius-card); background: var(--ten-popover-bg); box-shadow: var(--ten-tooltip-shadow); backdrop-filter: blur(26px) saturate(1.35); -webkit-backdrop-filter: blur(26px) saturate(1.35", "); animation: ten-picker-in .22s cubic-bezier(.22,1,.36,1); scrollbar-width: thin; scrollbar-color: var(--ten-scroll-thumb) transparent; }\n.ten-search-site-menu[hidden] { display: none !important; }\n.ten-search-site-menu::-webkit-scrollbar { width: 5px; }\n.ten-search-site-menu::-webkit-scrollbar-thumb { border-radius: 8px; background: rgba(95,246,255,.32); }", "\n.ten-search-site-option { width: 100%; min-height: 38px; display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 8px; padding: 7px 9px; color: var(--ten-text); font: inherit; font-size: 11px; text-align: left; cursor: pointer; border: 1px solid transparent; border-radius: 9px; background: transparent; transition: color .18s, bord", "er-color .18s, background .18s, transform .18s; }\n.ten-search-site-option + .ten-search-site-option { margin-top: 3px; }\n.ten-search-site-option span { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.ten-search-site-option small { color: var(--ten-muted); font-size: 9px; }\n.ten-search-site-option:hover:not(:disabled) { color:", " var(--ten-cyan); border-color: rgba(95,246,255,.18); background: rgba(95,246,255,.07); transform: translateX(2px); }\n.ten-search-site-option.is-selected { color: var(--ten-cyan); border-color: rgba(95,246,255,.28); background: linear-gradient(100deg, rgba(95,246,255,.11), rgba(156,108,255,.08)); }\n.ten-search-site-option:disabled { opacity: .43; cursor: not", "-allowed; }\n.ten-search-toolbar #ten-search-btn { flex: 0 0 76px; width: 76px; padding: 7px 10px; white-space: nowrap; }\n.ten-search-toolbar #ten-search-btn .ten-icon { flex: 0 0 17px; width: 17px; height: 17px; }\n.ten-rule-manage { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: -2px 0 10px; padding: 7px 8px 7px 11px; c", "olor: var(--ten-muted); font-size: 10px; border: 1px solid var(--ten-line); border-radius: 12px; background: rgba(5,16,31,.3); }\n.ten-rule-manage[hidden] { display: none !important; }\n.ten-rule-item { display: grid; grid-template-columns: minmax(0,1fr) 34px 34px; align-items: center; gap: 5px; }\n.ten-rule-item .ten-list-item { min-width: 0; }\n.ten-rule-edit ", "{ color: var(--ten-cyan); border-color: rgba(95,246,255,.16); background: rgba(95,246,255,.06); }\n.ten-rule-delete { color: var(--ten-danger); border-color: rgba(255,97,116,.18); background: rgba(255,97,116,.07); }\n.ten-list { display: grid; gap: 7px; }\n.ten-list-item { display: flex; align-items: center; gap: 9px; width: 100%; min-height: 43px; padding: 9px", " 11px; color: var(--ten-text); text-align: left; cursor: pointer; border: 1px solid var(--ten-line); border-radius: var(--ten-radius-control); background: var(--ten-list-bg); transition: .2s ease; }\n.ten-list-item:hover { border-color: var(--ten-cyan); background: var(--ten-list-hover-bg); transform: translateX(2px); }\n.ten-list-item.is-disabled { opacity: .", '4; cursor: not-allowed; }\n.ten-list-item input[type="checkbox"] { accent-color: var(--ten-cyan); }\n.ten-site-kind { flex: 0 0 auto; padding: 1px 6px; color: var(--ten-cyan); font-size: 9px; border: 1px solid rgba(95,246,255,.2); border-radius: 999px; background: rgba(95,246,255,.06); }\n.ten-name { min-width: 0; flex: 1; overflow: hidden; white-space: nowrap;', " text-overflow: ellipsis; }\n.ten-meta { color: var(--ten-muted); font-size: 10px; }\n.ten-empty { display: grid; place-items: center; min-height: 250px; color: var(--ten-muted); text-align: center; }\n.ten-status { margin-bottom: 10px; padding: 9px 11px; color: var(--ten-muted); border: 1px solid var(--ten-line); border-radius: var(--ten-radius-control); backg", "round: var(--ten-list-bg); }\n.ten-status.is-ready { color: var(--ten-success); }\n.ten-options { max-height: 0; margin-bottom: 0; padding: 0 11px; overflow: hidden; opacity: 0; border-width: 0; transition: max-height .42s cubic-bezier(.22,1,.36,1), opacity .2s, margin .2s, padding .2s, border-width .2s; }\n.ten-options.is-open { max-height: 390px; margin-botto", "m: 10px; padding: 11px; opacity: 1; border-width: 1px; }\n.ten-mode-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; }\n.ten-mode { min-height: 36px; color: var(--ten-muted); font: inherit; font-size: 11px; cursor: pointer; border: 1px solid var(--ten-line); border-radius: 10px; background: rgba(4,13,27,.3); transition: .2s; }\n.ten-mode.is", "-active { color: var(--ten-cyan); border-color: rgba(95,246,255,.48); background: rgba(95,246,255,.1); box-shadow: 0 0 18px rgba(95,246,255,.08); }\n.ten-chapter-tools { position: sticky; z-index: 8; top: -13px; display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; margin: 0 -5px 9px; padding: 7px 5px; border: 1px solid rgba(137,225,255,.16); border-r", "adius: 13px; background: linear-gradient(145deg,rgba(61,77,98,.94),rgba(47,60,80,.94)); box-shadow: 0 8px 20px rgba(1,9,20,.15), inset 0 1px rgba(255,255,255,.07); backdrop-filter: blur(18px) saturate(1.15); }\n.ten-chapter-tools > :last-child { justify-self: end; }\n.ten-chapter-reload { position: relative; display: grid; place-items: center; min-height: 34px", '; margin: 3px 0 9px; }\n.ten-chapter-reload::before { content: ""; position: absolute; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(95,246,255,.28), transparent); }\n.ten-chapter-reload button { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; color: var(--ten-cyan); font: inher', "it; font-size: 10px; cursor: pointer; border: 1px solid rgba(95,246,255,.17); border-radius: 999px; background: rgba(9,24,44,.82); transition: .22s ease; }\n.ten-chapter-reload button:hover { border-color: rgba(95,246,255,.42); box-shadow: 0 0 17px rgba(95,246,255,.1); }\n.ten-chapter-empty { display: grid; justify-items: center; gap: 8px; padding: 26px 16px 1", "7px; text-align: center; border: 1px solid var(--ten-line); border-radius: var(--ten-radius-card); background: var(--ten-empty-bg); }\n.ten-chapter-empty[hidden], #ten-chapter-loaded[hidden] { display: none !important; }\n.ten-empty-orbit { width: 52px; height: 52px; display: grid; place-items: center; color: var(--ten-cyan); border: 1px solid rgba(95,246,255,", ".28); border-radius: 17px; background: linear-gradient(145deg, rgba(95,246,255,.1), rgba(156,108,255,.1)); box-shadow: 0 0 24px rgba(95,246,255,.1); }\n.ten-empty-orbit .ten-icon { width: 24px; height: 24px; }\n.ten-empty-title { font-weight: 700; }\n.ten-chapter-empty .ten-btn { margin-top: 4px; }\n.ten-comic-info { width: min(290px,100%); display: grid; grid-t", "emplate-columns: 52px minmax(0,1fr); gap: 1px; margin-top: 6px; overflow: hidden; text-align: left; border: 1px solid var(--ten-line); border-radius: var(--ten-radius-control); background: var(--ten-info-bg); }\n.ten-comic-info span, .ten-comic-info strong { padding: 7px 9px; border-bottom: 1px solid rgba(95,246,255,.08); }\n.ten-comic-info span { color: var(-", "-ten-muted); font-size: 10px; }\n.ten-comic-info strong { min-width: 0; overflow: hidden; color: var(--ten-text); font-size: 11px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }\n.ten-chapter-list-head { display: flex; align-items: center; justify-content: space-between; min-height: 39px; margin-bottom: 6px; padding: 3px 5px 3px 11px; color:", " var(--ten-muted); font-size: 10px; border: 1px solid var(--ten-line); border-radius: 12px; background: rgba(9,24,44,.38); }\n.ten-chapter-list-head .ten-icon-btn.is-active { color: var(--ten-cyan); border-color: rgba(95,246,255,.35); background: rgba(95,246,255,.1); }\n.ten-chapter-list { display: grid; gap: 5px; max-height: none; overflow: visible; }\n.ten-pr", "ogress { height: 5px; margin-top: 7px; overflow: hidden; border-radius: 9px; background: rgba(255,255,255,.08); }\n.ten-progress > i { position: relative; display: block; height: 100%; overflow: hidden; border-radius: inherit; background: linear-gradient(90deg, var(--ten-cyan), var(--ten-violet)); box-shadow: 0 0 12px rgba(95,246,255,.4); transition: width .3", '5s; }\n.ten-progress > i::after { content: ""; position: absolute; inset: 0; width: 42%; pointer-events: none; opacity: 0; background: linear-gradient(90deg,transparent,rgba(255,255,255,.9),rgba(95,246,255,.45),transparent); transform: translateX(-140%); }\n#ten-comic-root[data-effects="1"] .ten-progress > i::after { opacity: .34; animation: ten-energy-flow va', 'r(--ten-energy-duration,7s) linear infinite; }\n#ten-comic-root[data-effects="2"] .ten-progress > i::after { opacity: .62; animation: ten-energy-flow var(--ten-energy-duration,5.8s) linear infinite; }\n.ten-progress > i.is-paused::after { opacity: 0 !important; animation-play-state: paused !important; }\n.ten-task-title { min-width: 0; overflow: hidden; font-we', "ight: 650; white-space: nowrap; text-overflow: ellipsis; }\n.ten-task-group { margin-bottom: 9px; overflow: hidden; border: 1px solid var(--ten-card-border); border-radius: var(--ten-radius-card); background: var(--ten-task-bg); box-shadow: var(--ten-card-shadow); }\n.ten-task-header { min-height: 48px; display: flex; align-items: center; padding: 5px 8px 5px ", "13px; }\n.ten-task-title-button { min-width: 0; flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 0; color: var(--ten-text); font: inherit; font-weight: 700; text-align: left; cursor: pointer; border: 0; background: transparent; }\n.ten-task-bulk { flex: 0 0 auto; min-height: 29px; margin-left: 4px; padding: 4px 9px; font-size: 9px; white-spa", "ce: nowrap; }\n.ten-task-bulk[hidden] { display: none; }\n.ten-task-control-group { flex: 0 0 auto; display: flex; align-items: center; gap: 5px; margin-left: 4px; }\n.ten-task-control-group .ten-task-bulk { margin-left: 0; }\n.ten-task-arrow-button { width: 31px; height: 31px; flex: 0 0 31px; display: grid; place-items: center; padding: 0; color: var(--ten-mute", "d); cursor: pointer; border: 1px solid transparent; border-radius: 9px; background: transparent; transition: color .2s, border-color .2s, background .2s; }\n.ten-task-arrow-button:hover { color: var(--ten-cyan); border-color: rgba(95,246,255,.2); background: rgba(95,246,255,.07); }\n.ten-task-arrow-button .ten-task-arrow { margin: 0; }\n.ten-task-count { min-wi", "dth: 22px; padding: 1px 7px; color: var(--ten-cyan); font-size: 10px; text-align: center; border: 1px solid rgba(95,246,255,.2); border-radius: 999px; background: rgba(95,246,255,.07); }\n.ten-task-arrow { width: 8px; height: 8px; margin-left: auto; margin-right: 5px; border-right: 1.5px solid var(--ten-muted); border-bottom: 1.5px solid var(--ten-muted); tra", "nsform: rotate(45deg) translateY(-2px); transition: transform .5s cubic-bezier(.22,1,.36,1); }\n.ten-task-group.is-open .ten-task-arrow { transform: rotate(225deg) translate(-2px,-2px); }\n.ten-task-body { min-width: 0; display: grid; grid-template-rows: 0fr; padding: 0 10px; overflow: hidden; opacity: 0; border-top: 0 solid var(--ten-line); transition: grid-t", "emplate-rows .5s cubic-bezier(.22,1,.36,1), opacity .5s ease, padding .5s ease, border-width .5s ease; }\n.ten-task-body > .ten-list { min-width: 0; width: 100%; min-height: 0; overflow: hidden; }\n.ten-task-group.is-open .ten-task-body { grid-template-rows: 1fr; padding: 9px 10px 10px; opacity: 1; border-top-width: 1px; }\n.ten-task-group.is-open .ten-task-bod", "y > .ten-list { max-height: none; overflow: visible; }\n.ten-task-group.is-open.has-scroll .ten-task-body > .ten-list { max-height: 400px; overflow-y: auto; }\n.ten-task-body .ten-empty { min-height: 72px; }\n.ten-task-meta { min-width: 0; display: flex; justify-content: space-between; gap: 8px; margin-top: 5px; color: var(--ten-muted); font-size: 10px; }\n.ten-", "task-meta > span:first-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.ten-task-meta > span:last-child { flex: 0 0 auto; white-space: nowrap; }\n.ten-task-performance { min-width: 0; display: flex; justify-content: space-between; gap: 8px; margin-top: 3px; color: rgba(190,216,231,.72); font-size: 9px; font-variant-nume", "ric: tabular-nums; }\n.ten-task-performance > span:first-child { color: rgba(95,246,255,.86); }\n.ten-task-performance > span:last-child { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: right; }\n.ten-effect-level { position: relative; display: grid; gap: 3px; padding: 3px; border-radius: 11px; background: rgba(3,14,28,", ".38); }\n.ten-effect-level { grid-template-columns: repeat(3,minmax(0,1fr)); }\n.ten-effect-level button { min-width: 0; min-height: 29px; padding: 3px 5px; color: var(--ten-muted); font: inherit; font-size: 9px; cursor: pointer; border: 1px solid transparent; border-radius: 8p", "x; background: transparent; transition: color .18s, border-color .18s, background .18s, box-shadow .18s; }\n.ten-effect-level button.is-active { color: var(--ten-cyan); border-color: rgba(95,246,255,.28); background: linear-gradient(145deg,rgba(95,246,255,.12),rgba(156,108,255,.11)); box-shadow: inset 0 1px rgba(255,255,255,.06);", " }\n.ten-state-animate { --ten-state-rgb: 95,246,255; position: relative; }\n.ten-state-animate.is-state-pause { --ten-state-rgb: 156,108,255; }\n.ten-state-animate.is-state-resume { --ten-state-rgb: 95,246,255; }\n.ten-state-animate.is-state-success { --ten-state-rgb: 85,239,182; }\n.ten-state-animate.is-state-danger { --ten-state-rgb: 255,97,116; }\n.ten-state-a", 'nimate::after { content: ""; position: absolute; z-index: 4; top: 0; bottom: 0; left: -42%; width: 38%; pointer-events: none; opacity: 0; border-radius: inherit; background: linear-gradient(90deg,transparent,rgba(var(--ten-state-rgb),.38),transparent); }\n#ten-comic-root[data-effects="1"] .ten-state-animate { animation: ten-state-border .9s ease-out 1; }\n#ten', '-comic-root[data-effects="1"] .ten-state-animate::after { animation: ten-state-scan .86s cubic-bezier(.22,1,.36,1) 1; }\n#ten-comic-root[data-effects="2"] .ten-state-animate { animation: ten-state-border .68s ease-out 1; }\n#ten-comic-root[data-effects="2"] .ten-state-animate::after { background: linear-gradient(90deg,transparent,rgba(var(--ten-state-rgb),.62)', ",transparent); animation: ten-state-scan .62s cubic-bezier(.22,1,.36,1) 1; }\n.ten-setting { display: grid; grid-template-columns: minmax(0,1fr) minmax(120px,1fr); align-items: center; gap: 10px; margin-bottom: 9px; }\n.ten-setting label { color: #c9dce8; }\n#ten-comic-root .ten-setting label,#ten-comic-root .ten-rule-fields label { position: static !important; inset: auto !important; transform: none !important; }\n.ten-appearance-card { padding-bottom: 7px; }\n.ten-appearance-setting { margin-bottom: 7px; }\n.ten-appea", "rance-axis { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 3px; padding: 3px; border: 1px solid var(--ten-card-border); border-radius: var(--ten-radius-control); background: var(--ten-input-bg); }\n.ten-appearance-axis button { min-width: 0; min-height: 29px; padding: 3px 4px; color: var(--ten-muted); font: inherit; font-size: 9px; curso", "r: pointer; border: 1px solid transparent; border-radius: 8px; background: transparent; transition: color .18s, border-color .18s, background .18s, transform .18s; }\n.ten-appearance-axis button:hover { color: var(--ten-text); background: var(--ten-control-hover-bg); }\n.ten-appearance-axis button.is-active { color: var(--ten-cyan); border-color: var(--ten-con", "trol-border); background: var(--ten-control-hover-bg); box-shadow: inset 0 1px rgba(255,255,255,.06); }\n.ten-settings-download .ten-setting { min-height: 36px; margin-bottom: 10px; }\n.ten-settings-download .ten-setting > label { font-size: 11px; line-height: 1.5; }\n.ten-settings-download .ten-setting-check { min-height: 30px; margin-top: 2px; margin-bottom: ", "11px; }\n.ten-direct-flow-setting { display: block !important; min-height: 0 !important; }\n.ten-direct-flow-setting > label { display: block; margin-bottom: 6px; }\n.ten-direct-flow-options { display: grid; gap: 6px; }\n.ten-direct-flow-options button { width: 100%; padding: 8px 10px; color: var(--ten-text); font: inherit; text-align: left; cursor: pointer; border: 1px solid var(--ten-control-border); border-radius: 10px; background: var(--ten-input-bg); transition: border-color .18s, background .18s, transform .18s; }\n.ten-direct-flow-options button:hover { transform: translateY(-1px); background: var(--ten-control-hover-bg); }\n.ten-direct-flow-options button.is-active { border-color: var(--ten-cyan); box-shadow: 0 0 0 3px rgba(95,246,255,.08); }\n.ten-direct-flow-options strong, .ten-direct-flow-options small { display: block; }\n.ten-direct-flow-options small { margin-top: 3px; color: var(--ten-muted); font-size: 10px; line-height: 1.45; }\n.ten-path-sanitize-setting { align-items: center; }\n.ten-path-sanitize-setting > div { min-width: 0; }\n.ten-path-sanitize-setting label, .ten-path-sanitize-setting small { display: block; }\n.ten-path-sanitize-setting small { margin-top: 3px; color: var(--ten-muted); font-size: 9px; line-height: 1.4; }\n.ten-setting .ten-input { text-align: center; font-variant-numeric: tabular-nums; }\n.ten-setting .ten-select { text-align: center; text-align-last: center; }\n.ten-setting-select { position: relative; z-index: 12; min-width: 0; width: 100%; }\n#ten-default-mode-trigger { width: 100%; height: 36px; display: flex; align-items: center; gap: 8px; padding: ", "0 11px; color: var(--ten-text); font: inherit; cursor: pointer; border: 1px solid rgba(137,225,255,.2); border-radius: 11px; background: rgba(6,18,34,.42); box-shadow: inset 0 1px rgba(255,255,255,.045); transition: border-color .2s, box-shadow .2s, background .2s; }\n#ten-default-mode-trigger:hover,\n.ten-setting-select.is-open #ten-default-mode-trigger { bor", "der-color: rgba(95,246,255,.55); background: rgba(9,27,46,.58); box-shadow: 0 0 0 3px rgba(95,246,255,.08), inset 0 1px rgba(255,255,255,.07); }\n#ten-default-mode-label { min-width: 0; flex: 1; text-align: center; }\n.ten-setting-select.is-open .ten-picker-arrow { transform: rotate(225deg) translate(-1px,-1px); }\n.ten-setting-select-menu { position: absolute;", " z-index: 45; top: 42px; right: 0; left: 0; padding: 6px; border: 1px solid var(--ten-panel-border); border-radius: var(--ten-radius-card); background: var(--ten-popover-bg); box-shadow: var(--ten-tooltip-shadow); backdrop-filter: blur(24px) saturate(1.35); animation: ten-picker-in .22s cubic-bezier(.22,1,.36,1); }\n.ten-setting-select-menu[hidden] { display:", " none !important; }\n.ten-setting-select-menu button { width: 100%; min-height: 43px; display: grid; grid-template-columns: 16px minmax(0,1fr); align-items: center; gap: 8px; padding: 6px 8px; color: var(--ten-text); font: inherit; text-align: left; cursor: pointer; border: 1px solid transparent; border-radius: 9px; background: transparent; transition: border", "-color .18s, background .18s, transform .18s; }\n.ten-setting-select-menu button + button { margin-top: 3px; }\n.ten-setting-select-menu button:hover { border-color: rgba(95,246,255,.2); background: rgba(95,246,255,.08); transform: translateX(2px); }\n.ten-setting-select-menu button.is-selected { border-color: rgba(95,246,255,.28); background: linear-gradient(1", "00deg, rgba(95,246,255,.13), rgba(156,108,255,.09)); }\n.ten-setting-select-menu button > span:last-child { min-width: 0; display: grid; gap: 1px; }\n.ten-setting-select-menu strong { font-size: 11px; font-weight: 700; }\n.ten-setting-select-menu small { color: var(--ten-muted); font-size: 9px; }\n.ten-mode-option-mark { width: 10px; height: 10px; border: 1px so", 'lid rgba(137,225,255,.35); border-radius: 50%; box-shadow: inset 0 0 0 2px rgba(7,18,34,.9); transition: background .18s, box-shadow .18s; }\n.ten-setting-select-menu button.is-selected .ten-mode-option-mark { background: var(--ten-cyan); box-shadow: 0 0 10px rgba(95,246,255,.48), inset 0 0 0 2px rgba(7,18,34,.82); }\n.ten-setting input[type="checkbox"] { just', 'ify-self: end; accent-color: var(--ten-cyan); width: 18px; height: 18px; }\n.ten-setting input[type="range"] { width: 100%; accent-color: var(--ten-cyan); }\n.ten-setting-value { color: var(--ten-cyan); font-variant-numeric: tabular-nums; text-align: right; }\n.ten-grid-2 { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; }\n.ten-toast { ', "position: absolute; z-index: 20; left: 50%; bottom: 78px; max-width: 86%; display: flex; align-items: center; gap: 8px; padding: 9px 10px 9px 13px; color: var(--ten-toast-text); border: 1px solid var(--ten-toast-border); border-radius: var(--ten-radius-control); background: var(--ten-toast-bg); box-shadow: var(--ten-tooltip-shadow); transform: translate(-50%", ",12px); opacity: 0; pointer-events: none; transition: .22s; }\n.ten-toast.is-show { transform: translate(-50%,0); opacity: 1; }\n#ten-toast-text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }\n.ten-toast button { flex: 0 0 auto; min-height: 27px; padding: 4px 9px; color: var(--ten-cyan); font: inherit; font-size: 10px; font-we", "ight: 700; cursor: pointer; pointer-events: auto; border: 1px solid var(--ten-control-border); border-radius: 8px; background: var(--ten-control-hover-bg); }\n.ten-toast button[hidden] { display: none; }\n.ten-confirm { position: absolute; z-index: 50; inset: 0; display: grid; place-items: center; padding: 22px; visibility: hidden; opacity: 0; pointer-events: ", "none; transition: opacity .24s ease, visibility .24s; }\n.ten-confirm.is-open { visibility: visible; opacity: 1; pointer-events: auto; }\n.ten-confirm-backdrop { position: absolute; inset: 0; padding: 0; cursor: default; border: 0; background: var(--ten-overlay-bg); backdrop-filter: blur(7px); }\n.ten-confirm-dialog { position: relative; width: min(310px,100%);", " padding: 18px; text-align: center; border: 1px solid var(--ten-panel-border); border-radius: var(--ten-radius-card); background: var(--ten-popover-bg); box-shadow: var(--ten-tooltip-shadow); transform: translateY(10px) scale(.96); transition: transform .28s cubic-bezier(.22,1,.36,1); }\n.ten-confirm.is-open .ten-confirm-dialog { transform: translateY(0) scal", "e(1); }\n.ten-confirm-icon { width: 42px; height: 42px; display: grid; place-items: center; margin: 0 auto 10px; color: #ff9aac; border: 1px solid rgba(255,97,116,.3); border-radius: 14px; background: rgba(255,97,116,.11); box-shadow: 0 0 22px rgba(255,97,116,.1); }\n.ten-confirm-title { margin-bottom: 6px; font-size: 14px; font-weight: 750; }\n.ten-confirm-mes", "sage { min-height: 34px; color: #c5d8e5; font-size: 11px; line-height: 1.55; word-break: break-word; }\n.ten-confirm-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; margin-top: 14px; }\n.ten-diagnostic { position: absolute; z-index: 51; inset: 0; display: grid; place-items: center; padding: 18px; visibility: hidden; opacity: ", "0; pointer-events: none; transition: opacity .24s ease, visibility .24s; }\n.ten-diagnostic.is-open { visibility: visible; opacity: 1; pointer-events: auto; }\n.ten-diagnostic-dialog { position: relative; width: 100%; max-height: 78%; display: grid; grid-template-rows: auto minmax(0,1fr) auto; gap: 11px; padding: 15px; border: 1px solid var(--ten-panel-border)", "; border-radius: var(--ten-radius-card); background: var(--ten-popover-bg); box-shadow: var(--ten-tooltip-shadow); transform: translateY(10px) scale(.97); transition: transform .28s cubic-bezier(.22,1,.36,1); }\n.ten-diagnostic.is-open .ten-diagnostic-dialog { transform: translateY(0) scale(1); }\n.ten-diagnostic-head { display: grid; grid-template-columns: 42", "px minmax(0,1fr) 34px; align-items: center; gap: 10px; text-align: left; }\n.ten-diagnostic-head .ten-confirm-icon { margin: 0; }\n.ten-confirm-icon.is-info { color: var(--ten-cyan); border-color: rgba(95,246,255,.3); background: rgba(95,246,255,.1); box-shadow: 0 0 22px rgba(95,246,255,.1); }\n#ten-diagnostic-content { min-height: 140px; margin: 0; padding: 11", "px; overflow: auto; color: #c9dce8; font: 10px/1.65 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; word-break: break-all; border: 1px solid rgba(137,225,255,.16); border-radius: 12px; background: rgba(3,13,27,.52); scrollbar-width: thin; scrollbar-color: rgba(95,246,255,.34) transparent; }\n.ten-diagnostic-actions { display: grid; g", "rid-template-columns: repeat(auto-fit,minmax(88px,1fr)); gap: 8px; }\n.ten-rule-guide-dialog { position: absolute; inset: 18px; width: auto; max-height: none; overflow: hidden; }\n.ten-rule-guide-content { min-height: 0; padding-right: 4px; overflow-y: auto; color: #c9dce8; font-size: 10px; line-height: 1.65; scrollbar-width: thin; scrollbar-color: rgba(95,246", ",255,.34) transparent; }\n.ten-rule-guide-content section { padding: 9px 10px; border: 1px solid rgba(137,225,255,.13); border-radius: 11px; background: rgba(3,13,27,.34); }\n.ten-rule-guide-content section + section { margin-top: 7px; }\n.ten-rule-guide-content h3 { margin: 0 0 5px; color: var(--ten-cyan); font-size: 10px; letter-spacing: .04em; }\n.ten-rule-gu", "ide-content ol, .ten-rule-guide-content ul { margin: 0; padding-left: 18px; }\n.ten-rule-guide-content li + li { margin-top: 3px; }\n.ten-rule-guide-content dl { display: grid; grid-template-columns: 78px minmax(0,1fr); gap: 4px 7px; margin: 0; }\n.ten-rule-guide-content dt { color: var(--ten-text); font-weight: 700; }\n.ten-rule-guide-content dd { margin: 0; }\n", ".ten-rule-guide-content code { padding: 1px 4px; color: var(--ten-cyan); border: 1px solid rgba(95,246,255,.13); border-radius: 5px; background: rgba(95,246,255,.06); font: 9px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }\n.ten-rule-guide-example > code { display: block; padding: 7px 8px; color: #bffbff; border-radius: 8px; background: rgba(2,10,", "22,.46); }\n.ten-rule-guide-warning { margin-top: 8px; padding: 7px 9px; color: #ffd0d9; border: 1px solid rgba(255,97,116,.24); border-radius: 9px; background: rgba(255,97,116,.08); }\n.ten-task-card, .ten-history-card { min-width: 0; display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 7px; contain: paint; cursor: default; transform: none !importan", "t; transition: border-color .24s ease, background-color .24s ease, box-shadow .24s ease; }\n.ten-task-card:hover, .ten-history-card:hover { border-color: rgba(95,246,255,.3); background: rgba(27,46,70,.52); box-shadow: inset 0 1px rgba(255,255,255,.04); transform: none; }\n.ten-task-card .ten-name, .ten-history-card .ten-name { min-width: 0; width: 100%; }\n.te", "n-task-actions { min-width: max-content; flex: 0 0 auto; display: flex; align-items: center; gap: 1px; }\n.ten-task-actions .ten-icon-btn { width: 29px; height: 29px; border-radius: 9px; }\n.ten-task-actions .ten-icon-btn.is-danger { color: #ff9aac; }\n.ten-task-actions .ten-icon-btn:focus-visible { outline: 2px solid var(--ten-cyan); outline-offset: 1px; }\n.te", "n-task-actions .ten-icon-btn:disabled { opacity: .24; cursor: default; }\n.ten-history-card .ten-task-actions .ten-icon-btn { width: 27px; height: 27px; }\n.ten-history-wrap { gap: 7px; }\n.ten-history-filter { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 4px; padding: 3px; border: 1px solid rgba(137,225,255,.12); border-radius: 11px; bac", "kground: rgba(3,14,28,.3); }\n.ten-history-filter button { min-width: 0; min-height: 29px; padding: 3px 5px; color: var(--ten-muted); font: inherit; font-size: 9px; cursor: pointer; border: 1px solid transparent; border-radius: 8px; background: transparent; transition: color .18s, border-color .18s, background .18s; }\n.ten-history-filter button:hover { color:", " var(--ten-text); background: rgba(95,246,255,.05); }\n.ten-history-filter button.is-active { color: var(--ten-cyan); border-color: rgba(95,246,255,.24); background: linear-gradient(145deg,rgba(95,246,255,.11),rgba(156,108,255,.09)); }\n.ten-recovery { margin-bottom: 9px; padding: 10px 11px; display: flex; align-items: center; justify-content: space-between; g", "ap: 9px; border: 1px solid rgba(95,246,255,.28); border-radius: 14px; background: linear-gradient(145deg,rgba(35,73,91,.72),rgba(59,48,91,.68)); box-shadow: inset 0 1px rgba(255,255,255,.08); }\n.ten-recovery[hidden] { display: none; }\n.ten-recovery > div:first-child { min-width: 0; display: grid; gap: 2px; }\n.ten-recovery strong { color: var(--ten-text); fon", "t-size: 11px; }\n.ten-recovery span { color: var(--ten-muted); font-size: 9px; }\n.ten-recovery .ten-btn { min-height: 30px; padding: 5px 9px; }\n.ten-task-state { padding: 1px 6px; border: 1px solid rgba(137,225,255,.18); border-radius: 999px; font-size: 9px; }\n.ten-task-state.is-failed, .ten-task-state.is-partial { color: #ff9aac; border-color: rgba(255,97,11", "6,.25); background: rgba(255,97,116,.08); }\n.ten-task-state.is-cancelled { color: #b4c2ce; }\n.ten-task-state.is-completed { color: var(--ten-cyan); }\n.ten-search-results { margin-top: 10px; }\n.ten-result-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(100px,1fr)); gap: 8px; }\n.ten-result { padding: 6px; overflow: hidden; color: var(--ten", "-text); cursor: pointer; border: 1px solid var(--ten-line); border-radius: 12px; background: var(--ten-surface); }\n.ten-result img { width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 8px; background: rgba(255,255,255,.05); }\n.ten-result span { display: block; margin-top: 5px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; fon", "t-size: 10px; }\n.ten-section-title { margin: 13px 2px 7px; color: var(--ten-muted); font-size: 10px; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; }\n.ten-file-name { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--ten-muted); font-size: 10px; }\n.ten-dir-control { min-width: 0; display: flex; al", "ign-items: center; justify-content: flex-end; gap: 8px; }\n.ten-dir-control .ten-btn { flex: 0 0 auto; margin: 0; }\n.ten-dir-control .ten-file-name { flex: 1 1 auto; max-width: 92px; text-align: left; }\n.ten-settings-hint { color: var(--ten-muted); font-size: 9px; line-height: 1.5; text-align: right; }\n.ten-rule-fields { display: grid; gap: 8px; }\n.ten-rule-fields label { min-width: 0; display: grid; gap: 4px; color: #c9dce8; font-size: 10px; }\n.ten-rule-fields .ten-input { height: 34px; text", "-align: left; }\n.ten-rule-intro { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 8px; margin-bottom: 9px; padding: 8px 10px; color: var(--ten-muted); font-size: 9px; line-height: 1.45; border: 1px solid var(--ten-card-border); border-radius: var(--ten-radius-control); background: var(--ten-list-bg); }\n.ten-rule-intro strong { color", ": var(--ten-cyan); font-size: 10px; white-space: nowrap; }\n.ten-rule-pick-actions { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 7px; margin: 0 0 8px; }\n.ten-rule-templates { margin: 0 0 8px; overflow: hidden; border: 1px solid var(--ten-card-border); border-radius: var(--ten-radius-control); background: var(--ten-list-bg); }\n.ten-rule", '-templates summary { display: flex; align-items: center; gap: 8px; padding: 9px 10px; color: var(--ten-text); font-size: 10px; cursor: pointer; list-style: none; }\n.ten-rule-templates summary::-webkit-details-marker { display: none; }\n.ten-rule-templates summary::after { content: ""; width: 6px; height: 6px; flex: 0 0 auto; border-right: 1.5px solid currentC', "olor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg) translateY(-2px); transition: transform .2s; }\n.ten-rule-templates summary span { margin-left: auto; overflow: hidden; color: var(--ten-muted); font-size: 9px; white-space: nowrap; text-overflow: ellipsis; }\n.ten-rule-templates[open] summary { color: var(--ten-cyan); border-bottom: 1px s", "olid var(--ten-card-border); }\n.ten-rule-templates[open] summary::after { transform: rotate(225deg) translate(-1px,-1px); }\n.ten-rule-template-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 6px; padding: 8px; animation: ten-picker-in .22s ease both; }\n.ten-rule-template-grid button { min-width: 0; min-height: 48px; display: grid; ", "align-content: center; gap: 2px; padding: 7px 8px; color: var(--ten-text); font: inherit; text-align: left; cursor: pointer; border: 1px solid var(--ten-control-border); border-radius: var(--ten-radius-control); background: var(--ten-input-bg); transition: border-color .18s, background .18s, transform .18s; }\n.ten-rule-template-grid button:hover, .ten-rule-t", "emplate-grid button.is-active { color: var(--ten-cyan); border-color: var(--ten-cyan); background: var(--ten-control-hover-bg); transform: translateY(-1px); }\n.ten-rule-template-grid strong { overflow: hidden; font-size: 10px; white-space: nowrap; text-overflow: ellipsis; }\n.ten-rule-template-grid small { overflow: hidden; color: var(--ten-muted); font-size:", " 8px; white-space: nowrap; text-overflow: ellipsis; }\n.ten-mobile-drawer { display: none; }\n.ten-rule-pick-actions button { min-height: 32px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 7px; color: var(--ten-text); font: inherit; font-size: 9px; cursor: pointer; border: 1px solid var(--ten-control-border); borde", "r-radius: var(--ten-radius-control); background: var(--ten-input-bg); }\n.ten-rule-pick-actions button .ten-icon { width: 14px; height: 14px; color: var(--ten-cyan); }\n.ten-rule-pick-actions button:hover { color: var(--ten-cyan); border-color: rgba(95,246,255,.42); background: rgba(95,246,255,.09); box-shadow: inset 0 1px rgba(255,255,255,.06); }\n.ten-rule-gu", "ide-open { min-height: 28px; display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; color: var(--ten-cyan); font: inherit; font-size: 9px; cursor: pointer; border: 1px solid rgba(95,246,255,.2); border-radius: 9px; background: rgba(95,246,255,.07); transition: transform .18s, border-color .18s, background .18s, box-shadow .18s; }\n.ten-rule-gu", "ide-open .ten-icon { width: 15px; height: 15px; }\n.ten-rule-guide-open:hover { transform: translateY(-1px); border-color: rgba(95,246,255,.5); background: rgba(95,246,255,.12); box-shadow: 0 6px 16px rgba(5,25,43,.14); }\n.ten-rule-simple-hint { margin-top: -3px; color: var(--ten-muted); font-size: 9px; line-height: 1.45; }\n.ten-rule-advanced { overflow: hidd", "en; border: 1px solid var(--ten-card-border); border-radius: var(--ten-radius-control); background: var(--ten-input-bg); }\n.ten-rule-advanced summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 10px; color: #c9dce8; font-size: 10px; cursor: pointer; list-style: none; }\n.ten-rule-advanced summary::-webkit-detai", 'ls-marker { display: none; }\n.ten-rule-advanced summary::after { content: ""; width: 6px; height: 6px; flex: 0 0 auto; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg) translateY(-2px); transition: transform .25s ease; }\n.ten-rule-advanced[open] summary { color: var(--ten-cyan); border-bottom: 1px soli', "d rgba(137,225,255,.12); }\n.ten-rule-advanced[open] summary::after { transform: rotate(225deg) translate(-1px,-1px); }\n.ten-rule-advanced summary span, .ten-rule-json summary span { margin-left: auto; color: var(--ten-muted); font-size: 9px; font-weight: 400; }\n.ten-rule-advanced-body { display: grid; gap: 8px; padding: 9px; animation: ten-picker-in .24s eas", "e both; }\n.ten-rule-frame { min-height: 34px; padding: 0 2px; }\n.ten-rule-function { min-height: 96px; font: 9px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; }\n.ten-rule-label { display: block; margin-bottom: 4px; color: #c9dce8; font-size: 10px; }\n.ten-rule-readtype { --rule-type: 0; position: relative; display: grid; grid-template-columns: repea", 't(2,1fr); padding: 3px; border-radius: 11px; background: rgba(3,14,28,.38); }\n.ten-rule-readtype::before { content: ""; position: absolute; inset: 3px 50% 3px 3px; border: 1px solid rgba(95,246,255,.25); border-radius: 8px; background: linear-gradient(145deg, rgba(95,246,255,.14), rgba(156,108,255,.12)); transform: translateX(calc(var(--rule-type)*100%)); tr', "ansition: transform .28s cubic-bezier(.22,1,.36,1); }\n.ten-rule-readtype button { position: relative; z-index: 1; min-height: 30px; color: var(--ten-muted); font: inherit; font-size: 10px; cursor: pointer; border: 0; background: transparent; }\n.ten-rule-readtype button.is-active { color: var(--ten-cyan); }\n.ten-rule-test-result { margin-top: 9px; padding: 9p", "x; color: #c9dce8; font: 9px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; border: 1px solid rgba(137,225,255,.18); border-radius: 10px; background: rgba(3,14,28,.4); }\n.ten-rule-test-result.is-success { color: #a9fff0; border-color: rgba(95,246,255,.3); }\n.ten-rule-test-result.is-error { color: #ffc0cb; border-color: rgba(255", ",97,116,.3); }\n.ten-rule-actions { display: grid; grid-template-columns: repeat(auto-fit,minmax(88px,1fr)); gap: 7px; margin-top: 9px; }\n.ten-backup-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; margin-bottom: 7px; }\n.ten-rule-json { margin-top: 10px; border-top: 1px solid rgba(137,225,255,.13); }\n.ten-rule-json summary { padding: 9px 2px 7px; color: var(--ten-muted); font-size: 10px; cursor: pointer; }\n.ten-rule-json[open] summary { color: var(--ten-cyan); }\n.ten-rule-json .ten-textarea { ", "min-height: 96px; }\n.ten-rule-json .ten-btn { width: 100%; margin-top: 7px; }\n@keyframes ten-particle { from { transform: translate3d(0,0,0) scale(.7); opacity: .15; } to { transform: translate3d(var(--tx),var(--ty),0) scale(1.2); opacity: .7; } }\n@keyframes ten-launcher-orbit { to { transform: rotate(360deg); } }\n@keyframes ten-view-in { from { opacity: 0; ", "transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }\n@keyframes ten-ripple { to { transform: scale(4); opacity: 0; } }\n@keyframes ten-picker-in { from { opacity: 0; transform: translateY(-7px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }\n@keyframes ten-energy-flow { to { transform: translateX(340%); } }\n@keyfr", "ames ten-state-scan { from { left: -42%; opacity: 0; } 24% { opacity: 1; } to { left: 108%; opacity: 0; } }\n@keyframes ten-state-border { 0% { box-shadow: 0 0 0 rgba(var(--ten-state-rgb),0); } 35% { box-shadow: 0 0 18px rgba(var(--ten-state-rgb),.18), inset 0 0 12px rgba(var(--ten-state-rgb),.06); } 100% { box-shadow: 0 0 0 rgba(var(--ten-state-rgb),0); } }\n", "@media (max-width: 560px), (max-height: 720px) {\n  #ten-panel { right: 8px; width: calc(100vw - 16px); height: calc(100vh - 16px); border-radius: 19px; }\n  #ten-comic-launcher { right: 8px; }\n  .ten-mobile-drawer { position: fixed; z-index: 2147483647; inset: 0; display: block; visibility: hidden; pointer-events: none; }\n  .ten-mobile-drawer.is-open { visibi", "lity: visible; pointer-events: auto; }\n  .ten-mobile-drawer-backdrop { position: absolute; inset: 0; width: 100%; padding: 0; border: 0; background: var(--ten-overlay-bg); backdrop-filter: blur(5px); opacity: 0; transition: opacity .22s; }\n  .ten-mobile-drawer.is-open .ten-mobile-drawer-backdrop { opacity: 1; }\n  .ten-mobile-drawer-sheet { position: absolute", "; right: 0; bottom: 0; left: 0; max-height: min(78vh,620px); display: grid; grid-template-rows: auto auto minmax(0,1fr); padding: 7px 12px 14px; overflow: hidden; border: 1px solid var(--ten-panel-border); border-radius: 22px 22px 0 0; background: var(--ten-popover-bg); box-shadow: 0 -18px 48px rgba(0,5,15,.28); transform: translateY(104%); transition: trans", "form .3s cubic-bezier(.22,1,.36,1); }\n  .ten-mobile-drawer.is-open .ten-mobile-drawer-sheet { transform: translateY(0); }\n  .ten-mobile-drawer-handle { width: 34px; height: 4px; margin: 0 auto 5px; border-radius: 999px; background: var(--ten-scroll-thumb); }\n  .ten-mobile-drawer-sheet header { min-height: 38px; display: flex; align-items: center; justify-con", "tent: space-between; color: var(--ten-text); font-size: 12px; font-weight: 750; }\n  #ten-mobile-drawer-content { min-height: 0; overflow-y: auto; padding: 2px 1px; }\n  #ten-mobile-drawer-content .ten-options { max-height: none; margin: 0; padding: 10px; opacity: 1; border-width: 1px; }\n  #ten-mobile-drawer-content .ten-options.is-mobile-drawer-content { back", "ground: var(--ten-card-bg); }\n  #ten-mobile-drawer-content .ten-rule-advanced-body { padding: 10px; border: 1px solid var(--ten-card-border); border-radius: var(--ten-radius-card); background: var(--ten-card-bg); }\n}\n@media (min-width: 561px) {\n  .ten-mobile-drawer { display: none; }\n}\n@media (max-width: 1000px) {\n  #ten-search-panel { z-index: 2147483647; r", "ight: 8px; width: calc(100vw - 16px); height: calc(100vh - 16px); border-radius: 19px; }\n}\n@media (prefers-reduced-motion: reduce) {\n  #ten-comic-root *, #ten-comic-root *::before, #ten-comic-root *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }\n  #ten-particle-field { display: none; }\n}\n\n.ten-theme-presets { display:", " grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; }\n.ten-theme-choice { min-width: 0; min-height: 58px; display: grid; align-content: center; gap: 2px; padding: 8px 10px; color: var(--ten-text); font: inherit; text-align: left; cursor: pointer; border: 1px solid var(--ten-line); border-radius: 13px; background: rgba(4,14,28,.36); transition: b", 'order-color .2s, box-shadow .2s, transform .18s, background .2s; }\n.ten-theme-choice[data-theme-choice="glass"] { box-shadow: inset 3px 0 #5ff6ff; }\n.ten-theme-choice[data-theme-choice="mist"] { box-shadow: inset 3px 0 #78bfe8; }\n.ten-theme-choice[data-theme-choice="porcelain"] { box-shadow: inset 3px 0 #b9835e; }\n.ten-theme-choice[data-theme-choice="express', 'ive"] { box-shadow: inset 3px 0 #aa71ff; }\n.ten-theme-choice[data-theme-choice="carbon"] { box-shadow: inset 3px 0 #ff4f96; }\n.ten-theme-choice[data-theme-choice="ink"] { box-shadow: inset 3px 0 #a18558; }\n.ten-theme-choice:hover { border-color: rgba(95,246,255,.46); transform: translateY(-1px); }\n.ten-theme-choice[aria-pressed="true"] { color: var(--ten-cya', "n); border-color: var(--ten-cyan); background: rgba(95,246,255,.09); box-shadow: 0 0 0 3px rgba(95,246,255,.07), inset 0 1px rgba(255,255,255,.08); }\n.ten-theme-choice strong { overflow: hidden; font-size: 11px; white-space: nowrap; text-overflow: ellipsis; }\n.ten-theme-choice small { overflow: hidden; color: var(--ten-muted); font-size: 8px; white-space: no", 'wrap; text-overflow: ellipsis; }\n\n#ten-comic-root[data-theme="mist"] { --ten-bg: rgba(241,248,253,.76); --ten-surface: rgba(255,255,255,.5); --ten-surface-strong: rgba(255,255,255,.74); --ten-line: rgba(67,112,148,.18); --ten-text: #183247; --ten-muted: #667d90; --ten-cyan: #168eaf; --ten-blue: #4d7edc; --ten-violet: #7c69ca; --ten-pink: #c45e91; --ten-dange', 'r: #ce4f6d; --ten-success: #278768; }\n#ten-comic-root[data-theme="mist"] #ten-comic-launcher { color: #183247; border-color: rgba(255,255,255,.84); border-radius: 20px; background: linear-gradient(145deg,rgba(255,255,255,.82),rgba(219,237,250,.68)); box-shadow: 0 14px 38px rgba(49,91,123,.2),0 0 24px rgba(86,168,213,.16),inset 0 1px rgba(255,255,255,.96); }\n', '#ten-comic-root[data-theme="mist"] #ten-panel { border-color: rgba(255,255,255,.86); border-radius: 27px; background: radial-gradient(circle at 90% 2%,rgba(151,129,232,.17),transparent 31%),radial-gradient(circle at 2% 88%,rgba(66,177,218,.14),transparent 32%),linear-gradient(155deg,rgba(244,250,255,.78),rgba(224,236,248,.7)); box-shadow:', ' 0 30px 86px rgba(43,73,99,.24),inset 0 1px rgba(255,255,255,.96); backdrop-filter: blur(38px) saturate(1.28); }\n#ten-comic-root[data-theme="mist"] #ten-panel::before { opacity: .5; background: radial-gradient(circle at 86% 4%,rgba(117,95,214,.14),transparent 28%),radial-gradient(circle at 6% 90%,rgba(37,155,198,.13),transparent 32%); }\n#ten-comic-root[data-', 'theme="mist"] .ten-header,\n#ten-comic-root[data-theme="mist"] .ten-nav { border-color: rgba(70,111,143,.14); background: rgba(248,252,255,.58); backdrop-filter: blur(23px) saturate(1.2); }\n#ten-comic-root[data-theme="mist"] .ten-card,\n#ten-comic-root[data-theme="mist"] .ten-task-group { border-color: rgba(255,255,255,.76); border-radius: 18px; background: li', 'near-gradient(145deg,rgba(255,255,255,.58),rgba(224,237,247,.42)); box-shadow: 0 10px 25px rgba(54,88,112,.1),inset 0 1px rgba(255,255,255,.88); backdrop-filter: blur(18px) saturate(1.18); }\n#ten-comic-root[data-theme="mist"] .ten-list-item,\n#ten-comic-root[data-theme="mist"] .ten-status,\n#ten-comic-root[data-theme="mist"] .ten-chapter-list-head { border-col', 'or: rgba(78,119,150,.16); border-radius: 14px; background: rgba(255,255,255,.46); box-shadow: inset 0 1px rgba(255,255,255,.8); }\n#ten-comic-root[data-theme="mist"] .ten-list-item:hover { border-color: rgba(22,142,175,.4); background: rgba(255,255,255,.68); }\n#ten-comic-root[data-theme="mist"] .ten-btn { color: #183247; border-color: rgba(77,126,174,.2); bor', 'der-radius: 13px; background: linear-gradient(115deg,rgba(208,235,248,.86),rgba(228,220,249,.8),rgba(213,240,242,.82)); box-shadow: inset 0 1px rgba(255,255,255,.9); }\n#ten-comic-root[data-theme="mist"] .ten-btn.is-danger { color: #a53e5c; background: rgba(255,232,239,.72); }\n#ten-comic-root[data-theme="mist"] .ten-input,\n#ten-comic-root[data-theme="mist"] .', 'ten-select,\n#ten-comic-root[data-theme="mist"] .ten-textarea,\n#ten-comic-root[data-theme="mist"] .ten-setting-select > button,\n#ten-comic-root[data-theme="mist"] .ten-source,\n#ten-comic-root[data-theme="mist"] .ten-effect-level,\n#ten-comic-root[data-theme="mist"] .ten-history-filter,\n#ten-comic-root[data-theme=', '"mist"] .ten-rule-readtype { color: #183247; border-color: rgba(70,111,143,.16); background: rgba(255,255,255,.45); }\n#ten-comic-root[data-theme="mist"] .ten-setting label,\n#ten-comic-root[data-theme="mist"] .ten-rule-fields label,\n#ten-comic-root[data-theme="mist"] .ten-rule-label { color: #29455a; }\n#ten-comic-root[data-theme="mist"] .ten-setting-select-me', 'nu,\n#ten-comic-root[data-theme="mist"] .ten-search-site-menu,\n#ten-comic-root[data-theme="mist"] .ten-confirm-dialog,\n#ten-comic-root[data-theme="mist"] .ten-diagnostic-dialog { color: #183247; border-color: rgba(77,126,174,.2); background: linear-gradient(145deg,rgba(250,253,255,.96),rgba(226,237,247,.96)); box-shadow: 0 22px 55px rgba(44,76,102,.22),inset ', '0 1px rgba(255,255,255,.9); }\n#ten-comic-root[data-theme="mist"] #ten-diagnostic-content { color: #29455a; background: rgba(255,255,255,.52); }\n#ten-comic-root[data-theme="mist"] .ten-select option { color: #183247; background: #f4f9fc; }\n#ten-comic-root[data-theme="mist"] .ten-progress { background: rgba(50,85,111,.12); }\n#ten-comic-root[data-theme="mist"] ', '.ten-progress > i { background: linear-gradient(90deg,#48b9d2,#65a4ea,#9c7cdd); box-shadow: 0 0 10px rgba(62,157,203,.25); }\n#ten-comic-root[data-theme="mist"] .ten-nav::before { border-color: rgba(45,140,184,.24); border-radius: 17px; background: linear-gradient(145deg,rgba(181,229,246,.56),rgba(213,198,246,.52)); box-shadow: 0 7px 19px rgba(57,102,132,.1),', 'inset 0 1px rgba(255,255,255,.88); }\n#ten-comic-root[data-theme="mist"] .ten-chapter-tools { border-color: rgba(255,255,255,.76); border-radius: 16px; background: linear-gradient(145deg,rgba(255,255,255,.84),rgba(226,238,248,.76)); box-shadow: 0 8px 20px rgba(54,88,112,.1),inset 0 1px rgba(255,255,255,.9); }\n#ten-comic-root[data-theme="mist"] #ten-search-pan', 'el { color: #183247; border-color: rgba(255,255,255,.82); background: linear-gradient(155deg,rgba(246,251,255,.94),rgba(225,237,247,.95)); box-shadow: 0 26px 70px rgba(43,73,99,.23),inset 0 1px rgba(255,255,255,.9); }\n#ten-comic-root[data-theme="mist"] #ten-particle-field { opacity: .22; filter: saturate(.65); }\n#ten-comic-root[data-theme="mist"] .ten-theme-', 'choice { color: #183247; border-color: rgba(70,111,143,.17); background: rgba(255,255,255,.56); }\n#ten-comic-root[data-theme="mist"] .ten-theme-choice:hover { border-color: rgba(22,142,175,.4); background: rgba(255,255,255,.74); }\n#ten-comic-root[data-theme="mist"] .ten-theme-choice[aria-pressed="true"] { color: #126f8b; border-color: #168eaf; background: rg', 'ba(225,244,252,.8); }\n#ten-comic-root[data-theme="mist"] .ten-rule-intro { border-color: rgba(70,111,143,.16); background: linear-gradient(145deg,rgba(255,255,255,.58),rgba(218,235,246,.46)); box-shadow: inset 0 1px rgba(255,255,255,.78); }\n#ten-comic-root[data-theme="mist"] .ten-rule-advanced { border-color: rgba(70,111,143,.17); background: rgba(250,253,25', '5,.5); box-shadow: inset 0 1px rgba(255,255,255,.72); }\n#ten-comic-root[data-theme="mist"] .ten-rule-advanced summary { color: #29455a; }\n#ten-comic-root[data-theme="mist"] .ten-rule-advanced[open] summary { color: #126f8b; border-bottom-color: rgba(70,111,143,.14); background: rgba(223,241,249,.46); }\n#ten-comic-root[data-theme="mist"] .ten-rule-guide-open ', '{ color: #126f8b; border-color: rgba(22,142,175,.24); background: rgba(225,244,252,.7); box-shadow: inset 0 1px rgba(255,255,255,.84); }\n#ten-comic-root[data-theme="mist"] #ten-search-site-trigger { color: #29455a; border-color: rgba(70,111,143,.18); background: linear-gradient(145deg,rgba(255,255,255,.72),rgba(220,238,248,.62)); box-shadow: inset 0 1px rgba', '(255,255,255,.9),0 5px 14px rgba(54,88,112,.08); }\n#ten-comic-root[data-theme="mist"] .ten-rule-manage { border-color: rgba(70,111,143,.16); background: rgba(255,255,255,.46); }\n#ten-comic-root[data-theme="mist"] .ten-chapter-reload button { border-color: rgba(22,142,175,.2); background: rgba(247,252,255,.82); box-shadow: inset 0 1px rgba(255,255,255,.9); }\n', '#ten-comic-root[data-theme="mist"] .ten-chapter-empty { border-color: rgba(255,255,255,.78); background: linear-gradient(145deg,rgba(255,255,255,.62),rgba(222,237,247,.48)); box-shadow: 0 9px 23px rgba(54,88,112,.09),inset 0 1px rgba(255,255,255,.9); }\n#ten-comic-root[data-theme="mist"] .ten-empty-orbit { border-color: rgba(22,142,175,.22); background: linea', 'r-gradient(145deg,rgba(230,248,253,.82),rgba(231,226,250,.7)); box-shadow: 0 8px 20px rgba(54,110,142,.1),inset 0 1px rgba(255,255,255,.9); }\n#ten-comic-root[data-theme="mist"] .ten-comic-info { border-color: rgba(70,111,143,.16); background: rgba(255,255,255,.5); box-shadow: inset 0 1px rgba(255,255,255,.82); }\n#ten-comic-root[data-theme="mist"] .ten-comic-', 'info span,\n#ten-comic-root[data-theme="mist"] .ten-comic-info strong { border-bottom-color: rgba(70,111,143,.1); }\n#ten-comic-root[data-theme="mist"] .ten-mini-task,\n#ten-comic-root[data-theme="mist"] .ten-rule-pick-hud { color: #183247; border-color: rgba(255,255,255,.86); background: linear-gradient(145deg,rgba(250,253,255,.94),rgba(222,237,248,.92)); box-', 'shadow: 0 16px 42px rgba(43,73,99,.2),inset 0 1px rgba(255,255,255,.94); }\n#ten-comic-root[data-theme="mist"] .ten-mini-icon,\n#ten-comic-root[data-theme="mist"] .ten-rule-pick-symbol { border-color: rgba(22,142,175,.2); background: rgba(225,244,252,.74); }\n#ten-comic-root[data-theme="mist"] .ten-mini-progress { background: rgba(50,85,111,.12); }\n#ten-comic-r', 'oot[data-theme="mist"] .ten-rule-pick-actions button { color: #29455a; border-color: rgba(70,111,143,.16); background: rgba(255,255,255,.5); }\n\n#ten-comic-root[data-theme="porcelain"] { --ten-bg: #f4f0e8; --ten-surface: #fffdf9; --ten-surface-strong: #f8f3ea; --ten-line: rgba(91,82,70,.2); --ten-text: #28323b; --ten-muted: #74746f; --ten-cyan: #315f88; --ten', '-blue: #3f6f9d; --ten-violet: #8e6f57; --ten-pink: #b86a5c; --ten-danger: #b94f49; --ten-success: #4f7f64; }\n#ten-comic-root[data-theme="porcelain"] #ten-comic-launcher { color: #28323b; border-color: #d9d1c4; border-radius: 15px; background: #fffdf8; box-shadow: 0 11px 28px rgba(62,54,44,.18),inset 0 1px #fff; }\n#ten-comic-root[data-theme="porcelain"] #ten-', 'panel { border-color: #d6cfc4; border-radius: 20px; background: #f5f1e9; box-shadow: 0 28px 72px rgba(55,48,40,.24),inset 0 1px #fff; backdrop-filter: none; }\n#ten-comic-root[data-theme="porcelain"] #ten-panel::before { opacity: 0; }\n#ten-comic-root[data-theme="porcelain"] .ten-header,\n#ten-comic-root[data-theme="porcelain"] .ten-nav { bo', 'rder-color: #d9d2c7; background: #f0ebe2; backdrop-filter: none; }\n#ten-comic-root[data-theme="porcelain"] .ten-card,\n#ten-comic-root[data-theme="porcelain"] .ten-task-group { border-color: #ddd6ca; border-radius: 13px; background: #fffdf9; box-shadow: 0 7px 18px rgba(65,55,43,.08),inset 0 1px #fff; backdrop-filter: none; }\n#ten-comic-root[data-theme="porcel', 'ain"] .ten-list-item,\n#ten-comic-root[data-theme="porcelain"] .ten-status,\n#ten-comic-root[data-theme="porcelain"] .ten-chapter-list-head { border-color: #e0d9cf; border-radius: 10px; background: #faf7f1; box-shadow: none; backdrop-filter: none; }\n#ten-comic-root[data-theme="porcelain"] .ten-list-item:hover { border-color: #8da5b8; background: #f5f8fa; }\n#te', 'n-comic-root[data-theme="porcelain"] .ten-btn { color: #28323b; border-color: #d2c8bb; border-radius: 9px; background: #eee8de; box-shadow: inset 0 1px rgba(255,255,255,.8); }\n#ten-comic-root[data-theme="porcelain"] .ten-btn.is-primary { color: #f7fbff; border-color: #315f88; background: #315f88; }\n#ten-comic-root[data-theme="porcelain"] .ten-btn.is-danger {', ' color: #9c403b; border-color: #dfb8b1; background: #fae9e5; }\n#ten-comic-root[data-theme="porcelain"] .ten-input,\n#ten-comic-root[data-theme="porcelain"] .ten-select,\n#ten-comic-root[data-theme="porcelain"] .ten-textarea,\n#ten-comic-root[data-theme="porcelain"] .ten-setting-select > button,\n#ten-comic-root[data-theme="porcelain"] .ten-source,\n#ten-comic-roo', 't[data-theme="porcelain"] .ten-effect-level,\n#ten-comic-root[data-theme="porcelain"] .ten-history-filter,\n#ten-comic-root[data-theme="porcelain"] .ten-rule-readtype { color: #28323b; border-color: #ddd6ca; background: #fffdf9; box-shadow: none; }\n#ten-comic-root[data-theme="porcelain"] .ten-setting label,\n', '#ten-comic-root[data-theme="porcelain"] .ten-rule-fields label,\n#ten-comic-root[data-theme="porcelain"] .ten-rule-label { color: #3d4650; }\n#ten-comic-root[data-theme="porcelain"] .ten-setting-select-menu,\n#ten-comic-root[data-theme="porcelain"] .ten-search-site-menu,\n#ten-comic-root[data-theme="porcelain"] .ten-confirm-dialog,\n#ten-comic-root[data-theme="po', 'rcelain"] .ten-diagnostic-dialog { color: #28323b; border-color: #d8d0c4; background: #fffdf9; box-shadow: 0 20px 50px rgba(65,55,43,.2); }\n#ten-comic-root[data-theme="porcelain"] #ten-diagnostic-content { color: #3d4650; border-color: #ded7cc; background: #f8f4ed; }\n#ten-comic-root[data-theme="porcelain"] .ten-select option { color: #28323b; background: #ff', 'fdf9; }\n#ten-comic-root[data-theme="porcelain"] .ten-progress { background: #e5e1da; }\n#ten-comic-root[data-theme="porcelain"] .ten-progress > i { background: linear-gradient(90deg,#315f88,#6286a5,#b57d56); box-shadow: none; }\n#ten-comic-root[data-theme="porcelain"] .ten-nav::before { border-color: #b7c7d4; border-radius: 11px; background: #dde7ee; box-shado', 'w: inset 0 1px #f8fbfd; }\n#ten-comic-root[data-theme="porcelain"] .ten-chapter-tools { border-color: #d9d2c7; border-radius: 11px; background: #fffdf9; box-shadow: 0 7px 18px rgba(65,55,43,.09); backdrop-filter: none; }\n#ten-comic-root[data-theme="porcelain"] #ten-search-panel { color: #28323b; border-color: #d6cfc4; background: #f5f1e9; box-shadow: 0 24px 6', '4px rgba(55,48,40,.22); backdrop-filter: none; }\n#ten-comic-root[data-theme="porcelain"] #ten-particle-field { display: none; }\n#ten-comic-root[data-theme="porcelain"] .ten-theme-choice { color: #28323b; border-color: #ddd6ca; background: #fffdf9; }\n#ten-comic-root[data-theme="porcelain"] .ten-theme-choice:hover { border-color: #8da5b8; background: #f7f8f7; ', '}\n#ten-comic-root[data-theme="porcelain"] .ten-theme-choice[aria-pressed="true"] { color: #315f88; border-color: #315f88; background: #e8eff4; }\n#ten-comic-root[data-theme="porcelain"] .ten-rule-intro { border-color: #ddd6ca; background: #faf7f1; box-shadow: inset 0 1px #fff; }\n#ten-comic-root[data-theme="porcelain"] .ten-rule-advanced { border-color: #ddd6c', 'a; background: #fffdf9; box-shadow: inset 0 1px #fff; }\n#ten-comic-root[data-theme="porcelain"] .ten-rule-advanced summary { color: #3d4650; }\n#ten-comic-root[data-theme="porcelain"] .ten-rule-advanced[open] summary { color: #315f88; border-bottom-color: #e0d9cf; background: #f7f2ea; }\n#ten-comic-root[data-theme="porcelain"] .ten-rule-guide-open { color: #31', '5f88; border-color: #c8d5df; background: #e8eff4; box-shadow: inset 0 1px #fff; }\n#ten-comic-root[data-theme="porcelain"] #ten-search-site-trigger { color: #3d4650; border-color: #ddd6ca; background: #fffdf9; box-shadow: inset 0 1px #fff,0 4px 12px rgba(65,55,43,.06); }\n#ten-comic-root[data-theme="porcelain"] .ten-rule-manage { border-color: #e0d9cf; backgro', 'und: #faf7f1; }\n#ten-comic-root[data-theme="porcelain"] .ten-chapter-reload button { border-color: #d8d0c4; background: #fffdf9; box-shadow: inset 0 1px #fff; }\n#ten-comic-root[data-theme="porcelain"] .ten-chapter-empty { border-color: #ddd6ca; background: #fffdf9; box-shadow: 0 7px 18px rgba(65,55,43,.08),inset 0 1px #fff; }\n#ten-comic-root[data-theme="porc', 'elain"] .ten-empty-orbit { border-color: #c8d5df; background: #e8eff4; box-shadow: inset 0 1px #fff; }\n#ten-comic-root[data-theme="porcelain"] .ten-comic-info { border-color: #e0d9cf; background: #faf7f1; box-shadow: inset 0 1px #fff; }\n#ten-comic-root[data-theme="porcelain"] .ten-comic-info span,\n#ten-comic-root[data-theme="porcelain"] .ten-comic-info stron', 'g { border-bottom-color: #e6dfd5; }\n#ten-comic-root[data-theme="porcelain"] .ten-mini-task,\n#ten-comic-root[data-theme="porcelain"] .ten-rule-pick-hud { color: #28323b; border-color: #d8d0c4; background: #fffdf9; box-shadow: 0 15px 38px rgba(65,55,43,.2),inset 0 1px #fff; backdrop-filter: none; }\n#ten-comic-root[data-theme="porcelain"] .ten-mini-icon,\n#ten-c', 'omic-root[data-theme="porcelain"] .ten-rule-pick-symbol { border-color: #c8d5df; background: #e8eff4; }\n#ten-comic-root[data-theme="porcelain"] .ten-mini-progress { background: #e5e1da; }\n#ten-comic-root[data-theme="porcelain"] .ten-rule-pick-actions button { color: #3d4650; border-color: #ddd6ca; background: #faf7f1; }\n#ten-comic-root[data-theme="porcelain"', '] .ten-rule-guide-content { color: #625f59; }\n#ten-comic-root[data-theme="porcelain"] .ten-rule-guide-content section { border-color: #e0d9cf; background: #faf7f1; }\n#ten-comic-root[data-theme="porcelain"] .ten-rule-guide-content code { border-color: #ded7cc; background: #f0ebe2; }\n#ten-comic-root[data-theme="porcelain"] .ten-rule-guide-example > code { colo', 'r: #3d4650; background: #f0ebe2; }\n\n#ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-mode { color: var(--ten-muted); border-color: var(--ten-line); background: rgba(255,255,255,.48); }\n#ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-mode.is-active { color: var(--ten-cyan); border-color: var(--ten-cyan); background: ', 'rgba(72,133,174,.1); }\n#ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-confirm-message,\n#ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-rule-test-result,\n#ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-task-performance { color: #53697a; }\n#ten-comic-root:is([data-theme="mist"],[data-theme="por', 'celain"]) .ten-toast { color: #f3f9fc; border-color: rgba(67,112,148,.32); background: rgba(30,48,63,.94); }\n#ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-confirm-backdrop { background: rgba(34,48,60,.36); }\n#ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-task-actions .ten-icon-btn.is-danger { color: #bc4d66; }\n#', 'ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-rule-guide-content { color: #53697a; }\n#ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-rule-guide-content section { border-color: var(--ten-line); background: rgba(255,255,255,.5); }\n#ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-rule-guide-conte', 'nt dt { color: var(--ten-text); }\n#ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-rule-guide-content code { color: var(--ten-cyan); border-color: var(--ten-line); background: rgba(66,112,148,.07); }\n#ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-rule-guide-example > code { color: #29455a; background: rgba(232,241,', '247,.7); }\n#ten-comic-root:is([data-theme="mist"],[data-theme="porcelain"]) .ten-rule-guide-warning { color: #a53e5c; border-color: rgba(190,77,103,.22); background: rgba(255,232,239,.68); }\n\n#ten-comic-root[data-theme="expressive"] { --ten-bg: rgba(22,20,58,.86); --ten-surface: rgba(52,48,105,.58); --ten-surface-strong: rgba(61,56,122,.78); --ten-line: rgba', '(178,173,255,.24); --ten-text: #f7f4ff; --ten-muted: #aaa7cb; --ten-cyan: #61ddff; --ten-blue: #7c98ff; --ten-violet: #aa71ff; --ten-pink: #ff75c7; --ten-danger: #ff7697; --ten-success: #74efc7; }\n#ten-comic-root[data-theme="expressive"] #ten-comic-launcher { border-radius: 22px; background: linear-gradient(145deg,rgba(55,164,221,.94),rgba(132,75,226,.94)); ', 'box-shadow: 0 14px 36px rgba(40,23,103,.42),0 0 27px rgba(121,113,255,.27),inset 0 1px rgba(255,255,255,.22); }\n#ten-comic-root[data-theme="expressive"] #ten-panel { border-color: rgba(174,183,255,.3); border-radius: 30px; background: radial-gradient(circle at 90% 4%,rgba(120,85,255,.22),transparent 34%),radial-gradient(circle at 8% 92%,r', 'gba(44,190,245,.15),transparent 34%),linear-gradient(155deg,rgba(31,29,79,.94),rgba(13,17,47,.96)); box-shadow: 0 30px 90px rgba(17,9,58,.55),inset 0 1px rgba(255,255,255,.07); }\n#ten-comic-root[data-theme="expressive"] .ten-header { background: rgba(27,27,72,.48); }\n#ten-comic-root[data-theme="expressive"] .ten-card,\n#ten-comic-root[data-theme="expressive"]', ' .ten-task-group { border-color: rgba(180,178,255,.2); border-radius: 21px; background: linear-gradient(145deg,rgba(69,64,128,.48),rgba(31,31,79,.48)); box-shadow: inset 0 1px rgba(255,255,255,.07),0 9px 24px rgba(13,9,50,.14); }\n#ten-comic-root[data-theme="expressive"] .ten-list-item { border-radius: 17px; background: rgba(24,27,71,.55); }\n#ten-comic-root[d', 'ata-theme="expressive"] .ten-btn { border-radius: 14px; background: linear-gradient(115deg,rgba(48,119,174,.78),rgba(107,69,190,.78),rgba(44,129,151,.74)); }\n#ten-comic-root[data-theme="expressive"] .ten-icon-btn,\n#ten-comic-root[data-theme="expressive"] .ten-task-arrow-button { border-radius: 50%; }\n#ten-comic-root[data-theme="expressive"] .ten-progress { h', 'eight: 6px; }\n#ten-comic-root[data-theme="expressive"] .ten-progress > i { background: linear-gradient(90deg,#53dffc,#7597ff,#a970ff); }\n#ten-comic-root[data-theme="expressive"] .ten-nav { background: rgba(13,17,47,.76); }\n#ten-comic-root[data-theme="expressive"] .ten-nav::before { border-radius: 19px; background: linear-gradient(145deg,rgba(72,189,239,.25),', 'rgba(147,91,239,.3)); }\n#ten-comic-root[data-theme="expressive"] #ten-search-panel { border-color: rgba(174,183,255,.28); background: linear-gradient(155deg,rgba(37,34,91,.96),rgba(15,18,51,.98)); }\n#ten-comic-root[data-theme="expressive"] .ten-chapter-tools { border-radius: 17px; background: linear-gradient(145deg,rgba(69,64,128,.9),rgba(31,31,79,.92)); }\n#', 'ten-comic-root[data-theme="expressive"] .ten-mini-task,\n#ten-comic-root[data-theme="expressive"] .ten-rule-pick-hud { border-color: rgba(174,183,255,.3); border-radius: 21px; background: linear-gradient(145deg,rgba(69,64,128,.96),rgba(25,27,72,.97)); box-shadow: 0 18px 46px rgba(17,9,58,.4),inset 0 1px rgba(255,255,255,.08); }\n#ten-comic-root[data-theme="exp', 'ressive"] .ten-rule-pick-actions button { border-color: rgba(180,178,255,.2); background: rgba(31,31,79,.5); }\n\n#ten-comic-root[data-theme="carbon"] { --ten-bg: rgba(5,8,13,.94); --ten-surface: rgba(15,20,29,.78); --ten-surface-strong: rgba(20,27,39,.9); --ten-line: rgba(85,145,190,.3); --ten-text: #edf5ff; --ten-muted: #7f8b9e; --ten-cyan: #2c9cff; --ten-bl', 'ue: #287fff; --ten-violet: #8b4cff; --ten-pink: #ff4f96; --ten-danger: #ff5d83; --ten-success: #55e5bb; }\n#ten-comic-root[data-theme="carbon"] #ten-comic-launcher { border-color: rgba(45,157,255,.72); border-radius: 15px; background: linear-gradient(145deg,#111824,#080b11); box-shadow: -4px 0 22px rgba(41,143,255,.3),4px 0 22px rgba(255,66,144,.2),inset 0 0 ', '0 1px rgba(255,255,255,.05); }\n#ten-comic-root[data-theme="carbon"] #ten-panel { border-color: rgba(49,153,230,.55); border-radius: 17px; background: linear-gradient(155deg,#111821,#070a0f 76%); box-shadow: -2px 0 25px rgba(37,137,238,.22),2px 0 25px rgba(255,57,139,.15),0 30px 80px rgba(0,0,0,.58),inset -1px 0 rgba(255,65,143,.45),inset ', '1px 0 rgba(45,157,255,.55); }\n#ten-comic-root[data-theme="carbon"] #ten-panel::before { opacity: .45; background: linear-gradient(90deg,rgba(41,148,255,.08),transparent 24%,transparent 76%,rgba(255,64,145,.07)); }\n#ten-comic-root[data-theme="carbon"] .ten-header,\n#ten-comic-root[data-theme="carbon"] .ten-nav { background: rgba(5,8,13,.82); }\n#ten-comic-root[', 'data-theme="carbon"] .ten-card,\n#ten-comic-root[data-theme="carbon"] .ten-task-group { border-color: rgba(83,119,149,.38); border-radius: 14px; background: linear-gradient(145deg,rgba(24,31,42,.9),rgba(8,12,18,.88)); box-shadow: inset 1px 0 rgba(44,156,255,.15),inset -1px 0 rgba(255,79,150,.09),0 8px 20px rgba(0,0,0,.24); }\n#ten-comic-root[data-theme="carbon', '"] .ten-list-item { border-color: rgba(79,112,142,.34); border-radius: 11px; background: rgba(7,11,17,.77); box-shadow: inset 2px 0 rgba(44,156,255,.6); }\n#ten-comic-root[data-theme="carbon"] [data-task-group="waiting"] .ten-list-item { box-shadow: inset 2px 0 rgba(255,79,150,.56); }\n#ten-comic-root[data-theme="carbon"] .ten-btn { border-radius: 10px; backgr', 'ound: linear-gradient(110deg,rgba(23,82,133,.75),rgba(46,35,94,.72),rgba(116,27,71,.62)); }\n#ten-comic-root[data-theme="carbon"] .ten-progress > i { background: linear-gradient(90deg,#208dff,#2fa6ff,#9d4cff); box-shadow: 0 0 13px rgba(44,156,255,.48); }\n#ten-comic-root[data-theme="carbon"] .ten-nav { border-top-color: rgba(61,112,151,.38); }\n#ten-comic-root[', 'data-theme="carbon"] .ten-nav::before { border-color: rgba(40,142,255,.65); border-radius: 12px; background: rgba(16,28,43,.78); box-shadow: -4px 0 14px rgba(39,143,255,.18),4px 0 14px rgba(255,65,143,.12),inset 0 0 0 1px rgba(255,255,255,.04); }\n#ten-comic-root[data-theme="carbon"] #ten-search-panel { border-color: rgba(49,153,230,.48); background: linear-g', 'radient(155deg,#111821,#070a0f 78%); box-shadow: -2px 0 22px rgba(37,137,238,.18),2px 0 22px rgba(255,57,139,.12),0 25px 70px rgba(0,0,0,.55); }\n#ten-comic-root[data-theme="carbon"] .ten-chapter-tools { border-color: rgba(49,153,230,.4); border-radius: 11px; background: linear-gradient(145deg,rgba(24,31,42,.96),rgba(8,12,18,.96)); }\n#ten-comic-root[data-them', 'e="carbon"] .ten-mini-task,\n#ten-comic-root[data-theme="carbon"] .ten-rule-pick-hud { border-color: rgba(49,153,230,.48); border-radius: 14px; background: linear-gradient(145deg,#111821,#070a0f); box-shadow: -2px 0 18px rgba(37,137,238,.18),2px 0 18px rgba(255,57,139,.12),0 18px 46px rgba(0,0,0,.48); }\n#ten-comic-root[data-theme="carbon"] .ten-rule-pick-acti', 'ons button { border-color: rgba(83,119,149,.38); background: rgba(7,11,17,.78); }\n\n#ten-comic-root[data-theme="ink"] { --ten-bg: rgba(24,20,15,.94); --ten-surface: rgba(38,32,24,.78); --ten-surface-strong: rgba(47,39,29,.9); --ten-line: rgba(206,178,125,.24); --ten-text: #f1e2c5; --ten-muted: #a6977c; --ten-cyan: #83a875; --ten-blue: #668c6f; --ten-violet: #', 'a18558; --ten-pink: #d06a52; --ten-danger: #e16d53; --ten-success: #91b67b; font-family: "Noto Serif SC","Songti SC","Microsoft YaHei",serif; }\n#ten-comic-root[data-theme="ink"] #ten-comic-launcher { color: #f0d6a6; border-color: rgba(194,151,82,.48); border-radius: 17px; background: linear-gradient(145deg,rgba(48,48,31,.96),rgba(24,22,17,.96)); box-shadow: ', '0 12px 30px rgba(20,12,5,.4),inset 0 1px rgba(255,232,192,.08); }\n#ten-comic-root[data-theme="ink"] #ten-panel { border-color: rgba(203,171,112,.3); border-radius: 24px; background: radial-gradient(circle at 12% 88%,rgba(68,94,59,.13),transparent 27%),linear-gradient(155deg,#2b261d,#15130f 76%); box-shadow: 0 30px 88px rgba(15,9,4,.62),in', 'set 0 1px rgba(255,238,207,.05); }\n#ten-comic-root[data-theme="ink"] #ten-panel::before { opacity: .45; background: radial-gradient(circle at 88% 4%,rgba(173,128,67,.12),transparent 28%),radial-gradient(circle at 2% 92%,rgba(67,104,64,.12),transparent 30%); }\n#ten-comic-root[data-theme="ink"] .ten-header,\n#ten-comic-root[data-theme="ink"] .ten-nav { backgrou', 'nd: rgba(20,17,13,.72); }\n#ten-comic-root[data-theme="ink"] .ten-card,\n#ten-comic-root[data-theme="ink"] .ten-task-group { border-color: rgba(202,174,123,.2); border-radius: 19px; background: linear-gradient(145deg,rgba(50,43,33,.72),rgba(25,22,17,.72)); box-shadow: inset 0 1px rgba(255,231,191,.04),0 8px 22px rgba(12,8,4,.18); }\n#ten-comic-root[data-theme="', 'ink"] .ten-list-item { border-color: rgba(195,169,119,.18); border-radius: 14px; background: rgba(17,16,12,.68); }\n#ten-comic-root[data-theme="ink"] .ten-btn { color: #f1dfbd; border-color: rgba(190,151,87,.24); border-radius: 12px; background: linear-gradient(110deg,rgba(72,73,45,.72),rgba(85,58,34,.68)); }\n#ten-comic-root[data-theme="ink"] .ten-progress > ', 'i { background: linear-gradient(90deg,#668d64,#90ad75,#c29455); box-shadow: 0 0 10px rgba(135,170,106,.25); }\n#ten-comic-root[data-theme="ink"] .ten-task-state.is-completed { color: #9fbe82; }\n#ten-comic-root[data-theme="ink"] .ten-nav::before { border-color: rgba(193,154,91,.3); border-radius: 15px; background: rgba(89,66,38,.4); box-shadow: inset 0 1px rgb', 'a(255,232,190,.05); }\n#ten-comic-root[data-theme="ink"] #ten-particle-field { opacity: .22; filter: sepia(1) hue-rotate(45deg); }\n#ten-comic-root[data-theme="ink"] #ten-search-panel { color: #f1e2c5; border-color: rgba(203,171,112,.28); background: linear-gradient(155deg,#2b261d,#15130f 78%); }\n#ten-comic-root[data-theme="ink"] .ten-chapter-tools { border-co', 'lor: rgba(202,174,123,.2); border-radius: 15px; background: linear-gradient(145deg,rgba(50,43,33,.94),rgba(25,22,17,.94)); }\n#ten-comic-root[data-theme="ink"] .ten-mini-task,\n#ten-comic-root[data-theme="ink"] .ten-rule-pick-hud { border-color: rgba(203,171,112,.28); border-radius: 18px; background: linear-gradient(145deg,rgba(50,43,33,.97),rgba(25,22,17,.98)', '); box-shadow: 0 18px 46px rgba(15,9,4,.48),inset 0 1px rgba(255,238,207,.05); }\n#ten-comic-root[data-theme="ink"] .ten-rule-pick-actions button { border-color: rgba(195,169,119,.2); background: rgba(17,16,12,.68); }\n\n#ten-comic-root[data-theme="glass"] { --ten-panel-bg:linear-gradient(150deg,rgba(20,42,67,.68),rgba(9,18,36,.78)); --ten-panel-border:rgba(133', ",233,255,.28); --ten-panel-shadow:0 30px 90px rgba(0,5,15,.5),0 0 0 1px rgba(255,255,255,.05) inset,0 0 42px rgba(91,140,255,.12); --ten-header-bg:rgba(4,12,25,.48); --ten-card-bg:rgba(23,38,62,.55); --ten-card-border:rgba(137,225,255,.2); --ten-card-shadow:inset 0 1px rgba(255,255,255,.06); --ten-task-bg:rgba(10,25,46,.52); --ten-list-bg:rgba(23,38,62,.46);", " --ten-list-hover-bg:rgba(36,61,91,.6); --ten-control-bg:linear-gradient(110deg,rgba(39,68,101,.72),rgba(80,47,123,.65),rgba(31,92,112,.72)); --ten-control-hover-bg:rgba(95,246,255,.09); --ten-control-border:rgba(111,220,255,.2); --ten-primary-bg:linear-gradient(110deg,#5ff6ff,#7fb1ff,#c078ff,#5ff6ff); --ten-primary-text:#04131c; --ten-primary-border:rgba(16", "0,255,255,.72); --ten-danger-bg:rgba(255,97,116,.12); --ten-danger-text:#ffdfe5; --ten-danger-border:rgba(255,97,116,.3); --ten-input-bg:rgba(2,10,22,.42); --ten-popover-bg:linear-gradient(150deg,rgba(28,51,75,.98),rgba(10,22,40,.98)); --ten-empty-bg:rgba(11,27,49,.38); --ten-info-bg:rgba(2,10,22,.25); --ten-mini-bg:linear-gradient(145deg,rgba(28,51,75,.94),", "rgba(20,28,52,.95)); --ten-overlay-bg:rgba(2,8,19,.62); --ten-tooltip-bg:rgba(5,15,29,.97); --ten-tooltip-text:#eefaff; --ten-tooltip-border:rgba(95,246,255,.28); --ten-tooltip-shadow:0 10px 28px rgba(0,5,15,.38),inset 0 1px rgba(255,255,255,.08); --ten-focus-ring:0 0 0 3px rgba(95,246,255,.1); --ten-scroll-thumb:rgba(95,246,255,.3); --ten-radius-panel:24px;", ' --ten-radius-card:15px; --ten-radius-control:11px; }\n#ten-comic-root[data-theme="mist"] { --ten-panel-bg:radial-gradient(circle at 90% 2%,rgba(151,129,232,.17),transparent 31%),radial-gradient(circle at 2% 88%,rgba(66,177,218,.14),transparent 32%),linear-gradient(155deg,rgba(244,250,255,.78),rgba(224,236,248,.7)); --ten-panel-border:rgba(255,255,255,.86); -', "-ten-panel-shadow:0 30px 86px rgba(43,73,99,.24),inset 0 1px rgba(255,255,255,.96); --ten-header-bg:rgba(248,252,255,.58); --ten-card-bg:linear-gradient(145deg,rgba(255,255,255,.58),rgba(224,237,247,.42)); --ten-card-border:rgba(255,255,255,.76); --ten-card-shadow:0 10px 25px rgba(54,88,112,.1),inset 0 1px rgba(255,255,255,.88); --ten-task-bg:linear-gradient", "(145deg,rgba(255,255,255,.58),rgba(224,237,247,.42)); --ten-list-bg:rgba(255,255,255,.46); --ten-list-hover-bg:rgba(255,255,255,.68); --ten-control-bg:linear-gradient(115deg,rgba(208,235,248,.86),rgba(228,220,249,.8),rgba(213,240,242,.82)); --ten-control-hover-bg:rgba(225,244,252,.8); --ten-control-border:rgba(77,126,174,.2); --ten-primary-bg:linear-gradient", "(115deg,#8de7ef,#9bbdf4,#c5b3ef); --ten-primary-text:#183247; --ten-primary-border:rgba(22,142,175,.3); --ten-danger-bg:rgba(255,232,239,.72); --ten-danger-text:#a53e5c; --ten-danger-border:rgba(206,79,109,.24); --ten-input-bg:rgba(255,255,255,.45); --ten-popover-bg:linear-gradient(145deg,rgba(250,253,255,.97),rgba(226,237,247,.97)); --ten-empty-bg:linear-gr", "adient(145deg,rgba(255,255,255,.62),rgba(222,237,247,.48)); --ten-info-bg:rgba(255,255,255,.5); --ten-mini-bg:linear-gradient(145deg,rgba(250,253,255,.94),rgba(222,237,248,.92)); --ten-overlay-bg:rgba(34,48,60,.36); --ten-tooltip-bg:rgba(250,253,255,.98); --ten-tooltip-text:#183247; --ten-tooltip-border:rgba(77,126,174,.24); --ten-tooltip-shadow:0 10px 28px ", 'rgba(43,73,99,.2),inset 0 1px rgba(255,255,255,.92); --ten-focus-ring:0 0 0 3px rgba(22,142,175,.12); --ten-scroll-thumb:rgba(22,142,175,.28); --ten-radius-panel:27px; --ten-radius-card:18px; --ten-radius-control:13px; }\n#ten-comic-root[data-theme="porcelain"] { --ten-panel-bg:#f5f1e9; --ten-panel-border:#d6cfc4; --ten-panel-shadow:0 28px 72px rgba(55,48,40,', ".24),inset 0 1px #fff; --ten-header-bg:#f0ebe2; --ten-card-bg:#fffdf9; --ten-card-border:#ddd6ca; --ten-card-shadow:0 7px 18px rgba(65,55,43,.08),inset 0 1px #fff; --ten-task-bg:#fffdf9; --ten-list-bg:#faf7f1; --ten-list-hover-bg:#f5f8fa; --ten-control-bg:#eee8de; --ten-control-hover-bg:#e8eff4; --ten-control-border:#d2c8bb; --ten-primary-bg:#315f88; --ten-p", "rimary-text:#f7fbff; --ten-primary-border:#315f88; --ten-danger-bg:#fae9e5; --ten-danger-text:#9c403b; --ten-danger-border:#dfb8b1; --ten-input-bg:#fffdf9; --ten-popover-bg:#fffdf9; --ten-empty-bg:#fffdf9; --ten-info-bg:#faf7f1; --ten-mini-bg:#fffdf9; --ten-overlay-bg:rgba(55,48,40,.28); --ten-tooltip-bg:#fffdf9; --ten-tooltip-text:#28323b; --ten-tooltip-bor", 'der:#d8d0c4; --ten-tooltip-shadow:0 10px 26px rgba(65,55,43,.18),inset 0 1px #fff; --ten-focus-ring:0 0 0 3px rgba(49,95,136,.1); --ten-scroll-thumb:rgba(49,95,136,.25); --ten-radius-panel:20px; --ten-radius-card:13px; --ten-radius-control:9px; }\n#ten-comic-root[data-theme="expressive"] { --ten-panel-bg:radial-gradient(circle at 90% 4%,rgba(120,85,255,.22),t', "ransparent 34%),radial-gradient(circle at 8% 92%,rgba(44,190,245,.15),transparent 34%),linear-gradient(155deg,rgba(31,29,79,.94),rgba(13,17,47,.96)); --ten-panel-border:rgba(174,183,255,.3); --ten-panel-shadow:0 30px 90px rgba(17,9,58,.55),inset 0 1px rgba(255,255,255,.07); --ten-header-bg:rgba(27,27,72,.58); --ten-card-bg:linear-gradient(145deg,rgba(69,64,1", "28,.48),rgba(31,31,79,.48)); --ten-card-border:rgba(180,178,255,.2); --ten-card-shadow:inset 0 1px rgba(255,255,255,.07),0 9px 24px rgba(13,9,50,.14); --ten-task-bg:linear-gradient(145deg,rgba(69,64,128,.48),rgba(31,31,79,.48)); --ten-list-bg:rgba(24,27,71,.55); --ten-list-hover-bg:rgba(56,52,112,.62); --ten-control-bg:linear-gradient(115deg,rgba(48,119,174,", ".78),rgba(107,69,190,.78),rgba(44,129,151,.74)); --ten-control-hover-bg:rgba(97,221,255,.1); --ten-control-border:rgba(178,173,255,.24); --ten-primary-bg:linear-gradient(115deg,#61ddff,#7c98ff,#aa71ff); --ten-primary-text:#16152f; --ten-primary-border:rgba(174,183,255,.45); --ten-danger-bg:rgba(255,117,199,.12); --ten-danger-text:#ffdff3; --ten-danger-border", ":rgba(255,117,199,.3); --ten-input-bg:rgba(19,22,63,.52); --ten-popover-bg:linear-gradient(155deg,rgba(69,64,128,.98),rgba(20,22,61,.98)); --ten-empty-bg:rgba(31,31,79,.46); --ten-info-bg:rgba(20,23,64,.48); --ten-mini-bg:linear-gradient(145deg,rgba(69,64,128,.96),rgba(25,27,72,.97)); --ten-overlay-bg:rgba(13,10,45,.64); --ten-tooltip-bg:rgba(25,23,68,.98); ", '--ten-tooltip-text:#f7f4ff; --ten-tooltip-border:rgba(174,183,255,.3); --ten-tooltip-shadow:0 12px 30px rgba(17,9,58,.42),inset 0 1px rgba(255,255,255,.08); --ten-focus-ring:0 0 0 3px rgba(97,221,255,.11); --ten-scroll-thumb:rgba(97,221,255,.28); --ten-radius-panel:30px; --ten-radius-card:21px; --ten-radius-control:14px; }\n#ten-comic-root[data-theme="carbon"', "] { --ten-panel-bg:linear-gradient(155deg,#111821,#070a0f 76%); --ten-panel-border:rgba(49,153,230,.55); --ten-panel-shadow:-2px 0 25px rgba(37,137,238,.22),2px 0 25px rgba(255,57,139,.15),0 30px 80px rgba(0,0,0,.58),inset -1px 0 rgba(255,65,143,.45),inset 1px 0 rgba(45,157,255,.55); --ten-header-bg:rgba(5,8,13,.82); --ten-card-bg:linear-gradient(145deg,rgba", "(24,31,42,.9),rgba(8,12,18,.88)); --ten-card-border:rgba(83,119,149,.38); --ten-card-shadow:inset 1px 0 rgba(44,156,255,.15),inset -1px 0 rgba(255,79,150,.09),0 8px 20px rgba(0,0,0,.24); --ten-task-bg:linear-gradient(145deg,rgba(24,31,42,.9),rgba(8,12,18,.88)); --ten-list-bg:rgba(7,11,17,.77); --ten-list-hover-bg:rgba(15,25,37,.88); --ten-control-bg:linear-g", "radient(110deg,rgba(23,82,133,.75),rgba(46,35,94,.72),rgba(116,27,71,.62)); --ten-control-hover-bg:rgba(44,156,255,.1); --ten-control-border:rgba(85,145,190,.3); --ten-primary-bg:linear-gradient(110deg,#208dff,#9d4cff,#ff4f96); --ten-primary-text:#f6fbff; --ten-primary-border:rgba(44,156,255,.55); --ten-danger-bg:rgba(255,79,150,.12); --ten-danger-text:#ffdd", "ea; --ten-danger-border:rgba(255,79,150,.3); --ten-input-bg:rgba(4,8,13,.8); --ten-popover-bg:linear-gradient(155deg,#111821,#070a0f); --ten-empty-bg:rgba(8,13,20,.78); --ten-info-bg:rgba(7,11,17,.8); --ten-mini-bg:linear-gradient(145deg,#111821,#070a0f); --ten-overlay-bg:rgba(0,0,0,.7); --ten-tooltip-bg:#070a0f; --ten-tooltip-text:#edf5ff; --ten-tooltip-bor", 'der:rgba(49,153,230,.48); --ten-tooltip-shadow:-2px 0 14px rgba(37,137,238,.18),2px 0 14px rgba(255,57,139,.12),0 12px 28px rgba(0,0,0,.48); --ten-focus-ring:0 0 0 3px rgba(44,156,255,.1); --ten-scroll-thumb:rgba(44,156,255,.32); --ten-radius-panel:17px; --ten-radius-card:14px; --ten-radius-control:10px; }\n#ten-comic-root[data-theme="ink"] { --ten-panel-bg:r', "adial-gradient(circle at 12% 88%,rgba(68,94,59,.13),transparent 27%),linear-gradient(155deg,#2b261d,#15130f 76%); --ten-panel-border:rgba(203,171,112,.3); --ten-panel-shadow:0 30px 88px rgba(15,9,4,.62),inset 0 1px rgba(255,238,207,.05); --ten-header-bg:rgba(20,17,13,.72); --ten-card-bg:linear-gradient(145deg,rgba(50,43,33,.72),rgba(25,22,17,.72)); --ten-car", "d-border:rgba(202,174,123,.2); --ten-card-shadow:inset 0 1px rgba(255,231,191,.04),0 8px 22px rgba(12,8,4,.18); --ten-task-bg:linear-gradient(145deg,rgba(50,43,33,.72),rgba(25,22,17,.72)); --ten-list-bg:rgba(17,16,12,.68); --ten-list-hover-bg:rgba(50,43,33,.82); --ten-control-bg:linear-gradient(110deg,rgba(72,73,45,.72),rgba(85,58,34,.68)); --ten-control-hov", "er-bg:rgba(131,168,117,.1); --ten-control-border:rgba(190,151,87,.24); --ten-primary-bg:linear-gradient(110deg,#83a875,#a18558); --ten-primary-text:#17140f; --ten-primary-border:rgba(194,151,82,.42); --ten-danger-bg:rgba(208,106,82,.12); --ten-danger-text:#f3c9b8; --ten-danger-border:rgba(208,106,82,.3); --ten-input-bg:rgba(17,15,11,.64); --ten-popover-bg:li", "near-gradient(155deg,rgba(50,43,33,.98),rgba(22,19,14,.99)); --ten-empty-bg:rgba(31,27,20,.68); --ten-info-bg:rgba(17,15,11,.55); --ten-mini-bg:linear-gradient(145deg,rgba(50,43,33,.97),rgba(25,22,17,.98)); --ten-overlay-bg:rgba(15,9,4,.68); --ten-tooltip-bg:rgba(28,24,18,.98); --ten-tooltip-text:#f1e2c5; --ten-tooltip-border:rgba(203,171,112,.28); --ten-too", 'ltip-shadow:0 12px 28px rgba(15,9,4,.48),inset 0 1px rgba(255,238,207,.05); --ten-focus-ring:0 0 0 3px rgba(131,168,117,.1); --ten-scroll-thumb:rgba(161,133,88,.32); --ten-radius-panel:24px; --ten-radius-card:19px; --ten-radius-control:12px; }\n\n#ten-comic-root[data-theme="glass"] { --ten-toast-bg:rgba(5,15,29,.94); --ten-toast-text:#eefaff; --ten-toast-borde', 'r:rgba(95,246,255,.3); --ten-launcher-bg:linear-gradient(145deg,rgba(28,72,108,.88),rgba(91,54,148,.86)); --ten-launcher-border:rgba(111,236,255,.48); --ten-launcher-shadow:0 12px 34px rgba(4,14,30,.3),0 0 25px rgba(95,246,255,.2),inset 0 1px rgba(255,255,255,.18); --ten-radius-launcher:18px; }\n#ten-comic-root[data-theme="mist"] { --ten-toast-bg:rgba(250,253', ",255,.98); --ten-toast-text:#183247; --ten-toast-border:rgba(77,126,174,.24); --ten-launcher-bg:linear-gradient(145deg,rgba(255,255,255,.82),rgba(219,237,250,.68)); --ten-launcher-border:rgba(255,255,255,.84); --ten-launcher-shadow:0 14px 38px rgba(49,91,123,.2),0 0 24px rgba(86,168,213,.16),inset 0 1px rgba(255,255,255,.96); --ten-radius-launcher:20px; }\n#t", 'en-comic-root[data-theme="porcelain"] { --ten-toast-bg:#fffdf9; --ten-toast-text:#28323b; --ten-toast-border:#d8d0c4; --ten-launcher-bg:#fffdf8; --ten-launcher-border:#d9d1c4; --ten-launcher-shadow:0 11px 28px rgba(62,54,44,.18),inset 0 1px #fff; --ten-radius-launcher:15px; }\n#ten-comic-root[data-theme="expressive"] { --ten-toast-bg:rgba(25,23,68,.98); --ten', "-toast-text:#f7f4ff; --ten-toast-border:rgba(174,183,255,.3); --ten-launcher-bg:linear-gradient(145deg,rgba(55,164,221,.94),rgba(132,75,226,.94)); --ten-launcher-border:rgba(174,183,255,.34); --ten-launcher-shadow:0 14px 36px rgba(40,23,103,.42),0 0 27px rgba(121,113,255,.27),inset 0 1px rgba(255,255,255,.22); --ten-radius-launcher:22px; }\n#ten-comic-root[da", 'ta-theme="carbon"] { --ten-toast-bg:#070a0f; --ten-toast-text:#edf5ff; --ten-toast-border:rgba(49,153,230,.48); --ten-launcher-bg:linear-gradient(145deg,#111824,#080b11); --ten-launcher-border:rgba(45,157,255,.72); --ten-launcher-shadow:-4px 0 22px rgba(41,143,255,.3),4px 0 22px rgba(255,66,144,.2),inset 0 0 0 1px rgba(255,255,255,.05); --ten-radius-launcher', ':15px; }\n#ten-comic-root[data-theme="ink"] { --ten-toast-bg:rgba(28,24,18,.98); --ten-toast-text:#f1e2c5; --ten-toast-border:rgba(203,171,112,.28); --ten-launcher-bg:linear-gradient(145deg,rgba(48,48,31,.96),rgba(24,22,17,.96)); --ten-launcher-border:rgba(194,151,82,.48); --ten-launcher-shadow:0 12px 30px rgba(20,12,5,.4),inset 0 1px rgba(255,232,192,.08); -', "-ten-radius-launcher:17px; }\n\n#ten-comic-root[data-theme] #ten-panel,\n#ten-comic-root[data-theme] #ten-search-panel { border-color:var(--ten-panel-border); border-radius:var(--ten-radius-panel); background:var(--ten-panel-bg); box-shadow:var(--ten-panel-shadow); }\n#ten-comic-root[data-theme] .ten-header,\n#ten-comic-root[data-theme] .ten-n", "av,\n#ten-comic-root[data-theme] .ten-search-panel-header { background:var(--ten-header-bg); }\n#ten-comic-root[data-theme] .ten-card { border-color:var(--ten-card-border); border-radius:var(--ten-radius-card); background:var(--ten-card-bg); box-shadow:var(--ten-card-shadow); }\n#ten-comic-root[data-theme] .ten-task-group { border-color:var(--ten-card-border); ", "border-radius:var(--ten-radius-card); background:var(--ten-task-bg); box-shadow:var(--ten-card-shadow); }\n#ten-comic-root[data-theme] .ten-list-item,\n#ten-comic-root[data-theme] .ten-status,\n#ten-comic-root[data-theme] .ten-chapter-list-head { background:var(--ten-list-bg); }\n#ten-comic-root[data-theme] .ten-list-item:hover { background:var(--ten-list-hover-", "bg); }\n#ten-comic-root[data-theme] .ten-btn:not(.is-primary):not(.is-danger) { color:var(--ten-text); border-color:var(--ten-control-border); border-radius:var(--ten-radius-control); background:var(--ten-control-bg); }\n#ten-comic-root[data-theme] .ten-btn.is-primary { color:var(--ten-primary-text); border-color:var(--ten-primary-border); background:var(--ten", "-primary-bg); }\n#ten-comic-root[data-theme] .ten-btn.is-danger { color:var(--ten-danger-text); border-color:var(--ten-danger-border); background:var(--ten-danger-bg); }\n#ten-comic-root[data-theme] .ten-input,\n#ten-comic-root[data-theme] .ten-select,\n#ten-comic-root[data-theme] .ten-textarea,\n#ten-comic-root[data-theme] .ten-setting-select > button { backgrou", "nd:var(--ten-input-bg); }\n#ten-comic-root[data-theme] .ten-setting-select-menu,\n#ten-comic-root[data-theme] .ten-search-site-menu,\n#ten-comic-root[data-theme] .ten-confirm-dialog,\n#ten-comic-root[data-theme] .ten-diagnostic-dialog { color:var(--ten-text); border-color:var(--ten-panel-border); background:var(--ten-popover-bg); box-shadow:var(--ten-tooltip-sha", "dow); }\n#ten-comic-root[data-theme] .ten-chapter-empty { border-color:var(--ten-card-border); background:var(--ten-empty-bg); box-shadow:var(--ten-card-shadow); }\n#ten-comic-root[data-theme] .ten-comic-info { border-color:var(--ten-card-border); background:var(--ten-info-bg); }\n#ten-comic-root[data-theme] .ten-mini-task,\n#ten-comic-root[data-theme] .ten-rule", "-pick-hud { color:var(--ten-text); border-color:var(--ten-panel-border); border-radius:var(--ten-radius-card); background:var(--ten-mini-bg); box-shadow:var(--ten-tooltip-shadow); }\n#ten-comic-root[data-theme] .ten-rule-intro { border-color:var(--ten-card-border); border-radius:var(--ten-radius-control); background:var(--ten-list-bg); }\n#ten-comic-root[data-", "theme] .ten-rule-advanced,\n#ten-comic-root[data-theme] .ten-rule-pick-actions button { color:var(--ten-text); border-color:var(--ten-control-border); border-radius:var(--ten-radius-control); background:var(--ten-input-bg); }\n#ten-comic-root[data-theme] .ten-icon-tooltip { color:var(--ten-tooltip-text); border-color:var(--ten-tooltip-border); background:var(-", "-ten-tooltip-bg); box-shadow:var(--ten-tooltip-shadow); }\n#ten-comic-root[data-theme] .ten-toast { color:var(--ten-toast-text); border-color:var(--ten-toast-border); background:var(--ten-toast-bg); box-shadow:var(--ten-tooltip-shadow); }\n#ten-comic-root[data-theme] #ten-comic-launcher { border-color:var(--ten-launcher-border); border-radius:var(--ten-radius-", 'launcher); background:var(--ten-launcher-bg); box-shadow:var(--ten-launcher-shadow); }\n\n#ten-comic-root[data-shape="sharp"] { --ten-radius-panel: 14px; --ten-radius-card: 10px; --ten-radius-control: 7px; --ten-radius-launcher: 10px; }\n#ten-comic-root[data-shape="round"] { --ten-radius-panel: 30px; --ten-radius-card: 22px; --te', 'n-radius-control: 15px; --ten-radius-launcher: 22px; }\n#ten-comic-root[data-density="compact"] #ten-panel { grid-template-rows: 52px minmax(0,1fr) 58px; }\n#ten-comic-root[data-density="compact"] .ten-view { padding: 9px; }\n#ten-comic-root[data-density="compact"] .ten-card { margin-bottom: 6px; padding: 9px; }\n#ten-comic-root[data-density="compact"] .ten-list', ' { gap: 5px; }\n#ten-comic-root[data-density="compact"] .ten-list-item { min-height: 38px; padding: 7px 9px; }\n#ten-comic-root[data-density="comfortable"] .ten-view { padding: 16px; }\n#ten-comic-root[data-density="comfortable"] .ten-card { margin-bottom: 12px; padding: 13px; }\n#ten-comic-root[data-density="comfortable"] .ten-list { gap: 9px; }\n#ten-comic-root', '[data-density="comfortable"] .ten-list-item { min-height: 47px; padding: 11px 13px; }\n#ten-comic-root[data-motion="calm"] #ten-panel { transition-duration: .25s; }\n#ten-comic-root[data-motion="calm"] .ten-task-body { transition-duration: .32s; }\n#ten-comic-root[data-motion="spring"] #ten-panel { transition-timing-function: cubic-bezier(.16,1.35,.3,1); }\n#ten', '-comic-root[data-motion="spring"] .ten-task-body { transition-timing-function: cubic-bezier(.16,1.25,.3,1); }\n\n@media (max-width: 380px) {\n  .ten-theme-presets { grid-template-columns: 1fr; }\n}\n'].join(""), (document.head || document.documentElement).appendChild(e);
    }(), (0, siteRules.HL)(window.location.href);
    const t = document.createElement("div");
    t.id = ROOT_ID, t.innerHTML = [['<svg width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true">\n    <symbol id="ten-i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18"/></symbol>\n    <symbol id="ten-i-layers" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5', ' 9-5"/></symbol>\n    <symbol id="ten-i-download" viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></symbol>\n    <symbol id="ten-i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 ', "8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.3", '8.37.72.6 1 .3.35.7.5 1.1.5h.1v4h-.1c-.42 0-.8.15-1.1.5-.23.28-.44.62-.6 1Z"/></symbol>\n    <symbol id="ten-i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>\n    <symbol id="ten-i-github" viewBox="0 0 24 24"><path d="M12 2.8a9.2 9.2 0 0 0-2.9 17.93c.46.08.63-.2.63-.45v-1.78c-2.57.56-3.11-1.09-3.11-1.09-.42-1.07-1.03-1.35-1.03-1.35-.84-.57.06-.56.06-.56.93.07 1.42.95 1.42.95.83 1.42 2.17 1.01 2.7.77.08-.6.32-1.01.59-1.25-2.05-.23-4.21-1.03-4.21-4.56 0-1.01.36-1.84.95-2.49-.1-.23-.41-1.18.09-2.46 0 0 .77-.25 2.53.95A8.8 8.8 0 0 1 12 6.7c.78 0 1.57.1 2.3.31 1.76-1.2 2.53-.95 2.53-.95.5 1.28.19 2.23.09 2.46.59.65.95 1.48.95 2.49 0 3.54-2.16 4.32-4.22 4.55.33.29.63.85.63 1.71v2.54c0 .25.17.54.64.45A9.2 9.2 0 0 0 12 2.8Z"/></symbol>\n    <symbol id="ten-i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></symbol>\n    <symbol id="ten-i-refresh" viewBox="0 0 24 24"><path d', '="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8A8 8 0 0 1 20 12M17.9 16A8 8 0 0 1 4 12"/></symbol>\n    <symbol id="ten-i-sliders" viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></symbol>\n    <symbol id="ten-i-sort" viewBox="0 0 24 24"><path d="M8 ', '6h12M8 12h9M8 18h6M4 4v16m0 0-2.5-2.5M4 20l2.5-2.5"/></symbol>\n    <symbol id="ten-i-edit" viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4ZM13.5 6.5l4 4"/></symbol>\n    <symbol id="ten-i-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></symbol>\n    <symbol id="ten-i-pause" viewBox="0 0 24 24"><path d="M8 5v14M16 ', '5v14"/></symbol>\n    <symbol id="ten-i-play" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></symbol>\n    <symbol id="ten-i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></symbol>\n    <symbol id="ten-i-up" viewBox="0 0 24 24"><path d="m6 14 6-6 6 6"/></symbol>\n    <symbol id="ten-i-down" viewBox="0 0 24 24"><path d="', 'm6 10 6 6 6-6"/></symbol>\n    <symbol id="ten-i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></symbol>\n    <symbol id="ten-i-backup" viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5V4Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></symbol>\n    <symbol id="ten-i-guide" viewBo', 'x="0 0 24 24"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"/><path d="m17 7 .5 1.2L19 9l-1.5.8L17 11l-.5-1.2L15 9l1.5-.8L17 7Z"/></symbol>\n    <symbol id="ten-i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 1', '9v3M2 12h3M19 12h3"/></symbol>\n  </svg>'].join(""), `<button id="${LAUNCHER_ID}" class="is-hidden" type="button" aria-label="打开 10漫画" title="打开 10漫画"><span>10漫</span></button>`, `<div id="ten-mini-task" class="ten-mini-task is-hidden" aria-hidden="true"><button id="ten-mini-open" class="ten-mini-open" type="button" aria-label="打开下载任务"><span class="ten-mini-icon">${icon("download")}</span><span class="ten-mini-copy"><strong id="ten-mini-title">正在下载</strong><small id="ten-mini-meta">准备任务</small><span class="ten-mini-progress"><i id="ten-mini-progress"></i></span></span></button><button id="ten-mini-toggle" class="ten-mini-toggle" type="button" aria-label="全部暂停" title="全部暂停">${icon("pause")}</button></div>`, `<div id="ten-rule-pick-layer" class="ten-rule-pick-layer is-hidden" aria-hidden="true"><div id="ten-rule-pick-box" class="ten-rule-pick-box"></div><div class="ten-rule-pick-hud"><span class="ten-rule-pick-symbol">${icon("target")}</span><span><strong id="ten-rule-pick-title">选择网页元素</strong><small id="ten-rule-pick-selector">移动鼠标并点击，Esc 取消</small></span><button id="ten-rule-pick-cancel" type="button">取消</button></div></div>`, '<div id="ten-icon-tooltip" class="ten-icon-tooltip" role="tooltip" aria-hidden="true"></div>', `<aside id="${PANEL_ID}" aria-hidden="true"><div id="ten-particle-field" aria-hidden="true"></div>`, `<header class="ten-header"><span class="ten-brand-mark">10</span><div class="ten-heading"><div id="ten-title" class="ten-title">章节选择</div><div id="ten-subtitle" class="ten-subtitle">章节管理</div></div><a id="ten-github-link" class="ten-icon-btn" href="https://github.com/JY525712/10Comic-remastered" target="_blank" rel="noopener noreferrer" aria-label="打开 GitHub 仓库" title="GitHub 仓库">${icon("github")}</a><button id="ten-close" class="ten-icon-btn" type="button" aria-label="收起面板">${icon("close")}</button></header>`, '<main class="ten-content">', `<section class="ten-view" data-view="sites">\n    <div class="ten-toolbar">\n      <div class="ten-source"><button type="button" data-source="0">内置站点</button><button type="button" data-source="1">导入规则</button></div>\n    </div>\n    <div id="ten-rule-manage" class="ten-rule-manage" hidden><span id="ten-rule-count">已导入 0 条规则</span><button id="ten-rule-clear-all" class="ten-btn is-danger is-small" type="button">清空全部</button></div>\n    <div class="ten-toolbar ten-search-toolbar"><div id="ten-search-site-picker" class="ten-search-site-picker"><button id="ten-search-site-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span id="ten-search-site-label">全部站点</span><span class="ten-picker-arrow"></span></button><div id="ten-search-site-menu" class="ten-search-site-menu" role="listbox" hidden></div></div><input id="ten-search-input" class="ten-input" placeholder="搜索漫画"><button id="ten-search-btn" class="ten-btn is-primary ten-icon-label" type="button">${icon("search")}<span>搜索</span></button></div>\n    <div id="ten-site-list" class="ten-list"></div>\n  </section>`, `<section class="ten-view" data-view="chapters">\n    <div id="ten-chapter-status" class="ten-status">正在识别当前页面…</div>\n    <div class="ten-chapter-tools">\n      <div class="ten-row ten-chapter-select-group"><button id="ten-select-all" class="ten-btn is-small" type="button" disabled>全选</button><button id="ten-clear-select" class="ten-btn is-small" type="button" disabled>取消</button></div>\n      <button id="ten-toggle-options" class="ten-btn is-small ten-icon-label" type="button">${icon("sliders")}<span>下载选项</span></button>\n      <button id="ten-download-selected" class="ten-btn is-primary is-small" type="button" disabled>下载</button>\n    </div>\n    <div id="ten-options" class="ten-card ten-options">\n      <div class="ten-card-title">下载方式</div>\n      <div class="ten-mode-grid"><button class="ten-mode" data-mode="0">直接下载</button><button class="ten-mode" data-mode="1">压缩下载</button><button class="ten-mode" data-mode="2">图片拼接</button></div>\n      <div class="ten-grid-2" style="margin-top:8px"><label class="ten-list-item"><input id="ten-add-sequence" type="checkbox"> 补充序号</label><label class="ten-list-item"><input id="ten-reverse-sequence" type="checkbox"> 序号反转</label></div>\n      <div class="ten-section-title">当前阅读章节</div>\n      <div class="ten-grid-2"><input id="ten-current-comic" class="ten-input" placeholder="漫画名"><input id="ten-current-chapter" class="ten-input" placeholder="章节名"></div>\n      <button id="ten-download-current" class="ten-btn" type="button" style="margin-top:8px;width:100%">获取并下载当前章节</button>\n    </div>\n    <div class="ten-chapter-reload"><button id="ten-reload-chapters" type="button">${icon("refresh")}<span>重载列表</span></button></div>\n    <div id="ten-chapter-empty" class="ten-chapter-empty">\n      <div class="ten-empty-orbit">${icon("layers")}</div>\n      <div class="ten-empty-title">尚未加载章节</div>\n      <div class="ten-meta">确认漫画信息后加载当前页面的章节列表</div>\n      <button id="ten-load-chapters" class="ten-btn is-primary" type="button">加载章节</button>\n      <div class="ten-comic-info"><span>网站</span><strong id="ten-info-site">未匹配</strong><span>漫画</span><strong id="ten-info-comic">------</strong></div>\n    </div>\n    <div id="ten-chapter-loaded" hidden>\n      <div class="ten-chapter-list-head"><span id="ten-chapter-count">章节列表</span><div class="ten-row"><button id="ten-reverse-list" class="ten-icon-btn" type="button" title="反向排序">${icon("sort")}</button><button id="ten-edit-list" class="ten-icon-btn" type="button" title="编辑名称">${icon("edit")}</button></div></div>\n      <div id="ten-chapter-list" class="ten-chapter-list"></div>\n    </div>\n  </section>`, [['<section class="ten-view" data-view="tasks"><div id="ten-recovery" class="ten-recovery" hidden><div><strong>发现未完成任务</strong><span id="ten-recovery-count"></span></div><div class="ten-row"><button id="ten-recovery-discard" class="ten-btn is-danger is-small" type="button">放弃</button><button id="ten-recovery-restore" class="ten-btn is-primary is-small" type="bu', 'tton">恢复</button></div></div><div class="ten-task-group" data-task-group="active"><div class="ten-task-header"><button class="ten-task-title-button" type="button" aria-expanded="false"><span>正在下载</span><span id="ten-active-count" class="ten-task-count">0</span></button><div class="ten-task-control-group"><button id="ten-toggle-all-active" class="ten-btn is-s', 'mall ten-task-bulk" type="button" hidden>全部暂停</button><button id="ten-cancel-all-active" class="ten-btn is-danger is-small ten-task-bulk" type="button" hidden>全部取消</button><button class="ten-task-arrow-button" type="button" aria-label="展开或收起正在下载" aria-expanded="false"><span class="ten-task-arrow"></span></button></div></div><div class="ten-task-body"><div id', '="ten-active-tasks" class="ten-list"></div></div></div>'].join(""), '<div class="ten-task-group" data-task-group="waiting"><div class="ten-task-header"><button class="ten-task-title-button" type="button" aria-expanded="false"><span>等待下载</span><span id="ten-waiting-count" class="ten-task-count">0</span></button><div class="ten-task-control-group"><button id="ten-remove-all-waiting" class="ten-btn is-danger is-small ten-task-bulk" type="button" hidden>全部移出</button><button class="ten-task-arrow-button" type="button" aria-label="展开或收起等待下载" aria-expanded="false"><span class="ten-task-arrow"></span></button></div></div><div class="ten-task-body"><div id="ten-waiting-tasks" class="ten-list"></div></div></div>', '<div class="ten-task-group" data-task-group="history"><div class="ten-task-header"><button class="ten-task-title-button" type="button" aria-expanded="false"><span>下载记录</span><span id="ten-history-count" class="ten-task-count">0</span></button><div class="ten-task-control-group"><button id="ten-clear-history" class="ten-icon-btn" type="button" title="清空记录">', icon("trash"), '</button><button class="ten-task-arrow-button" type="button" aria-label="展开或收起下载记录" aria-expanded="false"><span class="ten-task-arrow"></span></button></div></div><div class="ten-task-body"><div class="ten-list ten-history-wrap"><div id="ten-history-filter" class="ten-history-filter" role="group" aria-label="下载记录筛选"><button type="button" data-history-filter="all">全部</button><button type="button" data-history-filter="completed">完成</button><button type="button" data-history-filter="failed">失败</button><button type="button" data-history-filter="cancelled">取消</button></div><div id="ten-history" class="ten-list"></div></div></div></div></section>'].join(""), [`<section class="ten-view" data-view="settings"><div class="ten-card ten-settings-card"><div class="ten-card-title">主题预设</div><div class="ten-theme-presets" role="group" aria-label="主题预设">${Object.entries(THEMES).map(([e, t]) => `<button class="ten-theme-choice" data-theme-choice="${e}" type="button"><strong>${t[0]}</strong><small>${t[1]}</small></button>`).join("")}</div></div>`, appearanceAxesCard(), '<div class="ten-card ten-settings-card"><div class="ten-card-title">界面</div>', settingCheck("ten-auto-open", "随网页打开界面"), '<div class="ten-setting"><label for="ten-hotkey">快捷键（Alt +）</label><input id="ten-hotkey" class="ten-input" maxlength="1"></div><div class="ten-setting"><label for="ten-scale">界面缩放</label><div class="ten-row"><input id="ten-scale" type="range" min="75" max="125" step="1"><span id="ten-scale-value" class="ten-setting-value"></span></div></div><div class="ten-setting"><label>特效强度</label><div class="ten-effect-level" role="group" aria-label="特效强度"><button type="button" data-effect-level="0">关闭</button><button type="button" data-effect-level="1">轻量</button><button type="button" data-effect-level="2">标准</button></div></div></div>', ['<div class="ten-card ten-settings-card ten-settings-download"><div class="ten-card-title">下载</div><div class="ten-setting"><label for="ten-max-chapters">同时下载章节</label><input id="ten-max-chapters" class="ten-input" type="number" min="1" max="3"></div><div class="ten-setting"><label for="ten-concurrent-images">每章并发图片</label><input id="ten-concurrent-images" cl', 'ass="ten-input" type="number" min="1" max="5"></div><div class="ten-setting"><label for="ten-default-mode-trigger">默认方式</label><div id="ten-default-mode" class="ten-setting-select"><button id="ten-default-mode-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span id="ten-default-mode-label">直接下载</span><span class="ten-picker-arrow"></spa', 'n></button><div id="ten-default-mode-menu" class="ten-setting-select-menu" role="listbox" hidden><button type="button" data-default-mode="0"><span class="ten-mode-option-mark"></span><span><strong>直接下载</strong><small>逐张保存图片</small></span></button><button type="button" data-default-mode="1"><span class="ten-mode-option-mark"></span><span><strong>压缩下载</strong>', '<small>打包为章节 ZIP</small></span></button><button type="button" data-default-mode="2"><span class="ten-mode-option-mark"></span><span><strong>图片拼接</strong><small>输出连续长图</small></span></button></div></div></div><div class="ten-setting ten-direct-flow-setting"><label>直接下载流程</label><div class="ten-direct-flow-options" role="group" aria-label="直接下载流程"><button type="button" data-direct-flow="0"><strong>兼容流程</strong><small>GM_xmlhttpRequest → Blob → 保存；兼容性优先</small></button><button type="button" data-direct-flow="1"><strong>快速直连</strong><small>GM_download → 直接保存；失败自动回退兼容流程</small></button></div></div><div class="ten-setting ten-setting-check ten-path-sanitize-setting"><div><label for="ten-sanitize-paths">自动清理文件夹和文件名</label><small>默认开启；去除尾部空格、句点和系统禁用字符，仅影响保存路径</small></div><input id="ten-sanitize-paths" type="checkbox"></div>'].join(""), '<div class="ten-setting"><label for="ten-max-height">拼接最大高度</label><input id="ten-max-height" class="ten-input" type="number" min="10000" max="65530"></div><div class="ten-setting"><label for="ten-digits">图片序号位数</label><input id="ten-digits" class="ten-input" type="number" min="1" max="8"></div><div class="ten-setting"><label>图片下载范围</label><div class="ten-grid-2"><input id="ten-range-start" class="ten-input" type="number" min="1"><input id="ten-range-end" class="ten-input" type="number" min="-1"></div></div>', settingCheck("ten-splice-page", "网站图片连续阅读"), settingCheck("ten-notify-complete", "下载完成通知"), '<div class="ten-setting"><label for="ten-history-limit">下载记录上限</label><input id="ten-history-limit" class="ten-input" type="number" min="10" max="500"></div><div class="ten-setting"><label>本地保存目录</label><div class="ten-dir-control"><button id="ten-choose-dir" class="ten-btn is-small" type="button">选择目录</button><span id="ten-dir-name" class="ten-file-name"></span></div></div></div>', '<div id="ten-rule-editor-card" class="ten-card ten-settings-card"><div class="ten-card-head"><div class="ten-card-title">自定义规则</div><button id="ten-rule-guide-open" class="ten-rule-guide-open" type="button" aria-label="自定义站点设置方法">' + icon("guide") + ['<span>方法</span></button></div><div class="ten-rule-intro"><strong>简单填写</strong><span>普通卷轴漫画站只需填写名称、域名、章节列表和图片选择器</span></div><div class="ten-rule-fields"><div class="ten-grid-2"><label>站点名称<input id="ten-rule-name" class="ten-input" placeholder="例如：示例漫画"></label><label>域名<input id="ten-rule-domain" class="ten-input" placeholder="example.com"></label></div><d', 'iv class="ten-grid-2"><label>漫画标题选择器<input id="ten-rule-title-selector" class="ten-input" placeholder="例如：h1.title"></label><label>章节列表选择器<input id="ten-rule-chapter-selector" class="ten-input" placeholder="例如：.chapter-list"></label></div><label>章节图片选择器<input id="ten-rule-image-selector" class="ten-input" placeholder="例如：.reader img"></label><div class="ten-', 'rule-simple-hint">自动识别 src、data-src、data-original、data-url 和 srcset；相对地址会自动补全</div><details id="ten-rule-advanced" class="ten-rule-advanced"><summary>复杂站点设置 <span>翻页、隐藏页面或自定义解析</span></summary><div class="ten-rule-advanced-body"><label>站点首页<input id="ten-rule-homepage" class="ten-input" placeholder="留空时根据域名自动生成"></label><label>规则说明<input id="ten-rule-desc" c', 'lass="ten-input" placeholder="可选：使用提示或站点说明"></label><div><span class="ten-rule-label">阅读方式</span><div class="ten-rule-readtype"><button type="button" data-rule-readtype="1">卷轴阅读</button><button type="button" data-rule-readtype="0">翻页阅读</button></div></div><div class="ten-setting ten-rule-frame"><label for="ten-rule-use-frame">使用隐藏页面读取</label><input id="ten-r', 'ule-use-frame" type="checkbox"></div><label>图片解析函数<textarea id="ten-rule-getimgs" class="ten-textarea ten-rule-function" placeholder="可留空并使用上方图片选择器；复杂站点可填写原版 getImgs 函数" spellcheck="false"></textarea></label></div></details></div><div id="ten-rule-test-result" class="ten-rule-test-result" hidden></div><div class="ten-rule-actions"><button id="ten-rule-test" ', 'class="ten-btn" type="button">测试当前页面</button><button id="ten-rule-save" class="ten-btn is-primary" type="button">保存规则</button><button id="ten-rule-cancel-edit" class="ten-btn is-danger" type="button" hidden>取消编辑</button></div><details class="ten-rule-json"><summary>原版 JSON 导入 <span>兼容旧规则</span></summary><textarea id="ten-rule-text" class="ten-textarea" place', 'holder="粘贴原版站点规则数组" autocomplete="off" spellcheck="false"></textarea><button id="ten-import-rules" class="ten-btn" type="button">导入并保存</button></details></div><div class="ten-card ten-settings-card"><div class="ten-card-title">设置与规则备份</div><div class="ten-backup-actions"><button id="ten-backup-export" class="ten-btn" type="button">导出备份</button><button id="te', 'n-backup-import" class="ten-btn is-primary" type="button">导入备份</button></div><input id="ten-backup-file" type="file" accept="application/json,.json" hidden><div class="ten-settings-hint">包含界面、下载设置和自定义规则</div></div><button id="ten-reset" class="ten-btn is-danger" type="button" style="width:100%">重置全部设置</button></section>'].join("")].join(""), '</main><nav class="ten-nav" aria-label="功能导航">', navButton("sites", "globe", "站点"), navButton("chapters", "layers", "章节"), navButton("tasks", "download", "任务"), navButton("settings", "settings", "设置"), '</nav><div id="ten-toast" class="ten-toast" role="status" aria-live="polite"><span id="ten-toast-text"></span><button id="ten-toast-action" type="button" hidden>撤销</button></div>', `<div id="ten-confirm" class="ten-confirm" aria-hidden="true"><button class="ten-confirm-backdrop" type="button" data-confirm-cancel aria-label="取消"></button><div class="ten-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ten-confirm-title" aria-describedby="ten-confirm-message"><div class="ten-confirm-icon">${icon("trash")}</div><div id="ten-confirm-title" class="ten-confirm-title">确认操作</div><div id="ten-confirm-message" class="ten-confirm-message"></div><div class="ten-confirm-actions"><button id="ten-confirm-cancel" class="ten-btn" type="button" data-confirm-cancel>取消</button><button id="ten-confirm-ok" class="ten-btn is-danger" type="button">确认</button></div></div></div>`, `<div id="ten-diagnostic" class="ten-diagnostic" aria-hidden="true"><button class="ten-confirm-backdrop" type="button" data-diagnostic-close aria-label="关闭诊断"></button><div class="ten-diagnostic-dialog" role="dialog" aria-modal="true" aria-labelledby="ten-diagnostic-title"><div class="ten-diagnostic-head"><div class="ten-confirm-icon is-info">${icon("info")}</div><div><div id="ten-diagnostic-title" class="ten-confirm-title">下载诊断</div><div id="ten-diagnostic-summary" class="ten-meta"></div></div><button class="ten-icon-btn" type="button" data-diagnostic-close aria-label="关闭">${icon("close")}</button></div><pre id="ten-diagnostic-content"></pre><div class="ten-diagnostic-actions"><button id="ten-copy-failures" class="ten-btn" type="button">复制失败清单</button><button id="ten-diagnostic-copy" class="ten-btn" type="button">复制诊断信息</button><button class="ten-btn is-primary" type="button" data-diagnostic-close>完成</button></div></div></div>`, `<div id="ten-rule-guide" class="ten-diagnostic ten-rule-guide" aria-hidden="true"><button class="ten-confirm-backdrop" type="button" data-rule-guide-close aria-label="关闭方法说明"></button><div class="ten-diagnostic-dialog ten-rule-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="ten-rule-guide-title"><div class="ten-diagnostic-head"><div class="ten-confirm-icon is-info">${icon("guide")}</div><div><div id="ten-rule-guide-title" class="ten-confirm-title">自定义站点设置方法</div><div class="ten-meta">从页面选择器到保存测试</div></div><button class="ten-icon-btn" type="button" data-rule-guide-close aria-label="关闭">${icon("close")}</button></div><div class="ten-rule-guide-content"><section><h3>一、添加前准备</h3><ol><li>先打开漫画的目录页面，确保页面中能看到漫画名称和章节链接。</li><li>按 F12 打开开发者工具，使用左上角的元素选择工具点选目标内容。</li><li>优先选择稳定的 <code>id</code> 或 <code>class</code>，避免使用很长的层级路径。</li></ol></section><section><h3>二、简单填写的五个字段</h3><dl><dt>站点名称</dt><dd>仅用于脚本内显示，例如“示例漫画”。</dd><dt>域名</dt><dd>只填 <code>example.com</code>，不要填写章节路径；多个域名用逗号分隔。</dd><dt>漫画标题选择器</dt><dd>指向漫画名称，例如 <code>h1.title</code>。</dd><dt>章节列表选择器</dt><dd>指向包含章节链接的外层容器，例如 <code>.chapter-list</code>。</dd><dt>章节图片选择器</dt><dd>在阅读页中指向漫画图片，例如 <code>.reader img</code>。脚本会自动识别常见懒加载地址。</dd></dl></section><section class="ten-rule-guide-example"><h3>三、可以照着填写的示例</h3><code>站点名称：示例漫画<br>域名：example.com<br>漫画标题：h1.title<br>章节列表：.chapter-list<br>章节图片：.reader img</code></section><section><h3>四、测试与保存</h3><ol><li>在漫画目录页点击“测试当前页面”，确认标题和章节链接能被找到。</li><li>目录页找不到章节图片是正常的，图片选择器应在任意章节阅读页中验证。</li><li>点击“保存规则”，刷新目标网站后脚本入口才会按新规则启用。</li></ol></section><section><h3>五、什么时候使用复杂设置</h3><ul><li><b>翻页阅读：</b>每次只能取得部分图片，并需要下一页地址时使用。</li><li><b>隐藏页面读取：</b>图片必须等网页脚本运行后才出现时开启。</li><li><b>图片解析函数：</b>页面数据经过加密、来自接口或普通选择器无法取得时填写。</li><li><b>原版 JSON 导入：</b>用于导入已有规则数组；只导入来源可信的规则。</li></ul></section><section><h3>六、常见问题</h3><ul><li>章节为 0：检查章节选择器指向的容器内是否真的包含 <code>&lt;a&gt;</code> 链接。</li><li>图片为 0：在章节阅读页重新检查选择器，必要时开启隐藏页面读取。</li><li>下载被拒绝：通常与登录、Cookie、防盗链或网站接口更新有关，需要调整高级规则。</li></ul></section><div class="ten-rule-guide-warning">解析函数可以执行代码，请勿导入来源不明的规则。</div></div><button class="ten-btn is-primary" type="button" data-rule-guide-close>我知道了</button></div></div>`, "</aside>", `<aside id="ten-search-panel" aria-hidden="true">\n    <header class="ten-search-panel-header"><div><div class="ten-title">搜索结果</div><div id="ten-search-panel-subtitle" class="ten-subtitle">全部站点</div></div><button id="ten-search-close" class="ten-icon-btn" type="button" aria-label="关闭搜索结果">${icon("close")}</button></header>\n    <div id="ten-search-results" class="ten-search-panel-content"></div>\n  </aside>`, '<div id="ten-mobile-drawer" class="ten-mobile-drawer" aria-hidden="true"><button class="ten-mobile-drawer-backdrop" type="button" data-drawer-close aria-label="关闭抽屉"></button><section class="ten-mobile-drawer-sheet" role="dialog" aria-modal="true" aria-labelledby="ten-mobile-drawer-title"><div class="ten-mobile-drawer-handle"></div><header><div id="ten-mobile-drawer-title">下载选项</div><button type="button" class="ten-icon-btn" data-drawer-close aria-label="关闭">' + icon("close") + '</button></header><div id="ten-mobile-drawer-content"></div></section></div>'].join(""), document.body.appendChild(t), state.historyRenderKey = "", state.miniNodes = null, createParticles(), function () {
      const e = one(".ten-rule-intro");
      e && !byId("ten-rule-pick-actions") && e.insertAdjacentHTML("afterend", `<details id="ten-rule-template-library" class="ten-rule-templates"><summary>规则模板库 <span>先选类型，再点选网页元素</span></summary><div class="ten-rule-template-grid"><button type="button" data-rule-template="basic"><strong>基础卷轴</strong><small>普通图片列表</small></button><button type="button" data-rule-template="lazy"><strong>懒加载阅读</strong><small>data-src 等属性</small></button><button type="button" data-rule-template="frame"><strong>隐藏页面</strong><small>等待网页脚本渲染</small></button><button type="button" data-rule-template="paged"><strong>翻页阅读</strong><small>需要高级解析函数</small></button></div></details><div id="ten-rule-pick-actions" class="ten-rule-pick-actions" role="group" aria-label="可视化规则选择"><button type="button" data-rule-pick="title">${icon("target")}<span>选择标题</span></button><button type="button" data-rule-pick="chapters">${icon("target")}<span>选择章节</span></button><button type="button" data-rule-pick="images">${icon("target")}<span>选择图片</span></button></div>`);
    }(), byId(LAUNCHER_ID).addEventListener("click", showUI), byId("ten-mini-open").addEventListener("click", () => {
      showUI(), activateTab("tasks");
    }), byId("ten-mini-toggle").addEventListener("click", toggleMiniTasks), byId("ten-rule-pick-cancel").addEventListener("click", cancelRulePicking), all("[data-rule-pick]").forEach(e => e.addEventListener("click", () => function (e) {
      const t = RULE_PICK_CONFIG[e];
      if (!t || state.rulePicking) return;
      closeRuleGuide(), state.rulePicking = t, state.rulePickElement = null, document.documentElement.classList.add("ten-rule-picking-page"), byId(ROOT_ID).classList.add("is-rule-picking");
      const n = byId("ten-rule-pick-layer");
      n.classList.remove("is-hidden"), n.setAttribute("aria-hidden", "false"), byId("ten-rule-pick-title").textContent = `请选择${t.label}`, byId("ten-rule-pick-selector").textContent = "移动鼠标并点击，Esc 取消", document.addEventListener("pointermove", handleRulePickMove, !0), document.addEventListener("click", handleRulePickClick, !0), document.addEventListener("keydown", handleRulePickKey, !0), window.addEventListener("scroll", refreshRulePickBox, !0), window.addEventListener("resize", refreshRulePickBox, !0), syncMiniTaskBar();
    }(e.dataset.rulePick))), all("[data-rule-template]").forEach(e => e.addEventListener("click", () => function (e) {
      const t = RULE_TEMPLATES[e];
      t && (t.imageCss && (byId("ten-rule-image-selector").value = t.imageCss), byId("ten-rule-use-frame").checked = t.useFrame, setRuleReadType(t.readtype), byId("ten-rule-advanced").open = 0 === t.readtype || t.useFrame, all("[data-rule-template]").forEach(t => t.classList.toggle("is-active", t.dataset.ruleTemplate === e)), toast(0 === t.readtype ? "已应用翻页模板，请在高级设置填写图片解析函数" : `已应用${t.name}模板`));
    }(e.dataset.ruleTemplate))), byId(ROOT_ID).addEventListener("pointerover", scheduleIconTooltip), byId(ROOT_ID).addEventListener("pointerout", handleIconTooltipLeave), byId(ROOT_ID).addEventListener("focusin", showIconTooltip), byId(ROOT_ID).addEventListener("focusout", handleIconTooltipLeave), byId(ROOT_ID).addEventListener("click", hideIconTooltip), window.addEventListener("scroll", hideIconTooltip, !0), window.addEventListener("resize", hideIconTooltip), byId("ten-close").addEventListener("click", hideUI), byId("ten-toast-action").addEventListener("click", runToastUndo), all("[data-drawer-close]").forEach(e => e.addEventListener("click", closeMobileDrawer)), one("summary", byId("ten-rule-advanced")).addEventListener("click", openRuleAdvancedDrawer), all(".ten-tab").forEach(e => e.addEventListener("click", () => activateTab(e.dataset.tab))), all(".ten-source button").forEach(e => e.addEventListener("click", () => {
      state.sourceMode = Number(e.dataset.source), renderSites();
    })), byId("ten-site-list").addEventListener("click", deleteImportedRule), byId("ten-rule-clear-all").addEventListener("click", clearRules), byId("ten-search-site-trigger").addEventListener("click", toggleSearchSiteMenu), byId("ten-search-site-menu").addEventListener("click", handleSearchSiteChoice), document.addEventListener("click", closeSearchSiteMenuOnOutsideClick), byId("ten-search-btn").addEventListener("click", searchComics), byId("ten-search-close").addEventListener("click", closeSearchPanel), byId("ten-search-input").addEventListener("keydown", e => {
      "Enter" === e.key && searchComics();
    }), byId("ten-load-chapters").addEventListener("click", loadChapters), byId("ten-reload-chapters").addEventListener("click", reloadChapters), byId("ten-select-all").addEventListener("click", () => selectAllChapters(!0)), byId("ten-clear-select").addEventListener("click", () => selectAllChapters(!1)), byId("ten-reverse-list").addEventListener("click", reverseChapters), byId("ten-edit-list").addEventListener("click", toggleChapterEdit), byId("ten-toggle-options").addEventListener("click", toggleOptions), byId("ten-download-selected").addEventListener("click", downloadSelected), byId("ten-download-current").addEventListener("click", downloadCurrentChapter), all(".ten-mode").forEach(e => e.addEventListener("click", () => setDownloadMode(Number(e.dataset.mode)))), byId("ten-add-sequence").addEventListener("change", updateChapterSequence), byId("ten-reverse-sequence").addEventListener("change", updateChapterSequence), byId("ten-clear-history").addEventListener("click", clearHistory), byId("ten-toggle-all-active").addEventListener("click", toggleAllActiveTasks), byId("ten-cancel-all-active").addEventListener("click", cancelAllActiveTasks), byId("ten-remove-all-waiting").addEventListener("click", removeAllWaitingTasks), byId("ten-recovery-restore").addEventListener("click", restorePendingTasks), byId("ten-recovery-discard").addEventListener("click", discardPendingTasks), byId("ten-active-tasks").addEventListener("click", handleTaskAction), byId("ten-waiting-tasks").addEventListener("click", handleTaskAction), byId("ten-history").addEventListener("click", handleHistoryClick), byId("ten-history-filter").addEventListener("click", handleHistoryFilter), byId("ten-confirm-ok").addEventListener("click", () => closeConfirm(!0)), all("[data-confirm-cancel]").forEach(e => e.addEventListener("click", () => closeConfirm(!1))), all("[data-diagnostic-close]").forEach(e => e.addEventListener("click", closeDiagnostic)), byId("ten-rule-guide-open").addEventListener("click", openRuleGuide), all("[data-rule-guide-close]").forEach(e => e.addEventListener("click", closeRuleGuide)), byId("ten-diagnostic-copy").addEventListener("click", copyDiagnostic), byId("ten-copy-failures").addEventListener("click", () => copyFailureList(state.diagnosticItem)), all(".ten-task-title-button").forEach(e => e.addEventListener("click", () => toggleTaskGroup(e))), all(".ten-task-arrow-button").forEach(e => e.addEventListener("click", e => toggleTaskGroup(e.currentTarget))), all('.ten-setting input[type="number"]').forEach(e => {
      if (e.parentElement.classList.contains("ten-number-control")) return;
      const t = document.createElement("div");
      t.className = "ten-number-control", e.before(t), t.appendChild(e);
      const n = document.createElement("span");
      n.className = "ten-number-steps", n.innerHTML = '<button type="button" data-number-step="1" aria-label="增加数值"><i></i></button><button type="button" data-number-step="-1" aria-label="减少数值"><i></i></button>', t.appendChild(n), n.addEventListener("click", t => {
        const n = t.target.closest("[data-number-step]");
        n && (Number(n.dataset.numberStep) > 0 ? e.stepUp() : e.stepDown(), e.dispatchEvent(new Event("change", {
          bubbles: !0
        })));
      });
    }), all("[data-theme-choice]").forEach(e => e.addEventListener("click", () => setThemePreset(e.dataset.themeChoice, !0))), all("[data-appearance-axis]").forEach(e => e.addEventListener("click", () => function (e, t) {
      const n = {
        density: ["compact", "standard", "comfortable"],
        shape: ["sharp", "standard", "round"],
        motion: ["calm", "standard", "spring"]
      };
      n[e] && n[e].includes(t) && (state.settings.appearance[e] = t, applyAppearance(state.settings.appearance), (0, configModule.po)("appearanceAxes", state.settings.appearance), toast("主题外观已更新"));
    }(e.dataset.appearanceAxis, e.dataset.appearanceValue))), bindChange("ten-auto-open", e => saveLoadSetting("isShowUI", e.target.checked)), bindChange("ten-hotkey", e => {
      const t = String(e.target.value || "V").slice(-1).toUpperCase();
      e.target.value = t, state.settings.hotkey = t, saveLoadSetting("loadHotKey", t);
    }), byId("ten-scale").addEventListener("input", e => applyScale(Number(e.target.value), !1)), byId("ten-scale").addEventListener("change", e => applyScale(Number(e.target.value), !0)), all("[data-effect-level]").forEach(e => e.addEventListener("click", () => setEffectLevel(Number(e.dataset.effectLevel), !0))), bindNumber("ten-max-chapters", "maxChapterNum", 1, 3, e => {
      state.settings.maxChapters = e, syncQueueLimits();
    }), bindNumber("ten-concurrent-images", "maxPictureNum", 1, 5, e => {
      state.settings.concurrentImages = e, syncQueueLimits();
    }), byId("ten-default-mode-trigger").addEventListener("click", toggleDefaultModeMenu), byId("ten-default-mode-menu").addEventListener("click", chooseDefaultMode), all("[data-direct-flow]").forEach(e => e.addEventListener("click", () => setDirectFlow(Number(e.dataset.directFlow), !0))), document.addEventListener("click", closeDefaultModeMenuOnOutsideClick), bindNumber("ten-max-height", "maxSplicingHeight", 1e4, 65530, e => {
      state.settings.maxSplicingHeight = e;
    }), bindNumber("ten-digits", "imgIndexBitNum", 1, 8, e => {
      state.settings.digits = e;
    }), bindNumber("ten-history-limit", "historyLimit", 10, 500, e => {
      state.settings.historyLimit = e, trimHistory();
    }), bindChange("ten-range-start", saveImageRange), bindChange("ten-range-end", saveImageRange), bindChange("ten-splice-page", e => {
      state.settings.splicePage = e.target.checked, (0, configModule.po)("imgSplicingFlag", state.settings.splicePage), applyPageSplicing();
    }), bindChange("ten-notify-complete", e => {
      state.settings.notifyComplete = e.target.checked, (0, configModule.po)("downloadNotification", state.settings.notifyComplete);
    }), bindChange("ten-sanitize-paths", e => {
      state.settings.sanitizePaths = e.target.checked, (0, configModule.po)("sanitizePathNames", state.settings.sanitizePaths);
    }), byId("ten-choose-dir").addEventListener("click", chooseDirectory), all("[data-rule-readtype]").forEach(e => e.addEventListener("click", () => setRuleReadType(Number(e.dataset.ruleReadtype)))), byId("ten-rule-test").addEventListener("click", testRuleEditor), byId("ten-rule-save").addEventListener("click", saveRuleEditor), byId("ten-rule-cancel-edit").addEventListener("click", resetRuleEditor), byId("ten-import-rules").addEventListener("click", importRules), byId("ten-backup-export").addEventListener("click", exportSettingsBackup), byId("ten-backup-import").addEventListener("click", () => byId("ten-backup-file").click()), byId("ten-backup-file").addEventListener("change", importSettingsBackup), byId("ten-reset").addEventListener("click", resetSettings), byId(ROOT_ID).addEventListener("click", addRipple), applySettingsToUI(), detectComicInfo(), renderSites(), renderChapters(), renderTasks(), async function () {
      if ("function" != typeof window.showDirectoryPicker) return void (byId("ten-dir-name").textContent = "浏览器默认下载目录");
      const e = await (0, downloadUtils.oZ)();
      if (e) try {
        "granted" === (await e.queryPermission({
          mode: "readwrite"
        })) && (state.dirHandle = e, window.__tenComicDirectoryHandle = e, byId("ten-dir-name").textContent = e.name);
      } catch (e) {
        byId("ten-dir-name").textContent = "请重新选择目录";
      }
    }(), state.ready = !0, function () {
      const e = safeGet(PENDING_TASKS_KEY, []),
        t = window.location.hostname.toLowerCase();
      state.recoveryTasks = uniqueTaskSnapshots(Array.isArray(e) ? e : []).filter(e => taskHost(e) === t), renderRecoveryTasks();
    }(), activateTab(state.activeTab), state.settings.autoOpen ? showUI() : state.pendingLauncher && showLauncher();
  }
  function icon(e) {
    return `<svg class="ten-icon" aria-hidden="true"><use href="#ten-i-${e}"></use></svg>`;
  }
  function navButton(e, t, n) {
    return `<button class="ten-tab" type="button" data-tab="${e}">${icon(t)}<span>${n}</span></button>`;
  }
  function appearanceAxesCard() {
    const e = (e, t, n) => `<div class="ten-setting ten-appearance-setting"><label>${t}</label><div class="ten-appearance-axis" role="group" aria-label="${t}">${n.map(([t, n]) => `<button type="button" data-appearance-axis="${e}" data-appearance-value="${t}">${n}</button>`).join("")}</div></div>`;
    return `<div class="ten-card ten-settings-card ten-appearance-card"><div class="ten-card-title">主题外观</div>${e("density", "界面密度", [["compact", "紧凑"], ["standard", "标准"], ["comfortable", "舒适"]])}${e("shape", "圆角风格", [["sharp", "利落"], ["standard", "标准"], ["round", "圆润"]])}${e("motion", "动效节奏", [["calm", "克制"], ["standard", "标准"], ["spring", "弹性"]])}</div>`;
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
    const t = byId("ten-default-mode"),
      n = byId("ten-default-mode-menu"),
      r = n.hidden;
    n.hidden = !r, t.classList.toggle("is-open", r), byId("ten-default-mode-trigger").setAttribute("aria-expanded", String(r)), r && closeSearchSiteMenu();
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
    setThemePreset(e.themePreset, !1), applyAppearance(e.appearance), byId("ten-auto-open").checked = e.autoOpen, byId("ten-hotkey").value = e.hotkey, byId("ten-scale").value = e.scale, byId("ten-scale-value").textContent = `${e.scale}%`, byId("ten-max-chapters").value = e.maxChapters, byId("ten-concurrent-images").value = e.concurrentImages, byId("ten-max-height").value = e.maxSplicingHeight, byId("ten-digits").value = e.digits, byId("ten-history-limit").value = e.historyLimit, byId("ten-range-start").value = e.imageRange[0], byId("ten-range-end").value = e.imageRange[1], byId("ten-splice-page").checked = e.splicePage, byId("ten-notify-complete").checked = e.notifyComplete, byId("ten-sanitize-paths").checked = e.sanitizePaths;
    byId("ten-rule-text").value = "", resetRuleEditor(), applyScale(e.scale, !1), setEffectLevel(e.effectLevel, !1), setDownloadMode(e.downloadType, !1), setDirectFlow(e.directFlow, !1), applyPageSplicing();
  }
  function showUI() {
    state.ready && (state.visible = !0, byId(PANEL_ID).classList.add("is-open"), byId(PANEL_ID).setAttribute("aria-hidden", "false"), byId(LAUNCHER_ID).classList.add("is-hidden"), syncMiniTaskBar(), refreshQueueOnVisibility(), state.recoveryTasks.length && toast(`发现 ${state.recoveryTasks.length} 个未完成任务`));
  }
  function hideUI() {
    state.ready && (state.rulePicking && finishRulePicking(), state.visible = !1, byId(PANEL_ID).classList.remove("is-open"), byId(PANEL_ID).setAttribute("aria-hidden", "true"), byId(LAUNCHER_ID).classList.toggle("is-hidden", !state.launcherVisible), closeSearchPanel(), closeDefaultModeMenu(), closeDiagnostic(), closeRuleGuide(), closeMobileDrawer(), state.confirmResolve && closeConfirm(!1), syncMiniTaskBar(), refreshQueueOnVisibility());
  }
  function toggleUI() {
    return state.ready && !byId(PANEL_ID) && (state.ready = !1), state.ready ? state.visible ? (state.launcherVisible = !1, void hideUI()) : void (state.launcherVisible ? state.ready && (state.launcherVisible = !1, byId(LAUNCHER_ID).classList.add("is-hidden"), syncMiniTaskBar()) : showLauncher()) : (state.pendingLauncher = !0, void injectStyle());
  }
  function showLauncher() {
    state.ready && (state.launcherVisible = !0, state.pendingLauncher = !1, byId(LAUNCHER_ID).classList.remove("is-hidden"), syncMiniTaskBar());
  }
  function activateTab(e) {
    if (!TAB_ORDER.includes(e)) return;
    state.activeTab = e, all(".ten-view").forEach(t => t.classList.toggle("is-active", t.dataset.view === e)), all(".ten-tab").forEach(t => t.classList.toggle("is-active", t.dataset.tab === e));
    const t = TAB_ORDER.indexOf(e);
    one(".ten-nav").style.setProperty("--tab", t), byId("ten-title").textContent = TAB_TITLES[e][0], byId("ten-subtitle").textContent = TAB_TITLES[e][1], "tasks" === e && renderTasks();
  }
  function renderSites() {
    const e = (0, siteRules.eT)(),
      t = Array.isArray(e.originalInfo) ? e.originalInfo.slice() : [],
      n = Array.isArray(e.userWebInfo) ? e.userWebInfo.slice() : [],
      r = 0 === state.sourceMode ? t : n;
    one(".ten-source").style.setProperty("--source", state.sourceMode), all(".ten-source button").forEach(e => e.classList.toggle("is-active", Number(e.dataset.source) === state.sourceMode)), byId("ten-rule-manage").hidden = 0 === state.sourceMode, byId("ten-rule-count").textContent = `已导入 ${n.length} 条规则 · 可逐条删除`, function (e = []) {
      state.searchSites = (Array.isArray(e) ? e : []).map((e, t) => ({
        site: e,
        order: t
      })).sort((e, t) => Number(Boolean(t.site?.searchTemplate_1)) - Number(Boolean(e.site?.searchTemplate_1)) || e.order - t.order).map(e => e.site), state.selectedSearchIndex = -1;
      const t = state.searchSites.filter(e => e && e.searchTemplate_1).length,
        n = 0 === state.sourceMode ? "全部内置站点" : "全部导入站点";
      byId("ten-search-site-label").textContent = n, byId("ten-search-btn").disabled = 0 === t, byId("ten-search-site-menu").innerHTML = [`<button class="ten-search-site-option is-all is-selected" type="button" role="option" data-search-index="-1" ${t ? "" : "disabled"}><span>${n}</span><small>${t} 个可搜索</small></button>`, ...state.searchSites.map((e, t) => `<button class="ten-search-site-option" type="button" role="option" data-search-index="${t}" ${e.searchTemplate_1 ? "" : "disabled"}><span>${escapeHtml(e.webName)}</span><small>${e.searchTemplate_1 ? "可搜索" : "仅浏览"}</small></button>`)].join(""), closeSearchSiteMenu();
    }(r), byId("ten-site-list").innerHTML = r.length ? r.map((e, t) => 0 === state.sourceMode ? `<button class="ten-list-item" type="button" data-url="${escapeAttr(e.homepage)}"><span class="ten-name">${escapeHtml(e.webName)}</span><span class="ten-site-kind">内置</span><span class="ten-meta">${escapeHtml(e.webDesc || "打开站点")}</span></button>` : `<div class="ten-rule-item"><button class="ten-list-item ten-rule-open" type="button" data-url="${escapeAttr(e.homepage)}"><span class="ten-name">${escapeHtml(e.webName)}</span><span class="ten-meta">${escapeHtml(e.webDesc || e.domain || "导入规则")}</span></button><button class="ten-icon-btn ten-rule-edit" type="button" data-edit-rule="${t}" title="编辑规则" aria-label="编辑 ${escapeAttr(e.webName)}">${icon("edit")}</button><button class="ten-icon-btn ten-rule-delete" type="button" data-delete-rule="${t}" title="删除规则" aria-label="删除 ${escapeAttr(e.webName)}">${icon("trash")}</button></div>`).join("") : empty("暂无导入规则");
  }
  function deleteImportedRule(e) {
    const t = e.target.closest("[data-edit-rule]");
    if (t) return void function (e) {
      const t = safeGet("userWebInfo", []),
        n = (Array.isArray(t) ? t : [])[e];
      n && (state.editRuleIndex = e, state.editRuleBase = {
        ...n
      }, byId("ten-rule-name").value = n.webName || "", byId("ten-rule-domain").value = Array.isArray(n.domain) ? n.domain.join(", ") : n.domain || "", byId("ten-rule-homepage").value = n.homepage || "", byId("ten-rule-desc").value = n.webDesc || "", byId("ten-rule-title-selector").value = n.comicNameCss || "", byId("ten-rule-chapter-selector").value = n.chapterCss || "", byId("ten-rule-image-selector").value = n.imageCss || "", byId("ten-rule-use-frame").checked = Boolean(n.useFrame), byId("ten-rule-getimgs").value = n.simpleRule ? "" : "function" == typeof n.getImgs ? n.getImgs.toString() : n.getImgs || "", setRuleReadType(n.readtype), byId("ten-rule-advanced").open = !n.simpleRule, byId("ten-rule-save").textContent = "更新规则", byId("ten-rule-cancel-edit").hidden = !1, activateTab("settings"), setTimeout(() => byId("ten-rule-editor-card").scrollIntoView({
        behavior: "smooth",
        block: "start"
      }), 80));
    }(Number(t.dataset.editRule));
    const n = e.target.closest("[data-delete-rule]");
    if (n) return void async function (e) {
      const t = safeGet("userWebInfo", []),
        n = Array.isArray(t) ? t.slice() : [];
      n[e] && (await showConfirm("删除自定义规则", `确认删除规则“${n[e].webName || n[e].domain || "未命名规则"}”？`, "删除")) && (n.splice(e, 1), (0, configModule.po)("userWebInfo", n), renderSites(), toast("规则已删除"));
    }(Number(n.dataset.deleteRule));
    const a = e.target.closest("[data-url]");
    a && a.dataset.url && window.open(a.dataset.url, "_blank");
  }
  async function searchComics() {
    const e = byId("ten-search-input").value.trim();
    if (!e || state.searching) return;
    const t = state.searchSites.filter(e => e && e.searchTemplate_1),
      n = state.selectedSearchIndex >= 0 ? state.searchSites[state.selectedSearchIndex] : null,
      r = n && n.searchTemplate_1 ? [n] : t;
    if (!r.length) return void toast(0 === state.sourceMode ? "当前没有可搜索的内置站点" : "导入规则没有配置搜索功能");
    state.searching = !0, closeSearchSiteMenu();
    const a = byId("ten-search-results"),
      i = n ? n.webName : 0 === state.sourceMode ? "全部内置站点" : "全部导入站点";
    !function (e) {
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
    const t = byId("ten-search-site-menu"),
      n = t.hidden;
    t.hidden = !n, byId("ten-search-site-picker").classList.toggle("is-open", n), byId("ten-search-site-trigger").setAttribute("aria-expanded", String(n));
  }
  function handleSearchSiteChoice(e) {
    const t = e.target.closest("[data-search-index]");
    if (!t || t.disabled) return;
    const n = Number(t.dataset.searchIndex);
    state.selectedSearchIndex = n, byId("ten-search-site-label").textContent = n < 0 ? 0 === state.sourceMode ? "全部内置站点" : "全部导入站点" : state.searchSites[n].webName, all(".ten-search-site-option").forEach(e => e.classList.toggle("is-selected", Number(e.dataset.searchIndex) === n)), closeSearchSiteMenu();
  }
  function closeSearchSiteMenuOnOutsideClick(e) {
    const t = byId("ten-search-site-picker");
    t && !t.contains(e.target) && closeSearchSiteMenu();
  }
  function closeSearchSiteMenu() {
    const e = byId("ten-search-site-menu");
    e && (e.hidden = !0, byId("ten-search-site-picker").classList.remove("is-open"), byId("ten-search-site-trigger").setAttribute("aria-expanded", "false"));
  }
  function closeSearchPanel() {
    const e = byId("ten-search-panel");
    e && (e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true"));
  }
  function renderSearchGroups(e, t) {
    t.innerHTML = e.map(e => `<div class="ten-section-title">${escapeHtml(e.site)}</div><div class="ten-result-grid">${e.results.map(e => `<button class="ten-result" type="button" data-url="${escapeAttr(e.url || "")}"><img src="${escapeAttr(e.imageUrl || "")}" alt="" loading="lazy"><span>${escapeHtml(e.name || "未命名")}</span></button>`).join("")}</div>`).join(""), all(".ten-result", t).forEach(e => e.addEventListener("click", () => window.open(e.dataset.url, "_blank")));
  }
  function detectComicInfo(e = 0) {
    if ((0, siteRules.HL)(window.location.href), !siteRules.Po) return state.webName = "未匹配", void updateChapterStatus();
    state.webName = siteRules.Po.webName;
    try {
      const e = document.querySelector(siteRules.Po.comicNameCss),
        t = e && String(e.innerText || e.textContent || "").split("\n")[0].trim();
      if (t) return state.comicName = t, byId("ten-current-comic").value = t, void updateChapterStatus();
    } catch (e) {
      console.warn("10漫画：漫画名称识别失败。", e);
    }
    updateChapterStatus(), e < 2 && setTimeout(() => detectComicInfo(e + 1), 1500);
  }
  function updateChapterStatus(e) {
    const t = byId("ten-chapter-status");
    t && (t.textContent = e || `${state.webName} · ${state.comicName}`, t.classList.toggle("is-ready", Boolean(siteRules.Po && "------" !== state.comicName)), byId("ten-info-site").textContent = state.webName, byId("ten-info-comic").textContent = state.comicName);
  }
  async function loadChapters() {
    if (state.chaptersLoading) return;
    if (!siteRules.Po) return void toast("当前网站没有匹配规则");
    state.chaptersLoading = !0;
    const e = byId("ten-load-chapters");
    e.disabled = !0, e.textContent = "正在加载…", updateChapterStatus("正在读取章节列表…");
    try {
      let e = null;
      "function" == typeof siteRules.Po.getComicInfo && (e = await siteRules.Po.getComicInfo(state.comicName)), Array.isArray(e) || (e = function () {
        const e = [];
        return collectFromSelector(siteRules.Po.chapterCss, "one", e), siteRules.Po.chapterCss_2 && collectFromSelector(siteRules.Po.chapterCss_2, "many", e), e;
      }()), String(siteRules.Po.homepage || "").includes("zerobyw33.com") && e[0]?.comicName && (state.comicName = e[0].comicName, byId("ten-current-comic").value = state.comicName), state.chapters = e.map(normalizeChapter).filter(e => e.chapterName), state.lastSelected = null, renderChapters(), updateChapterStatus(`${state.webName} · ${state.comicName} · ${state.chapters.length} 章`);
    } catch (e) {
      console.error("10漫画：章节加载失败。", e), updateChapterStatus("章节读取失败，请检查站点规则"), toast("网站规则可能已经失效");
    } finally {
      state.chaptersLoading = !1, e.disabled = !1, e.textContent = "重新加载章节";
    }
  }
  function collectFromSelector(e, t, r) {
    document.querySelectorAll(e).forEach(e => {
      e.querySelectorAll("a").forEach(e => {
        let a = "";
        try {
          a = siteRules.Po.chapterNameReg ? (e.outerHTML.match(siteRules.Po.chapterNameReg) || [])[1] : e.innerText, a = (0, downloadUtils.Sc)(a || "");
        } catch (e) {
          a = "";
        }
        let i = !1;
        siteRules.Po.hasSpend && e.parentElement && (i = e.parentElement.outerHTML.indexOf(siteRules.Po.payKey) > 0), r.push({
          comicName: (0, downloadUtils.Sc)(state.comicName),
          chapterNumStr: "",
          chapterName: a,
          downChapterName: "",
          url: e.href,
          characterType: t,
          readtype: siteRules.Po.readtype,
          isPay: i,
          isSelect: !1
        });
      });
    });
  }
  function normalizeChapter(e) {
    return Object.assign({
      comicName: (0, downloadUtils.Sc)(state.comicName),
      chapterNumStr: "",
      chapterName: "",
      downChapterName: "",
      url: "",
      characterType: "one",
      readtype: siteRules.Po.readtype,
      isPay: !1,
      isUnavailable: !1,
      unavailableReason: "",
      isSelect: !1
    }, e);
  }
  function canSelectChapter(e) {
    return Boolean(e && e.url && "javascript:void();" !== e.url && !e.isUnavailable);
  }
  function renderChapters() {
    const e = byId("ten-chapter-list"),
      t = state.chapters.length > 0,
      n = state.chapters.some(canSelectChapter),
      r = state.chapters.some(e => e.isSelect && canSelectChapter(e));
    byId("ten-chapter-empty").hidden = t, byId("ten-chapter-loaded").hidden = !t, byId("ten-select-all").disabled = !n, byId("ten-clear-select").disabled = !r, byId("ten-download-selected").disabled = !r, byId("ten-chapter-count").textContent = t ? `章节列表 · ${state.chapters.length}` : "章节列表", t ? (e.innerHTML = state.chapters.map((e, t) => {
      const n = !canSelectChapter(e),
        r = showChapterName(e);
      return `<div class="ten-list-item${n ? " is-disabled" : ""}" data-index="${t}">\n      <input type="checkbox" ${e.isSelect ? "checked" : ""} ${n ? "disabled" : ""} aria-label="${e.isUnavailable ? escapeHtml(e.unavailableReason || "当前账号未解锁") : "选择章节"}">\n      ${state.editMode ? `<input class="ten-input ten-chapter-name" value="${escapeAttr(e.chapterName)}">` : `<span class="ten-name">${escapeHtml(r)}</span>`}\n      <span class="ten-meta">${e.isUnavailable ? escapeHtml(e.unavailableReason || "未解锁") : e.isPay ? "付费" : "many" === e.characterType ? "分卷" : ""}</span>\n    </div>`;
    }).join(""), all("#ten-chapter-list [data-index]").forEach(e => {
      e.addEventListener("click", t => function (e, t) {
        const n = state.chapters[e];
        if (!canSelectChapter(n) || t.target.classList.contains("ten-chapter-name")) return;
        const r = !n.isSelect;
        if (t.shiftKey && null !== state.lastSelected && r) {
          const t = Math.min(state.lastSelected, e),
            n = Math.max(state.lastSelected, e);
          for (let e = t; e <= n; e++) canSelectChapter(state.chapters[e]) && (state.chapters[e].isSelect = !0);
        } else n.isSelect = r;
        state.lastSelected = r ? e : null, renderChapters();
      }(Number(e.dataset.index), t));
      const t = e.querySelector(".ten-chapter-name");
      t && (t.addEventListener("click", e => e.stopPropagation()), t.addEventListener("change", t => {
        state.chapters[Number(e.dataset.index)].chapterName = t.target.value;
      }));
    })) : e.innerHTML = "";
  }
  function reloadChapters() {
    state.chapters = [], state.lastSelected = null, state.editMode = !1, byId("ten-edit-list").classList.remove("is-active"), renderChapters(), detectComicInfo(), loadChapters();
  }
  function selectAllChapters(e) {
    state.chapters.forEach(t => {
      t.isSelect = Boolean(e && canSelectChapter(t));
    }), state.lastSelected = null, renderChapters();
  }
  function reverseChapters() {
    state.chapters.reverse(), state.lastSelected = null, updateChapterSequence();
  }
  function toggleChapterEdit() {
    state.editMode = !state.editMode, byId("ten-edit-list").classList.toggle("is-active", state.editMode), byId("ten-edit-list").title = state.editMode ? "完成编辑" : "编辑名称", renderChapters();
  }
  function toggleOptions() {
    isNarrowLayout() ? byId("ten-mobile-drawer").classList.contains("is-open") ? closeMobileDrawer() : openMobileDrawer("下载选项", byId("ten-options")) : (state.optionsOpen = !state.optionsOpen, byId("ten-options").classList.toggle("is-open", state.optionsOpen));
  }
  function isNarrowLayout() {
    return window.matchMedia("(max-width: 560px)").matches;
  }
  function openMobileDrawer(e, t) {
    if (!t || state.drawerContent) return;
    const n = byId("ten-mobile-drawer"),
      r = document.createComment("ten-mobile-drawer-anchor");
    t.before(r), byId("ten-mobile-drawer-content").appendChild(t), state.drawerAnchor = r, state.drawerContent = t, "ten-options" === t.id && (state.optionsOpen = !0), t.classList.add("is-open", "is-mobile-drawer-content"), byId("ten-mobile-drawer-title").textContent = e, n.classList.add("is-open"), n.setAttribute("aria-hidden", "false"), setTimeout(() => {
      byId("ten-mobile-drawer-content").scrollTop = 0;
    }, 0);
  }
  function closeMobileDrawer() {
    const e = byId("ten-mobile-drawer");
    if (!e) return;
    e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true");
    const t = state.drawerContent;
    t && state.drawerAnchor?.parentNode && (t.classList.remove("is-open", "is-mobile-drawer-content"), state.drawerAnchor.replaceWith(t)), "ten-options" === t?.id && (state.optionsOpen = !1), t?.classList.contains("ten-rule-advanced-body") && (byId("ten-rule-advanced").open = !1), state.drawerContent = null, state.drawerAnchor = null;
  }
  function openRuleAdvancedDrawer(e) {
    if (!isNarrowLayout()) return;
    e.preventDefault();
    const t = byId("ten-rule-advanced");
    t.open = !0, openMobileDrawer("复杂站点设置", one(".ten-rule-advanced-body", t));
  }
  function setDownloadMode(e, t = !1) {
    state.settings.downloadType = e, all(".ten-mode").forEach(t => t.classList.toggle("is-active", Number(t.dataset.mode) === e));
    const n = ["直接下载", "压缩下载", "图片拼接"];
    byId("ten-default-mode-label") && (byId("ten-default-mode-label").textContent = n[e] || n[0]), all("[data-default-mode]").forEach(t => t.classList.toggle("is-selected", Number(t.dataset.defaultMode) === e)), t && (0, configModule.po)("downType", e);
  }
  function updateChapterSequence() {
    const e = byId("ten-add-sequence").checked,
      t = byId("ten-reverse-sequence").checked,
      r = state.chapters.length;
    state.chapters.forEach((a, i) => {
      a.chapterNumStr = e ? (0, downloadUtils.xo)(t ? r - i : i + 1, 3) : "";
    }), renderChapters();
  }
  function showChapterName(e) {
    return e.chapterNumStr ? `${e.chapterNumStr}${e.chapterName ? `-${e.chapterName}` : ""}` : e.chapterName;
  }
  function downloadSelected() {
    const e = state.chapters.filter(e => e.isSelect && canSelectChapter(e)).map(e => function (e) {
      const t = Object.assign({}, e);
      return t.downChapterName = showChapterName(t), t.downType = state.settings.downloadType, t.downHeaders = siteRules.Po && siteRules.Po.downHeaders, t.batchDelay = siteRules.Po && siteRules.Po.batchDelay, t.directFlow = state.settings.directFlow, t.directRemoteDownload = Boolean(siteRules.Po && siteRules.Po.directRemoteDownload), t.heavyCanvasExport = Boolean(siteRules.Po && siteRules.Po.heavyCanvasExport), t;
    }(e));
    e.length ? (enqueueDownloads(e), state.chapters.forEach(e => {
      e.isSelect = !1;
    }), renderChapters()) : toast("请先选择章节");
  }
  function downloadCurrentChapter() {
    if (!siteRules.Po) return void toast("当前网站没有匹配规则");
    const e = byId("ten-current-comic").value.trim(),
      t = byId("ten-current-chapter").value.trim();
    e && t ? (enqueueDownloads([{
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
    }]), state.optionsOpen = !1, byId("ten-options").classList.remove("is-open")) : toast("请输入漫画名和章节名");
  }
  async function enqueueDownloads(e) {
    siteRules.Po && void 0 !== siteRules.Po.batchDelay && e.forEach(e => {
      void 0 === e.batchDelay && (e.batchDelay = siteRules.Po.batchDelay);
    }), e.forEach(e => {
      void 0 === e.directFlow && (e.directFlow = state.settings.directFlow), void 0 === e.directRemoteDownload && (e.directRemoteDownload = Boolean(siteRules.Po && siteRules.Po.directRemoteDownload)), void 0 === e.heavyCanvasExport && (e.heavyCanvasExport = Boolean(siteRules.Po && siteRules.Po.heavyCanvasExport));
    }), "function" != typeof window.showDirectoryPicker || (await (0, downloadUtils.Oh)()) || toast("未选择保存目录，将使用浏览器默认下载目录"), e.forEach(e => {
      e.useDirectory = Boolean(window.__tenComicDirectoryHandle || window.__ylDirectoryHandle);
    }), state.queue || (state.queue = new DownloadQueue(state.settings.maxChapters, state.settings.concurrentImages, state.settings.digits, {
      getHistoryData: renderTasks,
      $forceUpdate: scheduleTaskRender,
      persistTasks: scheduleTaskPersist,
      notifyTask: notifyDownloadTask
    })), state.queue, state.queue.addList(e), state.queue.run(), activateTab("tasks"), renderTasks();
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
    const t = new Set();
    return e.filter(e => {
      if (!e || !e.url) return !1;
      const n = JSON.stringify([taskHost(e), e.comicName || "", e.downChapterName || e.chapterName || "", e.url]);
      return !t.has(n) && (t.add(n), !0);
    });
  }
  function renderRecoveryTasks() {
    state.ready && (byId("ten-recovery").hidden = 0 === state.recoveryTasks.length, byId("ten-recovery-count").textContent = state.recoveryTasks.length ? `${state.recoveryTasks.length} 个任务可恢复` : "");
  }
  async function restorePendingTasks() {
    const e = state.recoveryTasks.slice();
    e.length && (state.recoveryTasks = [], renderRecoveryTasks(), await enqueueDownloads(e), toast(`已恢复 ${e.length} 个任务`));
  }
  async function discardPendingTasks() {
    state.recoveryTasks.length && (await showConfirm("放弃未完成任务", `将删除当前站点的 ${state.recoveryTasks.length} 个恢复点。`, "放弃任务")) && (state.recoveryTasks = [], persistQueueState(), renderRecoveryTasks(), toast("未完成任务已放弃"));
  }
  function scheduleTaskPersist() {
    clearTimeout(state.persistTimer), state.persistTimer = setTimeout(persistQueueState, 750);
  }
  function persistQueueState() {
    clearTimeout(state.persistTimer), state.persistTimer = null;
    const e = window.location.hostname.toLowerCase(),
      t = safeGet(PENDING_TASKS_KEY, []),
      n = (Array.isArray(t) ? t : []).filter(t => taskHost(t) !== e),
      a = state.queue ? state.queue.pendingTasks() : state.recoveryTasks;
    (0, configModule.po)(PENDING_TASKS_KEY, uniqueTaskSnapshots(n.concat(a)));
  }
  function handlePageHide() {
    (state.queue || state.recoveryTasks.length) && persistQueueState();
  }
  !function () {
    try {
      (0, configModule.Iq)();
    } catch (e) {
      console.warn("10漫画：初始化存储失败。", e);
    }
    (0, siteRules.HL)(window.location.href), siteRules.Po ? (state.settings = readSettings(), window.addEventListener("keydown", handleGlobalHotkey, {
      capture: !0,
      passive: !1
    }), window.addEventListener("pageshow", injectStyle), window.addEventListener("pagehide", handlePageHide), document.addEventListener("visibilitychange", refreshQueueOnVisibility), function () {
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
    }) : injectStyle()) : function () {
      try {
        GM_registerMenuCommand("为当前网站添加自定义规则", openUnsupportedRuleEditor);
      } catch (e) {
        console.warn("10漫画：自定义规则菜单注册失败。", e);
      }
    }();
  }();
  let taskRenderFrame = null;
  function scheduleTaskRender() {
    state.visible && "tasks" !== state.activeTab || taskRenderFrame || (taskRenderFrame = requestAnimationFrame(() => {
      taskRenderFrame = null, renderTasks();
    }));
  }
  function renderTasks() {
    if (!state.ready) return;
    const e = state.queue ? state.queue.worker.map((e, t) => e ? {
        item: e,
        index: t
      } : null).filter(Boolean) : [],
      t = state.queue ? state.queue.list.map((e, t) => ({
        item: e,
        index: t
      })).reverse() : [];
    syncMiniTaskBar(e, t.length), state.visible && "tasks" === state.activeTab && (setText(byId("ten-active-count"), e.length), setText(byId("ten-waiting-count"), t.length), function (e, t) {
      const n = byId("ten-toggle-all-active"),
        r = e.map(e => e.item).filter(e => !e.cancelled && "cancelling" !== e.status),
        a = r.length > 0 && r.every(e => e.paused || "paused" === e.status);
      n.hidden = 0 === r.length, byId("ten-cancel-all-active").hidden = 0 === r.length;
      const i = a ? "resume" : "pause";
      n.dataset.bulkAction !== i && (n.dataset.bulkAction = i), setText(n, a ? "全部继续" : "全部暂停"), byId("ten-remove-all-waiting").hidden = 0 === t;
    }(e, t.length), function (e) {
      const t = byId("ten-active-tasks");
      if (!e.length) return void renderStaticTaskList("ten-active-tasks", [], empty("当前没有下载任务"));
      delete t.dataset.renderKey;
      const n = new Set(e.map(e => String(e.index)));
      all("[data-worker-card]", t).forEach(e => {
        n.has(e.dataset.workerCard) || e.remove();
      }), one(".ten-empty", t)?.remove(), e.forEach(({
        item: e,
        index: n
      }, r) => {
        let a = one(`[data-worker-card="${n}"]`, t);
        if (!a || a._tenTask !== e) {
          const r = document.createElement("template");
          r.innerHTML = taskCard(e, "active", n);
          const i = r.content.firstElementChild;
          a ? a.replaceWith(i) : t.appendChild(i), a = i, a._tenTask = e, a._tenNodes = taskCardNodes(a);
        }
        !function (e, t) {
          const n = e._tenNodes || (e._tenNodes = taskCardNodes(e)),
            r = Math.max(0, Math.min(100, Number(t.progress || 0)));
          setText(n.title, t.downChapterName || t.chapterName || "未命名章节");
          const a = n.progress;
          setStyle(a, "width", `${r}%`), setStyle(a, "--ten-energy-duration", `${energyFlowDuration(t.speedBps)}s`), a.classList.toggle("is-paused", Boolean(t.paused)), setText(n.stage, t.stage || "正在下载"), setText(n.stats, `${t.successNum || 0}/${t.totalNumber || "?"} · ${r}%`), setText(n.speed, t.paused ? "已暂停" : formatSpeed(t.speedBps)), setText(n.eta, t.paused ? "剩余 --" : formatEta(t.etaSeconds));
          const i = t.status || (t.paused ? "paused" : "running"),
            o = e.dataset.taskStatus;
          !o || o === i || "paused" !== i && "running" !== i || playStateAnimation(e, "paused" === i ? "pause" : "resume"), e.dataset.taskStatus !== i && (e.dataset.taskStatus = i);
          const s = n.toggle,
            c = "paused" === t.status,
            d = c ? "resume" : "pause";
          s.dataset.taskAction !== d && (s.dataset.taskAction = d, s.title = c ? "继续" : "暂停", s.innerHTML = icon(c ? "play" : "pause"));
        }(a, e);
        const i = t.children[r];
        i !== a && t.insertBefore(a, i || null);
      });
    }(e), renderStaticTaskList("ten-waiting-tasks", t.map(({
      item: e
    }) => [e.url, e.comicName, e.downChapterName]), () => t.length ? t.map(({
      item: e,
      index: n
    }, r) => taskCard(e, "waiting", n, r, t.length)).join("") : empty("等待队列为空")), function () {
      const e = readHistory(),
        t = `${state.historyFilter}|${state.historyRaw}`;
      if (t === state.historyRenderKey) return;
      state.historyRenderKey = t;
      const n = function (e) {
        return "completed" === state.historyFilter ? e.filter(e => "completed" === e.status || !e.status && !e.hasError) : "failed" === state.historyFilter ? e.filter(e => "failed" === e.status || "partial" === e.status || e.hasError) : "cancelled" === state.historyFilter ? e.filter(e => "cancelled" === e.status) : e;
      }(e);
      setText(byId("ten-history-count"), e.length), renderStaticTaskList("ten-history", [state.historyFilter, ...n.map(e => [e.id, e.status, e.comicName, e.downChapterName, e.failedImages?.length])], n.length ? n.map(historyCard).join("") : empty(e.length ? "没有符合筛选条件的记录" : "暂无下载记录")), all("[data-history-filter]").forEach(e => {
        const t = e.dataset.historyFilter === state.historyFilter;
        e.classList.toggle("is-active", t), setAttribute(e, "aria-pressed", String(t));
      }), function (e) {
        const t = e[0],
          n = t && Number(t.id) || 0;
        if (null !== state.lastHistoryId) {
          if (n > state.lastHistoryId && "cancelled" !== t.status) {
            const e = "completed" === t.status || !t.status && !t.hasError;
            playStateAnimation(one('[data-task-group="history"]'), e ? "success" : "danger");
          }
          state.lastHistoryId = n;
        } else state.lastHistoryId = n;
      }(e);
    }(), syncTaskGroup("active", e.length), syncTaskGroup("waiting", t.length));
  }
  function syncMiniTaskBar(e, t) {
    if (!state.ready && !byId("ten-mini-task")) return;
    const n = (state.miniNodes?.root?.isConnected || (state.miniNodes = {
        root: byId("ten-mini-task"),
        launcher: byId(LAUNCHER_ID),
        title: byId("ten-mini-title"),
        meta: byId("ten-mini-meta"),
        progress: byId("ten-mini-progress"),
        toggle: byId("ten-mini-toggle")
      }), state.miniNodes),
      r = Array.isArray(e) ? e.map(e => e.item) : state.queue ? state.queue.worker.filter(Boolean) : [],
      a = r.filter(e => !e.cancelled && "cancelling" !== e.status),
      i = Number.isFinite(t) ? t : state.queue ? state.queue.list.length : 0,
      o = n.root,
      s = Boolean((r.length || i) && !state.visible && !state.rulePicking);
    if (o.classList.toggle("is-hidden", !s), o.setAttribute("aria-hidden", String(!s)), s ? n.launcher.classList.add("is-hidden") : n.launcher.classList.toggle("is-hidden", state.visible || !state.launcherVisible), !s) return;
    const c = a.length > 0 && a.every(e => e.paused || "paused" === e.status),
      d = a.reduce((e, t) => e + (Number(t.speedBps) || 0), 0),
      u = a.reduce((e, t) => Math.max(e, Number(t.etaSeconds) || 0), 0),
      p = r.filter(e => Number(e.totalNumber) > 0),
      h = p.length ? p.reduce((e, t) => e + Math.min(Number(t.successNum) || 0, Number(t.totalNumber)), 0) / p.reduce((e, t) => e + Number(t.totalNumber), 0) * 100 : r.length ? r.reduce((e, t) => e + (Number(t.progress) || 0), 0) / r.length : 0;
    setText(n.title, r.length ? c ? `${r.length} 个章节已暂停` : `${r.length} 个章节下载中` : `${i} 个章节等待`), setText(n.meta, r.length ? c ? (i ? `${i} 个等待 · ` : "") + "点击继续" : `${formatSpeed(d)} · ${formatEta(u)}` : "打开任务页查看队列"), setStyle(n.progress, "width", `${Math.max(0, Math.min(100, h))}%`);
    const m = n.toggle;
    m.hidden = 0 === a.length;
    const g = c ? "resume" : "pause",
      f = c ? "全部继续" : "全部暂停";
    setAttribute(m, "aria-label", f), m.dataset.action !== g && (m.dataset.action = g, m.title = f, m.innerHTML = icon(c ? "play" : "pause"));
  }
  function toggleMiniTasks() {
    if (!state.queue) return;
    const e = state.queue.worker.filter(e => e && !e.cancelled && "cancelling" !== e.status);
    if (!e.length) return;
    const t = e.every(e => e.paused || "paused" === e.status),
      n = state.queue.setAllPaused(!t);
    n && toast(t ? `已继续 ${n} 个任务` : `已暂停 ${n} 个任务`), renderTasks();
  }
  function iconTipButton(e) {
    return e instanceof Element ? e.closest(".ten-icon-btn, .ten-task-arrow-button, .ten-mini-toggle, .ten-number-steps button") : null;
  }
  function scheduleIconTooltip(e) {
    const t = iconTipButton(e.target);
    t && t !== state.iconTipTarget && (clearTimeout(state.iconTipTimer), state.iconTipTimer = setTimeout(() => showIconTooltip({
      target: t
    }), 320));
  }
  function showIconTooltip(e) {
    const t = iconTipButton(e.target);
    if (!t) return;
    const n = t.getAttribute("title");
    n && (t.dataset.tenTip = n, t.removeAttribute("title"));
    const r = t.dataset.tenTip || t.getAttribute("aria-label");
    if (!r) return;
    clearTimeout(state.iconTipTimer), hideIconTooltip(), state.iconTipTarget = t, t.setAttribute("aria-describedby", "ten-icon-tooltip");
    const a = byId("ten-icon-tooltip");
    a.textContent = r, a.classList.add("is-show"), a.setAttribute("aria-hidden", "false"), requestAnimationFrame(() => function (e, t) {
      if (e !== state.iconTipTarget || !e.isConnected) return;
      const n = e.getBoundingClientRect(),
        r = t.getBoundingClientRect(),
        a = Math.max(8, Math.min(window.innerWidth - r.width - 8, n.left + n.width / 2 - r.width / 2)),
        i = n.top - r.height - 8;
      t.style.left = `${a}px`, t.style.top = `${i >= 8 ? i : n.bottom + 8}px`;
    }(t, a));
  }
  function handleIconTooltipLeave(e) {
    const t = iconTipButton(e.target);
    t && e.relatedTarget instanceof Node && t.contains(e.relatedTarget) || (clearTimeout(state.iconTipTimer), state.iconTipTimer = null, t && t !== state.iconTipTarget || hideIconTooltip());
  }
  function hideIconTooltip() {
    clearTimeout(state.iconTipTimer), state.iconTipTimer = null, state.iconTipTarget && state.iconTipTarget.removeAttribute("aria-describedby"), state.iconTipTarget = null;
    const e = byId("ten-icon-tooltip");
    e && (e.classList.remove("is-show"), e.setAttribute("aria-hidden", "true"));
  }
  function toggleTaskGroup(e) {
    const t = e.closest(".ten-task-group");
    if (!t) return;
    const n = t.classList.toggle("is-open");
    one(".ten-task-title-button", t)?.setAttribute("aria-expanded", String(n)), one(".ten-task-arrow-button", t)?.setAttribute("aria-expanded", String(n));
  }
  function renderStaticTaskList(e, t, n) {
    const r = byId(e),
      a = JSON.stringify(t);
    r.dataset.renderKey !== a && (r.innerHTML = "function" == typeof n ? n() : n, r.dataset.renderKey = a);
  }
  function taskCardNodes(e) {
    return {
      title: one("[data-task-title]", e),
      progress: one("[data-task-progress]", e),
      stage: one("[data-task-stage]", e),
      stats: one("[data-task-stats]", e),
      speed: one("[data-task-speed]", e),
      eta: one("[data-task-eta]", e),
      toggle: one("[data-task-toggle]", e)
    };
  }
  function playStateAnimation(e, t) {
    e && 0 !== state.settings.effectLevel && (clearTimeout(e._tenStateTimer), e.classList.remove("ten-state-animate", "is-state-pause", "is-state-resume", "is-state-success", "is-state-danger"), e.offsetWidth, e.classList.add("ten-state-animate", `is-state-${t}`), e._tenStateTimer = setTimeout(() => {
      e.classList.remove("ten-state-animate", `is-state-${t}`);
    }, 2 === state.settings.effectLevel ? 800 : 1e3));
  }
  function formatSpeed(e) {
    const t = Number(e) || 0;
    return t <= 0 ? "速度计算中" : t < 1024 ? `${Math.round(t)} B/s` : t < 1048576 ? `${(t / 1024).toFixed(1)} KB/s` : `${(t / 1024 / 1024).toFixed(1)} MB/s`;
  }
  function energyFlowDuration(e) {
    const t = Math.max(0, Number(e) || 0),
      n = Math.log2(1 + t / 32768);
    let r = Math.max(1.6, Math.min(6.6, 6.6 - .75 * n));
    return 1 === state.settings.effectLevel && (r *= 1.2), r.toFixed(2);
  }
  function formatDurationValue(e) {
    const t = Number(e);
    if (!Number.isFinite(t) || t < 0) return "";
    const n = Math.max(0, Math.round(t / 1e3));
    return n < 60 ? `${n}秒` : n < 3600 ? `${Math.floor(n / 60)}分${n % 60}秒` : `${Math.floor(n / 3600)}时${Math.floor(n % 3600 / 60)}分`;
  }
  function formatCompletedAt(e) {
    if (!e) return "";
    const t = new Date(e);
    return Number.isNaN(t.getTime()) ? "" : `完成 ${t.toLocaleString()}`;
  }
  function formatHistoryTiming(e) {
    const t = [formatTaskDuration(e.durationMs)],
      n = formatDurationValue(e.totalDurationMs),
      r = formatDurationValue(e.pausedDurationMs),
      a = formatCompletedAt(e.completedAt);
    return n && t.push(`总历时 ${n}`), Number.isFinite(Number(e.pausedDurationMs)) && r && t.push(`暂停 ${r}`), a && t.push(a), t.join(" · ");
  }
  function formatTaskDuration(e) {
    const t = formatDurationValue(e);
    return t ? `用时 ${t}` : "用时未记录";
  }
  function formatEta(e) {
    if (!Number.isFinite(e)) return "剩余时间估算中";
    const t = Math.max(0, Math.round(e));
    return t <= 1 ? "即将完成" : t < 60 ? `剩余 ${t} 秒` : t < 3600 ? `剩余 ${Math.floor(t / 60)}分${t % 60}秒` : `剩余 ${Math.floor(t / 3600)}时${Math.ceil(t % 3600 / 60)}分`;
  }
  function syncTaskGroup(e, t) {
    const n = one(`[data-task-group="${e}"]`);
    if (!n) return;
    n.classList.toggle("has-scroll", t > 5), t > 0 && "true" !== n.dataset.seen && (n.dataset.seen = "true", n.classList.add("is-open")), 0 === t && (delete n.dataset.seen, "waiting" !== e && n.classList.remove("is-open"));
    const r = String(n.classList.contains("is-open"));
    setAttribute(one(".ten-task-title-button", n), "aria-expanded", r), setAttribute(one(".ten-task-arrow-button", n), "aria-expanded", r);
  }
  function toggleAllActiveTasks(e) {
    if (!state.queue) return;
    const t = "resume" !== e.currentTarget.dataset.bulkAction,
      n = state.queue.setAllPaused(t);
    n && toast(t ? `已暂停 ${n} 个任务` : `已继续 ${n} 个任务`), renderTasks();
  }
  async function cancelAllActiveTasks() {
    if (!state.queue) return;
    const e = state.queue.worker.filter(e => e && !e.cancelled).length;
    if (!e || !(await showConfirm("取消全部下载任务", `确认取消当前正在进行的 ${e} 个任务？`, "全部取消"))) return;
    const t = state.queue.cancelAll();
    renderTasks(), t && toast(`正在取消 ${t} 个任务`);
  }
  async function removeAllWaitingTasks() {
    if (!state.queue || !state.queue.list.length) return;
    const e = state.queue.list.length;
    if (!(await showConfirm("移出全部等待任务", `确认将等待队列中的 ${e} 个任务全部移出？`, "全部移出"))) return;
    const t = state.queue.list.slice(),
      n = state.queue.clearWaiting();
    renderTasks(), n && toast(`已移出 ${n} 个等待任务`, () => restoreWaitingTasks(t));
  }
  function restoreWaitingTasks(e) {
    state.queue && e.length && (state.queue.list.push(...e), state.queue.run(), renderTasks());
  }
  function taskCard(e, t, n, r = 0, a = 0) {
    const i = Math.max(0, Math.min(100, Number(e.progress || 0))),
      o = "active" === t,
      s = "paused" === e.status,
      c = o ? `<div class="ten-task-actions"><button class="ten-icon-btn" type="button" data-task-toggle data-task-action="${s ? "resume" : "pause"}" data-worker-index="${n}" title="${s ? "继续" : "暂停"}">${icon(s ? "play" : "pause")}</button><button class="ten-icon-btn" type="button" data-task-action="diagnostic" data-worker-index="${n}" title="诊断信息">${icon("info")}</button><button class="ten-icon-btn is-danger" type="button" data-task-action="cancel" data-worker-index="${n}" title="取消任务">${icon("close")}</button></div>` : `<div class="ten-task-actions"><button class="ten-icon-btn" type="button" data-task-action="waiting-up" data-waiting-index="${n}" title="提前一个位置" ${0 === r ? "disabled" : ""}>${icon("up")}</button><button class="ten-icon-btn" type="button" data-task-action="waiting-down" data-waiting-index="${n}" title="延后一个位置" ${r === a - 1 ? "disabled" : ""}>${icon("down")}</button><button class="ten-icon-btn is-danger" type="button" data-task-action="cancel-waiting" data-waiting-index="${n}" title="移出队列">${icon("close")}</button></div>`;
    return `<div class="ten-list-item ten-task-card"${o ? ` data-worker-card="${n}"` : ""}><div class="ten-name"><div class="ten-task-title"${o ? " data-task-title" : ""}>${escapeHtml(e.downChapterName || e.chapterName || "未命名章节")}</div>${o ? `<div class="ten-progress"><i data-task-progress${e.paused ? ' class="is-paused"' : ""} style="width:${i}%;--ten-energy-duration:${energyFlowDuration(e.speedBps)}s"></i></div><div class="ten-task-meta"><span data-task-stage>${escapeHtml(e.stage || "正在下载")}</span><span data-task-stats>${e.successNum || 0}/${e.totalNumber || "?"} · ${i}%</span></div><div class="ten-task-performance"><span data-task-speed>${formatSpeed(e.speedBps)}</span><span data-task-eta>${formatEta(e.etaSeconds)}</span></div>` : '<div class="ten-meta">等待开始</div>'}</div>${c}</div>`;
  }
  function historyCard(e) {
    const t = {
        completed: "已完成",
        partial: "部分失败",
        failed: "失败",
        cancelled: "已取消"
      }[e.status] || (e.hasError ? "存在错误" : "已完成"),
      n = Array.isArray(e.failedImages) ? e.failedImages.filter(e => e && e.url) : [];
    return `<div class="ten-list-item ten-history-card"><div class="ten-name"><div class="ten-task-title">${escapeHtml(e.downChapterName || "未命名章节")}</div><div class="ten-task-meta"><span>${formatHistoryTiming(e)}</span><span>${escapeHtml(e.flowUsed || "流程未记录")}</span><span class="ten-task-state is-${escapeAttr(e.status || (e.hasError ? "failed" : "completed"))}">${t}</span></div></div><div class="ten-task-actions">${n.length ? `<button class="ten-icon-btn" type="button" data-retry-history="${e.id}" title="仅重试 ${n.length} 张失败图片">${icon("refresh")}</button><button class="ten-icon-btn" type="button" data-copy-failures="${e.id}" title="复制失败清单">${icon("copy")}</button>` : ""}<button class="ten-icon-btn" type="button" data-diagnostic-history="${e.id}" title="诊断信息">${icon("info")}</button><button class="ten-icon-btn" type="button" data-delete-history="${e.id}" title="删除记录">${icon("trash")}</button></div></div>`;
  }
  function handleHistoryFilter(e) {
    const t = e.target.closest("[data-history-filter]");
    t && t.dataset.historyFilter !== state.historyFilter && (state.historyFilter = t.dataset.historyFilter, renderTasks());
  }
  async function handleTaskAction(e) {
    const t = e.target.closest("[data-task-action]");
    if (!t || !state.queue) return;
    const n = t.dataset.taskAction;
    if ("waiting-up" === n || "waiting-down" === n) return state.queue.moveWaiting(Number(t.dataset.waitingIndex), "waiting-up" === n ? "up" : "down"), renderTasks();
    if ("cancel-waiting" === n) {
      const e = Number(t.dataset.waitingIndex),
        n = state.queue.list[e];
      return state.queue.cancelWaiting(e) && toast("任务已移出等待队列", () => restoreWaitingTasks([n])), renderTasks();
    }
    const r = Number(t.dataset.workerIndex),
      a = state.queue.worker[r];
    a && ("pause" === n && state.queue.pause(r), "resume" === n && state.queue.resume(r), "diagnostic" === n && openDiagnostic(a), "cancel" === n && (await showConfirm("取消下载任务", `确认取消“${a.comicName} · ${a.downChapterName}”？`, "取消任务")) && state.queue.cancel(r), renderTasks());
  }
  function readHistory() {
    const e = localStorage.getItem("ylComicDownHistory") || "[]";
    if (e === state.historyRaw) return state.historyCache;
    try {
      const t = JSON.parse(e);
      if (!Array.isArray(t)) return writeHistory([]);
      let n = !1;
      const r = 100 * Date.now();
      t.forEach((e, t) => {
        e && void 0 === e.id && (e.id = r - t, n = !0);
      });
      const a = new Set(),
        i = t.filter(e => {
          const t = `${e.comicName || ""}\0${e.downChapterName || ""}`;
          return !a.has(t) && (a.add(t), !0);
        }).slice(0, state.settings ? state.settings.historyLimit : boundedNumber(safeGet("historyLimit", 100), 100, 10, 500)),
        o = n || i.length !== t.length ? JSON.stringify(i) : e;
      return o !== e && localStorage.setItem("ylComicDownHistory", o), state.historyRaw = o, state.historyCache = i, i;
    } catch (t) {
      return state.historyRaw = e, state.historyCache = [], state.historyCache;
    }
  }
  function writeHistory(e) {
    const t = Array.isArray(e) ? e : [],
      n = JSON.stringify(t);
    return localStorage.setItem("ylComicDownHistory", n), state.historyRaw = n, state.historyCache = t, state.historyRenderKey = "", t;
  }
  async function handleHistoryClick(e) {
    const t = e.target.closest("[data-diagnostic-history]"),
      n = e.target.closest("[data-retry-history]"),
      r = e.target.closest("[data-copy-failures]"),
      a = e.target.closest("[data-delete-history]"),
      i = readHistory();
    if (t) return openDiagnostic(i.find(e => String(e.id) === t.dataset.diagnosticHistory));
    if (n) return function (e) {
      const t = Array.isArray(e && e.failedImages) ? e.failedImages.filter(e => e && e.url) : [];
      if (!t.length) return toast("没有可重试的失败图片");
      const n = e.task && "object" == typeof e.task ? e.task : {};
      enqueueDownloads([{
        ...n,
        comicName: e.comicName,
        chapterName: e.downChapterName,
        downChapterName: e.downChapterName,
        url: n.url || e.comicPageUrl,
        readtype: void 0 === n.readtype ? 1 : n.readtype,
        downType: 0,
        retryImages: t
      }]), toast(`已加入 ${t.length} 张失败图片`);
    }(i.find(e => String(e.id) === n.dataset.retryHistory));
    if (r) return copyFailureList(i.find(e => String(e.id) === r.dataset.copyFailures));
    if (!a) return;
    const o = i.findIndex(e => String(e.id) === a.dataset.deleteHistory),
      s = i[o];
    s && (await showConfirm("删除下载记录", `确认删除“${s.comicName || "未命名漫画"} · ${s.downChapterName || "未命名章节"}”？`, "删除")) && (i.splice(o, 1), writeHistory(i), renderTasks(), toast("下载记录已删除", () => function (e, t) {
      if (!e) return;
      const n = readHistory().slice();
      n.some(t => String(t.id) === String(e.id)) || (n.splice(Math.max(0, Math.min(t, n.length)), 0, e), writeHistory(n), renderTasks());
    }(s, o)));
  }
  function trimHistory() {
    writeHistory(readHistory().slice(0, state.settings.historyLimit)), renderTasks();
  }
  async function clearHistory() {
    const e = readHistory();
    if (!e.length) return toast("当前没有下载记录");
    (await showConfirm("清空下载记录", `将删除全部 ${e.length} 条下载记录，此操作无法撤销。`, "全部清空")) && (writeHistory([]), renderTasks(), toast("下载记录已清空"));
  }
  function showConfirm(e, t, n = "确认") {
    state.confirmResolve && closeConfirm(!1), byId("ten-confirm-title").textContent = e, byId("ten-confirm-message").textContent = t, byId("ten-confirm-ok").textContent = n;
    const r = byId("ten-confirm");
    return r.classList.add("is-open"), r.setAttribute("aria-hidden", "false"), setTimeout(() => byId("ten-confirm-cancel").focus(), 0), new Promise(e => {
      state.confirmResolve = e;
    });
  }
  function closeConfirm(e) {
    const t = state.confirmResolve;
    state.confirmResolve = null;
    const n = byId("ten-confirm");
    n && (n.classList.remove("is-open"), n.setAttribute("aria-hidden", "true")), t && t(e);
  }
  function openRuleGuide() {
    const e = byId("ten-rule-guide");
    e && (e.classList.add("is-open"), e.setAttribute("aria-hidden", "false"), setTimeout(() => e.querySelector(".ten-rule-guide-dialog [data-rule-guide-close]")?.focus(), 0));
  }
  function closeRuleGuide() {
    const e = byId("ten-rule-guide");
    e && (e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true"));
  }
  function openDiagnostic(e) {
    if (!e) return;
    state.diagnosticItem = e;
    const t = Array.isArray(e.diagnostics) ? e.diagnostics : [],
      n = Array.isArray(e.failedImages) ? e.failedImages : Array.isArray(e.failures) ? e.failures : [],
      r = e.stage || (e.hasError ? "存在下载错误" : "没有发现错误"),
      a = [`漫画：${e.comicName || "未知"}`, `章节：${e.downChapterName || e.chapterName || "未知"}`, `状态：${r}`, `页面：${e.comicPageUrl || e.url || window.location.href}`, `失败图片：${n.length} 张`, ""];
    t.length ? (a.push("诊断详情："), t.forEach((e, t) => {
      const n = e.time ? new Date(e.time).toLocaleString() : "未知时间";
      a.push(`${t + 1}. [${n}] ${e.stage || "下载"}：${e.message || "未知错误"}`), e.imgIndex && a.push(`   图片序号：${e.imgIndex}`), e.url && a.push(`   地址：${e.url}`);
    })) : a.push(e.hasError ? "这是旧版记录，没有保存详细错误信息。" : "当前没有错误详情。"), byId("ten-diagnostic-summary").textContent = `${e.comicName || "未知漫画"} · ${e.downChapterName || e.chapterName || "未知章节"}`, byId("ten-diagnostic-content").textContent = a.join("\n");
    const i = byId("ten-diagnostic");
    i.classList.add("is-open"), i.setAttribute("aria-hidden", "false");
  }
  function closeDiagnostic() {
    const e = byId("ten-diagnostic");
    e && (e.classList.remove("is-open"), e.setAttribute("aria-hidden", "true"));
  }
  function copyDiagnostic() {
    copyText(byId("ten-diagnostic-content").textContent, "诊断信息已复制");
  }
  function copyFailureList(e) {
    const t = Array.isArray(e && e.failedImages) ? e.failedImages : Array.isArray(e && e.failures) ? e.failures : [];
    if (!t.length) return toast("没有失败图片可复制");
    const n = [`漫画：${e.comicName || "未知"}`, `章节：${e.downChapterName || e.chapterName || "未知"}`, `失败图片：${t.length} 张`, ""];
    t.forEach((e, t) => n.push(`${t + 1}. 序号：${e.imgIndex || "未知"}\n   原因：${e.reason || "未知错误"}\n   地址：${e.url || "无"}`)), copyText(n.join("\n"), "失败清单已复制");
  }
  function copyText(e, t) {
    try {
      GM_setClipboard(e, "text"), toast(t);
    } catch (n) {
      navigator.clipboard && "function" == typeof navigator.clipboard.writeText ? navigator.clipboard.writeText(e).then(() => toast(t)).catch(() => toast("复制失败")) : toast("复制失败");
    }
  }
  function saveLoadSetting(e, t) {
    const n = safeGet("appLoadDefault", {}),
      a = n && "object" == typeof n ? n : {};
    a[e] = t, (0, configModule.po)("appLoadDefault", a), "isShowUI" === e && (state.settings.autoOpen = t);
  }
  function applyScale(e, t) {
    state.settings.scale = e, byId(PANEL_ID).style.setProperty("--ten-scale", e / 100), byId("ten-scale-value").textContent = `${e}%`, t && saveLoadSetting("rightSize", e);
  }
  function setEffectLevel(e, t) {
    const n = Math.max(0, Math.min(2, Number(e) || 0));
    state.settings.effectLevel = n, byId(ROOT_ID).dataset.effects = String(n), createParticles(n), all("[data-effect-level]").forEach(e => {
      const t = Number(e.dataset.effectLevel) === n;
      e.classList.toggle("is-active", t), e.setAttribute("aria-pressed", String(t));
    }), t && ((0, configModule.po)("effectLevel", n), toast(["特效已关闭", "已切换为轻量特效", "已切换为标准特效"][n]));
  }
  function setThemePreset(e, t) {
    const n = Object.prototype.hasOwnProperty.call(THEMES, e) ? e : "glass";
    state.settings.themePreset = n, byId(ROOT_ID).dataset.theme = n, all("[data-theme-choice]").forEach(e => e.setAttribute("aria-pressed", String(e.dataset.themeChoice === n))), t && ((0, configModule.po)("themePreset", n), toast(`已切换为${THEMES[n][0]}`));
  }
  function applyAppearance(e) {
    const t = byId(ROOT_ID),
      n = e || {};
    t.dataset.density = n.density || "standard", t.dataset.shape = n.shape || "standard", t.dataset.motion = n.motion || "standard", all("[data-appearance-axis]").forEach(e => {
      const t = e.dataset.appearanceValue === n[e.dataset.appearanceAxis];
      e.classList.toggle("is-active", t), setAttribute(e, "aria-pressed", String(t));
    });
  }
  function saveImageRange() {
    const e = Math.max(1, Math.trunc(Number(byId("ten-range-start").value) || 1)),
      t = Math.trunc(Number(byId("ten-range-end").value) || -1),
      n = -1 === t ? -1 : Math.max(e, t);
    state.settings.imageRange = [e, n], byId("ten-range-start").value = e, byId("ten-range-end").value = n, (0, configModule.po)("imgDownRange", state.settings.imageRange);
  }
  function exportSettingsBackup() {
    const e = Object.fromEntries(BACKUP_KEYS.map(e => [e, safeGet(e, null)])),
      n = {
        format: "10Comic-settings-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: e,
        rules: Array.isArray(safeGet("userWebInfo", [])) ? safeGet("userWebInfo", []) : []
      },
      r = new Date().toISOString().slice(0, 10);
    !function (e, t) {
      const n = URL.createObjectURL(e);
      let r = !1,
        a = !1;
      const i = () => {
          r || (r = !0, URL.revokeObjectURL(n));
        },
        o = () => {
          if (r || a) return;
          a = !0;
          const e = document.createElement("a");
          e.href = n, e.download = t, e.hidden = !0, document.body.appendChild(e), e.click(), e.remove(), setTimeout(i, 1e3), toast("设置与规则备份已导出");
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
    }(new Blob([JSON.stringify(n, null, 2)], {
      type: "application/json"
    }), `10Comic-设置与规则备份-${r}.json`);
  }
  async function importSettingsBackup(e) {
    const t = e.target.files && e.target.files[0];
    if (e.target.value = "", t) try {
      const e = JSON.parse(await t.text());
      if (!e || "10Comic-settings-backup" !== e.format || !e.settings || !Array.isArray(e.rules)) throw new Error("不是有效的 10漫画备份文件");
      const n = e => (Array.isArray(e) ? e : [e]).some(e => String(e || "").trim());
      if (e.rules.some(e => !e || !n(e.domain))) throw new Error("备份中的规则域名无效");
      if (!(await showConfirm("导入设置与规则", `将使用备份中的设置和 ${e.rules.length} 条规则覆盖当前配置。`, "确认导入"))) return;
      BACKUP_KEYS.forEach(t => {
        void 0 !== e.settings[t] && null !== e.settings[t] && (0, configModule.po)(t, e.settings[t]);
      }), (0, configModule.po)("userWebInfo", e.rules), state.settings = readSettings(), applySettingsToUI(), trimHistory(), renderSites(), toast(`备份已导入，共 ${e.rules.length} 条规则`);
    } catch (e) {
      toast(e.message || "备份文件读取失败");
    }
  }
  function applyPageSplicing() {
    let e = document.getElementById("ten-comic-page-style");
    e || (e = document.createElement("style"), e.id = "ten-comic-page-style", document.head.appendChild(e)), e.textContent = state.settings.splicePage && siteRules.Po && siteRules.Po.readCssText ? siteRules.Po.readCssText : "";
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
    document.hidden || state.queue && state.queue.refresh();
  }
  const RULE_PICK_CONFIG = {
      title: {
        field: "ten-rule-title-selector",
        label: "漫画标题",
        role: "title"
      },
      chapters: {
        field: "ten-rule-chapter-selector",
        label: "章节列表",
        role: "chapters"
      },
      images: {
        field: "ten-rule-image-selector",
        label: "章节图片",
        role: "images"
      }
    },
    RULE_TEMPLATES = {
      basic: {
        name: "基础卷轴",
        imageCss: ".reader img, .viewer img, .comic-content img",
        readtype: 1,
        useFrame: !1
      },
      lazy: {
        name: "懒加载阅读",
        imageCss: "img[data-src], img[data-original], img[data-url], img[data-lazy-src]",
        readtype: 1,
        useFrame: !1
      },
      frame: {
        name: "隐藏页面",
        imageCss: ".reader img, .viewer img, .comic-content img",
        readtype: 1,
        useFrame: !0
      },
      paged: {
        name: "翻页阅读",
        imageCss: "",
        readtype: 0,
        useFrame: !1
      }
    };
  function handleRulePickMove(e) {
    if (!state.rulePicking || byId(ROOT_ID).contains(e.target)) return;
    const t = normalizeRulePickTarget(e.target, state.rulePicking.role);
    t && t !== state.rulePickElement && (state.rulePickElement = t, cancelAnimationFrame(state.rulePickFrame), state.rulePickFrame = requestAnimationFrame(refreshRulePickBox));
  }
  function refreshRulePickBox() {
    if (!state.rulePicking || !state.rulePickElement?.isConnected) return;
    const e = state.rulePickElement.getBoundingClientRect();
    byId("ten-rule-pick-box").style.cssText = `left:${e.left}px;top:${e.top}px;width:${e.width}px;height:${e.height}px`, byId("ten-rule-pick-selector").textContent = buildRuleSelector(state.rulePickElement, state.rulePicking.role) || "无法生成选择器，请选择其他元素";
  }
  function handleRulePickClick(e) {
    if (!state.rulePicking || byId(ROOT_ID).contains(e.target)) return;
    e.preventDefault(), e.stopImmediatePropagation();
    const t = buildRuleSelector(normalizeRulePickTarget(e.target, state.rulePicking.role), state.rulePicking.role);
    if (!t) return;
    const n = state.rulePicking;
    finishRulePicking();
    const r = byId(n.field);
    r.value = t, r.dispatchEvent(new Event("input", {
      bubbles: !0
    })), byId("ten-rule-editor-card").scrollIntoView({
      behavior: "smooth",
      block: "start"
    }), setTimeout(() => r.focus(), 260), toast(`已选择${n.label}：${t}`);
  }
  function handleRulePickKey(e) {
    "Escape" === e.key && (e.preventDefault(), e.stopImmediatePropagation(), cancelRulePicking());
  }
  function cancelRulePicking() {
    state.rulePicking && (finishRulePicking(), toast("已取消可视化选择"));
  }
  function finishRulePicking() {
    cancelAnimationFrame(state.rulePickFrame), state.rulePickFrame = null, state.rulePicking = null, state.rulePickElement = null, document.removeEventListener("pointermove", handleRulePickMove, !0), document.removeEventListener("click", handleRulePickClick, !0), document.removeEventListener("keydown", handleRulePickKey, !0), window.removeEventListener("scroll", refreshRulePickBox, !0), window.removeEventListener("resize", refreshRulePickBox, !0), byId(ROOT_ID).classList.remove("is-rule-picking"), document.documentElement.classList.remove("ten-rule-picking-page");
    const e = byId("ten-rule-pick-layer");
    e.classList.add("is-hidden"), e.setAttribute("aria-hidden", "true"), byId("ten-rule-pick-box").removeAttribute("style"), syncMiniTaskBar();
  }
  function normalizeRulePickTarget(e, t) {
    if (!(e instanceof Element)) return null;
    if ("images" === t) return e.closest("img") || e.querySelector("img") || e;
    if ("chapters" !== t) return e;
    let n = e.closest("a") || e;
    n.matches("a") && (n = n.parentElement);
    for (let e = 0; n && e < 5; e++, n = n.parentElement) if (n.querySelectorAll("a[href]").length > 1) return n;
    return e;
  }
  function buildRuleSelector(e, t) {
    if (!e) return "";
    if ("images" === t && e.matches("img")) {
      const t = stableRuleClasses(e);
      for (const e of t) {
        const t = `img.${escapeCss(e)}`;
        if (selectorCount(t) > 1) return t;
      }
      let n = e.parentElement;
      for (let e = 0; n && e < 5; e++, n = n.parentElement) {
        if (n.querySelectorAll("img").length < 2) continue;
        const e = uniqueRuleSelector(n);
        if (e) return `${e} img`;
      }
    }
    return uniqueRuleSelector(e);
  }
  function uniqueRuleSelector(e) {
    if (!e || !e.tagName) return "";
    if (e.id) {
      const t = `#${escapeCss(e.id)}`;
      if (1 === selectorCount(t)) return t;
    }
    const t = e.tagName.toLowerCase(),
      n = stableRuleClasses(e);
    for (let e = 1; e <= Math.min(2, n.length); e++) {
      const r = t + n.slice(0, e).map(e => `.${escapeCss(e)}`).join("");
      if (1 === selectorCount(r)) return r;
    }
    const r = [];
    let a = e;
    for (let e = 0; a && a !== document.documentElement && e < 6; e++, a = a.parentElement) {
      let e = a.tagName.toLowerCase();
      const t = stableRuleClasses(a);
      t.length && (e += `.${escapeCss(t[0])}`);
      const n = a.parentElement ? Array.from(a.parentElement.children).filter(e => e.tagName === a.tagName) : [];
      n.length > 1 && (e += `:nth-of-type(${n.indexOf(a) + 1})`), r.unshift(e);
      const i = r.join(" > ");
      if (1 === selectorCount(i)) return i;
    }
    return r.join(" > ");
  }
  function stableRuleClasses(e) {
    return Array.from(e.classList || []).filter(e => e.length <= 36 && !/\d{4,}|(^|[-_])(active|selected|current|hover|focus|open|loading|show|hide)([-_]|$)/i.test(e)).slice(0, 3);
  }
  function selectorCount(e) {
    try {
      return document.querySelectorAll(e).length;
    } catch (e) {
      return 0;
    }
  }
  function escapeCss(e) {
    return window.CSS && "function" == typeof window.CSS.escape ? window.CSS.escape(String(e)) : String(e).replace(/[^a-zA-Z0-9_-]/g, e => `\\${e}`);
  }
  function setRuleReadType(e) {
    state.ruleReadType = 0 === Number(e) ? 0 : 1;
    const t = one(".ten-rule-readtype");
    t && t.style.setProperty("--rule-type", 1 === state.ruleReadType ? 0 : 1), all("[data-rule-readtype]").forEach(e => e.classList.toggle("is-active", Number(e.dataset.ruleReadtype) === state.ruleReadType));
  }
  function resetRuleEditor() {
    state.editRuleIndex = -1, state.editRuleBase = null, state.ruleReadType = 1, ["ten-rule-name", "ten-rule-domain", "ten-rule-homepage", "ten-rule-desc", "ten-rule-title-selector", "ten-rule-chapter-selector", "ten-rule-image-selector", "ten-rule-getimgs"].forEach(e => {
      byId(e) && (byId(e).value = "");
    }), byId("ten-rule-use-frame") && (byId("ten-rule-use-frame").checked = !1), byId("ten-rule-advanced") && (byId("ten-rule-advanced").open = !1), byId("ten-rule-save") && (byId("ten-rule-save").textContent = "保存规则"), byId("ten-rule-cancel-edit") && (byId("ten-rule-cancel-edit").hidden = !0), byId("ten-rule-test-result") && (byId("ten-rule-test-result").hidden = !0), setRuleReadType(1);
  }
  function readRuleEditor() {
    const e = byId("ten-rule-name").value.trim(),
      t = byId("ten-rule-domain").value.split(/[,，\s]+/).map(e => e.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^\*\./, "")).filter(Boolean),
      n = byId("ten-rule-homepage").value.trim() || (t[0] ? `https://${t[0]}/` : ""),
      r = byId("ten-rule-image-selector").value.trim(),
      a = byId("ten-rule-getimgs").value.trim(),
      i = Boolean(r && !a),
      o = a || (r ? ["function(context, processData) {\n    const frame = processData && processData.frameId ? document.getElementById(processData.frameId) : null\n    const root = frame && frame.contentDocument ? frame.contentDocument : new DOMParser().parseFromString(String(context || ''), 'text/html')\n    const base = processData && processData.url ? processData.url : location.h", "ref\n    const urls = Array.from(root.querySelectorAll(this.imageCss)).map(img => {\n      const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || ''\n      return img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-url') || img.getAttribute('data-lazy-src') || img.currentSrc || (srcset.trim().spli", "t(/\\s*,\\s*/).pop() || '').trim().split(/\\s+/)[0] || img.getAttribute('src')\n    }).filter(Boolean).map(url => { try { return new URL(url, base).href } catch (error) { return url } })\n    if (frame) frame.remove()\n    return [...new Set(urls)]\n  }"].join("") : "");
    if (!e || !t.length) throw new Error("请填写站点名称和域名");
    if (!o) throw new Error("请填写章节图片选择器；复杂站点也可填写图片解析函数");
    if (i && 0 === state.ruleReadType) throw new Error("翻页阅读需要在复杂站点设置中填写图片解析函数");
    try {
      new URL(n);
    } catch (e) {
      throw new Error("站点首页地址格式不正确");
    }
    if (!/^(async\s+)?function\s*\(/.test(o)) throw new Error("图片解析函数必须使用 function 或 async function 格式");
    let s;
    try {
      s = Function(`"use strict";return (${o})`)();
    } catch (e) {
      throw new Error("图片解析函数存在语法错误");
    }
    if ("function" != typeof s) throw new Error("图片解析函数格式不正确");
    if (r) try {
      document.querySelector(r);
    } catch (e) {
      throw new Error("章节图片选择器格式不正确");
    }
    return {
      ...(state.editRuleBase || {}),
      webName: e,
      domain: 1 === t.length ? t[0] : t,
      homepage: n,
      webDesc: byId("ten-rule-desc").value.trim(),
      comicNameCss: byId("ten-rule-title-selector").value.trim(),
      chapterCss: byId("ten-rule-chapter-selector").value.trim(),
      readtype: state.ruleReadType,
      useFrame: byId("ten-rule-use-frame").checked,
      imageCss: r,
      simpleRule: i,
      getImgs: o
    };
  }
  function testRuleEditor() {
    const e = byId("ten-rule-test-result");
    e.hidden = !1, e.classList.remove("is-success", "is-error");
    try {
      const t = readRuleEditor(),
        n = Array.isArray(t.domain) ? t.domain : [t.domain],
        r = window.location.hostname.toLowerCase(),
        a = ["规则格式：通过", "域名匹配：" + (n.some(e => r === e.toLowerCase() || r.endsWith(`.${e.toLowerCase()}`)) ? "当前页面已匹配" : "当前页面不属于该规则，仅检查格式")];
      if (t.comicNameCss) {
        let e;
        try {
          e = document.querySelector(t.comicNameCss);
        } catch (e) {
          throw new Error("漫画标题选择器格式不正确");
        }
        a.push(`漫画标题：${e ? String(e.textContent || "").trim().slice(0, 60) || "已找到节点" : "未找到"}`);
      }
      if (t.chapterCss) {
        let e;
        try {
          e = [...document.querySelectorAll(t.chapterCss)];
        } catch (e) {
          throw new Error("章节列表选择器格式不正确");
        }
        const n = e.reduce((e, t) => e + t.querySelectorAll("a").length, 0);
        a.push(`章节列表：${e.length} 个容器，${n} 个链接`);
      }
      t.imageCss && a.push(`章节图片：当前页面找到 ${document.querySelectorAll(t.imageCss).length} 张（目录页为 0 属正常）`), a.push(t.simpleRule ? "图片解析：已自动生成" : "图片解析函数：语法通过（未执行网络下载）"), e.textContent = a.join("\n"), e.classList.add("is-success");
    } catch (t) {
      e.textContent = `测试失败：${t.message}`, e.classList.add("is-error");
    }
  }
  function saveRuleEditor() {
    try {
      const e = readRuleEditor(),
        t = safeGet("userWebInfo", []),
        n = Array.isArray(t) ? t.slice() : [];
      state.editRuleIndex >= 0 && n[state.editRuleIndex] ? n[state.editRuleIndex] = e : n.unshift(e), (0, configModule.po)("userWebInfo", n);
      const a = state.editRuleIndex >= 0;
      resetRuleEditor(), state.sourceMode = 1, renderSites(), activateTab("sites"), toast(a ? "规则已更新，刷新目标页面后生效" : "规则已保存，打开目标页面即可使用");
    } catch (e) {
      toast(e.message || "规则保存失败");
    }
  }
  function importRules() {
    const e = byId("ten-rule-text").value.trim();
    if (!e) return toast("请先粘贴规则数组");
    try {
      const t = Function(`"use strict";return (${e})`)();
      if (!Array.isArray(t)) throw new Error("规则必须是数组");
      const n = e => (Array.isArray(e) ? e : [e]).some(e => String(e || "").trim());
      if (t.some(e => !e || !n(e.domain))) throw new Error("规则域名不能为空");
      const a = t.map(e => {
          const t = {
            ...e
          };
          return ["getImgs", "getComicInfo"].forEach(e => {
            "function" == typeof t[e] && (t[e] = t[e].toString());
          }), t;
        }),
        i = safeGet("userWebInfo", []),
        o = Array.isArray(i) ? i : [];
      (0, configModule.po)("userWebInfo", a.concat(o)), byId("ten-rule-text").value = "", state.sourceMode = 1, renderSites(), activateTab("sites"), toast(`已导入 ${t.length} 条规则`);
    } catch (e) {
      toast("规则格式不正确");
    }
  }
  async function clearRules() {
    (await showConfirm("清空自定义规则", "将删除全部已导入规则，此操作无法撤销。", "全部清空")) && ((0, configModule.po)("userWebInfo", []), renderSites(), toast("导入规则已清空"));
  }
  async function resetSettings() {
    (await showConfirm("重置全部设置", "界面、下载和规则设置都将恢复默认值。", "确认重置")) && (await (0, configModule.zU)(), state.settings = readSettings(), state.ready && (applySettingsToUI(), toast("设置已重置")));
  }
  function createParticles(e = state.settings ? state.settings.effectLevel : 1) {
    const t = 0 === e ? 0 : 1 === e ? 11 : 22,
      n = byId("ten-particle-field");
    if (state.particleCount === t && n.childElementCount === t) return;
    state.particleCount = t;
    const r = ["#5ff6ff", "#5b8cff", "#9c6cff", "#ff5fac"];
    n.innerHTML = Array.from({
      length: t
    }, (e, t) => `<i style="--x:${(37 * t + 11) % 100}%;--y:${(61 * t + 7) % 100}%;--s:${1 + t % 3}px;--tx:${13 * t % 34 - 16}px;--ty:${17 * t % 46 - 22}px;--d:${4 + t % 5}s;--delay:-${t % 7}s;--c:${r[t % r.length]}"></i>`).join("");
  }
  function addRipple(e) {
    const t = e.target.closest(".ten-btn");
    if (!t || t.disabled || 0 === state.settings.effectLevel) return;
    const n = t.getBoundingClientRect(),
      r = document.createElement("span"),
      a = Math.max(n.width, n.height);
    r.className = "ten-ripple", r.style.width = r.style.height = `${a}px`, r.style.left = e.clientX - n.left - a / 2 + "px", r.style.top = e.clientY - n.top - a / 2 + "px", t.appendChild(r), r.addEventListener("animationend", () => r.remove(), {
      once: !0
    });
  }
  function toast(e, t = null) {
    if (!state.ready) return;
    const n = byId("ten-toast"),
      r = byId("ten-toast-action");
    setText(byId("ten-toast-text"), e), state.toastUndo = "function" == typeof t ? t : null, r.hidden = !state.toastUndo, n.classList.add("is-show"), clearTimeout(state.toastTimer), state.toastTimer = setTimeout(() => {
      n.classList.remove("is-show"), state.toastUndo = null, r.hidden = !0;
    }, state.toastUndo ? 6500 : 2200);
  }
  function runToastUndo() {
    const e = state.toastUndo;
    e && (state.toastUndo = null, clearTimeout(state.toastTimer), byId("ten-toast-action").hidden = !0, e(), toast("已撤销刚才的操作"));
  }
  function notifyDownloadTask(e) {
    const t = e.downChapterName || e.chapterName || "未命名章节",
      n = "failed" === e.status || "partial" === e.status || e.hasError,
      r = n ? `${t} 下载结束，存在失败图片` : `${t} 下载完成`;
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
