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
}, RULE_TEMPLATES = {
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
    t && t !== state.rulePickElement && (state.rulePickElement = t, cancelAnimationFrame(state.rulePickFrame), 
    state.rulePickFrame = requestAnimationFrame(refreshRulePickBox));
}

function refreshRulePickBox() {
    if (!state.rulePicking || !state.rulePickElement?.isConnected) return;
    const e = state.rulePickElement.getBoundingClientRect();
    byId("ten-rule-pick-box").style.cssText = `left:${e.left}px;top:${e.top}px;width:${e.width}px;height:${e.height}px`, 
    byId("ten-rule-pick-selector").textContent = buildRuleSelector(state.rulePickElement, state.rulePicking.role) || "无法生成选择器，请选择其他元素";
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
    cancelAnimationFrame(state.rulePickFrame), state.rulePickFrame = null, state.rulePicking = null, 
    state.rulePickElement = null, document.removeEventListener("pointermove", handleRulePickMove, !0), 
    document.removeEventListener("click", handleRulePickClick, !0), document.removeEventListener("keydown", handleRulePickKey, !0), 
    window.removeEventListener("scroll", refreshRulePickBox, !0), window.removeEventListener("resize", refreshRulePickBox, !0), 
    byId(ROOT_ID).classList.remove("is-rule-picking"), document.documentElement.classList.remove("ten-rule-picking-page");
    const e = byId("ten-rule-pick-layer");
    e.classList.add("is-hidden"), e.setAttribute("aria-hidden", "true"), byId("ten-rule-pick-box").removeAttribute("style"), 
    syncMiniTaskBar();
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
    const t = e.tagName.toLowerCase(), n = stableRuleClasses(e);
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
    state.editRuleIndex = -1, state.editRuleBase = null, state.ruleReadType = 1, [ "ten-rule-name", "ten-rule-domain", "ten-rule-homepage", "ten-rule-desc", "ten-rule-title-selector", "ten-rule-chapter-selector", "ten-rule-image-selector", "ten-rule-getimgs" ].forEach(e => {
        byId(e) && (byId(e).value = "");
    }), byId("ten-rule-use-frame") && (byId("ten-rule-use-frame").checked = !1), byId("ten-rule-advanced") && (byId("ten-rule-advanced").open = !1), 
    byId("ten-rule-save") && (byId("ten-rule-save").textContent = "保存规则"), byId("ten-rule-cancel-edit") && (byId("ten-rule-cancel-edit").hidden = !0), 
    byId("ten-rule-test-result") && (byId("ten-rule-test-result").hidden = !0), setRuleReadType(1);
}

function readRuleEditor() {
    const e = byId("ten-rule-name").value.trim(), t = byId("ten-rule-domain").value.split(/[,，\s]+/).map(e => e.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^\*\./, "")).filter(Boolean), n = byId("ten-rule-homepage").value.trim() || (t[0] ? `https://${t[0]}/` : ""), r = byId("ten-rule-image-selector").value.trim(), a = byId("ten-rule-getimgs").value.trim(), i = Boolean(r && !a), o = a || (r ? [ "function(context, processData) {\n    const frame = processData && processData.frameId ? document.getElementById(processData.frameId) : null\n    const root = \
frame && frame.contentDocument ? frame.contentDocument : new DOMParser().parseFromString(String(context || ''), 'text/html')\n    const base = processData && \
processData.url ? processData.url : location.h", "ref\n    const urls = Array.from(root.querySelectorAll(this.imageCss)).map(img => {\n      const srcset = img.getAttribute('srcset') || \
img.getAttribute('data-srcset') || ''\n      return img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-url') || \
img.getAttribute('data-lazy-src') || img.currentSrc || (srcset.trim().spli", "t(/\\s*,\\s*/).pop() || '').trim().split(/\\s+/)[0] || img.getAttribute('src')\n    }).filter(Boolean).map(url => { try { return new URL(url, base).href } \
catch (error) { return url } })\n    if (frame) frame.remove()\n    return [...new Set(urls)]\n  }" ].join("") : "");
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
        ...state.editRuleBase || {},
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
        const t = readRuleEditor(), n = Array.isArray(t.domain) ? t.domain : [ t.domain ], r = window.location.hostname.toLowerCase(), a = [ "规则格式：通过", "域名匹配：" + (n.some(e => r === e.toLowerCase() || r.endsWith(`.${e.toLowerCase()}`)) ? "当前页面已匹配" : "当前页面不属于该规则，仅检查格式") ];
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
                e = [ ...document.querySelectorAll(t.chapterCss) ];
            } catch (e) {
                throw new Error("章节列表选择器格式不正确");
            }
            const n = e.reduce((e, t) => e + t.querySelectorAll("a").length, 0);
            a.push(`章节列表：${e.length} 个容器，${n} 个链接`);
        }
        t.imageCss && a.push(`章节图片：当前页面找到 ${document.querySelectorAll(t.imageCss).length} 张（目录页为 0 属正常）`), 
        a.push(t.simpleRule ? "图片解析：已自动生成" : "图片解析函数：语法通过（未执行网络下载）"), e.textContent = a.join("\n"), 
        e.classList.add("is-success");
    } catch (t) {
        e.textContent = `测试失败：${t.message}`, e.classList.add("is-error");
    }
}

function saveRuleEditor() {
    try {
        const e = readRuleEditor(), t = safeGet("userWebInfo", []), n = Array.isArray(t) ? t.slice() : [];
        state.editRuleIndex >= 0 && n[state.editRuleIndex] ? n[state.editRuleIndex] = e : n.unshift(e), 
        (0, configModule.po)("userWebInfo", n);
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
        const n = e => (Array.isArray(e) ? e : [ e ]).some(e => String(e || "").trim());
        if (t.some(e => !e || !n(e.domain))) throw new Error("规则域名不能为空");
        const a = t.map(e => {
            const t = {
                ...e
            };
            return [ "getImgs", "getComicInfo" ].forEach(e => {
                "function" == typeof t[e] && (t[e] = t[e].toString());
            }), t;
        }), i = safeGet("userWebInfo", []), o = Array.isArray(i) ? i : [];
        (0, configModule.po)("userWebInfo", a.concat(o)), byId("ten-rule-text").value = "", 
        state.sourceMode = 1, renderSites(), activateTab("sites"), toast(`已导入 ${t.length} 条规则`);
    } catch (e) {
        toast("规则格式不正确");
    }
}

async function clearRules() {
    await showConfirm("清空自定义规则", "将删除全部已导入规则，此操作无法撤销。", "全部清空") && ((0, configModule.po)("userWebInfo", []), 
    renderSites(), toast("导入规则已清空"));
}
