module.exports = (webpackModule, webpackExports, webpackRequire) => {
  "use strict";

  webpackRequire.d(webpackExports, {
    Iq: () => initializeSettings,
    cF: () => getStorage,
    po: () => setStorage,
    zU: () => resetSettings
  });

  const configVersion = "2.0.8",
        configDefaults = {
    version: configVersion,
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
    imgDownRange: [1, -1],
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
  },
        localStorageDefaults = {
    ylComicDownHistory: "[]"
  },
        obsoleteKeys = ["downHistory"],
        initializeSettings = () => {
    for (const e in localStorageDefaults) null == localStorage.getItem(e) && localStorage.setItem(e, localStorageDefaults[e]);

    for (const e in configDefaults) void 0 === GM_getValue(e) && GM_setValue(e, configDefaults[e]);

    if (GM_getValue("version") !== configVersion) return obsoleteKeys.forEach(e => {
      void 0 !== GM_getValue(e) && GM_deleteValue(e);
    }), GM_setValue("version", configVersion), !0;
  },
        resetSettings = async () => {
    for (const e in configDefaults) GM_setValue(e, configDefaults[e]);

    return !0;
  },
        setStorage = (e, t, n = null) => {
    if (n) {
      const r = GM_getValue(e),
            a = r && "object" == typeof r ? r : {};
      a[n] = t, t = a;
    }

    return GM_setValue(e, t), !0;
  },
        getStorage = e => GM_getValue(e);
};
