            comicsWebInfo.forEach(e => {
                void 0 === e.batchDelay && (e.batchDelay = 200);
            });
            const getWebList = () => {
                const e = (0, _config_setup__WEBPACK_IMPORTED_MODULE_1__.cF)("userWebInfo"), t = Array.isArray(e) ? e : [];
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
                if (currentComics = comicsWebInfo.find(e => matchesRuleDomain(e.domain, t)) || null, 
                null === currentComics) {
                    const e = (0, _config_setup__WEBPACK_IMPORTED_MODULE_1__.cF)("userWebInfo"), n = Array.isArray(e) ? e : [];
                    currentComics = n.find(e => matchesRuleDomain(e && e.domain, t)) || null;
                }
                return null !== currentComics && "string" == typeof currentComics.getImgs && (window.request = _utils_index__WEBPACK_IMPORTED_MODULE_0__.WY, 
                currentComics.getImgs = funSplicing(currentComics.getImgs)), null !== currentComics && "string" == typeof currentComics.getComicInfo && (window.request = _utils_index__WEBPACK_IMPORTED_MODULE_0__.WY, 
                currentComics.getComicInfo = funSplicing(currentComics.getComicInfo)), currentComics;
            };
            function matchesRuleDomain(e, t) {
                return ("Array" === (0, _utils_index__WEBPACK_IMPORTED_MODULE_0__.oL)(e) ? e : [ e ]).some(e => {
                    const n = String(e || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^\*\./, "");
                    return n && (t === n || t.endsWith(`.${n}`));
                });
            }
            function funSplicing(e) {
                const t = [], n = [];
                return e.includes("funstrToData") && (t.push("funstrToData"), n.push(_utils_index__WEBPACK_IMPORTED_MODULE_0__.D)), 
                e.includes("request") && (t.push("request"), n.push(_utils_index__WEBPACK_IMPORTED_MODULE_0__.WY)), 
                e.includes("trimSpecial") && (t.push("trimSpecial"), n.push(_utils_index__WEBPACK_IMPORTED_MODULE_0__.Sc)), 
                Function(...t, `"use strict";return (${e})`)(...n);
            }
        }