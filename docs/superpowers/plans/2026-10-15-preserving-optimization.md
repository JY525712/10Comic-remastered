# 10漫画保持功能的优化计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按用户认可的方案优化代码、UI、交互与运行开销，完整保留现有功能和数据兼容。

**Architecture:** 基于与用户附件一致的 2.0.11 源码，保留原生 DOM 与单文件用户脚本架构。构建阶段组合可编辑 CSS、模板和功能片段，运行时继续使用原有接口与站点适配。

**Tech Stack:** JavaScript、原生 DOM/CSS、Node test、Playwright Chromium、现有 Babel/Terser 构建。

**Spec:** 本聊天中用户认可的渐进优化方案；完整约束如下。

## Global Constraints

- 四个主入口、六套主题、外观设置、快捷键和脚本菜单保持兼容。
- 所有站点规则、搜索顺序、章节选择/Shift 连选/排序/改名、规则编辑与可视化选择保留。
- 下载并发、重试、三种输出、命名、图片顺序/范围、目录及授权语义保持兼容。
- 旧设置键、历史记录、规则、备份格式和未完成任务恢复保持兼容。
- 保留 @name、@namespace、@match、@grant、@connect 和 @noframes；仅升级版本。
- 原版留存为 baseline/original-2.0.11.user.js；用户下载目录原件不覆盖。
- 用户已明确要求执行给出的方案，采用当前会话直接实施，不重复征询授权。

## Review Focus

1. 长章节列表勾选、Shift 连选、改名、反转后索引映射与焦点、滚动保持正确。
2. 弹窗、抽屉叠加时 Tab/Escape 只影响最上层，关闭后回到仍存在的触发元素。
3. 320px 窄屏、横屏低高度、125% 缩放、六主题及减弱动态效果可用。
4. 非支持网站仍可通过菜单编辑规则，页面样式和全站启动开销不被扩大。
5. 原版设置、站点规则、下载结果及中断/错误路径在重构后保持兼容。

## Task 1: 基线和浏览器回归工具

Files: baseline/*, tests/helpers/browser.cjs, scripts/verify-browser.cjs。
- [ ] 留存原件及哈希，运行现有 npm test（Expected: 25 pass）。
- [ ] 建立真实 Chromium 本地站点/GM API 夹具，能够操作四主入口及现有设置、规则和队列。

## Task 2: 章节列表增量更新

Files: src/userscript/modules/ui.js（随后分离至 ui/chapters.js）, tests/ui-browser.test.cjs。
Interfaces: 继续使用 state.chapters、renderChapters()、canSelectChapter()。
- [ ] 测试选择保留 DOM 节点、焦点、滚动；记录原版失败。
- [ ] 容器事件委托、按章节对象复用行、只更新变化的控件；保持编辑与 Shift 语义。
- [ ] 单测与浏览器回归通过。

## Task 3: 可维护 UI 源码和依赖减负

Files: src/userscript/ui/*, scripts/compose-ui.cjs, scripts/build-readable-userscript.cjs, src/userscript/runtime.source.js。
Interfaces: 构建时替换 UI 插槽，保留同一词法作用域和原函数接口。
- [ ] 在内存验证提取样式/模板/功能片段前后语义与产物一致。
- [ ] 分离 CSS、壳模板、章节、任务、规则交互；样式选择器限定在根容器。
- [ ] 核查并移除无调用无副作用的 ZIP vendor 执行依赖；保留原有 ZIP 输出路径。
- [ ] 构建一致性、原有全部测试和浏览器回归通过。

## Task 4: 界面与交互打磨

Files: src/userscript/ui/styles.css, accessibility.js, shell.js, modules/ui.js。
Interfaces: 保留现有控件 ID、主题、存储键和入口；焦点控制仅限打开的模态层。
- [ ] 先验证键盘焦点逃逸和关闭后丢失焦点的原版失败。
- [ ] 实现模态焦点约束/恢复、统一 Escape；提高文字/按钮层次和可见焦点。
- [ ] 改善选中行、长标题、设置分组、触摸目标、动态视口、安全区与短屏滚动。
- [ ] 合并可证明重复的样式规则，保留主题差异与显式动效选择。
- [ ] 运行桌面/窄屏/六主题/减弱动态效果矩阵并检查截图。

## Task 5: 资源、兼容和交付

Files: src/userscript/modules/ui.js, metadata.part, package.json, README.md, docs/优化说明.md。
- [ ] 按测量优化隐藏 UI 的装饰动画，验证菜单、自定义规则及下载不中断。
- [ ] 核查下载取消、存储竞争，仅对可复现问题修复；无证据则保留原语义并记录。
- [ ] 升级至 2.0.12，生成安装脚本、源码包、功能对照与验证记录。
- [ ] npm test、check:build、node --check、浏览器验证全部通过后独立复核。
