const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const userscriptPath = process.env.USERSCRIPT_PATH || path.resolve(__dirname, "../10漫画—重制版.user.js");
const source = fs.readFileSync(userscriptPath, "utf8");

const ruleStart = source.indexOf('{domain:"ridibooks.com"');
assert.notEqual(ruleStart, -1, "RidiBooks 内置规则不存在");
const ruleEnd = source.indexOf('},{domain:"www.webtoons.com"', ruleStart);
assert.notEqual(ruleEnd, -1, "无法定位 RidiBooks 规则结尾");

const storage = new Map([["unrelated", "keep"]]);
let openedUrl = "";
let openedOptions = null;
let tabClosed = false;
const ruleContext = {
  URL,
  Date,
  Math,
  location: { origin: "https://ridibooks.com" },
  GM_getValue: (name, fallback) => storage.has(name) ? storage.get(name) : fallback,
  GM_setValue(name, value) {
    storage.set(name, structuredClone(value));
    if (value.status === "waiting") {
      storage.set(name, {
        ...value,
        status: "ready",
        images: ["https://img.ridi.example/1.webp", "https://img.ridi.example/2.webp"],
      });
    }
  },
  GM_deleteValue: (name) => storage.delete(name),
  GM_openInTab(url, options) {
    openedUrl = url;
    openedOptions = options;
    return { close() { tabClosed = true; } };
  },
  _utils_index__WEBPACK_IMPORTED_MODULE_0__: { async gw(seconds) { assert.equal(seconds, 0.25); } },
};
const rule = vm.runInNewContext(`(${source.slice(ruleStart, ruleEnd + 1)})`, ruleContext);

(async () => {
  assert.equal(rule.webName, "RidiBooks");
  assert.equal(rule.readerTabMode, "ridi");
  assert.equal(rule.hasSpend, true);
  assert.equal(rule.useFrame, false);

  function chapterRow({ id, title, price, adult = "0" }) {
    return {
      getAttribute(name) {
        if (name === "data-price") return price;
        if (name === "data-is-adult-only") return adult;
        return null;
      },
      querySelector(selector) {
        assert.equal(selector, ".js_book_title");
        return { textContent: title };
      },
    };
  }
  const catalogLinks = [
    { href: "/books/6305000001/view", row: chapterRow({ id: "6305000001", title: "테스트 작품 1화", price: "0" }) },
    { href: "/books/6305000002/view", row: chapterRow({ id: "6305000002", title: "테스트 작품 2화", price: "300" }) },
    { href: "/books/6305000003/view", row: chapterRow({ id: "6305000003", title: "테스트 작품 성인화", price: "0", adult: "1" }) },
  ].map(({ href, row }) => ({
    getAttribute(name) { return name === "href" ? href : null; },
    closest(selector) { assert.equal(selector, "li.js_series_book_list"); return row; },
  }));
  const catalogContext = {
    ...ruleContext,
    document: {
      querySelector(selector) {
        assert.equal(selector, "h1");
        return { textContent: "테스트 작품" };
      },
      querySelectorAll(selector) {
        assert.equal(selector, 'li.js_series_book_list a[href*="/view"]');
        return catalogLinks;
      },
    },
  };
  const catalogRule = vm.runInNewContext(`(${source.slice(ruleStart, ruleEnd + 1)})`, catalogContext);
  assert.deepEqual(JSON.parse(JSON.stringify(await catalogRule.getComicInfo.call(catalogRule))), [
    {
      comicName: "테스트 작품",
      chapterName: "테스트 작품 1화",
      chapterNumStr: "",
      url: "https://ridibooks.com/books/6305000001/view",
      readtype: 1,
      isPay: false,
      isUnavailable: false,
      unavailableReason: "",
      isSelect: false,
    },
    {
      comicName: "테스트 작품",
      chapterName: "테스트 작품 2화",
      chapterNumStr: "",
      url: "https://ridibooks.com/books/6305000002/view",
      readtype: 1,
      isPay: true,
      isUnavailable: false,
      unavailableReason: "需要当前账号已有访问权限",
      isSelect: false,
    },
    {
      comicName: "테스트 작품",
      chapterName: "테스트 작품 성인화",
      chapterNumStr: "",
      url: "https://ridibooks.com/books/6305000003/view",
      readtype: 1,
      isPay: true,
      isUnavailable: true,
      unavailableReason: "年龄限制章节需要在网页端完成官方验证",
      isSelect: false,
    },
  ]);

  await assert.rejects(
    () => rule.getImgs.call(rule, "", { url: "https://ridibooks.com/webtoon/recommendation", signal: { aborted: false } }),
    /请在 RidiBooks 阅读器页面/, 
  );

  const images = await rule.getImgs.call(rule, "", {
    url: "https://ridibooks.com/books/123456/view?book_id=123456",
    signal: { aborted: false },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(images)), [
    "https://img.ridi.example/1.webp",
    "https://img.ridi.example/2.webp",
  ]);
  assert.match(openedUrl, /^https:\/\/ridibooks\.com\/books\/123456\/view\?book_id=123456#tencomic-ridi-task=/);
  assert.deepEqual(JSON.parse(JSON.stringify(openedOptions)), { active: false, insert: true, setParent: true });
  assert.equal(tabClosed, true);
  assert.equal([...storage.keys()].some((key) => key.startsWith("tenComicRidiWorker:")), false);
  assert.equal(storage.get("unrelated"), "keep");

  const workerStart = source.indexOf("/* RIDIBOOKS_READER_WORKER_START */");
  const workerEnd = source.indexOf("/* RIDIBOOKS_READER_WORKER_END */", workerStart);
  assert.notEqual(workerStart, -1, "RidiBooks 阅读 worker 不存在");
  assert.notEqual(workerEnd, -1, "RidiBooks 阅读 worker 结尾不存在");
  const workerSource = source.slice(workerStart, workerEnd + "/* RIDIBOOKS_READER_WORKER_END */".length);

  const workerKey = "tenComicRidiWorker:task-1";
  const workerStorage = new Map([[workerKey, {
    id: "task-1",
    status: "waiting",
    readerUrl: "https://ridibooks.com/books/123456/view?book_id=123456",
  }], ["unrelated", "keep"]]);
  const workerWindow = {
    fetch: async () => ({
      clone: () => ({ json: async () => ({
        data: {
          book_title: "测试 Ridi 章节",
          pages: [
            { src: "https://img.ridi.example/2.webp" },
            "https://img.ridi.example/1.webp",
            { url: "data:image/gif;base64,placeholder" },
            { image: "https://img.ridi.example/1.webp" },
          ],
        },
      }) }),
    }),
    addEventListener() {},
  };
  function FakeXHR() {}
  FakeXHR.prototype.open = function open() {};
  FakeXHR.prototype.addEventListener = function addEventListener() {};
  const workerContext = {
    window: workerWindow,
    XMLHttpRequest: FakeXHR,
    location: {
      hostname: "ridibooks.com",
      pathname: "/books/123456/view",
      hash: "#tencomic-ridi-task=task-1",
    },
    GM_getValue: (name, fallback) => workerStorage.has(name) ? workerStorage.get(name) : fallback,
    GM_setValue: (name, value) => workerStorage.set(name, structuredClone(value)),
    setTimeout: () => 1,
    clearTimeout() {},
    Date,
  };
  vm.runInNewContext(workerSource, workerContext);
  await workerWindow.fetch("https://viewer.ridibooks.com/generate?book_id=123456");
  await Promise.resolve();
  assert.equal(workerStorage.get(workerKey).status, "ready");
  assert.equal(workerStorage.get(workerKey).title, "测试 Ridi 章节");
  assert.deepEqual(JSON.parse(JSON.stringify(workerStorage.get(workerKey).images)), [
    "https://img.ridi.example/2.webp",
    "https://img.ridi.example/1.webp",
  ]);
  assert.equal(workerStorage.get("unrelated"), "keep");

  console.log("PASS RidiBooks authorized reader behavior");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
