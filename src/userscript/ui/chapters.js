function detectComicInfo(e = 0) {
    if ((0, siteRules.HL)(window.location.href), !siteRules.Po) return state.webName = "未匹配", 
    void updateChapterStatus();
    state.webName = siteRules.Po.webName;
    try {
        const e = document.querySelector(siteRules.Po.comicNameCss), t = e && String(e.innerText || e.textContent || "").split("\n")[0].trim();
        if (t) return state.comicName = t, byId("ten-current-comic").value = t, void updateChapterStatus();
    } catch (e) {
        console.warn("10漫画：漫画名称识别失败。", e);
    }
    updateChapterStatus(), e < 2 && setTimeout(() => detectComicInfo(e + 1), 1500);
}

function updateChapterStatus(e) {
    refreshRuleMatchStatus();
    const t = byId("ten-chapter-status");
    t && (t.textContent = e || `${state.webName} · ${state.comicName}`, t.classList.toggle("is-ready", Boolean(siteRules.Po && "------" !== state.comicName)), 
    byId("ten-info-site").textContent = state.webName, byId("ten-info-comic").textContent = state.comicName);
}

async function loadChapters() {
    if (state.chaptersLoading) return;
    if (!siteRules.Po) return void toast("当前网站没有匹配规则");
    state.chaptersLoading = !0;
    const e = byId("ten-load-chapters");
    e.disabled = !0, e.textContent = "正在加载…", updateChapterStatus("正在读取章节列表…");
    try {
        let e = null;
        "function" == typeof siteRules.Po.getComicInfo && (e = await siteRules.Po.getComicInfo(state.comicName)), 
        Array.isArray(e) || (e = function() {
            const e = [];
            return collectFromSelector(siteRules.Po.chapterCss, "one", e), siteRules.Po.chapterCss_2 && collectFromSelector(siteRules.Po.chapterCss_2, "many", e), 
            e;
        }()), String(siteRules.Po.homepage || "").includes("zerobyw33.com") && e[0]?.comicName && (state.comicName = e[0].comicName, 
        byId("ten-current-comic").value = state.comicName), state.chapters = e.map(normalizeChapter).filter(e => e.chapterName), 
        state.lastSelected = null, await renderChapters(), updateChapterStatus(`${state.webName} · ${state.comicName} · ${state.chapters.length} 章`);
    } catch (e) {
        console.error("10漫画：章节加载失败。", e), updateChapterStatus("章节读取失败，请检查站点规则"), toast("网站规则可能已经失效");
    } finally {
        state.chaptersLoading = !1, e.disabled = !1, e.textContent = "重新加载章节";
        if (state.chaptersReloadRequested) state.chaptersReloadRequested = !1, reloadChapters();
    }
}

function collectFromSelector(e, t, r) {
    document.querySelectorAll(e).forEach(e => {
        e.querySelectorAll("a").forEach(e => {
            if (e.closest("#ten-comic-root")) return;
            if (siteRules.Po.chapterUrlIncludes && !e.href.includes(siteRules.Po.chapterUrlIncludes)) return;
            if (siteRules.Po.chapterUrlExcludes && e.href.includes(siteRules.Po.chapterUrlExcludes)) return;
            let a = "";
            try {
                a = siteRules.Po.chapterNameReg ? (e.outerHTML.match(siteRules.Po.chapterNameReg) || [])[1] : e.innerText, 
                a = (0, downloadUtils.Sc)(a || "");
            } catch (e) {
                a = "";
            }
            let i = !1;
            siteRules.Po.hasSpend && e.parentElement && (i = e.parentElement.outerHTML.indexOf(siteRules.Po.payKey) > 0), 
            r.push({
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

function handleChapterClick(event) {
    const row = event.target.closest("[data-index]");
    if (!row || !event.currentTarget.contains(row) || event.target.closest(".ten-chapter-name")) return;
    const index = Number(row.dataset.index);
    const chapter = state.chapters[index];
    if (!canSelectChapter(chapter)) return;
    const selected = !chapter.isSelect;
    if (event.shiftKey && state.lastSelected !== null && selected) {
        const first = Math.min(state.lastSelected, index);
        const last = Math.max(state.lastSelected, index);
        for (let cursor = first; cursor <= last; cursor++) {
            if (canSelectChapter(state.chapters[cursor])) setChapterSelected(state.chapters[cursor], true);
        }
    } else setChapterSelected(chapter, selected);
    state.lastSelected = selected ? index : null;
    syncChapterControls(byId("ten-chapter-list"));
}

function handleChapterNameChange(event) {
    if (!event.target.matches(".ten-chapter-name")) return;
    const row = event.target.closest("[data-index]");
    const chapter = state.chapters[Number(row && row.dataset.index)];
    if (chapter) chapter.chapterName = event.target.value;
}

function syncChapterControls(list) {
    const hasChapters = state.chapters.length > 0;
    byId("ten-chapter-empty").hidden = hasChapters;
    byId("ten-chapter-loaded").hidden = !hasChapters;
    byId("ten-select-all").disabled = !list._tenSelectableCount;
    byId("ten-clear-select").disabled = !list._tenSelectedCount;
    byId("ten-download-selected").disabled = !list._tenSelectedCount;
    setText(byId("ten-chapter-count"), hasChapters ? `章节列表 · ${state.chapters.length}` : "章节列表");
    byId("ten-edit-list").classList.toggle("is-active", state.editMode);
}

function setChapterSelected(chapter, selected) {
    if (Boolean(chapter.isSelect) === selected) return;
    const list = byId("ten-chapter-list");
    chapter.isSelect = selected;
    if (canSelectChapter(chapter)) list._tenSelectedCount += selected ? 1 : -1;
    const row = list._tenRows?.get(chapter);
    if (row) {
        row._tenCheckbox.checked = selected;
        row.classList.toggle("is-selected", selected && canSelectChapter(chapter));
    }
}

async function renderChapters() {
    const list = byId("ten-chapter-list"), chapters = state.chapters.slice();
    const generation = list._tenRenderGeneration = (list._tenRenderGeneration || 0) + 1;
    const rows = list._tenRows || (list._tenRows = new Map), retained = new Set(chapters);
    list._tenSelectableCount = 0, list._tenSelectedCount = 0;
    for (const [chapter, row] of rows) if (!retained.has(chapter)) row.remove(), rows.delete(chapter);
    chapters.forEach((chapter, index) => {
        if (canSelectChapter(chapter)) list._tenSelectableCount++, chapter.isSelect && list._tenSelectedCount++;
        const row = rows.get(chapter);
        if (row) setAttribute(row, "data-index", index);
    });
    syncChapterControls(list);
    if (!list._tenEventsBound) {
        list.addEventListener("click", handleChapterClick);
        list.addEventListener("change", handleChapterNameChange);
        list._tenEventsBound = true;
    }
    setAttribute(list, "aria-busy", chapters.length >= 500 ? "true" : "false");
    let anchor = list.firstElementChild, sliceStarted = performance.now(), sliceRows = 0;
    for (let index = 0; index < chapters.length; index++) {
        const chapter = chapters[index];
        let row = rows.get(chapter);
        if (!row) {
            row = document.createElement("div");
            row.className = "ten-list-item";
            row.innerHTML = '<input type="checkbox"><span class="ten-chapter-label"></span><span class="ten-meta"></span>';
            row._tenCheckbox = row.firstElementChild;
            row._tenLabel = row.children[1];
            row._tenMeta = row.lastElementChild;
        }
        const disabled = !canSelectChapter(chapter);
        const name = showChapterName(chapter);
        setAttribute(row, "data-index", index);
        row.classList.toggle("is-disabled", disabled);
        row.classList.toggle("is-selected", Boolean(chapter.isSelect && !disabled));
        row._tenCheckbox.checked = Boolean(chapter.isSelect);
        row._tenCheckbox.disabled = disabled;
        setAttribute(row._tenCheckbox, "aria-label", chapter.isUnavailable ? chapter.unavailableReason || "当前账号未解锁" : `选择章节：${name}`);
        const editMode = Boolean(state.editMode);
        if (row._tenEditMode !== editMode) {
            row._tenLabel.replaceChildren();
            const label = document.createElement(editMode ? "input" : "span");
            label.className = editMode ? "ten-input ten-chapter-name" : "ten-name";
            if (editMode) label.setAttribute("aria-label", "章节名称");
            row._tenLabel.appendChild(label);
            row._tenName = label;
            row._tenEditMode = editMode;
        }
        if (editMode) {
            if (document.activeElement !== row._tenName && row._tenName.value !== chapter.chapterName) row._tenName.value = chapter.chapterName;
        } else setText(row._tenName, name);
        setAttribute(row._tenName, "title", name);
        setText(row._tenMeta, chapter.isUnavailable ? chapter.unavailableReason || "未解锁" : chapter.isPay ? "付费" : chapter.characterType === "many" ? "分卷" : "");
        rows.set(chapter, row);
        if (anchor !== row) list.insertBefore(row, anchor);
        anchor = row.nextElementSibling;
        sliceRows++;
        if (chapters.length >= 500 && index + 1 < chapters.length && (sliceRows >= 200 || sliceRows % 50 === 0 && performance.now() - sliceStarted >= 8)) {
            await yieldToBrowser(0);
            if (!list.isConnected || generation !== list._tenRenderGeneration) return;
            sliceStarted = performance.now(), sliceRows = 0;
        }
    }
    setAttribute(list, "aria-busy", "false");
}

function reloadChapters() {
    if (state.chaptersLoading) return void (state.chaptersReloadRequested = !0);
    state.chapters = [], state.lastSelected = null, state.editMode = !1, byId("ten-edit-list").classList.remove("is-active"), 
    renderChapters(), detectComicInfo(), loadChapters();
}

function selectAllChapters(e) {
    state.chapters.forEach(t => {
        setChapterSelected(t, Boolean(e && canSelectChapter(t)));
    }), state.lastSelected = null, syncChapterControls(byId("ten-chapter-list"));
}

function reverseChapters() {
    state.chapters.reverse(), state.lastSelected = null, updateChapterSequence();
}

function toggleChapterEdit() {
    state.editMode = !state.editMode, byId("ten-edit-list").classList.toggle("is-active", state.editMode), 
    byId("ten-edit-list").title = state.editMode ? "完成编辑" : "编辑名称", renderChapters();
}
