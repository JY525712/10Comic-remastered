module.exports = (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
  "use strict";

  __webpack_require__.d(__webpack_exports__, {
    HL: () => matchWeb,
    Ni: () => searchFunTemplate_1,
    Po: () => currentComics,
    eT: () => getWebList
  });
  var downloadUtils = __webpack_require__(624),
    configModule = __webpack_require__(390);
  const searchFunTemplate_1 = async (data, keyword) => {
      let {
        search_add_url: search_add_url,
        search_pre: search_pre,
        alllist_dom_css: alllist_dom_css,
        minlist_dom_css: minlist_dom_css,
        namelink_index: namelink_index,
        img_src: img_src,
        use_background: use_background,
        img_reg: img_reg,
        match_reg_num: match_reg_num
      } = data.searchTemplate_1;
      namelink_index ? namelink_index-- : namelink_index = 0;
      let searchUrl = "";
      searchUrl = search_pre ? search_pre + search_add_url + keyword : data.homepage + search_add_url + keyword;
      let headers = "";
      data.headers && (headers = data.headers);
      const {
          responseText: responseText
        } = await (0, downloadUtils.WY)({
          method: "get",
          url: searchUrl,
          data: "",
          headers: headers
        }),
        dom = (0, downloadUtils.U3)(responseText).querySelector(alllist_dom_css),
        domList = dom.querySelectorAll(minlist_dom_css),
        searchList = [];
      return domList.forEach(element => {
        const obj = {};
        try {
          obj.name = element.querySelector("a").title;
          const pathname = element.querySelector("a").pathname;
          if (obj.url = data.homepage + pathname.slice(1, pathname.length), use_background) obj.imageUrl = element.innerHTML.match(/background.*?(url)\('?(.*?)'?\)/)[2];else if (img_reg) obj.imageUrl = element.innerHTML.match(img_reg)[match_reg_num];else {
            const reg2 = eval("/" + img_src + "=('|\")(.*?)('|\")/");
            obj.imageUrl = element.innerHTML.match(reg2)[2];
          }
          if ("" === obj.name) {
            let e = element.innerHTML.match(/title=('|")(.*?)('|")/);
            e && e.length >= 2 ? obj.name = e[2] : (e = element.innerHTML.match(/alt=('|")(.*?)('|")/), e && e.length >= 2 && (obj.name = e[2])), "" === obj.name && (obj.name = element.querySelectorAll("a")[namelink_index].innerText);
          }
        } catch (e) {
          console.log("error: ", data.webName, e);
        }
        searchList.push(obj);
      }), new Promise((e, t) => {
        e(searchList);
      });
    },
    comicsWebInfo = [{
      domain: "manhua.zaimanhua.com",
      homepage: "https://manhua.zaimanhua.com/",
      webName: "再漫画",
      comicNameCss: ".wrap_intro_l_comic h1 a",
      chapterCss: ".tab-content-selected",
      readtype: 1,
      useFrame: !1,
      getImgs: async function (e, t) {
        const n = String(t && t.url || "").match(/\/view\/[^/]+\/(\d+)\/(\d+)/);
        if (!n) throw new Error("无法识别再漫画章节地址");
        const r = `https://manhua.zaimanhua.com/api/v1/comic2/chapter/detail?channel=pc&app_name=zmh&version=1.0.0&timestamp=${Date.now()}&uid=0&comic_id=${n[1]}&chapter_id=${n[2]}`,
          a = await (0, downloadUtils.WY)({
            method: "get",
            url: r,
            headers: {
              referer: t.url
            }
          });
        if (!a || "object" != typeof a) throw new Error("再漫画章节接口请求失败");
        let i;
        try {
          i = JSON.parse(a.responseText || a.response || "");
        } catch (e) {
          throw new Error("再漫画章节接口响应格式错误");
        }
        if (0 !== Number(i.errno)) throw new Error(i.errmsg || "再漫画章节接口返回错误");
        const o = i.data && i.data.chapterInfo && i.data.chapterInfo.page_url,
          s = Array.isArray(o) ? [...new Set(o.filter(e => /^https?:/i.test(String(e))))] : [];
        if (!s.length) throw new Error("再漫画图片数据加载失败");
        return s;
      }
    }, {
      domain: "comic.naver.com",
      homepage: "https://comic.naver.com/",
      webName: "comic.naver",
      comicNameCss: "#content > div.EpisodeListInfo__comic_info--yRAu0 > div > h2",
      chapterCss: "#content ul",
      chapterNameReg: /span.*?>(.*?)<\/span>/,
      webDesc: "找到漫画目录页再使用, 新打开页面需“重载列表”",
      readtype: 1,
      headers: {
        referer: "https://comic.naver.com/"
      },
      getImgs: async function (e) {
        const t = e.match(/class="wt_viewer"[\s\S]*?(<\/div>)/)[0].matchAll(/img src="(.*?)"/g),
          n = [];
        for (const e of t) n.push(e[1]);
        return n;
      }
    }, {
      domain: "ac.qq.com",
      homepage: "https://ac.qq.com/",
      webName: "腾讯漫画",
      comicNameCss: ".works-intro-title.ui-left strong",
      chapterCss: ".chapter-page-all.works-chapter-list",
      headers: "",
      readtype: 1,
      webDesc: "2023.3.2起, 需要APP观看的章节无法完整下载",
      hasSpend: !0,
      payKey: "ui-icon-pay",
      searchTemplate_1: {
        search_add_url: "Comic/searchList?search=",
        alllist_dom_css: ".mod_book_list",
        minlist_dom_css: "li",
        img_src: "data-original"
      },
      getImgs: function (context) {
        let nonce = context.match(/<script>\s*window.*?=(.*?)?;/)[1];
        nonce = eval(nonce);
        const dataStr = context.match(/DATA.*?'(.*)?'/)[1],
          data = dataStr.split("");
        nonce = nonce.match(/\d+[a-zA-Z]+/g);
        let len = nonce.length,
          locate = null,
          str = "";
        for (; len--;) locate = 255 & parseInt(nonce[len]), str = nonce[len].replace(/\d+/g, ""), data.splice(locate, str.length);
        const chapterStr = data.join(""),
          chapterObj = JSON.parse(window.atob(chapterStr)),
          imgarr = [];
        return chapterObj.picture.forEach(e => {
          imgarr.push(e.url);
        }), imgarr;
      }
    }, {
      domain: "komiic.com",
      homepage: "https://komiic.com/",
      webName: "Komiic漫画",
      comicNameCss: ".ComicMain__info .text-h6",
      chapterCss: ".v-card-text .v-container .v-row",
      chapterNameReg: / class="serial">(.*?)<\/span>/,
      webDesc: "SPA页面, 新页面需“重载列表”重新匹配新名称",
      headers: {
        referer: "https://komiic.com/"
      },
      readtype: 1,
      getImgs: async function (e, t) {
        const {
            url: n
          } = t,
          r = {
            operationName: "imagesByChapterId",
            variables: {
              chapterId: n.match(/chapter\/(\d*)\/images/)[1]
            },
            query: "query imagesByChapterId($chapterId: ID!) {\n  imagesByChapterId(chapterId: $chapterId) {\n    id\n    kid\n    height\n    width\n    __typename\n  }\n}\n"
          },
          {
            responseText: a
          } = await (0, downloadUtils.WY)({
            method: "post",
            url: "https://komiic.com/api/query",
            headers: {
              "Content-Type": "application/json"
            },
            data: JSON.stringify(r)
          }),
          i = JSON.parse(a).data.imagesByChapterId,
          o = [];
        return i.forEach(e => {
          o.push("https://komiic.com/api/image/" + e.kid);
        }), o;
      }
    }, {
      domain: ["www.baozimhcn.com", "www.baozimh.com", "cn.baozimhcn.com"],
      homepage: "https://www.baozimh.com/",
      webName: "包子漫画",
      comicNameCss: "h1.comics-detail__title",
      chapterCss: ".comics-detail > .l-content:nth-of-type(3) #chapter-items",
      chapterCss_2: ".comics-detail > .l-content:nth-of-type(3) .pure-g",
      readtype: 1,
      searchTemplate_1: {
        search_add_url: "search/?keyword=",
        alllist_dom_css: ".pure-g.classify-items",
        minlist_dom_css: "div.comics-card",
        img_reg: /src=('|")(.*?)\?/,
        match_reg_num: 2
      },
      getImgs: async function (e, t) {
        const n = [],
          r = /next_chapter"><a href="(.*)?"[\s\S]{1,10}点击进入下一页/;
        let a = !1,
          i = "";
        do {
          const t = e.matchAll(/<img.*src="(.*?)"/g);
          for (const e of t) n.includes(e[1]) || n.push(e[1]);
          if (a = r.test(e), a) {
            i = e.match(r)[1];
            const {
              responseText: t
            } = await (0, downloadUtils.WY)("get", i);
            e = t;
          }
        } while (a);
        return n;
      }
    }, {
      domain: "www.kuaikanmanhua.com",
      homepage: "https://www.kuaikanmanhua.com/",
      webName: "快看漫画",
      comicNameCss: "h3.title",
      chapterCss: ".episode-title",
      readtype: 1,
      hasSpend: !0,
      useFrame: !0,
      directRemoteDownload: !0,
      getComicInfo: async function () {
        const e = unsafeWindow.__NUXT__.data[0],
          t = e.comics,
          n = e.topicInfo.title,
          r = [];
        return t.forEach(e => {
          const t = `https://www.kuaikanmanhua.com/webs/comic-next/${e.id}`,
            a = {
              comicName: n,
              chapterName: String(e.title || "").trim(),
              chapterNumStr: "",
              url: t,
              readtype: this.readtype,
              isPay: Boolean(e.locked),
              isUnavailable: Boolean(e.locked),
              unavailableReason: e.locked ? "当前账号未解锁" : "",
              isSelect: !1
            };
          r.push(a);
        }), r;
      },
      getImgs: async function (e, t) {
        const n = document.getElementById(t.frameId);
        if (!n) throw new Error("隐藏章节页面不存在");
        try {
          const o = n.contentWindow,
            s = n.contentDocument,
            d = String(s && s.body && s.body.innerText || ""),
            l = /当前章节为付费章节/.test(d),
            u = /余额不足/.test(d) && /(立即充值|立即购买)/.test(d);
          if (l) throw new Error("当前账号未解锁此章节");
          const c = () => o.__NUXT__ && o.__NUXT__.data && o.__NUXT__.data[0] && o.__NUXT__.data[0].res && o.__NUXT__.data[0].res.data && o.__NUXT__.data[0].res.data.comic_info && o.__NUXT__.data[0].res.data.comic_info.comic_images;
          let a = c();
          for (let e = 0; e < 20 && (!Array.isArray(a) || !a.length); e++) await (0, downloadUtils.gw)(.1), a = c();
          let r = Array.isArray(a) && a.length ? a.map(e => e.url1280 || e.url).filter(Boolean) : s ? [...s.querySelectorAll(".imgList .img-box img.img")].map(e => e.getAttribute("data-src") || e.currentSrc || e.src || "").filter(e => /^https?:/i.test(e)) : [];
          if (r = [...new Set(r)], !r.length) throw new Error("快看漫画图片数据加载失败");
          if (u && r.length <= 2) throw new Error("当前账号未解锁此章节");
          return r;
        } finally {
          n.remove();
        }
      }
    }, {
      domain: "m.kuaikanmanhua.com",
      homepage: "https://m.kuaikanmanhua.com/",
      webName: "快看漫画m",
      comicNameCss: ".mask p.title",
      chapterCss: "",
      readtype: 1,
      hasSpend: !0,
      showInList: !1,
      useFrame: !0,
      directRemoteDownload: !0,
      getComicInfo: async function () {
        const code = document.body.outerHTML.match(/\(function\(a,b,c.*?(\)\))/g)[0],
          data = eval(code),
          list = data.data[0].comicList,
          comicName = (0, downloadUtils.Sc)(data.data[0].topicInfo.title),
          newlist = list.map(e => ({
            comicName: comicName,
            chapterName: (0, downloadUtils.Sc)(e.title),
            chapterNumStr: "",
            url: "https://m.kuaikanmanhua.com/mobile/comics/" + e.id,
            readtype: 1,
            isPay: !e.is_free,
            isUnavailable: Boolean(e.locked),
            unavailableReason: e.locked ? "当前账号未解锁" : "",
            isSelect: !1
          }));
        return newlist;
      },
      getImgs: async function (e, t) {
        const n = document.getElementById(t.frameId);
        if (!n) throw new Error("隐藏章节页面不存在");
        try {
          const o = n.contentWindow,
            s = n.contentDocument;
          let r = s ? [...s.querySelectorAll(".imgList .img-box img.img")].map(e => e.getAttribute("data-src") || e.currentSrc || e.src || "").filter(e => /^https?:/i.test(e)) : [];
          r = [...new Set(r)];
          const d = String(s && s.body && s.body.innerText || ""),
            l = /当前章节为付费章节/.test(d),
            u = /余额不足/.test(d) && /(立即充值|立即购买)/.test(d);
          if (l) throw new Error("当前账号未解锁此章节");
          if (!r.length) {
            let a = o.__NUXT__ && o.__NUXT__.data && o.__NUXT__.data[0] && o.__NUXT__.data[0].res && o.__NUXT__.data[0].res.data && o.__NUXT__.data[0].res.data.comic_info && o.__NUXT__.data[0].res.data.comic_info.comic_images;
            if (!Array.isArray(a) || !a.length) await (0, downloadUtils.gw)(2), a = o.__NUXT__ && o.__NUXT__.data && o.__NUXT__.data[0] && o.__NUXT__.data[0].res && o.__NUXT__.data[0].res.data && o.__NUXT__.data[0].res.data.comic_info && o.__NUXT__.data[0].res.data.comic_info.comic_images;
            if (!Array.isArray(a) || !a.length) throw new Error("快看漫画图片数据加载失败");
            r = a.map(e => e.url1280 || e.url).filter(Boolean);
          }
          r = [...new Set(r)];
          if (u && r.length <= 2) throw new Error("当前账号未解锁此章节");
          return r;
        } finally {
          n.remove();
        }
      }
    }, {
      domain: "www.dongmanmanhua.cn",
      homepage: "https://www.dongmanmanhua.cn/",
      webName: "咚漫",
      comicNameCss: "h1.subj",
      chapterCss: "#_listUl",
      chapterNameReg: /alt="(.*?)"/,
      readtype: 1,
      headers: {
        referer: "https://www.dongmanmanhua.cn/"
      },
      getImgs: async function (e) {
        const t = e.match(/class="viewer_lst[\s\S]*?input/)[0].matchAll(/img src[\s\S]*?data-url="(.*?)"/g),
          n = [];
        for (const e of t) n.push(e[1]);
        return n;
      }
    }, {
      domain: ["mangacopy.com", "www.mangacopy.com"],
      homepage: "https://www.mangacopy.com/",
      webName: "拷贝漫画",
      comicNameCss: "h6",
      chapterCss: "",
      webDesc: "仅下载页面正常加载的漫画图片",
      readtype: 1,
      useFrame: !0,
      getComicInfo: async function () {
        const e = String(document.querySelector("h6") && document.querySelector("h6").textContent || "拷贝漫画").trim() || "拷贝漫画",
          t = new Map();
        return [...document.querySelectorAll('a[href*="/chapter/"]')].forEach(n => {
          if (n.closest && n.closest(".comicParticulars-botton")) return;
          const r = String(n.getAttribute("href") || ""),
            a = String(n.textContent || "").trim();
          if (!r || !a) return;
          const i = new URL(r, location.origin).href;
          t.has(i) || t.set(i, {
            comicName: e,
            chapterName: a,
            chapterNumStr: "",
            url: i,
            readtype: this.readtype,
            isPay: !1,
            isSelect: !1
          });
        }), [...t.values()];
      },
      getImgs: async function (e, t) {
        const n = document.getElementById(t.frameId);
        if (!n) throw new Error("隐藏章节页面不存在");
        try {
          const e = n.contentWindow,
            r = n.contentDocument;
          if (!e || !r) throw new Error("无法读取隐藏章节页面");
          n.style.cssText = "position:fixed;left:-10000px;top:0;width:1200px;height:900px;opacity:0;pointer-events:none;border:0;";
          const a = () => [...r.querySelectorAll(".comicContent-list img[data-src]")].map(e => e.getAttribute("data-src") || "").filter(e => /^https?:/i.test(e) && !/\/loading\.jpg(?:[?#]|$)/i.test(e)).map(e => {
              try {
                return new URL(e, t.url).href;
              } catch (t) {
                return e;
              }
            }),
            i = [];
          let o = "",
            s = 0;
          for (let n = 0; n < 80; n++) {
            if (t && t.signal && t.signal.aborted) throw new Error("下载已取消");
            const c = [...new Set(a())],
              d = c.join("\n");
            d === o ? s++ : (o = d, s = 0), i.splice(0, i.length, ...c);
            const l = Math.max(Number(r.documentElement && r.documentElement.scrollHeight || 0), Number(r.body && r.body.scrollHeight || 0)),
              u = Number(e.scrollY || 0) + Number(e.innerHeight || 0) >= l - 4;
            if (i.length && u && s >= 3) break;
            e.scrollBy(0, Math.max(1e3, Number(e.innerHeight) || 900)), await (0, downloadUtils.gw)(.15);
          }
          if (!i.length) throw new Error("拷贝漫画 阅读页未找到漫画图片");
          return i;
        } finally {
          n.remove();
        }
      }
    }, {
      domain: "ridibooks.com",
      homepage: "https://ridibooks.com/webtoon/recommendation",
      webName: "RidiBooks",
      comicNameCss: "h1",
      chapterCss: "",
      webDesc: "免费或已授权章节",
      readtype: 1,
      hasSpend: !0,
      useFrame: !1,
      readerTabMode: "ridi",
      directRemoteDownload: !1,
      getComicInfo: async function () {
        const e = document.querySelector("h1"),
          t = String(e && e.textContent || "RidiBooks").trim() || "RidiBooks",
          n = () => [...document.querySelectorAll('li.js_series_book_list a[href*="/view"]')];
        let r = n();
        for (let e = 0; e < 40 && !r.length; e++) await (0, downloadUtils.gw)(.25), r = n();
        if (!r.length) throw new Error("未找到 RidiBooks 章节列表");
        const a = new Map();
        return r.forEach(e => {
          const n = e.closest("li.js_series_book_list"),
            r = e.getAttribute("href") || "";
          if (!n || !r) return;
          const i = new URL(r, location.origin).href;
          if (a.has(i)) return;
          const o = String(n.querySelector(".js_book_title") && n.querySelector(".js_book_title").textContent || "").trim();
          if (!o) return;
          const s = Number(n.getAttribute("data-price") || 0) > 0,
            c = String(n.getAttribute("data-is-adult-only") || "0") === "1";
          a.set(i, {
            comicName: t,
            chapterName: o,
            chapterNumStr: "",
            url: i,
            readtype: this.readtype,
            isPay: s || c,
            isUnavailable: c,
            unavailableReason: c ? "年龄限制章节需要在网页端完成官方验证" : s ? "需要当前账号已有访问权限" : "",
            isSelect: !1
          });
        }), [...a.values()];
      },
      getImgs: async function (e, t) {
        const n = "tenComicRidiWorker:",
          r = Date.now().toString(36) + Math.random().toString(36).slice(2),
          a = n + r,
          i = String(t && t.url || "");
        if (!/^https:\/\/ridibooks\.com\/books\/\d+\/view/i.test(i)) throw new Error("请在 RidiBooks 阅读器页面使用“下载当前章节”");
        const o = i + (i.includes("#") ? "&" : "#") + "tencomic-ridi-task=" + r,
          s = {
            id: r,
            status: "waiting",
            readerUrl: i,
            images: [],
            error: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            cancelled: !1
          };
        let c = null;
        GM_setValue(a, s);
        try {
          if ("function" != typeof GM_openInTab) throw new Error("请允许脚本打开一个 RidiBooks 阅读标签页");
          c = GM_openInTab(o, {
            active: !1,
            insert: !0,
            setParent: !0
          });
          for (let e = 0; e < 360; e++) {
            if (t && t.signal && t.signal.aborted) {
              const e = GM_getValue(a, s);
              throw GM_setValue(a, {
                ...e,
                cancelled: !0,
                status: "cancelled",
                updatedAt: Date.now()
              }), new Error("下载已取消");
            }
            const e = GM_getValue(a, null);
            if (e && "ready" === e.status) {
              const t = [...new Set((Array.isArray(e.images) ? e.images : []).map(String).filter(e => /^https:\/\//i.test(e)))];
              if (!t.length) throw new Error("RidiBooks 阅读器没有返回图片");
              return t;
            }
            if (e && "error" === e.status) throw new Error(e.error || "RidiBooks 章节未授权或读取失败");
            await (0, downloadUtils.gw)(.25);
          }
          throw new Error("RidiBooks 阅读标签页响应超时；请确认章节免费或当前账号已有访问权限");
        } finally {
          GM_deleteValue(a);
          try {
            c && "function" == typeof c.close && c.close();
          } catch (e) {}
        }
      }
    }, {
      domain: "www.webtoons.com",
      homepage: "https://www.webtoons.com/",
      webName: "Webtoons",
      comicNameCss: ".subj",
      chapterCss: "#_listUl",
      readtype: 1,
      useFrame: !1,
      getImgs: function (e) {
        const t = (0, downloadUtils.U3)(e),
          n = [...t.querySelectorAll("#_imageContainer img, .viewer_img img, ._imageContainer img")].map(e => e.getAttribute("data-url") || e.getAttribute("src") || "").filter(e => /^https?:/i.test(e)),
          r = [...new Set(n)];
        if (!r.length) throw new Error("Webtoons 图片数据加载失败");
        return r;
      }
    }, {
      domain: "page.kakao.com",
      homepage: "https://page.kakao.com/",
      webName: "KakaoPage",
      comicNameCss: "",
      chapterCss: "",
      webDesc: "仅下载免费章节或当前账号已经购买/有权访问的章节",
      headers: {
        referer: "https://page.kakao.com/"
      },
      downHeaders: {
        referer: "https://page.kakao.com/"
      },
      readtype: 1,
      hasSpend: !0,
      useFrame: !1,
      readerTabMode: "kakao",
      directRemoteDownload: !1,
      getComicInfo: async function () {
        const e = () => [...document.querySelectorAll('a[href*="/viewer/"]')];
        let t = e();
        for (let e = 0; e < 40 && !t.length; e++) await (0, downloadUtils.gw)(.25), t = e();
        if (!t.length) throw new Error("未找到 KakaoPage 章节列表");
        const n = String(document.title || "KakaoPage").replace(/\s*-\s*(?:웹툰|웹소설|책)[\s\S]*$/, "").replace(/\s*\|\s*카카오페이지[\s\S]*$/, "").trim() || "KakaoPage",
          r = new Map();
        return t.forEach(e => {
          const t = String(e.textContent || "").replace(/\s+/g, " ").trim();
          if (!t || /동영상|웹에서\s*감상불가/.test(t)) return;
          const a = e.getAttribute("href") || "",
            i = new URL(a, location.origin).href;
          if (!/^https:\/\/page\.kakao\.com\/content\/\d+\/viewer\/\d+\/?/i.test(i) || r.has(i)) return;
          const o = [...e.querySelectorAll(".font-medium2")].map(e => String(e.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" ").trim() || t,
            s = /무료/.test(t);
          r.set(i, {
            comicName: n,
            chapterName: o,
            chapterNumStr: "",
            url: i,
            readtype: this.readtype,
            isPay: !s,
            isUnavailable: !1,
            unavailableReason: s ? "" : "需要当前账号已有访问权限",
            isSelect: !1
          });
        }), [...r.values()];
      },
      getImgs: async function (e, t) {
        const n = "tenComicKakaoWorker:",
          r = Date.now().toString(36) + Math.random().toString(36).slice(2),
          a = n + r,
          i = String(t && t.url || "");
        if (!/^https:\/\/page\.kakao\.com\/content\/\d+\/viewer\/\d+\/?/i.test(i)) throw new Error("无法识别 KakaoPage 章节地址");
        const o = i + (i.includes("#") ? "&" : "#") + "tencomic-kakao-task=" + r,
          s = {
            id: r,
            status: "waiting",
            readerUrl: i,
            images: [],
            error: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            cancelled: !1
          };
        let c = null;
        GM_setValue(a, s);
        try {
          if ("function" != typeof GM_openInTab) throw new Error("请允许脚本打开一个 KakaoPage 阅读标签页");
          c = GM_openInTab(o, {
            active: !1,
            insert: !0,
            setParent: !0
          });
          for (let e = 0; e < 360; e++) {
            if (t && t.signal && t.signal.aborted) {
              const e = GM_getValue(a, s);
              throw GM_setValue(a, {
                ...e,
                cancelled: !0,
                status: "cancelled",
                updatedAt: Date.now()
              }), new Error("下载已取消");
            }
            const e = GM_getValue(a, null);
            if (e && "ready" === e.status) {
              const t = [...new Set((Array.isArray(e.images) ? e.images : []).map(String).filter(e => /^https:\/\//i.test(e)))];
              if (!t.length) throw new Error("KakaoPage 阅读器没有返回图片");
              return t;
            }
            if (e && "error" === e.status) throw new Error(e.error || "KakaoPage 章节未授权或读取失败");
            await (0, downloadUtils.gw)(.25);
          }
          throw new Error("KakaoPage 阅读标签页响应超时；请确认章节免费或当前账号已有访问权限");
        } finally {
          GM_deleteValue(a);
          try {
            c && "function" == typeof c.close && c.close();
          } catch (e) {}
        }
      }
    }, {
      domain: "manga.bilibili.com",
      homepage: "https://manga.bilibili.com/",
      webName: "哔哩哔哩漫画",
      comicNameCss: "h1.manga-title.t-no-wrap",
      chapterCss: ".episode-list",
      webDesc: "仅下载免费或当前账号已购买章节",
      headers: {
        referer: "https://manga.bilibili.com/"
      },
      readtype: 0,
      hasSpend: !0,
      useFrame: !0,
      reuseParsedImages: !0,
      heavyCanvasExport: !0,
      getComicInfo: async function () {
        const e = location.href.match(/\/(?:detail\/)?mc(\d+)/);
        if (!e) throw new Error("无法识别哔哩哔哩漫画ID");
        const t = Number(e[1]),
          n = unsafeWindow && unsafeWindow.document ? unsafeWindow.document : document,
          r = () => {
            const e = n.querySelector(".episode-list-component"),
              t = e && e.__vue__,
              r = t && t.episodeList;
            return Array.isArray(r) ? r.flat().filter(e => e && e.id) : [];
          };
        let a = r();
        for (let e = 0; e < 50 && !a.length; e++) await (0, downloadUtils.gw)(.1), a = r();
        if (!a.length) throw new Error("哔哩哔哩桌面章节数据加载失败，请刷新页面后重试");
        const i = n.querySelector(".manga-title"),
          o = String(i && i.textContent || n.title || "").trim().replace(/\s*-\s*哔哩哔哩漫画\s*$/, "");
        return a.slice().sort((e, t) => Number(e.ord) - Number(t.ord)).map(e => {
          const n = Boolean((void 0 !== e.isLocked ? e.isLocked : e.is_locked) && !(void 0 !== e.isInFree ? e.isInFree : e.is_in_free)),
            r = String(e._shortTitle || e.shortTitle || e.short_title || ""),
            a = String(e.title || "");
          return {
            comicName: o,
            chapterName: (r + " " + a).trim(),
            chapterNumStr: "",
            url: "https://manga.bilibili.com/mc" + t + "/" + e.id,
            readtype: this.readtype,
            isPay: n,
            isUnavailable: n,
            unavailableReason: n ? "当前账号未解锁" : "",
            isSelect: !1
          };
        });
      },
      getImgs: async function (e, t) {
        let n = t.otherData;
        const r = () => {
          n && "function" == typeof n.cleanup && n.cleanup();
        };
        try {
          if (!n) {
            const e = document.getElementById(t.frameId);
            if (!e) throw new Error("隐藏章节页面不存在");
            n = {
              frame: e,
              canvasHelper: null,
              canvasToBlob: null,
              cleanup() {
                this.canvasHelper && this.canvasHelper.remove(), this.frame && this.frame.remove(), this.canvasHelper = null, this.canvasToBlob = null, this.frame = null, this.win = null, this.doc = null, this.range = null;
              }
            };
            const r = e.contentWindow,
              a = e.contentDocument;
            if (!r || !a) throw new Error("无法读取隐藏章节页面");
            let i = null,
              o = [];
            for (let e = 0; e < 60; e++) {
              if (t.signal && t.signal.aborted) throw new Error("下载已取消");
              i = a.querySelector(".range-input"), o = [...a.querySelectorAll(".image-list .image-item")];
              if (i && o.length) break;
              await (0, downloadUtils.gw)(.25);
            }
            if (!i || !o.length) throw new Error("章节未授权或阅读器加载失败");
            const s = (0, configModule.cF)("imgDownRange"),
              c = Math.max(1, parseInt(Array.isArray(s) ? s[0] : 1) || 1),
              d = Array.isArray(s) ? parseInt(s[1]) : -1,
              l = Math.min(o.length, -1 === d ? o.length : Math.max(c - 1, d));
            if (l <= c - 1) throw new Error("所选下载范围内没有图片");
            const u = document.createElement("iframe");
            u.className = "ten-comic-canvas-helper", u.src = "about:blank", u.style.cssText = "display:none!important", document.documentElement.appendChild(u), n.canvasHelper = u;
            let p = null;
            for (let e = 0; e < 20; e++) {
              if (p = u.contentWindow && u.contentWindow.HTMLCanvasElement && u.contentWindow.HTMLCanvasElement.prototype.toBlob, "function" == typeof p) break;
              await (0, downloadUtils.gw)(.05);
            }
            if ("function" != typeof p) throw new Error("无法获取原生 Canvas 导出方法");
            Object.assign(n, {
              cursor: 0,
              total: l - c + 1,
              start: c - 1,
              win: r,
              doc: a,
              range: i,
              canvasToBlob: p
            });
          }
          if (t.signal && t.signal.aborted) throw new Error("下载已取消");
          const a = Math.max(1, Math.min(5, Math.trunc(Number(t.batchSize) || 1))),
            i = n.cursor,
            o = Math.min(n.total, i + a),
            s = [],
            c = [];
          for (let e = i; e < o; e++) {
            const r = n.start + e;
            s.push(r);
            let a = null;
            for (let e = 0; e < 80; e++) {
              if (t.signal && t.signal.aborted) throw new Error("下载已取消");
              if ((0 === e || e && 0 === e % 20) && (n.range.value = String(r), n.range.dispatchEvent(new n.win.Event("input", {
                bubbles: !0
              }))), (a = [...n.doc.querySelectorAll(".image-list .image-item")][r]) && a.classList.contains("image-loaded") && (a = a.querySelector("canvas"))) break;
              a = null, await (0, downloadUtils.gw)(.25);
            }
            if (!a) throw new Error("漫画第 " + (r + 1) + " 页加载超时，请确认该章节已购买或仍在限免");
            c.push(a);
          }
          const l = await Promise.all(c.map(async (e, d) => {
              let r;
              for (let a = 0; a < 2; a++) try {
                return await new Promise((t, r) => n.canvasToBlob.call(e, e => e && e.size > 1024 ? t(e) : r(new Error("漫画第 " + (s[d] + 1) + " 页画布导出失败")), "image/jpeg", .92));
              } catch (e) {
                if (r = e, 1 === a) throw r;
                await (0, downloadUtils.gw)(.05);
              }
              throw r;
            })),
            u = [];
          try {
            for (const e of l) u.push(URL.createObjectURL(e));
          } catch (e) {
            for (const e of u) try {
              URL.revokeObjectURL(e);
            } catch (e) {}
            throw e;
          }
          return n.cursor = o, n.cursor >= n.total && n.cleanup(), {
            imgUrlArr: u,
            imgIndexStart: n.start + i + 1,
            nextPageUrl: n.cursor < n.total ? t.url : null,
            nextPageDelay: 0,
            imgCount: n.total,
            otherData: n
          };
        } catch (e) {
          throw r(), e;
        }
      }
    }, {
      domain: "m.hipmh.com",
      homepage: "https://m.hipmh.com/",
      webName: "嬉皮漫畫（HipMH）",
      comicNameCss: "aside h1, h1",
      chapterCss: "",
      webDesc: "免费漫画站点；下载时使用单个阅读标签页",
      readtype: 1,
      useFrame: !1,
      readerTabMode: !0,
      getComicInfo: async function (e) {
        const t = () => [...document.querySelectorAll('a[href*="/chapter/go?hid="]')],
          n = [...document.querySelectorAll("button")].find(e => /查看所有章[節节]/.test(String(e.textContent || "")));
        let r = t();
        if (!r.length && n && !n.disabled) {
          n.click();
          for (let e = 0; e < 20 && !r.length; e++) await (0, downloadUtils.gw)(.25), r = t();
        }
        if (!r.length) throw new Error("未找到 HipMH 章节列表");
        const a = new Map();
        return r.forEach(t => {
          const n = String(t.textContent || "").trim(),
            r = t.getAttribute("href") || "";
          if (!n || !r) return;
          const i = new URL(r, location.origin),
            o = i.searchParams.get("hid");
          if (!o) return;
          const s = new URL("/chapter/" + encodeURIComponent(o), "https://reader.hipmh.top").href;
          a.has(s) || a.set(s, {
            comicName: e,
            chapterName: n,
            chapterNumStr: "",
            url: s,
            readtype: this.readtype,
            isPay: !1,
            isSelect: !1
          });
        }), [...a.values()];
      },
      getImgs: async function (e, t) {
        const n = "tenComicHipmhWorker:",
          r = Date.now().toString(36) + Math.random().toString(36).slice(2),
          a = n + r,
          i = String(t && t.url || "");
        if (!/^https:\/\/reader\.hipmh\.top\/chapter\//i.test(i)) throw new Error("无法识别 HipMH 章节地址");
        const o = i + (i.includes("#") ? "&" : "#") + "tencomic-task=" + r,
          s = {
            id: r,
            status: "waiting",
            readerUrl: i,
            images: [],
            error: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            cancelled: !1
          };
        let c = null;
        GM_setValue(a, s);
        try {
          if ("function" != typeof GM_openInTab) throw new Error("请允许脚本打开一个 HipMH 阅读标签页");
          c = GM_openInTab(o, {
            active: !1,
            insert: !0,
            setParent: !0
          });
          for (let e = 0; e < 480; e++) {
            if (t && t.signal && t.signal.aborted) {
              const e = GM_getValue(a, s);
              throw GM_setValue(a, {
                ...e,
                cancelled: !0,
                status: "cancelled",
                updatedAt: Date.now()
              }), new Error("下载已取消");
            }
            const e = GM_getValue(a, null);
            if (e && "ready" === e.status) {
              const t = [...new Set((Array.isArray(e.images) ? e.images : []).filter(e => /^https:\/\//i.test(String(e))))];
              if (!t.length) throw new Error("HipMH 阅读页没有返回图片");
              return t;
            }
            if (e && "error" === e.status) throw new Error(e.error || "HipMH 阅读页处理失败");
            await (0, downloadUtils.gw)(.25);
          }
          throw new Error("HipMH 阅读标签页响应超时");
        } finally {
          GM_deleteValue(a);
          try {
            c && "function" == typeof c.close && c.close();
          } catch (e) {}
        }
      }
    }, {
      domain: ["rumanhua2.com", "www.rumanhua2.com"],
      homepage: "https://www.rumanhua2.com/",
      webName: "如漫画",
      comicNameCss: "h1.name_mh",
      chapterCss: ".chapterlistload",
      readtype: 1,
      useFrame: !0,
      getComicInfo: async function (e) {
        const t = () => [...document.querySelectorAll(".chapterlistload a[href]")],
          n = t().length,
          r = document.querySelector(".chaplist-more button");
        if (r && !r.disabled && (!r.getClientRects || r.getClientRects().length)) {
          r.click();
          let e = 0;
          for (; e < 20 && t().length <= n; e++) await (0, downloadUtils.gw)(.25);
          if (t().length <= n) throw new Error("完整章节列表加载超时");
        }
        const a = t();
        if (!a.length) throw new Error("未找到章节列表");
        const i = new Map();
        return a.forEach(t => {
          const n = String(t.textContent || "").trim(),
            r = t.href;
          n && r && !i.has(r) && i.set(r, {
            comicName: e,
            chapterName: n,
            chapterNumStr: "",
            url: r,
            readtype: this.readtype,
            isPay: !1,
            isSelect: !1
          });
        }), [...i.values()];
      },
      getImgs: async function (e, t) {
        const n = document.getElementById(t.frameId);
        if (!n) throw new Error("隐藏章节页面不存在");
        try {
          const e = n.contentDocument;
          if (!e) throw new Error("无法读取隐藏章节页面");
          const r = () => {
            const n = [...e.querySelectorAll(".main_img .chapter-img-box img")].map(e => {
              const n = e.getAttribute("data-src") || e.getAttribute("src") || "";
              if (!n || /\/static\/images\/load\.gif(?:[?#]|$)/i.test(n)) return "";
              try {
                return new URL(n, t.url || this.homepage).href;
              } catch (e) {
                return n;
              }
            }).filter(Boolean);
            return [...new Set(n)];
          };
          let a = [],
            i = "",
            o = 0;
          for (let e = 0; e < 20; e++) {
            if (t && t.signal && t.signal.aborted) throw new Error("下载已取消");
            const n = r(),
              s = n.join("\n");
            s && s === i ? o += 1 : o = 0, a = n, i = s;
            if (a.length && e >= 6 && o >= 3) break;
            await (0, downloadUtils.gw)(.25);
          }
          if (!a.length) throw new Error("章节页面未找到漫画图片");
          return a;
        } finally {
          n.remove();
        }
      }
    }];
  /*__EDGE_SITE_RULES__*/
  comicsWebInfo.forEach(e => {
    void 0 === e.batchDelay && (e.batchDelay = 200);
  });
  const getWebList = () => {
    const e = (0, configModule.cF)("userWebInfo"),
      t = Array.isArray(e) ? e : [];
    return {
      originalInfo: comicsWebInfo,
      userWebInfo: t
    };
  };
  let currentComics = null;
  const matchWeb = e => {
    let t = "";
    try {
      t = new URL(e || window.location.href).hostname.toLowerCase();
    } catch (e) {
      return null;
    }
    if (currentComics = comicsWebInfo.find(e => matchesRuleDomain(e.domain, t)) || null, null === currentComics) {
      const e = (0, configModule.cF)("userWebInfo"),
        n = Array.isArray(e) ? e : [];
      currentComics = n.find(e => matchesRuleDomain(e && e.domain, t)) || null;
    }
    return null !== currentComics && "string" == typeof currentComics.getImgs && (window.request = downloadUtils.WY, currentComics.getImgs = funSplicing(currentComics.getImgs)), null !== currentComics && "string" == typeof currentComics.getComicInfo && (window.request = downloadUtils.WY, currentComics.getComicInfo = funSplicing(currentComics.getComicInfo)), currentComics;
  };
  function matchesRuleDomain(e, t) {
    return ("Array" === (0, downloadUtils.oL)(e) ? e : [e]).some(e => {
      const n = String(e || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^\*\./, "");
      return n && (t === n || t.endsWith(`.${n}`));
    });
  }
  function funSplicing(e) {
    const t = [],
      n = [];
    return e.includes("funstrToData") && (t.push("funstrToData"), n.push(downloadUtils.D)), e.includes("request") && (t.push("request"), n.push(downloadUtils.WY)), e.includes("trimSpecial") && (t.push("trimSpecial"), n.push(downloadUtils.Sc)), Function(...t, `"use strict";return (${e})`)(...n);
  }
};
