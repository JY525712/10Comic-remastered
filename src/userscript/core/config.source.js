,
        390: (e, t, n) => {
            "use strict";
            n.d(t, {
                Iq: () => s,
                cF: () => l,
                po: () => d,
                zU: () => c
            });
            const r = "2.0.8", a = {
                version: r,
                appLoadDefault: {
                    isShowUI: !1,
                    loadHotKey: "V",
                    rightSize: 100,
                    centerSize: 100
                },
                maxChapterNum: 2,
                maxPictureNum: 3,
                downType: 0,
                directDownloadFlow: 0,
                sanitizePathNames: !0,
                maxSplicingHeight: 2e4,
                imgIndexBitNum: 3,
                imgSplicingFlag: !0,
                imgDownRange: [ 1, -1 ],
                historyLimit: 100,
                downloadNotification: !0,
                effectLevel: 1,
                themePreset: "glass",
                appearanceAxes: {
                    density: "standard",
                    shape: "standard",
                    motion: "standard"
                },
                pendingTasks: [],
                userWebInfo: [],
                rootDir: "10Comic"
            }, i = {
                ylComicDownHistory: "[]"
            }, o = [ "downHistory" ], s = () => {
                for (const e in i) null == localStorage.getItem(e) && localStorage.setItem(e, i[e]);
                for (const e in a) void 0 === GM_getValue(e) && GM_setValue(e, a[e]);
                if (GM_getValue("version") !== r) return o.forEach(e => {
                    void 0 !== GM_getValue(e) && GM_deleteValue(e);
                }), GM_setValue("version", r), !0;
            }, c = async () => {
                for (const e in a) GM_setValue(e, a[e]);
                return !0;
            }, d = (e, t, n = null) => {
                if (n) {
                    const r = GM_getValue(e), a = r && "object" == typeof r ? r : {};
                    a[n] = t, t = a;
                }
                return GM_setValue(e, t), !0;
            }, l = e => GM_getValue(e);
        }