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
    } : null).filter(Boolean) : [], t = state.queue ? state.queue.list.length : 0;
    syncMiniTaskBar(e, t);
    if (!state.visible || "tasks" !== state.activeTab) return;
    (setText(byId("ten-active-count"), e.length), 
    setText(byId("ten-waiting-count"), t), function(e, t) {
        const n = byId("ten-toggle-all-active"), r = e.map(e => e.item).filter(e => !e.cancelled && "cancelling" !== e.status), a = r.length > 0 && r.every(e => e.paused || "paused" === e.status);
        n.hidden = 0 === r.length, byId("ten-cancel-all-active").hidden = 0 === r.length;
        const i = a ? "resume" : "pause";
        n.dataset.bulkAction !== i && (n.dataset.bulkAction = i), setText(n, a ? "全部继续" : "全部暂停"), 
        byId("ten-remove-all-waiting").hidden = 0 === t;
    }(e, t), function(e) {
        const t = byId("ten-active-tasks");
        if (!e.length) return void renderStaticTaskList("ten-active-tasks", [], empty("当前没有下载任务"));
        delete t.dataset.renderKey;
        const n = new Set(e.map(e => String(e.index)));
        all("[data-worker-card]", t).forEach(e => {
            n.has(e.dataset.workerCard) || e.remove();
        }), one(".ten-empty", t)?.remove(), e.forEach(({item: e, index: n}, r) => {
            let a = one(`[data-worker-card="${n}"]`, t);
            if (!a || a._tenTask !== e) {
                const r = document.createElement("template");
                r.innerHTML = taskCard(e, "active", n);
                const i = r.content.firstElementChild;
                a ? a.replaceWith(i) : t.appendChild(i), a = i, a._tenTask = e, a._tenNodes = taskCardNodes(a);
            }
            !function(e, t) {
                const n = e._tenNodes || (e._tenNodes = taskCardNodes(e)), r = Math.max(0, Math.min(100, Number(t.progress || 0)));
                setText(n.title, t.downChapterName || t.chapterName || "未命名章节");
                const a = n.progress;
                setStyle(a, "width", `${r}%`), setStyle(a, "--ten-energy-duration", `${energyFlowDuration(t.speedBps)}s`), 
                a.classList.toggle("is-paused", Boolean(t.paused)), setText(n.stage, t.stage || "正在下载"), 
                setText(n.stats, `${t.successNum || 0}/${t.totalNumber || "?"} · ${r}%`), setText(n.speed, t.paused ? "已暂停" : formatSpeed(t.speedBps)), 
                setText(n.eta, t.paused ? "剩余 --" : formatEta(t.etaSeconds));
                const i = t.status || (t.paused ? "paused" : "running"), o = e.dataset.taskStatus;
                !o || o === i || "paused" !== i && "running" !== i || playStateAnimation(e, "paused" === i ? "pause" : "resume"), 
                e.dataset.taskStatus !== i && (e.dataset.taskStatus = i);
                const s = n.toggle, c = "paused" === t.status, d = c ? "resume" : "pause";
                s.dataset.taskAction !== d && (s.dataset.taskAction = d, s.title = c ? "继续" : "暂停", 
                s.innerHTML = icon(c ? "play" : "pause"));
            }(a, e);
            const i = t.children[r];
            i !== a && t.insertBefore(a, i || null);
        });
    }(e), renderWaitingTasks(state.queue), 
    function() {
        const e = readHistory(), t = `${state.historyFilter}|${state.historyRaw}`;
        if (t === state.historyRenderKey) return;
        state.historyRenderKey = t;
        const n = function(e) {
            return "completed" === state.historyFilter ? e.filter(e => "completed" === e.status || !e.status && !e.hasError) : "failed" === state.historyFilter ? e.filter(e => "failed" === e.status || "partial" === e.status || e.hasError) : "cancelled" === state.historyFilter ? e.filter(e => "cancelled" === e.status) : e;
        }(e);
        setText(byId("ten-history-count"), e.length), renderHistoryRows(n, e.length), 
        all("[data-history-filter]").forEach(e => {
            const t = e.dataset.historyFilter === state.historyFilter;
            e.classList.toggle("is-active", t), setAttribute(e, "aria-pressed", String(t));
        }), function(e) {
            const t = e[0], n = t && Number(t.id) || 0;
            if (null !== state.lastHistoryId) {
                if (n > state.lastHistoryId && "cancelled" !== t.status) {
                    const e = "completed" === t.status || !t.status && !t.hasError;
                    playStateAnimation(one('[data-task-group="history"]'), e ? "success" : "danger");
                }
                state.lastHistoryId = n;
            } else state.lastHistoryId = n;
        }(e);
    }(), syncTaskGroup("active", e.length), syncTaskGroup("waiting", t));
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
    }), state.miniNodes), r = Array.isArray(e) ? e.map(e => e.item) : state.queue ? state.queue.worker.filter(Boolean) : [], a = r.filter(e => !e.cancelled && "cancelling" !== e.status), i = Number.isFinite(t) ? t : state.queue ? state.queue.list.length : 0, o = n.root, s = Boolean((r.length || i) && !state.visible && !state.rulePicking);
    if (o.classList.toggle("is-hidden", !s), o.setAttribute("aria-hidden", String(!s)), 
    s ? n.launcher.classList.add("is-hidden") : n.launcher.classList.toggle("is-hidden", state.visible || !state.launcherVisible), 
    !s) return;
    const c = a.length > 0 && a.every(e => e.paused || "paused" === e.status), d = a.reduce((e, t) => e + (Number(t.speedBps) || 0), 0), u = a.reduce((e, t) => Math.max(e, Number(t.etaSeconds) || 0), 0), p = r.filter(e => Number(e.totalNumber) > 0), h = p.length ? p.reduce((e, t) => e + Math.min(Number(t.successNum) || 0, Number(t.totalNumber)), 0) / p.reduce((e, t) => e + Number(t.totalNumber), 0) * 100 : r.length ? r.reduce((e, t) => e + (Number(t.progress) || 0), 0) / r.length : 0;
    setText(n.title, r.length ? c ? `${r.length} 个章节已暂停` : `${r.length} 个章节下载中` : `${i} 个章节等待`), 
    setText(n.meta, r.length ? c ? (i ? `${i} 个等待 · ` : "") + "点击继续" : `${formatSpeed(d)} · ${formatEta(u)}` : "打开任务页查看队列"), 
    setStyle(n.progress, "width", `${Math.max(0, Math.min(100, h))}%`);
    const m = n.toggle;
    m.hidden = 0 === a.length;
    const g = c ? "resume" : "pause", f = c ? "全部继续" : "全部暂停";
    setAttribute(m, "aria-label", f), m.dataset.action !== g && (m.dataset.action = g, 
    m.title = f, m.innerHTML = icon(c ? "play" : "pause"));
}

function toggleMiniTasks() {
    if (!state.queue) return;
    const e = state.queue.worker.filter(e => e && !e.cancelled && "cancelling" !== e.status);
    if (!e.length) return;
    const t = e.every(e => e.paused || "paused" === e.status), n = state.queue.setAllPaused(!t);
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
    a.textContent = r, a.classList.add("is-show"), a.setAttribute("aria-hidden", "false"), 
    requestAnimationFrame(() => function(e, t) {
        if (e !== state.iconTipTarget || !e.isConnected) return;
        const n = e.getBoundingClientRect(), r = t.getBoundingClientRect(), a = Math.max(8, Math.min(window.innerWidth - r.width - 8, n.left + n.width / 2 - r.width / 2)), i = n.top - r.height - 8;
        t.style.left = `${a}px`, t.style.top = `${i >= 8 ? i : n.bottom + 8}px`;
    }(t, a));
}

function handleIconTooltipLeave(e) {
    const t = iconTipButton(e.target);
    t && e.relatedTarget instanceof Node && t.contains(e.relatedTarget) || (clearTimeout(state.iconTipTimer), 
    state.iconTipTimer = null, t && t !== state.iconTipTarget || hideIconTooltip());
}

function hideIconTooltip() {
    clearTimeout(state.iconTipTimer), state.iconTipTimer = null, state.iconTipTarget && state.iconTipTarget.removeAttribute("aria-describedby"), 
    state.iconTipTarget = null;
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
    const r = byId(e), a = JSON.stringify(t);
    r.dataset.renderKey !== a && (r.innerHTML = "function" == typeof n ? n() : n, r.dataset.renderKey = a);
}

const waitingTaskIds = new WeakMap;
let waitingTaskSequence = 0;

function renderTaskRows(id, entries, emptyMarkup) {
    const list = byId(id), previous = list._tenKeyedRows || new Map, current = new Map;
    if (!entries.length) {
        if (list._tenEmptyMarkup !== emptyMarkup || previous.size) list.innerHTML = emptyMarkup;
        list._tenEmptyMarkup = emptyMarkup, list._tenKeyedRows = current;
        return;
    }
    one(".ten-empty", list)?.remove(), delete list._tenEmptyMarkup;
    let anchor = list.firstElementChild;
    for (const entry of entries) {
        let row = previous.get(entry.key);
        if (!row || row.signature !== entry.signature) {
            const template = document.createElement("template");
            template.innerHTML = entry.render();
            const node = template.content.firstElementChild;
            if (row) {
                if (anchor === row.node) anchor = node;
                row.node.replaceWith(node);
            }
            row = { node: node, signature: entry.signature };
        }
        if (anchor !== row.node) list.insertBefore(row.node, anchor);
        anchor = row.node.nextElementSibling;
        current.set(entry.key, row);
    }
    for (const [key, row] of previous) if (!current.has(key)) row.node.remove();
    list._tenKeyedRows = current;
}

function renderWaitingTasks(queue) {
    const list = byId("ten-waiting-tasks"), count = queue ? queue.list.length : 0, revision = queue ? queue.waitingRevision || 0 : 0;
    if (list._tenWaitingQueue === queue && list._tenWaitingRevision === revision && list._tenWaitingCount === count) return;
    const entries = [];
    for (let index = count - 1; index >= 0; index--) {
        const task = queue.list[index], position = count - 1 - index;
        if (!waitingTaskIds.has(task)) waitingTaskIds.set(task, ++waitingTaskSequence);
        entries.push({
            key: waitingTaskIds.get(task),
            signature: JSON.stringify([ index, position === 0, position === count - 1, task.url, task.comicName, task.downChapterName, task.chapterName ]),
            render: () => taskCard(task, "waiting", index, position, count)
        });
    }
    renderTaskRows("ten-waiting-tasks", entries, empty("等待队列为空"));
    list._tenWaitingQueue = queue, list._tenWaitingRevision = revision, list._tenWaitingCount = count;
}

function renderHistoryRows(records, total) {
    const entries = [], occurrences = new Map;
    for (const record of records) {
        const base = JSON.stringify([ record.id, record.comicName, record.downChapterName ]), occurrence = occurrences.get(base) || 0;
        occurrences.set(base, occurrence + 1);
        entries.push({
            key: base + "|" + occurrence,
            signature: JSON.stringify([ record.id, record.downChapterName, record.status, record.hasError, record.flowUsed, record.durationMs, record.totalDurationMs, record.pausedDurationMs, record.completedAt, Array.isArray(record.failedImages) ? record.failedImages.filter(image => image && image.url).length : 0 ]),
            render: () => historyCard(record)
        });
    }
    renderTaskRows("ten-history", entries, empty(total ? "没有符合筛选条件的记录" : "暂无下载记录"));
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
    e && 0 !== state.settings.effectLevel && (clearTimeout(e._tenStateTimer), e.classList.remove("ten-state-animate", "is-state-pause", "is-state-resume", "is-state-success", "is-state-danger"), 
    e.offsetWidth, e.classList.add("ten-state-animate", `is-state-${t}`), e._tenStateTimer = setTimeout(() => {
        e.classList.remove("ten-state-animate", `is-state-${t}`);
    }, 2 === state.settings.effectLevel ? 800 : 1e3));
}

function formatSpeed(e) {
    const t = Number(e) || 0;
    return t <= 0 ? "速度计算中" : t < 1024 ? `${Math.round(t)} B/s` : t < 1048576 ? `${(t / 1024).toFixed(1)} KB/s` : `${(t / 1024 / 1024).toFixed(1)} MB/s`;
}

function energyFlowDuration(e) {
    const t = Math.max(0, Number(e) || 0), n = Math.log2(1 + t / 32768);
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
    const t = [ formatTaskDuration(e.durationMs) ], n = formatDurationValue(e.totalDurationMs), r = formatDurationValue(e.pausedDurationMs), a = formatCompletedAt(e.completedAt);
    return n && t.push(`总历时 ${n}`), Number.isFinite(Number(e.pausedDurationMs)) && r && t.push(`暂停 ${r}`), 
    a && t.push(a), t.join(" · ");
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
    n.classList.toggle("has-scroll", t > 5), t > 0 && "true" !== n.dataset.seen && (n.dataset.seen = "true", 
    n.classList.add("is-open")), 0 === t && (delete n.dataset.seen, "waiting" !== e && n.classList.remove("is-open"));
    const r = String(n.classList.contains("is-open"));
    setAttribute(one(".ten-task-title-button", n), "aria-expanded", r), setAttribute(one(".ten-task-arrow-button", n), "aria-expanded", r);
}

function toggleAllActiveTasks(e) {
    if (!state.queue) return;
    const t = "resume" !== e.currentTarget.dataset.bulkAction, n = state.queue.setAllPaused(t);
    n && toast(t ? `已暂停 ${n} 个任务` : `已继续 ${n} 个任务`), renderTasks();
}

async function cancelAllActiveTasks() {
    if (!state.queue) return;
    const e = state.queue.worker.filter(e => e && !e.cancelled).length;
    if (!e || !await showConfirm("取消全部下载任务", `确认取消当前正在进行的 ${e} 个任务？`, "全部取消")) return;
    const t = state.queue.cancelAll();
    renderTasks(), t && toast(`正在取消 ${t} 个任务`);
}

async function removeAllWaitingTasks() {
    if (!state.queue || !state.queue.list.length) return;
    const e = state.queue.list.length;
    if (!await showConfirm("移出全部等待任务", `确认将等待队列中的 ${e} 个任务全部移出？`, "全部移出")) return;
    const t = state.queue.list.slice(), n = state.queue.clearWaiting();
    renderTasks(), n && toast(`已移出 ${n} 个等待任务`, () => restoreWaitingTasks(t));
}

function restoreWaitingTasks(e) {
    state.queue && e.length && (state.queue.list.push(...e), state.queue.waitingRevision = (state.queue.waitingRevision || 0) + 1, state.queue.run(), renderTasks());
}

function taskCard(e, t, n, r = 0, a = 0) {
    const i = Math.max(0, Math.min(100, Number(e.progress || 0))), o = "active" === t, s = "paused" === e.status, c = o ? `<div class="ten-task-actions"><button class="ten-icon-btn" type="button" data-task-toggle data-task-action="${s ? "resume" : "pause"}" data-worker-index="${n}" title="${s ? "继续" : "暂停"}">${icon(s ? "play" : "pause")}</button><button class="ten-icon-btn" type="button" data-task-action="diagnostic" data-worker-index="${n}" title="诊断信息">${icon("info")}</button><button class="ten-icon-btn is-danger" type="button" data-task-action="cancel" data-worker-index="${n}" title="取消任务">${icon("close")}</button></div>` : `<div class="ten-task-actions"><button class="ten-icon-btn" type="button" data-task-action="waiting-up" data-waiting-index="${n}" title="提前一个位置" ${0 === r ? "disabled" : ""}>${icon("up")}</button><button class="ten-icon-btn" type="button" data-task-action="waiting-down" data-waiting-index="${n}" title="延后一个位置" ${r === a - 1 ? "disabled" : ""}>${icon("down")}</button><button class="ten-icon-btn is-danger" type="button" data-task-action="cancel-waiting" data-waiting-index="${n}" title="移出队列">${icon("close")}</button></div>`;
    return `<div class="ten-list-item ten-task-card"${o ? ` data-worker-card="${n}"` : ""}><div class="ten-name"><div class="ten-task-title"${o ? " data-task-title" : ""}>${escapeHtml(e.downChapterName || e.chapterName || "未命名章节")}</div>${o ? `<div class="ten-progress"><i data-task-progress${e.paused ? ' class="is-paused"' : ""} style="width:${i}%;--ten-energy-duration:${energyFlowDuration(e.speedBps)}s"></i></div><div class="ten-task-meta"><span data-task-stage>${escapeHtml(e.stage || "正在下载")}</span><span data-task-stats>${e.successNum || 0}/${e.totalNumber || "?"} · ${i}%</span></div><div class="ten-task-performance"><span data-task-speed>${formatSpeed(e.speedBps)}</span><span data-task-eta>${formatEta(e.etaSeconds)}</span></div>` : '<div class="ten-meta">等待开始</div>'}</div>${c}</div>`;
}

function historyCard(e) {
    const t = {
        completed: "已完成",
        partial: "部分失败",
        failed: "失败",
        cancelled: "已取消"
    }[e.status] || (e.hasError ? "存在错误" : "已完成"), n = Array.isArray(e.failedImages) ? e.failedImages.filter(e => e && e.url) : [];
    return `<div class="ten-list-item ten-history-card"><div class="ten-name"><div class="ten-task-title">${escapeHtml(e.downChapterName || "未命名章节")}</div><div class="ten-task-meta"><span>${formatHistoryTiming(e)}</span><span>${escapeHtml(e.flowUsed || "流程未记录")}</span><span class="ten-task-state is-${escapeAttr(e.status || (e.hasError ? "failed" : "completed"))}">${t}</span></div></div><div class="ten-task-actions">${n.length ? `<button class="ten-icon-btn" type="button" data-retry-history="${e.id}" title="仅重试 ${n.length} 张失败图片">${icon("refresh")}</button><button class="ten-icon-btn" type="button" data-copy-failures="${e.id}" title="复制失败清单">${icon("copy")}</button>` : ""}<button class="ten-icon-btn" type="button" data-diagnostic-history="${e.id}" title="诊断信息">${icon("info")}</button><button class="ten-icon-btn" type="button" data-delete-history="${e.id}" title="删除记录">${icon("trash")}</button></div></div>`;
}

function handleHistoryFilter(e) {
    const t = e.target.closest("[data-history-filter]");
    t && t.dataset.historyFilter !== state.historyFilter && (state.historyFilter = t.dataset.historyFilter, 
    renderTasks());
}

async function handleTaskAction(e) {
    const t = e.target.closest("[data-task-action]");
    if (!t || !state.queue) return;
    const n = t.dataset.taskAction;
    if ("waiting-up" === n || "waiting-down" === n) return state.queue.moveWaiting(Number(t.dataset.waitingIndex), "waiting-up" === n ? "up" : "down"), 
    renderTasks();
    if ("cancel-waiting" === n) {
        const e = Number(t.dataset.waitingIndex), n = state.queue.list[e];
        return state.queue.cancelWaiting(e) && toast("任务已移出等待队列", () => restoreWaitingTasks([ n ])), 
        renderTasks();
    }
    const r = Number(t.dataset.workerIndex), a = state.queue.worker[r];
    a && ("pause" === n && state.queue.pause(r), "resume" === n && state.queue.resume(r), 
    "diagnostic" === n && openDiagnostic(a), "cancel" === n && await showConfirm("取消下载任务", `确认取消“${a.comicName} · ${a.downChapterName}”？`, "取消任务") && state.queue.cancel(r), 
    renderTasks());
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
        const a = new Set, i = t.filter(e => {
            const t = `${e.comicName || ""}\0${e.downChapterName || ""}`;
            return !a.has(t) && (a.add(t), !0);
        }).slice(0, state.settings ? state.settings.historyLimit : boundedNumber(safeGet("historyLimit", 100), 100, 10, 500)), o = n || i.length !== t.length ? JSON.stringify(i) : e;
        return o !== e && localStorage.setItem("ylComicDownHistory", o), state.historyRaw = o, 
        state.historyCache = i, i;
    } catch (t) {
        return state.historyRaw = e, state.historyCache = [], state.historyCache;
    }
}

function writeHistory(e) {
    const t = Array.isArray(e) ? e : [], n = JSON.stringify(t);
    return localStorage.setItem("ylComicDownHistory", n), state.historyRaw = n, state.historyCache = t, 
    state.historyRenderKey = "", t;
}

async function handleHistoryClick(e) {
    const t = e.target.closest("[data-diagnostic-history]"), n = e.target.closest("[data-retry-history]"), r = e.target.closest("[data-copy-failures]"), a = e.target.closest("[data-delete-history]"), i = readHistory();
    if (t) return openDiagnostic(i.find(e => String(e.id) === t.dataset.diagnosticHistory));
    if (n) return function(e) {
        const t = Array.isArray(e && e.failedImages) ? e.failedImages.filter(e => e && e.url) : [];
        if (!t.length) return toast("没有可重试的失败图片");
        const n = e.task && "object" == typeof e.task ? e.task : {};
        enqueueDownloads([ {
            ...n,
            comicName: e.comicName,
            chapterName: e.downChapterName,
            downChapterName: e.downChapterName,
            url: n.url || e.comicPageUrl,
            readtype: void 0 === n.readtype ? 1 : n.readtype,
            downType: 0,
            retryImages: t
        } ]), toast(`已加入 ${t.length} 张失败图片`);
    }(i.find(e => String(e.id) === n.dataset.retryHistory));
    if (r) return copyFailureList(i.find(e => String(e.id) === r.dataset.copyFailures));
    if (!a) return;
    const o = i.findIndex(e => String(e.id) === a.dataset.deleteHistory), s = i[o];
    s && await showConfirm("删除下载记录", `确认删除“${s.comicName || "未命名漫画"} · ${s.downChapterName || "未命名章节"}”？`, "删除") && (i.splice(o, 1), 
    writeHistory(i), renderTasks(), toast("下载记录已删除", () => function(e, t) {
        if (!e) return;
        const n = readHistory().slice();
        n.some(t => String(t.id) === String(e.id)) || (n.splice(Math.max(0, Math.min(t, n.length)), 0, e), 
        writeHistory(n), renderTasks());
    }(s, o)));
}

function trimHistory() {
    writeHistory(readHistory().slice(0, state.settings.historyLimit)), renderTasks();
}

async function clearHistory() {
    const e = readHistory();
    if (!e.length) return toast("当前没有下载记录");
    await showConfirm("清空下载记录", `将删除全部 ${e.length} 条下载记录，此操作无法撤销。`, "全部清空") && (writeHistory([]), 
    renderTasks(), toast("下载记录已清空"));
}
