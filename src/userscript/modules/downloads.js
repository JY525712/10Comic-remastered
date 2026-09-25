module.exports = (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
  "use strict";

  __webpack_require__.d(__webpack_exports__, {
    D: () => funstrToData,
    IJ: () => selectDownloadDirectory,
    Oh: () => ensureDownloadDirectory,
    Sc: () => trimSpecial,
    U3: () => parseToDOM,
    WY: () => request,
    gJ: () => getImage,
    gw: () => delay,
    oL: () => getType,
    oZ: () => loadDirectoryHandle,
    pN: () => pathName,
    pP: () => sanitizeDownloadPath,
    sR: () => shouldRetryImageRequest,
    xo: () => addZeroForNum,
    zM: () => writeStoreZipToDirectoryV2,
    zd: () => downFile
  });
  async function writeStoreZipToDirectoryV2(path, entries, digits, onProgress, signal) {
    const root = await getDirectoryHandle();
    if (!root) return !1;
    const parts = sanitizeDownloadPath(path).split("\\").filter(Boolean),
      fileName = parts.pop();
    if (!fileName) throw new Error("ZIP 文件名不能为空");
    let directory = root;
    for (const part of parts) directory = await directory.getDirectoryHandle(part, {
      create: !0
    });
    const fileHandle = await directory.getFileHandle(fileName, {
        create: !0
      }),
      writable = await fileHandle.createWritable(),
      encoder = new TextEncoder();
    const throwIfAborted = () => {
        if (signal && signal.aborted) throw new Error("下载已取消");
      },
      abortWritable = () => {
        try {
          const result = writable.abort && writable.abort();
          result && "function" == typeof result.catch && result.catch(() => {});
        } catch (error) {}
      };
    signal && "function" == typeof signal.addEventListener && signal.addEventListener("abort", abortWritable, {
      once: !0
    });
    const crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index++) {
      let value = index;
      for (let bit = 0; bit < 8; bit++) value = 1 & value ? 3988292384 ^ value >>> 1 : value >>> 1;
      crcTable[index] = value >>> 0;
    }
    const crc32 = bytes => {
      let value = 4294967295;
      for (const byte of bytes) value = crcTable[255 & (value ^ byte)] ^ value >>> 8;
      return (4294967295 ^ value) >>> 0;
    };
    const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      write = bytes => writable.write(new Blob([bytes], {
        type: "application/octet-stream"
      }));
    let offset = 0;
    const centralRecords = [];
    try {
      throwIfAborted();
      if (entries.length >= 65535) throw new Error("ZIP 文件数量超过格式限制");
      for (let index = 0; index < entries.length; index++) {
        throwIfAborted();
        const entry = entries[index],
          imageIndex = entry.imgIndex || index + 1,
          isText = 1 === entry.blob || 0 === entry.blob,
          source = isText ? new Blob([entry.imgurl], {
            type: "text/plain"
          }) : entry.blob;
        if (!source || "function" != typeof source.arrayBuffer) throw new Error("ZIP 图片数据无法读取");
        const bytes = new Uint8Array(await source.arrayBuffer());
        entry.blob = null;
        throwIfAborted();
        const nameBytes = encoder.encode(addZeroForNum(imageIndex, digits) + (isText ? ".txt" : "." + entry.suffix)),
          checksum = crc32(bytes),
          size = bytes.length;
        if (size >= 4294967295 || offset + 30 + nameBytes.length + size >= 4294967295) throw new Error("ZIP 文件超过 4GB 格式限制");
        const localHeader = new Uint8Array(30),
          localView = view(localHeader);
        localView.setUint32(0, 67324752, !0);
        localView.setUint16(4, 20, !0);
        localView.setUint16(6, 2048, !0);
        localView.setUint16(8, 0, !0);
        localView.setUint32(14, checksum, !0);
        localView.setUint32(18, size, !0);
        localView.setUint32(22, size, !0);
        localView.setUint16(26, nameBytes.length, !0);
        await write(localHeader);
        throwIfAborted();
        await write(nameBytes);
        throwIfAborted();
        await write(bytes);
        throwIfAborted();
        const centralHeader = new Uint8Array(46 + nameBytes.length),
          centralView = view(centralHeader);
        centralView.setUint32(0, 33639248, !0);
        centralView.setUint16(4, 20, !0);
        centralView.setUint16(6, 20, !0);
        centralView.setUint16(8, 2048, !0);
        centralView.setUint16(10, 0, !0);
        centralView.setUint32(16, checksum, !0);
        centralView.setUint32(20, size, !0);
        centralView.setUint32(24, size, !0);
        centralView.setUint16(28, nameBytes.length, !0);
        centralView.setUint32(42, offset, !0);
        centralHeader.set(nameBytes, 46);
        centralRecords.push(centralHeader);
        offset += 30 + nameBytes.length + size;
        if ("function" == typeof onProgress) onProgress(index + 1, entries.length);
        await delay(0);
      }
      throwIfAborted();
      const centralOffset = offset;
      for (const record of centralRecords) {
        await write(record);
        throwIfAborted();
        offset += record.length;
      }
      const centralSize = offset - centralOffset;
      if (centralSize >= 4294967295) throw new Error("ZIP 中央目录超过格式限制");
      const endRecord = new Uint8Array(22),
        endView = view(endRecord);
      endView.setUint32(0, 101010256, !0);
      endView.setUint16(8, centralRecords.length, !0);
      endView.setUint16(10, centralRecords.length, !0);
      endView.setUint32(12, centralSize, !0);
      endView.setUint32(16, centralOffset, !0);
      await write(endRecord);
      throwIfAborted();
      await writable.close();
      throwIfAborted();
      signal && "function" == typeof signal.removeEventListener && signal.removeEventListener("abort", abortWritable);
      return !0;
    } catch (error) {
      signal && "function" == typeof signal.removeEventListener && signal.removeEventListener("abort", abortWritable);
      try {
        writable.abort && (await writable.abort());
      } catch (abortError) {}
      if (signal && signal.aborted) throw new Error("下载已取消");
      throw error;
    }
  }
  var siteRules = __webpack_require__(872),
    configModule = __webpack_require__(390);
  const loadStyle = (e, t, n) => {
      const r = document.getElementsByTagName("head")[0],
        a = document.createElement("style");
      a.name = t, a.id = t, a.innerText = n, r.appendChild(a);
    },
    loadStyle2 = e => new Promise((t, n) => {
      const r = document.getElementsByTagName("head")[0],
        a = document.createElement("link");
      a.rel = "stylesheet", a.type = "text/css", a.href = e, a.media = "all", r.appendChild(a), setTimeout(() => {
        t(!0);
      }, 1200);
    });
  function trimSpecial(e) {
    if ("" !== e) {
      const t = /[`~!@#$^\&*|{}'<>?:;~']/g;
      e = (e = e.replace(t, "")).replace(/\n|\r/g, "").trim();
    }
    return e;
  }
  function sanitizePathName(e) {
    let t = String(null == e ? "" : e).replace(/[\x00-\x1f<>:"/\\|?*]/g, " ").replace(/\s+/g, " ").replace(/[. ]+$/g, "").trim();
    return t || (t = "未命名"), /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\..*)?$/i.test(t) ? "_" + t : t;
  }
  function pathName(e) {
    return !1 === (0, configModule.cF)("sanitizePathNames") ? String(null == e ? "" : e) : sanitizePathName(e);
  }
  function sanitizeDownloadPath(e) {
    const t = String(null == e ? "" : e);
    return !1 === (0, configModule.cF)("sanitizePathNames") ? t.replace(/\s+/gi, " ") : t.split("\\").map(sanitizePathName).join("\\");
  }
  const getType = e => {
      const t = typeof e;
      return "object" !== t ? t : Object.prototype.toString.call(e).replace(/^\[object (\S+)\]$/, "$1");
    },
    getFrameContent = async (e, t) => new Promise((n, r) => {
      const a = document.createElement("iframe");
      a.id = e, a.className = "ten-comic-frame", a.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0;";
      const i = setTimeout(() => {
        a.remove(), r(new Error("iframe 加载超时"));
      }, 45e3);
      a.onload = function () {
        clearTimeout(i);
        try {
          n(a.contentDocument.body.outerHTML);
        } catch (e) {
          a.remove(), r(e);
        }
      }, a.onerror = function () {
        clearTimeout(i), a.remove(), r(new Error("iframe 加载失败"));
      }, a.src = t, document.body.appendChild(a);
    }),
    getImage = async e => {
      try {
        const t = e.url;
        let n = "";
        if (shouldLoadFrame(siteRules.Po, e)) {
          const r = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "g", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"],
            a = Math.round(25 * Math.random()) + 0,
            i = Math.round(25 * Math.random()) + 0,
            o = "ifr" + new Date().getTime() + r[a] + r[i];
          n = await getFrameContent(o, t), e.frameId = o;
        } else if (siteRules.Po.useFrame || "manhuagui" === siteRules.Po.readerTabMode) n = "";else {
          const r = await request({
            method: "get",
            url: t,
            useCookie: e.isPay,
            signal: e.signal
          });
          if (!r || "object" != typeof r) throw new Error("章节页面请求失败");
          n = r.response;
        }
        const r = await siteRules.Po.getImgs(n, e);
        return new Promise((e, t) => {
          e(r);
        });
      } catch (e) {
        throw console.log("getImageError: ", e), e;
      }
    },
    shouldLoadFrame = function (e, t) {
      return Boolean(e && e.useFrame) && !(e.reuseParsedImages && t && t.otherData);
    },
    requestLocalObjectUrl = async function (e, t) {
      try {
        if (t && t.aborted) return "abort";
        const n = await fetch(e, {
            signal: t
          }),
          r = await n.blob();
        return {
          status: n.status,
          statusText: n.statusText,
          response: r,
          responseText: "",
          responseHeaders: `content-type: ${r.type || "application/octet-stream"}\r\n`,
          finalUrl: e
        };
      } catch (e) {
        return t && t.aborted ? "abort" : "onerror";
      } finally {
        try {
          URL.revokeObjectURL(e);
        } catch (e) {}
      }
    },
    shouldRetryImageRequest = function (e, t, n) {
      return Boolean(t) && n < 2 && !String(e || "").startsWith("blob:");
    },
    request = async function (...e) {
      let t, n, r, a, i, o, s, c, d, l, u, p, h;
      1 === e.length ? ({
        method: t,
        url: n,
        data: r,
        headers: a,
        responseType: i,
        timeout: o,
        useCookie: s,
        onload: d,
        onerror: l,
        ontimeout: u,
        signal: p
      } = e[0], s && (c = document.cookie)) : ([t, n, ...h] = e, h && (h.length > 0 && (r = h[0]), h.length > 1 && (a = h[1])));
      a || null === siteRules.Po || (a = siteRules.Po.headers);
      if (n && String(n).startsWith("blob:")) return requestLocalObjectUrl(n, p);
      return new Promise(n ? e => {
        let s,
          h = !1;
        const m = t => {
            h || (h = !0, p && p.removeEventListener("abort", g), e(t));
          },
          g = () => {
            try {
              s && "function" == typeof s.abort && s.abort();
            } catch (e) {}
            m("abort");
          };
        if (p && p.aborted) return m("abort");
        try {
          s = GM_xmlhttpRequest({
            method: t,
            url: n,
            headers: a || {},
            data: r || null,
            responseType: i,
            timeout: o || 3e4,
            cookie: c || "",
            onload: function (e) {
              "function" == typeof d && d(e), m(e);
            },
            onerror: function (e) {
              "function" == typeof l ? l(e) : console.log("request-e: ", e), m("onerror");
            },
            ontimeout: function () {
              "function" == typeof u && u(), m("timeout");
            }
          }), p && !h && p.addEventListener("abort", g, {
            once: !0
          });
        } catch (e) {
          "function" == typeof l ? l(e) : console.log("request-e: ", e), m("onerror");
        }
      } : (e, t) => {
        e("");
      });
    };
  let rootDir = "10Comic";
  try {
    rootDir = (0, configModule.cF)("rootDir") || rootDir;
  } catch (e) {}
  const DIR_DB_NAME = "ten-comic-directory-db",
    DIR_DB_VERSION = 1,
    DIR_STORE_NAME = "handles",
    DIR_HANDLE_KEY = "download-directory",
    LEGACY_DIR_DB_NAME = "yl-comic-dir-db",
    LEGACY_DIR_HANDLE_KEY = "downloadDir";
  function openDirectoryDatabase(e = DIR_DB_NAME) {
    return new Promise((t, n) => {
      const r = indexedDB.open(e, DIR_DB_VERSION);
      r.onupgradeneeded = () => {
        const e = r.result;
        e.objectStoreNames.contains(DIR_STORE_NAME) || e.createObjectStore(DIR_STORE_NAME);
      }, r.onsuccess = () => t(r.result), r.onerror = () => n(r.error);
    });
  }
  async function saveDirectoryHandle(e) {
    if (e && "undefined" != typeof indexedDB) try {
      const t = await openDirectoryDatabase(),
        n = t.transaction(DIR_STORE_NAME, "readwrite");
      n.objectStore(DIR_STORE_NAME).put(e, DIR_HANDLE_KEY), await new Promise((e, t) => {
        n.oncomplete = e, n.onerror = () => t(n.error);
      }), t.close();
    } catch (e) {
      console.warn("10漫画：保存下载目录授权失败。", e);
    }
  }
  async function loadDirectoryHandle() {
    if ("undefined" == typeof indexedDB) return null;
    const e = [[DIR_DB_NAME, DIR_HANDLE_KEY], [LEGACY_DIR_DB_NAME, LEGACY_DIR_HANDLE_KEY]];
    for (const [t, n] of e) {
      const e = await readDirectoryHandle(t, n);
      if (e) return e;
    }
    return null;
  }
  async function readDirectoryHandle(e, t) {
    try {
      const n = await openDirectoryDatabase(e),
        r = n.transaction(DIR_STORE_NAME, "readonly").objectStore(DIR_STORE_NAME).get(t),
        a = await new Promise((e, t) => {
          r.onsuccess = () => e(r.result || null), r.onerror = () => t(r.error);
        });
      return n.close(), a;
    } catch (e) {
      return null;
    }
  }
  async function selectDownloadDirectory() {
    if ("function" != typeof window.showDirectoryPicker) return null;
    const e = await window.showDirectoryPicker({
      mode: "readwrite"
    });
    return window.__tenComicDirectoryHandle = e, window.__ylDirectoryHandle = e, await saveDirectoryHandle(e), e;
  }
  async function getDirectoryHandle(e = !1) {
    if ("function" != typeof window.showDirectoryPicker) return null;
    let t = window.__tenComicDirectoryHandle || window.__ylDirectoryHandle;
    if (t || (t = await loadDirectoryHandle()), t) try {
      let n = await t.queryPermission({
        mode: "readwrite"
      });
      if (e && "granted" !== n && (n = await t.requestPermission({
        mode: "readwrite"
      })), "granted" === n) return window.__tenComicDirectoryHandle = t, window.__ylDirectoryHandle = t, t;
    } catch (e) {}
    if (!e) return null;
    try {
      return await selectDownloadDirectory();
    } catch (e) {
      return null;
    }
  }
  const ensureDownloadDirectory = () => getDirectoryHandle(!0);
  async function writeToDirectory(e, t, n) {
    const r = t.split("\\").filter(Boolean),
      a = r.pop();
    let i = e;
    for (const e of r) i = await i.getDirectoryHandle(e, {
      create: !0
    });
    let o = n;
    if (!(n instanceof Blob)) {
      const e = await fetch(n);
      if (!e.ok) throw new Error(`下载文件失败：${e.status}`);
      o = await e.blob();
    }
    const s = await i.getFileHandle(a, {
        create: !0
      }),
      c = await s.createWritable();
    await c.write(o), await c.close();
  }
  const downFile = async (...e) => {
      let t, n, r, a, i, o, p;
      1 === e.length ? {
        url: t,
        name: n,
        headers: r,
        onload: a,
        onerror: i,
        ontimeout: o,
        signal: p
      } = e[0] : (t = e[0], n = e[1]), n = sanitizeDownloadPath(n);
      if (p && p.aborted) return !1;
      const s = await getDirectoryHandle();
      if (p && p.aborted) return !1;
      if (s) try {
        return await writeToDirectory(s, n, t), "function" == typeof a && a({}), !0;
      } catch (e) {
        console.warn("10漫画：写入所选目录失败，回退到浏览器下载。", e);
      }
      const c = t instanceof Blob,
        d = c ? window.URL.createObjectURL(t) : t,
        l = () => {
          c && window.URL.revokeObjectURL(d);
        };
      return new Promise(e => {
        let h = null,
          s = !1;
        const c = t => s ? !1 : (s = !0, p && p.removeEventListener("abort", u), l(), e(t), !0),
          u = () => {
            try {
              h && "function" == typeof h.abort && h.abort();
            } catch (e) {}
            c(!1);
          };
        if (p && p.aborted) return u();
        try {
          h = GM_download({
            url: d,
            name: pathName(rootDir) + "\\" + n,
            headers: r,
            onload: function (e) {
              c(!0) && "function" == typeof a && a(e);
            },
            onerror: function (e) {
              c(!1) && ("function" == typeof i && i(e), console.log("downFile-e: ", e));
            },
            ontimeout: function () {
              c(!1) && "function" == typeof o && o();
            }
          }), p && !s && p.addEventListener("abort", u, {
            once: !0
          });
        } catch (e) {
          c(!1) && ("function" == typeof i && i(e), console.log("downFile-e: ", e));
        }
      });
    },
    addZeroForNum = (e, t) => {
      let n = e + "";
      return n.length < t ? (n = new Array(t + 1).join("0") + n, n = n.slice(-t), n) : n;
    },
    getdomain = e => {
      e || (e = window.location.href);
      let t = "";
      var n = e.split("/");
      return t = n[2] ? n[2] : "", t;
    },
    parseToDOM = e => {
      var t = document.createElement("div");
      return "string" == typeof e && (t.innerHTML = e), t;
    };
  function delay(e) {
    return new Promise(function (t) {
      setTimeout(t, 1e3 * e);
    });
  }
  async function doThingsEachSecond(e, t) {
    let n,
      r = 0;
    do {
      n = t(), n ? r = e : await delay(1), r++;
    } while (r < e);
  }
  async function startScroll(e, t) {
    return new Promise((n, r) => {
      const a = setInterval(function () {
        e.scrollBy(0, 50), t.forEach((e, t) => {
          e() && (clearInterval(a), n([a, `condition_${t + 1}`]));
        });
      }, 200);
    });
  }
  const funstrToData = function funstrToData(str, reg) {
      const group = str.matchAll(reg),
        func = [];
      for (const e of group) func.push(e[1]), func.push(e[2]);
      func[1] || (func[1] = "()");
      const code = "(" + func[0] + ")" + func[1],
        data = eval(code);
      return data;
    },
    getCookie = e => {
      const t = document.cookie.split(";");
      for (let n = 0; n < t.length; n++) {
        const r = t[n].split("=");
        if (e === r[0].trim()) return r[1];
      }
      return "";
    };
};
