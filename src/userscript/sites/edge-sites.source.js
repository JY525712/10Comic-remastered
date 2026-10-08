/* FOUR_SITE_ADDITIONS_START: refreshed Mangabz, Manhuagui, Zero */            comicsWebInfo.unshift({
                domain: [ "mangabz.com", "www.mangabz.com" ],
                homepage: "https://www.mangabz.com/",
                webName: "Mangabz",
                comicNameCss: "p.detail-info-title",
                chapterCss: "#chapterlistload",
                readtype: 1,
                useFrame: true,
                headers: {
                    referer: "https://www.mangabz.com/"
                },
                searchTemplate_1: {
                    search_add_url: "search?title=",
                    alllist_dom_css: ".container .mh-list",
                    minlist_dom_css: "li",
                    img_src: "src"
                },
                downHeaders: {
                    referer: "https://www.mangabz.com/"
                },
                getImgs: async function(html, task) {
                    const frame = document.getElementById(task.frameId);
                    if (!frame || !frame.contentDocument || !frame.contentWindow) throw new Error("Mangabz reader did not load");
                    try {
                        const doc = frame.contentDocument, win = frame.contentWindow;
                        const range = String(doc.querySelector(".bottom-page2")?.textContent || "").match(/-\s*(\d+)/);
                        const total = range ? Number(range[1]) : 0;
                        if (!total || total > 1e3 || !doc.querySelector('a[href="javascript:ShowNext();"]')) throw new Error("Mangabz page list is unavailable");
                        const images = [];
                        for (let page = 1; page <= total; page++) {
                            if (task.signal?.aborted) throw new Error("Download cancelled");
                            if (page > 1) doc.querySelector('a[href="javascript:ShowNext();"]').click();
                            let found = "";
                            for (let attempt = 0; attempt < 80; attempt++) {
                                const current = Number(doc.querySelector("#lbcurrentpage")?.textContent || 0);
                                const src = String(doc.querySelector("#cp_image")?.getAttribute("src") || "");
                                if (current === page && /^https?:\/\//i.test(src) && !/\/loading\./i.test(src) && src !== images[images.length - 1]) {
                                    found = new URL(src, task.url).href;
                                    break;
                                }
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                            if (!found) throw new Error("Mangabz image page " + page + " timed out");
                            images.push(found);
                        }
                        return images;
                    } finally {
                        frame.remove();
                    }
                }
            });
            comicsWebInfo.push({
                domain: [ "manhuagui.com", "www.manhuagui.com" ],
                homepage: "https://www.manhuagui.com/",
                webName: "看漫画",
                comicNameCss: "h1",
                chapterCss: ".chapter-list",
                chapterNameReg: /title="([^"]+)"/,
                readtype: 1,
                useFrame: false,
                readerTabMode: "manhuagui",
                downHeaders: {
                    referer: "https://www.manhuagui.com/"
                },
                getImgs: async function(html, task) {
                    const prefix = "tenComicManhuaguiWorker:", id = Date.now().toString(36) + Math.random().toString(36).slice(2);
                    const key = prefix + id, readerUrl = String(task?.url || "").split("#")[0];
                    if (!/^https:\/\/(?:www\.)?manhuagui\.com\/comic\/\d+\/\d+\.html$/i.test(readerUrl)) throw new Error("Invalid Manhuagui chapter URL");
                    const record = {
                        id: id,
                        status: "waiting",
                        readerUrl: readerUrl,
                        images: [],
                        error: "",
                        cancelled: false,
                        updatedAt: Date.now()
                    };
                    let tab = null;
                    GM_setValue(key, record);
                    try {
                        if (typeof GM_openInTab !== "function") throw new Error("Please allow the script to open a Manhuagui reader tab");
                        tab = GM_openInTab(readerUrl + "#tencomic-mg-task=" + id, {
                            active: false,
                            insert: true,
                            setParent: true
                        });
                        for (let attempt = 0; attempt < 900; attempt++) {
                            if (task?.signal?.aborted) {
                                const current = GM_getValue(key, record);
                                GM_setValue(key, {
                                    ...current,
                                    cancelled: true,
                                    status: "cancelled"
                                });
                                throw new Error("Download cancelled");
                            }
                            const current = GM_getValue(key, null);
                            if (current?.status === "ready") {
                                const images = [ ...new Set((Array.isArray(current.images) ? current.images : []).filter(url => /^https:\/\//i.test(String(url)))) ];
                                if (!images.length) throw new Error("Manhuagui reader returned no images");
                                return images;
                            }
                            if (current?.status === "error") throw new Error(current.error || "Manhuagui reader failed");
                            await new Promise(resolve => setTimeout(resolve, 250));
                        }
                        throw new Error("Manhuagui reader tab timed out");
                    } finally {
                        GM_deleteValue(key);
                        try {
                            tab?.close?.();
                        } catch (error) {}
                    }
                }
            }, {
                domain: [ "zerobyw33.com", "www.zerobyw33.com" ],
                homepage: "https://www.zerobyw33.com/pc/pc/",
                webName: "Zero搬运网",
                comicNameCss: "main h1",
                chapterCss: "main .grid.grid-cols-2",
                readtype: 1,
                useFrame: true,
                getComicInfo: async function() {
                    let title = "", links = [];
                    for (let attempt = 0; attempt < 50; attempt++) {
                        title = String(document.querySelector("main h1")?.textContent || "").trim().split(/\r?\n|\u3010/)[0].trim();
                        links = [ ...document.querySelectorAll('main .grid.grid-cols-2 a[href*="/pc/view/index.php?zjid="]') ];
                        if (title && links.length) break;
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                    if (!title || !links.length) throw new Error("Zero comic title or chapters did not load");
                    const chapters = new Map;
                    for (const link of links) {
                        const name = String(link.textContent || "").trim(), href = link.getAttribute("href");
                        if (!name || !href) continue;
                        const url = new URL(href, location.origin).href;
                        if (!chapters.has(url)) chapters.set(url, {
                            comicName: title,
                            chapterName: name,
                            chapterNumStr: "",
                            url: url,
                            readtype: this.readtype,
                            isPay: false,
                            isSelect: false
                        });
                    }
                    return [ ...chapters.values() ];
                },
                downHeaders: {
                    referer: "https://www.zerobyw33.com/"
                },
                getImgs: async function(html, task) {
                    const frame = document.getElementById(task.frameId);
                    if (!frame || !frame.contentDocument) throw new Error("Zero reader did not load");
                    try {
                        const doc = frame.contentDocument;
                        for (let attempt = 0; attempt < 40; attempt++) {
                            if (task.signal?.aborted) throw new Error("Download cancelled");
                            const images = [ ...doc.querySelectorAll("#image-container img.manga-image") ].map(img => img.getAttribute("src") || "").filter(src => src && !/loading|placeholder/i.test(src)).map(src => new URL(src, task.url).href).filter(src => /^https?:\/\//i.test(src));
                            if (images.length) return [ ...new Set(images) ];
                            await new Promise(resolve => setTimeout(resolve, 200));
                        }
                        throw new Error("Zero reader has no accessible images");
                    } finally {
                        frame.remove();
                    }
                }
            });
            /* FOUR_SITE_ADDITIONS_END */

// SF 菠萝包：参考用户提供的下载脚本确认 picAy 数据形态；复用本站正常阅读流程。
comicsWebInfo.push({
    domain: "manhua.sfacg.com",
    homepage: "https://manhua.sfacg.com/",
    webName: "SF菠萝包漫画",
    webDesc: "在作品页加载章节；仅下载当前账号可正常阅读的章节。",
    comicNameCss: 'h1, .Reduction_left a[href^="/mh/"]',
    chapterCss: ".comic_Serial_list",
    readtype: 1,
    useFrame: true,
    hasSpend: true,
    payKey: "VIP",
    downHeaders: { referer: "https://manhua.sfacg.com/" },
    getComicInfo: async function() {
        const pageUrl = new URL(location.href);
        const match = pageUrl.pathname.match(/^\/mh\/([^/]+)\/(?:\d+\/)?$/i);
        if (!match) throw new Error("请在 SF 漫画作品页或章节阅读页加载目录");
        let root = document;
        const directoryUrl = new URL("/mh/" + match[1] + "/", pageUrl).href;
        if (/^\/mh\/[^/]+\/\d+\/$/i.test(pageUrl.pathname)) {
            const response = await (0, downloadUtils.WY)({
                method: "get", url: directoryUrl, useCookie: true,
                headers: { referer: pageUrl.href }
            });
            if (!response || response.status !== 200) throw new Error("SF 漫画目录请求失败");
            root = (0, downloadUtils.U3)(response.responseText || response.response || "");
        }
        const comicName = String(root.querySelector(this.comicNameCss)?.textContent || "").trim();
        if (!comicName) throw new Error("SF 漫画目录中未找到作品名称");
        const chapters = new Map();
        for (const list of root.querySelectorAll(this.chapterCss)) {
            // 本站每个目录分组均以最新章节在前显示。
            for (const link of [...list.querySelectorAll("a[href]")].reverse()) {
                const href = link.getAttribute("href");
                if (!href) continue;
                let url;
                try { url = new URL(href, directoryUrl); } catch (error) { continue; }
                if (!/^https?:$/.test(url.protocol) || url.hostname !== "manhua.sfacg.com") continue;
                url.protocol = pageUrl.protocol;
                const chapter = url.pathname.match(/^\/mh\/([^/]+)\/\d+\/$/i);
                if (url.origin !== pageUrl.origin || !chapter || chapter[1].toLowerCase() !== match[1].toLowerCase()) continue;
                url.search = "";
                url.hash = "";
                const isPay = /^VIP$/i.test(String(link.querySelector("b")?.textContent || "").trim());
                let chapterName = String(link.textContent || "").trim();
                if (isPay) chapterName = chapterName.replace(/^VIP\s*/i, "").trim();
                if (!chapterName || chapters.has(url.href)) continue;
                chapters.set(url.href, {
                    comicName, chapterName, chapterNumStr: "", url: url.href,
                    readtype: this.readtype, isPay, isSelect: false
                });
            }
        }
        if (!chapters.size) throw new Error("SF 漫画目录中未找到章节");
        return [...chapters.values()];
    },
    getImgs: async function(html, task) {
        const frame = document.getElementById(task?.frameId);
        if (!frame) throw new Error("SF 漫画阅读页未加载");
        try {
            const readerUrl = new URL(task.url);
            if (readerUrl.origin !== new URL(location.href).origin || !/^\/mh\/[^/]+\/\d+\/$/i.test(readerUrl.pathname)) {
                throw new Error("无法识别 SF 漫画章节地址，请打开章节阅读页");
            }
            for (let attempt = 0; attempt < 150; attempt++) {
                if (task.signal?.aborted) throw new Error("下载已取消");
                const doc = frame.contentDocument;
                // 页面全局变量不属于 DOM；隔离环境应使用已声明授权的页面窗口。
                const pageFrame = typeof unsafeWindow !== "undefined" ? unsafeWindow.document?.getElementById(task.frameId) : null;
                const win = frame.contentWindow?.wrappedJSObject || pageFrame?.contentWindow || frame.contentWindow;
                if (!doc || !win) throw new Error("SF 漫画阅读页不可读取，请先在网站正常登录并打开章节");
                if (new URL(win.location.href).pathname !== readerUrl.pathname) {
                    throw new Error("SF 漫画阅读页已跳转，请先确认该章节可正常阅读");
                }
                const pictures = win.picAy;
                if (Array.isArray(pictures) && pictures.length) {
                    // 不按图片 URL 去重：相同图片也可能占据两个不同的阅读页。
                    return Array.from(pictures, picture => {
                        if (typeof picture !== "string" || !picture.trim()) throw new Error("SF 漫画图片地址不完整");
                        const clean = picture.trim().replace(/\\\//g, "/");
                        let url;
                        try { url = new URL(clean, "https://coldpic.sfacg.com/"); } catch (error) {
                            throw new Error("SF 漫画图片地址格式错误");
                        }
                        if (!/^https?:$/.test(url.protocol)) throw new Error("SF 漫画图片地址格式错误");
                        return url.href;
                    });
                }
                const tips = doc.querySelector("#Tips");
                if (tips && tips.style.display !== "none" && String(tips.textContent || "").trim()) {
                    throw new Error("SF 漫画阅读页：" + String(tips.textContent).trim());
                }
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            throw new Error("SF 漫画图片加载超时，请确认已登录且当前账号可正常阅读该章节");
        } catch (error) {
            if (error?.name === "SecurityError") throw new Error("SF 漫画阅读页已跳转到登录或授权页面，请先在网站正常打开章节");
            throw error;
        } finally {
            frame.remove();
        }
    }
});
