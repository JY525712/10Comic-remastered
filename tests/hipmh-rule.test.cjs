const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const userscriptPath = process.env.USERSCRIPT_PATH || path.resolve(__dirname, "../10漫画—重制版.user.js");
const source = fs.readFileSync(userscriptPath, "utf8");
assert.match(source, /^\/\/ @version\s+2\.0\.8$/m, "元数据版本必须保持 2.0.8");

const ruleStart = source.indexOf('{domain:"m.hipmh.com"');
assert.notEqual(ruleStart, -1, "HipMH 内置规则不存在");

const ruleEnd = source.indexOf('},{domain:["rumanhua2.com","www.rumanhua2.com"]', ruleStart);
assert.notEqual(ruleEnd, -1, "无法定位 HipMH 内置规则结尾");

const chapterLinks = [
  {
    textContent: "第2話",
    getAttribute(name) {
      return name === "href" ? "/chapter/go?hid=chapter-2" : null;
    },
  },
  {
    textContent: "第1話",
    getAttribute(name) {
      return name === "href" ? "/chapter/go?hid=chapter-1" : null;
    },
  },
  {
    textContent: "第1話（重复）",
    getAttribute(name) {
      return name === "href" ? "/chapter/go?hid=chapter-1" : null;
    },
  },
];

let expanded = false;
let waitCalls = 0;
const expandButton = {
  textContent: "查看所有章節",
  disabled: false,
  click() {
    expanded = true;
  },
};

const context = {
  URL,
  location: { origin: "https://m.hipmh.com" },
  document: {
    querySelectorAll(selector) {
      if (selector === "button") return [expandButton];
      if (selector === 'a[href*="/chapter/go?hid="]') return expanded ? chapterLinks : [];
      assert.fail(`未预期的选择器: ${selector}`);
    },
  },
  _utils_index__WEBPACK_IMPORTED_MODULE_0__: {
    async gw(seconds) {
      assert.equal(seconds, 0.25);
      waitCalls += 1;
    },
  },
};

const rule = vm.runInNewContext(`(${source.slice(ruleStart, ruleEnd + 1)})`, context);

(async () => {
  assert.equal(rule.webName, "嬉皮漫畫（HipMH）");
  assert.equal(rule.readerTabMode, true);
  assert.equal(rule.readtype, 1);
  assert.equal(rule.useFrame, false);

  const chapters = await rule.getComicInfo.call(rule, "测试漫画");
  assert.equal(expanded, true, "规则应展开完整章节列表");
  assert.equal(waitCalls, 1, "展开后应等待一次 DOM 更新");
  assert.deepEqual(JSON.parse(JSON.stringify(chapters)), [
    {
      comicName: "测试漫画",
      chapterName: "第2話",
      chapterNumStr: "",
      url: "https://m.hipmh.com/chapter/go?hid=chapter-2",
      readtype: 1,
      isPay: false,
      isSelect: false,
    },
    {
      comicName: "测试漫画",
      chapterName: "第1話",
      chapterNumStr: "",
      url: "https://m.hipmh.com/chapter/go?hid=chapter-1",
      readtype: 1,
      isPay: false,
      isSelect: false,
    },
  ]);

  console.log("PASS HipMH built-in rule behavior");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


