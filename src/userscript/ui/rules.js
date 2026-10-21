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
        let container = e.parentElement;
        for (let depth = 0; container && depth < 5 && !container.matches("body,html"); depth++, container = container.parentElement) {
            if (container.querySelectorAll("img").length < 2) continue;
            const scope = uniqueRuleSelector(container);
            if (scope) return `${scope} img`;
        }
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
        if (!/\d{4,}/.test(e.id) && 1 === selectorCount(t)) return t;
    }
    for (const attribute of ["data-testid", "data-role", "itemprop", "role"]) {
        const value = e.getAttribute(attribute);
        if (!value || value.length > 64 || /\d{4,}/.test(value)) continue;
        const selector = e.tagName.toLowerCase() + `[${attribute}=${JSON.stringify(value)}]`;
        if (selectorCount(selector) === 1) return selector;
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
        return [...document.querySelectorAll(e)].filter(node => !node.closest("#ten-comic-root")).length;
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

