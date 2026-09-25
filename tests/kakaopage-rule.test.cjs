const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const userscriptPath = process.env.USERSCRIPT_PATH || path.resolve(__dirname, "../10漫画—重制版.user.js");
const source = fs.readFileSync(userscriptPath, "utf8");

const ruleStart = source.indexOf('{domain:"page.kakao.com"');
assert.notEqual(ruleStart, -1, "KakaoPage 内置规则不存在");
const ruleEnd = source.indexOf('},{domain:"manga.bilibili.com"', ruleStart);
assert.notEqual(ruleEnd, -1, "无法定位 KakaoPage 规则结尾");

function episode({ href, labels, text }) {
  return {
    textContent: text,
    getAttribute(name) {
      return name === "href" ? href : null;
    },
    querySelectorAll(selector) {
      assert.equal(selector, ".font-medium2");
      return labels.map((label) => ({ textContent: label }));
    },
  };
}

const links = [
  episode({
    href: "/content/60910969/viewer/60932293/",
    labels: ["무한의 마법사 동영상", "트레일러"],
    text: "무한의 마법사 동영상 트레일러 무료 웹에서 감상불가",
  }),
  episode({
    href: "/content/60910969/viewer/60914608/",
    labels: ["무한의 마법사", "1화"],
    text: "무한의 마법사 1화 22.12.30 209쪽 무료",
  }),
  episode({
    href: "/content/60910969/viewer/60914641/",
    labels: ["무한의 마법사", "4화"],
    text: "무한의 마법사 4화 22.12.30 156쪽",
  }),
  episode({
    href: "/content/60910969/viewer/60914608/",
    labels: ["重复", "1화"],
    text: "重复 1화 무료",
  }),
];

const context = {
  URL,
  location: { origin: "https://page.kakao.com" },
  document: {
    title: "무한의 마법사 - 웹툰 | 카카오페이지",
    querySelectorAll(selector) {
      assert.equal(selector, 'a[href*="/viewer/"]');
      return links;
    },
  },
  Date,
  Math,
  GM_getValue() {},
  GM_setValue() {},
  GM_deleteValue() {},
  GM_openInTab() {},
  _utils_index__WEBPACK_IMPORTED_MODULE_0__: { async gw() {} },
};

const rule = vm.runInNewContext(`(${source.slice(ruleStart, ruleEnd + 1)})`, context);

(async () => {
  assert.equal(rule.webName, "KakaoPage");
  assert.equal(rule.readerTabMode, "kakao");
  assert.equal(rule.hasSpend, true);
  assert.equal(rule.useFrame, false);

  const chapters = await rule.getComicInfo.call(rule);
  assert.deepEqual(JSON.parse(JSON.stringify(chapters)), [
    {
      comicName: "무한의 마법사",
      chapterName: "무한의 마법사 1화",
      chapterNumStr: "",
      url: "https://page.kakao.com/content/60910969/viewer/60914608/",
      readtype: 1,
      isPay: false,
      isUnavailable: false,
      unavailableReason: "",
      isSelect: false,
    },
    {
      comicName: "무한의 마법사",
      chapterName: "무한의 마법사 4화",
      chapterNumStr: "",
      url: "https://page.kakao.com/content/60910969/viewer/60914641/",
      readtype: 1,
      isPay: true,
      isUnavailable: false,
      unavailableReason: "需要当前账号已有访问权限",
      isSelect: false,
    },
  ]);

  const workerStart = source.indexOf("/* KAKAOPAGE_READER_WORKER_START */");
  const workerEnd = source.indexOf("/* KAKAOPAGE_READER_WORKER_END */", workerStart);
  assert.notEqual(workerStart, -1, "KakaoPage 阅读 worker 不存在");
  assert.notEqual(workerEnd, -1, "KakaoPage 阅读 worker 结尾不存在");
  const workerSource = source.slice(workerStart, workerEnd + "/* KAKAOPAGE_READER_WORKER_END */".length);

  const key = "tenComicKakaoWorker:task-1";
  const storage = new Map([[key, {
    id: "task-1",
    status: "waiting",
    readerUrl: "https://page.kakao.com/content/60910969/viewer/60914608/",
  }], ["unrelated", "keep"]]);
  const responseData = {
    data: {
      viewer: {
        imageDownloadData: {
          title: "무한의 마법사 1화",
          files: [
            { secureUrl: "https://page-edge.kakao.com/2.jpg", no: 2 },
            { secureUrl: "data:image/gif;base64,placeholder", no: 3 },
            { secureUrl: "https://page-edge.kakao.com/1.jpg", no: 1 },
            { secureUrl: "https://page-edge.kakao.com/1.jpg", no: 1 },
          ],
        },
      },
    },
  };
  const workerWindow = {
    fetch: async () => ({
      headers: { get: () => "application/json" },
      clone: () => ({ text: async () => JSON.stringify(responseData) }),
    }),
    close() {},
    addEventListener() {},
  };
  function FakeXHR() {}
  FakeXHR.prototype.open = function open() {};
  FakeXHR.prototype.addEventListener = function addEventListener() {};
  const workerContext = {
    window: workerWindow,
    XMLHttpRequest: FakeXHR,
    location: {
      hostname: "page.kakao.com",
      pathname: "/content/60910969/viewer/60914608/",
      hash: "#tencomic-kakao-task=task-1",
    },
    GM_getValue: (name, fallback) => storage.has(name) ? storage.get(name) : fallback,
    GM_setValue: (name, value) => storage.set(name, structuredClone(value)),
    setTimeout: () => 1,
    clearTimeout() {},
    Date,
    JSON,
  };
  vm.runInNewContext(workerSource, workerContext);
  await workerWindow.fetch("https://page-edge.kakao.com/data");
  await Promise.resolve();
  assert.equal(storage.get(key).status, "ready");
  assert.equal(storage.get(key).title, "무한의 마법사 1화");
  assert.deepEqual(JSON.parse(JSON.stringify(storage.get(key).images)), [
    "https://page-edge.kakao.com/1.jpg",
    "https://page-edge.kakao.com/2.jpg",
  ]);
  assert.equal(storage.get("unrelated"), "keep");

  const handoffStorage = new Map([["unrelated", "keep"]]);
  let openedUrl = "";
  let openedOptions = null;
  let tabClosed = false;
  const handoffContext = {
    ...context,
    GM_getValue: (name, fallback) => handoffStorage.has(name) ? handoffStorage.get(name) : fallback,
    GM_setValue(name, value) {
      handoffStorage.set(name, structuredClone(value));
      if (value.status === "waiting") {
        handoffStorage.set(name, {
          ...value,
          status: "ready",
          images: ["https://page-edge.kakao.com/1.jpg", "https://page-edge.kakao.com/2.jpg"],
        });
      }
    },
    GM_deleteValue: (name) => handoffStorage.delete(name),
    GM_openInTab(url, options) {
      openedUrl = url;
      openedOptions = options;
      return { close() { tabClosed = true; } };
    },
  };
  const handoffRule = vm.runInNewContext(`(${source.slice(ruleStart, ruleEnd + 1)})`, handoffContext);
  const images = await handoffRule.getImgs.call(handoffRule, "", {
    url: "https://page.kakao.com/content/60910969/viewer/60914608/",
    signal: { aborted: false },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(images)), [
    "https://page-edge.kakao.com/1.jpg",
    "https://page-edge.kakao.com/2.jpg",
  ]);
  assert.match(openedUrl, /^https:\/\/page\.kakao\.com\/content\/60910969\/viewer\/60914608\/#tencomic-kakao-task=/);
  assert.deepEqual(JSON.parse(JSON.stringify(openedOptions)), { active: false, insert: true, setParent: true });
  assert.equal(tabClosed, true);
  assert.equal([...handoffStorage.keys()].some((name) => name.startsWith("tenComicKakaoWorker:")), false);
  assert.equal(handoffStorage.get("unrelated"), "keep");

  console.log("PASS KakaoPage authorized reader behavior");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
