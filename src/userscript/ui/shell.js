function renderShell() {
    return [ [ '<svg width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true">\n    <symbol id="ten-i-globe" viewBox="0 0 24 24"><circle cx="12" \
cy="12" r="9"/><path d="M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18"/></symbol>\n    <symbol id="ten-i-layers" viewBox="0 0 24 24"><path d="m12 3 9 \
5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5', ' 9-5"/></symbol>\n    <symbol id="ten-i-download" viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></symbol>\n    <symbol id="ten-i-settings" \
viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 \
1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 ', "8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 \
0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 \
2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.3", '8.37.72.6 1 .3.35.7.5 1.1.5h.1v4h-.1c-.42 0-.8.15-1.1.5-.23.28-.44.62-.6 1Z"/></symbol>\n    <symbol id="ten-i-close" viewBox="0 0 24 24"><path d="M6 6l12 \
12M18 6 6 18"/></symbol>\n    <symbol id="ten-i-github" viewBox="0 0 24 24"><path d="M12 2.8a9.2 9.2 0 0 0-2.9 \
17.93c.46.08.63-.2.63-.45v-1.78c-2.57.56-3.11-1.09-3.11-1.09-.42-1.07-1.03-1.35-1.03-1.35-.84-.57.06-.56.06-.56.93.07 1.42.95 1.42.95.83 1.42 2.17 1.01 \
2.7.77.08-.6.32-1.01.59-1.25-2.05-.23-4.21-1.03-4.21-4.56 0-1.01.36-1.84.95-2.49-.1-.23-.41-1.18.09-2.46 0 0 .77-.25 2.53.95A8.8 8.8 0 0 1 12 6.7c.78 0 1.57.1 \
2.3.31 1.76-1.2 2.53-.95 2.53-.95.5 1.28.19 2.23.09 2.46.59.65.95 1.48.95 2.49 0 3.54-2.16 4.32-4.22 4.55.33.29.63.85.63 1.71v2.54c0 .25.17.54.64.45A9.2 9.2 0 0 \
0 12 2.8Z"/></symbol>\n    <symbol id="ten-i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></symbol>\n    <symbol \
id="ten-i-refresh" viewBox="0 0 24 24"><path d', '="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8A8 8 0 0 1 20 12M17.9 16A8 8 0 0 1 4 12"/></symbol>\n    <symbol id="ten-i-sliders" viewBox="0 0 24 24"><path d="M4 \
6h10M18 6h2M4 12h3M11 12h9M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></symbol>\n    <symbol \
id="ten-i-sort" viewBox="0 0 24 24"><path d="M8 ', '6h12M8 12h9M8 18h6M4 4v16m0 0-2.5-2.5M4 20l2.5-2.5"/></symbol>\n    <symbol id="ten-i-edit" viewBox="0 0 24 24"><path d="M4 20h4l11-11-4-4L4 16v4ZM13.5 6.5l4 \
4"/></symbol>\n    <symbol id="ten-i-trash" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></symbol>\n    <symbol \
id="ten-i-pause" viewBox="0 0 24 24"><path d="M8 5v14M16 ', '5v14"/></symbol>\n    <symbol id="ten-i-play" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></symbol>\n    <symbol id="ten-i-info" viewBox="0 0 24 \
24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></symbol>\n    <symbol id="ten-i-up" viewBox="0 0 24 24"><path d="m6 14 6-6 6 6"/></symbol>\n    \
<symbol id="ten-i-down" viewBox="0 0 24 24"><path d="', 'm6 10 6 6 6-6"/></symbol>\n    <symbol id="ten-i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 \
2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></symbol>\n    <symbol id="ten-i-backup" viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5V4Z"/><path d="M8 4v6h8V4M8 \
20v-6h8v6"/></symbol>\n    <symbol id="ten-i-guide" viewBo', 'x="0 0 24 24"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"/><path \
d="m17 7 .5 1.2L19 9l-1.5.8L17 11l-.5-1.2L15 9l1.5-.8L17 7Z"/></symbol>\n    <symbol id="ten-i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" \
r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 1', '9v3M2 12h3M19 12h3"/></symbol>\n  </svg>' ].join(""), `<button id="${LAUNCHER_ID}" class="is-hidden" type="button" aria-label="打开 10漫画" title="打开 10漫画"><span>10漫</span></button>`, `<div id="ten-mini-task" class="ten-mini-task is-hidden" aria-hidden="true"><button id="ten-mini-open" class="ten-mini-open" type="button" \
aria-label="打开下载任务"><span class="ten-mini-icon">${icon("download")}</span><span class="ten-mini-copy"><strong id="ten-mini-title">正在下载</strong><small id="ten-mini-meta">准备任务</small><span class="ten-mini-progress"><i \
id="ten-mini-progress"></i></span></span></button><button id="ten-mini-toggle" class="ten-mini-toggle" type="button" aria-label="全部暂停" title="全部暂停">${icon("pause")}</button></div>`, `<div id="ten-rule-pick-layer" class="ten-rule-pick-layer is-hidden" aria-hidden="true"><div id="ten-rule-pick-box" class="ten-rule-pick-box"></div><div \
class="ten-rule-pick-hud"><span class="ten-rule-pick-symbol">${icon("target")}</span><span><strong id="ten-rule-pick-title">选择网页元素</strong><small id="ten-rule-pick-selector">移动鼠标并点击，Esc 取消</small></span><button id="ten-rule-pick-cancel" \
type="button">取消</button></div></div>`, '<div id="ten-icon-tooltip" class="ten-icon-tooltip" role="tooltip" aria-hidden="true"></div>', `<aside id="${PANEL_ID}" inert aria-hidden="true"><div id="ten-particle-field" aria-hidden="true"></div>`, `<header class="ten-header"><span class="ten-brand-mark">10</span><div class="ten-heading"><div id="ten-title" class="ten-title">章节选择</div><div id="ten-subtitle" \
class="ten-subtitle">章节管理</div></div><a id="ten-github-link" class="ten-icon-btn" href="https://github.com/JY525712/10Comic-remastered" target="_blank" \
rel="noopener noreferrer" aria-label="打开 GitHub 仓库" title="GitHub 仓库">${icon("github")}</a><button id="ten-close" class="ten-icon-btn" type="button" aria-label="收起面板">${icon("close")}</button></header>`, '<main class="ten-content">', `<section class="ten-view" data-view="sites">\n    <div class="ten-toolbar">\n      <div class="ten-source"><button type="button" \
data-source="0">内置站点</button><button type="button" data-source="1">导入规则</button></div>\n    </div>\n    <div id="ten-rule-manage" class="ten-rule-manage" \
hidden><span id="ten-rule-count">已导入 0 条规则</span><button id="ten-rule-clear-all" class="ten-btn is-danger is-small" type="button">清空全部</button></div>\n    <div \
class="ten-toolbar ten-search-toolbar"><div id="ten-search-site-picker" class="ten-search-site-picker"><button id="ten-search-site-trigger" type="button" \
aria-haspopup="listbox" aria-expanded="false"><span id="ten-search-site-label">全部站点</span><span class="ten-picker-arrow"></span></button><div \
id="ten-search-site-menu" class="ten-search-site-menu" role="listbox" hidden></div></div><input id="ten-search-input" class="ten-input" \
placeholder="搜索漫画"><button id="ten-search-btn" class="ten-btn is-primary ten-icon-label" type="button">${icon("search")}<span>搜索</span></button></div>\n    <div id="ten-site-list" class="ten-list"></div>\n  </section>`, `<section class="ten-view" data-view="chapters">\n    <div id="ten-chapter-status" class="ten-status">正在识别当前页面…</div>\n    <div class="ten-chapter-tools">\n      \
<div class="ten-row ten-chapter-select-group"><button id="ten-select-all" class="ten-btn is-small" type="button" disabled>全选</button><button \
id="ten-clear-select" class="ten-btn is-small" type="button" disabled>取消</button></div>\n      <button id="ten-toggle-options" class="ten-btn is-small \
ten-icon-label" type="button">${icon("sliders")}<span>下载选项</span></button>\n      <button id="ten-download-selected" class="ten-btn is-primary is-small" type="button" disabled>下载</button>\n    </div>\n    \
<div id="ten-options" class="ten-card ten-options">\n      <div class="ten-card-title">下载方式</div>\n      <div class="ten-mode-grid"><button class="ten-mode" \
data-mode="0">直接下载</button><button class="ten-mode" data-mode="1">压缩下载</button><button class="ten-mode" data-mode="2">图片拼接</button></div>\n      <div \
class="ten-grid-2" style="margin-top:8px"><label class="ten-list-item"><input id="ten-add-sequence" type="checkbox"> 补充序号</label><label \
class="ten-list-item"><input id="ten-reverse-sequence" type="checkbox"> 序号反转</label></div>\n      <div class="ten-section-title">当前阅读章节</div>\n      <div \
class="ten-grid-2"><input id="ten-current-comic" class="ten-input" placeholder="漫画名"><input id="ten-current-chapter" class="ten-input" \
placeholder="章节名"></div>\n      <button id="ten-download-current" class="ten-btn" type="button" style="margin-top:8px;width:100%">获取并下载当前章节</button>\n    \
</div>\n    <div class="ten-chapter-reload"><button id="ten-reload-chapters" type="button">${icon("refresh")}<span>重载列表</span></button></div>\n    <div id="ten-chapter-empty" class="ten-chapter-empty">\n      <div class="ten-empty-orbit">${icon("layers")}</div>\n      <div class="ten-empty-title">尚未加载章节</div>\n      <div class="ten-meta">确认漫画信息后加载当前页面的章节列表</div>\n      <button id="ten-load-chapters" \
class="ten-btn is-primary" type="button">加载章节</button>\n      <div class="ten-comic-info"><span>网站</span><strong \
id="ten-info-site">未匹配</strong><span>漫画</span><strong id="ten-info-comic">------</strong></div>\n    </div>\n    <div id="ten-chapter-loaded" hidden>\n      \
<div class="ten-chapter-list-head"><span id="ten-chapter-count">章节列表</span><div class="ten-row"><button id="ten-reverse-list" class="ten-icon-btn" type="button" title="反向排序">${icon("sort")}</button><button id="ten-edit-list" class="ten-icon-btn" type="button" title="编辑名称">${icon("edit")}</button></div></div>\n      <div id="ten-chapter-list" class="ten-chapter-list"></div>\n    </div>\n  </section>`, [ [ '<section class="ten-view" data-view="tasks"><div id="ten-recovery" class="ten-recovery" hidden><div><strong>发现未完成任务</strong><span \
id="ten-recovery-count"></span></div><div class="ten-row"><button id="ten-recovery-discard" class="ten-btn is-danger is-small" type="button">放弃</button><button \
id="ten-recovery-restore" class="ten-btn is-primary is-small" type="bu', 'tton">恢复</button></div></div><div class="ten-task-group" data-task-group="active"><div class="ten-task-header"><button class="ten-task-title-button" \
type="button" aria-expanded="false"><span>正在下载</span><span id="ten-active-count" class="ten-task-count">0</span></button><div \
class="ten-task-control-group"><button id="ten-toggle-all-active" class="ten-btn is-s', 'mall ten-task-bulk" type="button" hidden>全部暂停</button><button id="ten-cancel-all-active" class="ten-btn is-danger is-small ten-task-bulk" type="button" \
hidden>全部取消</button><button class="ten-task-arrow-button" type="button" aria-label="展开或收起正在下载" aria-expanded="false"><span \
class="ten-task-arrow"></span></button></div></div><div class="ten-task-body"><div id', '="ten-active-tasks" class="ten-list"></div></div></div>' ].join(""), '<div class="ten-task-group" data-task-group="waiting"><div class="ten-task-header"><button class="ten-task-title-button" type="button" \
aria-expanded="false"><span>等待下载</span><span id="ten-waiting-count" class="ten-task-count">0</span></button><div class="ten-task-control-group"><button \
id="ten-remove-all-waiting" class="ten-btn is-danger is-small ten-task-bulk" type="button" hidden>全部移出</button><button class="ten-task-arrow-button" \
type="button" aria-label="展开或收起等待下载" aria-expanded="false"><span class="ten-task-arrow"></span></button></div></div><div class="ten-task-body"><div \
id="ten-waiting-tasks" class="ten-list"></div></div></div>', '<div class="ten-task-group" data-task-group="history"><div class="ten-task-header"><button class="ten-task-title-button" type="button" \
aria-expanded="false"><span>下载记录</span><span id="ten-history-count" class="ten-task-count">0</span></button><div class="ten-task-control-group"><button \
id="ten-clear-history" class="ten-icon-btn" type="button" title="清空记录">', icon("trash"), '</button><button class="ten-task-arrow-button" type="button" aria-label="展开或收起下载记录" aria-expanded="false"><span \
class="ten-task-arrow"></span></button></div></div><div class="ten-task-body"><div class="ten-list ten-history-wrap"><div id="ten-history-filter" \
class="ten-history-filter" role="group" aria-label="下载记录筛选"><button type="button" data-history-filter="all">全部</button><button type="button" \
data-history-filter="completed">完成</button><button type="button" data-history-filter="failed">失败</button><button type="button" \
data-history-filter="cancelled">取消</button></div><div id="ten-history" class="ten-list"></div></div></div></div></section>' ].join(""), [ '<section class="ten-view" data-view="settings">', renderThemeSettings(), [ '<details id="ten-download-settings" class="ten-card ten-settings-card ten-settings-download ten-settings-disclosure" open><summary \
class="ten-settings-summary">下载</summary><div class="ten-settings-disclosure-body"><div class="ten-setting"><label for="ten-max-chapters">同时下载章节</label><input \
id="ten-max-chapters" class="ten-input" type="number" min="1" max="3"></div><div class="ten-setting"><label for="ten-concurrent-images">每章并发图片</label><input \
id="ten-concurrent-images" cl', 'ass="ten-input" type="number" min="1" max="5"></div><div class="ten-setting"><label for="ten-default-mode-trigger">默认方式</label><div id="ten-default-mode" \
class="ten-setting-select"><button id="ten-default-mode-trigger" type="button" aria-haspopup="listbox" aria-expanded="false"><span \
id="ten-default-mode-label">直接下载</span><span class="ten-picker-arrow"></spa', 'n></button><div id="ten-default-mode-menu" class="ten-setting-select-menu" role="listbox" hidden><button type="button" data-default-mode="0"><span \
class="ten-mode-option-mark"></span><span><strong>直接下载</strong><small>逐张保存图片</small></span></button><button type="button" data-default-mode="1"><span \
class="ten-mode-option-mark"></span><span><strong>压缩下载</strong>', '<small>打包为章节 ZIP</small></span></button><button type="button" data-default-mode="2"><span \
class="ten-mode-option-mark"></span><span><strong>图片拼接</strong><small>输出连续长图</small></span></button></div></div></div><div class="ten-setting \
ten-direct-flow-setting"><label>直接下载流程</label><div class="ten-direct-flow-options" role="group" aria-label="直接下载流程"><button type="button" \
data-direct-flow="0"><strong>兼容流程</strong><small>GM_xmlhttpRequest → Blob → 保存；兼容性优先</small></button><button type="button" \
data-direct-flow="1"><strong>快速直连</strong><small>GM_download → 直接保存；失败自动回退兼容流程</small></button></div></div><div class="ten-setting ten-setting-check \
ten-path-sanitize-setting"><div><label for="ten-sanitize-paths">自动清理文件夹和文件名</label><small>默认开启；修正系统和浏览器不兼容名称，仅影响保存路径</small></div><input \
id="ten-sanitize-paths" type="checkbox"></div>' ].join(""), '<div class="ten-setting"><label for="ten-max-height">拼接最大高度</label><input id="ten-max-height" class="ten-input" type="number" min="10000" \
max="65530"></div><div class="ten-setting"><label for="ten-digits">图片序号位数</label><input id="ten-digits" class="ten-input" type="number" min="1" \
max="8"></div><div class="ten-setting"><label>图片下载范围</label><div class="ten-grid-2"><input id="ten-range-start" class="ten-input" type="number" min="1"><input \
id="ten-range-end" class="ten-input" type="number" min="-1"></div></div>', settingCheck("ten-splice-page", "网站图片连续阅读"), settingCheck("ten-notify-complete", "下载完成通知"), '<div class="ten-setting"><label for="ten-history-limit">下载记录上限</label><input id="ten-history-limit" class="ten-input" type="number" min="10" \
max="500"></div><div class="ten-setting"><label>本地保存目录</label><div class="ten-dir-control"><button id="ten-choose-dir" class="ten-btn is-small" \
type="button">选择目录</button><span id="ten-dir-name" class="ten-file-name"></span></div></div></div></details>', '<details id="ten-rule-editor-card" class="ten-card ten-settings-card ten-settings-disclosure"><summary class="ten-settings-summary">自定义规则</summary><div \
class="ten-settings-disclosure-body"><div class="ten-card-head"><span class="ten-meta">站点解析与规则导入</span><button id="ten-rule-guide-open" \
class="ten-rule-guide-open" type="button" aria-label="自定义站点设置方法">' + icon("guide") + [ '<span>方法</span></button></div><div class="ten-rule-intro"><strong>简单填写</strong><span>普通卷轴漫画站只需填写名称、域名、章节列表和图片选择器</span></div><div class="ten-rule-fields"><div \
class="ten-grid-2"><label>站点名称<input id="ten-rule-name" class="ten-input" placeholder="例如：示例漫画"></label><label>域名<input id="ten-rule-domain" class="ten-input" \
placeholder="example.com"></label></div><d', 'iv class="ten-grid-2"><label>漫画标题选择器<input id="ten-rule-title-selector" class="ten-input" placeholder="例如：h1.title"></label><label>章节列表选择器<input \
id="ten-rule-chapter-selector" class="ten-input" placeholder="例如：.chapter-list"></label></div><label>章节图片选择器<input id="ten-rule-image-selector" \
class="ten-input" placeholder="例如：.reader img"></label><div class="ten-', 'rule-simple-hint">自动识别 src、data-src、data-original、data-url 和 srcset；相对地址会自动补全</div><details id="ten-rule-advanced" class="ten-rule-advanced"><summary>复杂站点设置 \
<span>翻页、隐藏页面或自定义解析</span></summary><div class="ten-rule-advanced-body"><label>站点首页<input id="ten-rule-homepage" class="ten-input" \
placeholder="留空时根据域名自动生成"></label><label>规则说明<input id="ten-rule-desc" c', 'lass="ten-input" placeholder="可选：使用提示或站点说明"></label><div><span class="ten-rule-label">阅读方式</span><div class="ten-rule-readtype"><button type="button" \
data-rule-readtype="1">卷轴阅读</button><button type="button" data-rule-readtype="0">翻页阅读</button></div></div><div class="ten-setting ten-rule-frame"><label \
for="ten-rule-use-frame">使用隐藏页面读取</label><input id="ten-r', 'ule-use-frame" type="checkbox"></div><label>图片解析函数<textarea id="ten-rule-getimgs" class="ten-textarea ten-rule-function" placeholder="可留空并使用上方图片选择器；复杂站点可填写原版 \
getImgs 函数" spellcheck="false"></textarea></label></div></details></div><div id="ten-rule-test-result" class="ten-rule-test-result" hidden></div><div \
class="ten-rule-actions"><button id="ten-rule-test" ', 'class="ten-btn" type="button">测试当前页面</button><button id="ten-rule-save" class="ten-btn is-primary" type="button">保存规则</button><button id="ten-rule-cancel-edit" \
class="ten-btn is-danger" type="button" hidden>取消编辑</button></div><details class="ten-rule-json"><summary>原版 JSON 导入 <span>兼容旧规则</span></summary><textarea \
id="ten-rule-text" class="ten-textarea" place', 'holder="粘贴原版站点规则数组" autocomplete="off" spellcheck="false"></textarea><button id="ten-import-rules" class="ten-btn" \
type="button">导入并保存</button></details></div></details><div class="ten-card ten-settings-card"><div class="ten-card-title">设置与规则备份</div><div \
class="ten-backup-actions"><button id="ten-backup-export" class="ten-btn" type="button">导出备份</button><button id="te', 'n-backup-import" class="ten-btn is-primary" type="button">导入备份</button></div><input id="ten-backup-file" type="file" accept="application/json,.json" \
hidden><div class="ten-settings-hint">包含界面、下载设置和自定义规则</div></div><button id="ten-reset" class="ten-btn is-danger" type="button" style="width:100%">重置全部设置</button></section>' ].join("") ].join(""), '</main><nav class="ten-nav" aria-label="功能导航">', navButton("sites", "globe", "站点"), navButton("chapters", "layers", "章节"), navButton("tasks", "download", "任务"), navButton("settings", "settings", "设置"), '</nav><div id="ten-toast" class="ten-toast" role="status" aria-live="polite"><span id="ten-toast-text"></span><button id="ten-toast-action" type="button" hidden>撤销</button></div>', `<div id="ten-confirm" inert class="ten-confirm" aria-hidden="true"><button class="ten-confirm-backdrop" type="button" data-confirm-cancel \
aria-label="取消"></button><div class="ten-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ten-confirm-title" \
aria-describedby="ten-confirm-message"><div class="ten-confirm-icon">${icon("trash")}</div><div id="ten-confirm-title" class="ten-confirm-title">确认操作</div><div id="ten-confirm-message" class="ten-confirm-message"></div><div \
class="ten-confirm-actions"><button id="ten-confirm-cancel" class="ten-btn" type="button" data-confirm-cancel>取消</button><button id="ten-confirm-ok" \
class="ten-btn is-danger" type="button">确认</button></div></div></div>`, `<div id="ten-diagnostic" inert class="ten-diagnostic" aria-hidden="true"><button class="ten-confirm-backdrop" type="button" data-diagnostic-close \
aria-label="关闭诊断"></button><div class="ten-diagnostic-dialog" role="dialog" aria-modal="true" aria-labelledby="ten-diagnostic-title"><div \
class="ten-diagnostic-head"><div class="ten-confirm-icon is-info">${icon("info")}</div><div><div id="ten-diagnostic-title" class="ten-confirm-title">下载诊断</div><div id="ten-diagnostic-summary" class="ten-meta"></div></div><button \
class="ten-icon-btn" type="button" data-diagnostic-close aria-label="关闭">${icon("close")}</button></div><pre id="ten-diagnostic-content"></pre><div class="ten-diagnostic-actions"><button id="ten-copy-failures" class="ten-btn" \
type="button">复制失败清单</button><button id="ten-diagnostic-copy" class="ten-btn" type="button">复制诊断信息</button><button class="ten-btn is-primary" type="button" \
data-diagnostic-close>完成</button></div></div></div>`, `<div id="ten-rule-guide" inert class="ten-diagnostic ten-rule-guide" aria-hidden="true"><button class="ten-confirm-backdrop" type="button" data-rule-guide-close \
aria-label="关闭方法说明"></button><div class="ten-diagnostic-dialog ten-rule-guide-dialog" role="dialog" aria-modal="true" \
aria-labelledby="ten-rule-guide-title"><div class="ten-diagnostic-head"><div class="ten-confirm-icon is-info">${icon("guide")}</div><div><div id="ten-rule-guide-title" class="ten-confirm-title">自定义站点设置方法</div><div class="ten-meta">从页面选择器到保存测试</div></div><button class="ten-icon-btn" \
type="button" data-rule-guide-close aria-label="关闭">${icon("close")}</button></div><div class="ten-rule-guide-content"><section><h3>一、添加前准备</h3><ol><li>先打开漫画的目录页面，确保页面中能看到漫画名称和章节链接。</li><li>按 F12 \
打开开发者工具，使用左上角的元素选择工具点选目标内容。</li><li>优先选择稳定的 <code>id</code> 或 <code>class</code>，避免使用很长的层级路径。</li></ol></section><section><h3>二、简单填写的五个字段</h3><dl><dt>站点名称</dt><dd>仅用于脚本内显示，例如“示例漫画”。</dd><dt>域名</dt><dd>只填 \
<code>example.com</code>，不要填写章节路径；多个域名用逗号分隔。</dd><dt>漫画标题选择器</dt><dd>指向漫画名称，例如 <code>h1.title</code>。</dd><dt>章节列表选择器</dt><dd>指向包含章节链接的外层容器，例如 \
<code>.chapter-list</code>。</dd><dt>章节图片选择器</dt><dd>在阅读页中指向漫画图片，例如 <code>.reader img</code>。脚本会自动识别常见懒加载地址。</dd></dl></section><section \
class="ten-rule-guide-example"><h3>三、可以照着填写的示例</h3><code>站点名称：示例漫画<br>域名：example.com<br>漫画标题：h1.title<br>章节列表：.chapter-list<br>章节图片：.reader \
img</code></section><section><h3>四、测试与保存</h3><ol><li>在漫画目录页点击“测试当前页面”，确认标题和章节链接能被找到。</li><li>目录页找不到章节图片是正常的，图片选择器应在任意章节阅读页中验证。</li><li>点击“保存规则”，刷新目标网站后脚本入口才会按新规则启用。</li></ol></section><section><h3>五、什么时候使用复杂设置</h3><ul><li><b>翻页阅读：</b>每次只能取得部分图片，并需要下一页地址时使用。</li><li><b>隐藏页面读取：</b>图片必须等网页脚本运行后才出现时开启。</li><li><b>图片解析函数：</b>页面数据经过加密、来自接口或普通选择器无法取得时填写。</li><li><b>原版 \
JSON 导入：</b>用于导入已有规则数组；只导入来源可信的规则。</li></ul></section><section><h3>六、常见问题</h3><ul><li>章节为 0：检查章节选择器指向的容器内是否真的包含 <code>&lt;a&gt;</code> 链接。</li><li>图片为 \
0：在章节阅读页重新检查选择器，必要时开启隐藏页面读取。</li><li>下载被拒绝：通常与登录、Cookie、防盗链或网站接口更新有关，需要调整高级规则。</li></ul></section><div \
class="ten-rule-guide-warning">解析函数可以执行代码，请勿导入来源不明的规则。</div></div><button class="ten-btn is-primary" type="button" data-rule-guide-close>我知道了</button></div></div>`, "</aside>", `<aside id="ten-search-panel" aria-hidden="true">\n    <header class="ten-search-panel-header"><div><div class="ten-title">搜索结果</div><div \
id="ten-search-panel-subtitle" class="ten-subtitle">全部站点</div></div><button id="ten-search-close" class="ten-icon-btn" type="button" aria-label="关闭搜索结果">${icon("close")}</button></header>\n    <div id="ten-search-results" class="ten-search-panel-content"></div>\n  </aside>`, '<div id="ten-mobile-drawer" inert class="ten-mobile-drawer" aria-hidden="true"><button class="ten-mobile-drawer-backdrop" type="button" data-drawer-close \
aria-label="关闭抽屉"></button><section class="ten-mobile-drawer-sheet" role="dialog" aria-modal="true" aria-labelledby="ten-mobile-drawer-title"><div \
class="ten-mobile-drawer-handle"></div><header><div id="ten-mobile-drawer-title">下载选项</div><button type="button" class="ten-icon-btn" data-drawer-close aria-label="关闭">' + icon("close") + '</button></header><div id="ten-mobile-drawer-content"></div></section></div>' ].join("");
}

function renderThemeSettings() {
    return `<details id="ten-theme-settings" class="ten-card ten-settings-card ten-settings-disclosure">\n      <summary class="ten-settings-summary">主题</summary>\n      \
<div class="ten-settings-disclosure-body">\n        <section class="ten-settings-section">\n          <div class="ten-card-title">预设选择</div>\n          <div \
class="ten-theme-presets" role="group" aria-label="主题预设">\n            ${Object.entries(THEMES).map(([key, theme]) => `<button class="ten-theme-choice" data-theme-choice="${key}" type="button"><strong>${theme[0]}</strong><small>${theme[1]}</small></button>`).join("")}\n          </div>\n        </section>\n        ${appearanceAxesSection()}\n        <section class="ten-settings-section">\n          <div class="ten-card-title">界面设置</div>\n          ${settingCheck("ten-auto-open", "随网页打开界面")}\n          <div class="ten-setting"><label for="ten-hotkey">快捷键（Alt +）</label><input id="ten-hotkey" class="ten-input" maxlength="1"></div>\n          <div \
class="ten-setting"><label for="ten-scale">界面缩放</label><div class="ten-row"><input id="ten-scale" type="range" min="75" max="125" step="1"><span \
id="ten-scale-value" class="ten-setting-value"></span></div></div>\n          <div class="ten-setting"><label>特效强度</label><div class="ten-effect-level" \
role="group" aria-label="特效强度"><button type="button" data-effect-level="0">关闭</button><button type="button" data-effect-level="1">轻量</button><button \
type="button" data-effect-level="2">标准</button></div></div>\n        </section>\n      </div>\n    </details>`;
}
