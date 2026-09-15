const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const userscriptPath = process.env.USERSCRIPT_PATH || path.resolve(__dirname, "../10漫画—重制版.user.js");
const source = fs.readFileSync(userscriptPath, "utf8");

assert.match(source, /^\/\/ @grant\s+GM_openInTab$/m, "HipMH 工作标签页需要显式 GM_openInTab 授权");

const workerStart = source.indexOf("/* HIPMH_READER_WORKER_START */");
const workerEnd = source.indexOf("/* HIPMH_READER_WORKER_END */", workerStart);
assert.notEqual(workerStart, -1, "HipMH 阅读标签页 worker 不存在");
assert.notEqual(workerEnd, -1, "HipMH 阅读标签页 worker 结尾不存在");
const workerSource = source.slice(workerStart, workerEnd + "/* HIPMH_READER_WORKER_END */".length);

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    get(key) {
      return values.get(key);
    },
    set(key, value) {
      values.set(key, structuredClone(value));
    },
    delete(key) {
      values.delete(key);
    },
  };
}

(async () => {
  {
    const storage = createStorage({ unrelated: { keep: true } });
    const context = {
      location: { hostname: "example.com", hash: "#tencomic-task=ignored" },
      document: { readyState: "complete" },
      window: {},
      GM_getValue: storage.get,
      GM_setValue: storage.set,
      setTimeout,
      URLSearchParams,
    };
    vm.runInNewContext(workerSource, context);
    assert.equal(context.window.__tenComicHipmhWorkerPromise, undefined, "其他站点不得启动 HipMH worker");
    assert.deepEqual(storage.get("unrelated"), { keep: true });
  }

  {
    const key = "tenComicHipmhWorker:task-1";
    const storage = createStorage({
      unrelated: { keep: true },
      [key]: { id: "task-1", status: "waiting", readerUrl: "https://reader.hipmh.top/chapter/demo" },
    });
    let closed = false;
    const images = [
      { getAttribute: (name) => (name === "data-src" ? "https://img.example/1.webp" : null) },
      { getAttribute: (name) => (name === "data-src" ? "data:image/gif;base64,placeholder" : null) },
      { getAttribute: (name) => (name === "data-src" ? "https://img.example/1.webp" : null) },
      { getAttribute: (name) => (name === "data-src" ? "https://img.example/2.webp" : null) },
    ];
    const context = {
      location: { hostname: "reader.hipmh.top", hash: "#tencomic-task=task-1" },
      document: {
        readyState: "complete",
        getElementById(id) {
          assert.equal(id, "chapcontent");
          return {
            getAttribute(name) {
              return name === "data-total-images" ? "2" : null;
            },
            querySelectorAll(selector) {
              assert.equal(selector, ".chapter-image[data-src]");
              return images;
            },
          };
        },
      },
      window: { close() { closed = true; } },
      GM_getValue: storage.get,
      GM_setValue: storage.set,
      setTimeout,
      URLSearchParams,
      Date,
    };
    vm.runInNewContext(workerSource, context);
    await context.window.__tenComicHipmhWorkerPromise;
    assert.deepEqual(JSON.parse(JSON.stringify(storage.get(key).images)), [
      "https://img.example/1.webp",
      "https://img.example/2.webp",
    ]);
    assert.equal(storage.get(key).status, "ready");
    assert.equal(closed, true, "成功后只关闭工作标签页");
    assert.deepEqual(storage.get("unrelated"), { keep: true }, "不得改动其他存储键");
  }

  const ruleStart = source.indexOf('{domain:"m.hipmh.com"');
  const ruleEnd = source.indexOf('},{domain:["rumanhua2.com","www.rumanhua2.com"]', ruleStart);
  const storage = createStorage({ unrelated: "keep" });
  let openedUrl = "";
  let openedOptions = null;
  let tabClosed = false;
  const ruleContext = {
    URL,
    location: { origin: "https://m.hipmh.com" },
    document: { querySelectorAll() { return []; } },
    Date,
    Math,
    GM_getValue: storage.get,
    GM_setValue(key, value) {
      storage.set(key, value);
      if (value.status === "waiting") {
        storage.set(key, {
          ...value,
          status: "ready",
          images: ["https://img.example/a.webp", "https://img.example/b.webp"],
        });
      }
    },
    GM_deleteValue: storage.delete,
    GM_openInTab(url, options) {
      openedUrl = url;
      openedOptions = options;
      return { close() { tabClosed = true; } };
    },
    _utils_index__WEBPACK_IMPORTED_MODULE_0__: {
      async gw(seconds) {
        assert.equal(seconds, 0.25);
      },
    },
  };
  const rule = vm.runInNewContext(`(${source.slice(ruleStart, ruleEnd + 1)})`, ruleContext);
  const result = await rule.getImgs.call(rule, "", {
    url: "https://m.hipmh.com/chapter/go?hid=demo",
    signal: { aborted: false },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), [
    "https://img.example/a.webp",
    "https://img.example/b.webp",
  ]);
  assert.match(openedUrl, /^https:\/\/m\.hipmh\.com\/chapter\/go\?hid=demo#tencomic-task=/);
  assert.deepEqual(JSON.parse(JSON.stringify(openedOptions)), { active: false, insert: true, setParent: true });
  assert.equal(tabClosed, true, "主页面完成后应清理工作标签页句柄");
  assert.equal([...storage.values.keys()].some((keyName) => keyName.startsWith("tenComicHipmhWorker:")), false);
  assert.equal(storage.get("unrelated"), "keep");

  console.log("PASS HipMH isolated reader-tab protocol");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
