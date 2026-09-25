module.exports = class o {
  constructor(workerLen, maxPictureNum, imgIndexBitNum, vue) {
    this.workerLen = workerLen || 3, this.pictureNum = maxPictureNum || 2, this.list = [], this.worker = new Array(this.workerLen), this.workerDownInfo = new Array(this.workerLen), this.imgIndexBitNum = imgIndexBitNum, this.historySequence = 0, this.Vue = vue;
  }

  updateLimits(maxChapters, maxImages, digits) {
    this.workerLen = Math.max(1, Math.min(3, Number(maxChapters) || this.workerLen)), this.pictureNum = Math.max(1, Math.min(5, Number(maxImages) || this.pictureNum));

    for (; this.worker.length < this.workerLen;) this.worker.push(void 0), this.workerDownInfo.push(void 0);

    this.run(), this.refresh();
  }

  addList(list) {
    for (const t of list) this.list.unshift(t);

    this.refresh();
  }

  refresh() {
    this.Vue && (!document.hidden && this.Vue.$forceUpdate(), "function" == typeof this.Vue.persistTasks && this.Vue.persistTasks());
  }

  moveWaiting(index, direction) {
    const n = "up" === direction ? index + 1 : index - 1;
    return !(!this.list[index] || !this.list[n] || ([this.list[index], this.list[n]] = [this.list[n], this.list[index]], this.refresh(), 0));
  }

  setAllPaused(paused) {
    let t = 0;
    return this.worker.forEach(n => {
      n && !n.cancelled && n.paused !== paused && (paused ? n.pausedAt = Date.now() : (n.pausedAt && (n.elapsedBeforeMs = Math.max(0, Number(n.elapsedBeforeMs) || 0) + Math.max(0, n.pausedAt - n.activeStartedAt), n.activeStartedAt = Date.now(), n.pausedAt = null), this.resetSpeed(n), n.pauseWaiters.splice(0).forEach(e => e())), n.paused = paused, n.status = paused ? "paused" : "running", n.stage = paused ? "已暂停，将在当前请求结束后停止" : "继续下载", t += 1);
    }), t && this.refresh(), t;
  }

  cancelAll() {
    let e = 0;
    return this.worker.forEach(t => {
      t && !t.cancelled && (t.cancelled = !0, t.paused = !1, t.status = "cancelling", t.stage = "正在取消", t.abortController.abort(), t.pauseWaiters.splice(0).forEach(e => e()), e += 1);
    }), e && this.refresh(), e;
  }

  clearWaiting() {
    const e = this.list.length;
    return e ? (this.list.length = 0, this.refresh(), e) : 0;
  }

  pendingTasks() {
    const e = this.worker.filter(Boolean).map(e => this.snapshotWorker(e)),
          t = this.list.slice().reverse().map(e => this.snapshotTask(e));
    return e.concat(t);
  }

  snapshotTask(item) {
    let t = item.originHost || "";

    try {
      t = t || new URL(item.url, window.location.href).hostname;
    } catch (e) {
      t = window.location.hostname;
    }

    return {
      comicName: item.comicName,
      chapterName: item.chapterName,
      downChapterName: item.downChapterName,
      url: item.url,
      isPay: item.isPay,
      characterType: item.characterType,
      readtype: item.readtype,
      downType: item.downType,
      downHeaders: item.downHeaders,
      batchDelay: item.batchDelay,
      directFlow: item.directFlow,
      directRemoteDownload: item.directRemoteDownload,
      useDirectory: item.useDirectory,
      heavyCanvasExport: Boolean(item.heavyCanvasExport),
      retryImages: item.retryImages,
      originHost: t
    };
  }

  snapshotWorker(worker) {
    const t = this.snapshotTask(worker.task),
          n = this.taskTiming(worker);
    return t.resumeElapsedMs = n.activeMs, t.resumeWallStartedAt = worker.wallStartedAt, t.resumePaused = Boolean(worker.paused), worker.retryOnly ? t.retryImages = [...worker.inFlight, ...worker.retryPending].map(e => ({
      url: e.url,
      imgIndex: e.imgIndex
    })) : 0 === Number(worker.downType) && 1 === Number(worker.readtype) && worker.totalNumber > 0 && (t.resumeImages = [...worker.inFlight, ...worker.imgs].map(e => ({
      url: e.url,
      imgIndex: e.imgIndex
    })), t.resumeTotal = worker.totalNumber, t.resumeCompleted = worker.successNum, t.resumeFailures = worker.failures.map(e => ({ ...e
    })), t.resumeDiagnostics = worker.diagnostics.map(e => ({ ...e
    }))), t;
  }

  run() {
    for (let e = 0; e < this.workerLen; e++) {
      if (this.worker[e] || !this.list.length) continue;
      const t = this.list.pop();
      this.worker[e] = this.createWorker(t), this.workerDownInfo[e] = [], this.exeDown(e);
    }

    this.refresh();
  }

  createWorker(item) {
    const t = Array.isArray(item.retryImages) ? item.retryImages.filter(e => e && e.url) : [],
          n = Array.isArray(item.resumeImages) ? item.resumeImages.filter(e => e && e.url) : [],
          r = {
      comicName: item.comicName,
      chapterName: item.chapterName,
      downChapterName: item.downChapterName,
      url: item.url,
      isPay: item.isPay,
      readtype: item.readtype,
      downType: item.downType,
      downHeaders: item.downHeaders,
      batchDelay: item.batchDelay,
      directFlow: item.directFlow,
      directRemoteDownload: item.directRemoteDownload,
      useDirectory: item.useDirectory,
      heavyCanvasExport: Boolean(item.heavyCanvasExport),
      retryImages: t
    };
    return { ...r,
      imgIndex: 0,
      successNum: n.length ? Math.max(0, Number(item.resumeCompleted) || 0) : 0,
      totalNumber: n.length ? Math.max(n.length, Number(item.resumeTotal) || 0) : t.length,
      imgs: n.map(e => ({
        url: e.url,
        imgIndex: Number(e.imgIndex) || 0
      })),
      inFlight: [],
      progress: n.length && Number(item.resumeTotal) > 0 ? Math.min(100, Math.round((Number(item.resumeCompleted) || 0) / Number(item.resumeTotal) * 100)) : 0,
      downloadedBytes: 0,
      byteImageCount: 0,
      directRemoteCount: 0,
      compatDownloadCount: 0,
      speedBps: 0,
      etaSeconds: null,
      speedSamples: [{
        time: Date.now(),
        bytes: 0
      }],
      wallStartedAt: Number(item.resumeWallStartedAt) || Date.now(),
      activeStartedAt: Date.now(),
      elapsedBeforeMs: Math.max(0, Number(item.resumeElapsedMs) || 0),
      pausedAt: item.resumePaused ? Date.now() : null,
      hasError: Array.isArray(item.resumeFailures) && item.resumeFailures.length > 0,
      otherData: void 0,
      status: item.resumePaused ? "paused" : "running",
      stage: item.resumePaused ? "已暂停，等待继续" : n.length ? "准备恢复未完成下载" : t.length ? "准备重试失败图片" : "准备解析章节",
      paused: Boolean(item.resumePaused),
      cancelled: !1,
      pauseWaiters: [],
      abortController: new AbortController(),
      failures: Array.isArray(item.resumeFailures) ? item.resumeFailures.map(e => ({ ...e
      })) : [],
      diagnostics: Array.isArray(item.resumeDiagnostics) ? item.resumeDiagnostics.map(e => ({ ...e
      })) : [],
      retryImages: t,
      retryPending: t.slice(),
      retryOnly: t.length > 0,
      resumeOnly: n.length > 0,
      task: r
    };
  }

  taskTiming(worker, now = Date.now()) {
    const n = Math.max(0, Number(worker.elapsedBeforeMs) || 0),
          r = Number(worker.activeStartedAt) || now,
          a = null != worker.pausedAt ? Number(worker.pausedAt) : now,
          i = n + Math.max(0, a - r),
          o = Math.max(i, now - (Number(worker.wallStartedAt) || now));
    return {
      activeMs: Math.round(i),
      totalMs: Math.round(o),
      pausedMs: Math.round(Math.max(0, o - i))
    };
  }

  pause(index) {
    const t = this.worker[index];
    return !(!t || t.cancelled || t.paused || (t.paused = !0, t.pausedAt = Date.now(), t.status = "paused", t.stage = "已暂停，将在当前请求结束后停止", this.refresh(), 0));
  }

  resume(index) {
    const t = this.worker[index];
    return !(!t || t.cancelled || !t.paused || (t.pausedAt && (t.elapsedBeforeMs = Math.max(0, Number(t.elapsedBeforeMs) || 0) + Math.max(0, t.pausedAt - t.activeStartedAt), t.activeStartedAt = Date.now(), t.pausedAt = null), t.paused = !1, t.status = "running", t.stage = "继续下载", this.resetSpeed(t), t.pauseWaiters.splice(0).forEach(e => e()), this.refresh(), 0));
  }

  cancel(index) {
    const t = this.worker[index];
    return !(!t || t.cancelled || (t.cancelled = !0, t.paused = !1, t.status = "cancelling", t.stage = "正在取消", t.abortController.abort(), t.pauseWaiters.splice(0).forEach(e => e()), this.refresh(), 0));
  }

  cancelWaiting(index) {
    return !!this.list[index] && (this.list.splice(index, 1), this.refresh(), !0);
  }

  async waitUntilRunnable(index) {
    let t = this.worker[index];
    if (!t || t.cancelled) throw new a();

    for (; t.paused;) if (await new Promise(e => t.pauseWaiters.push(e)), t = this.worker[index], !t || t.cancelled) throw new a();
  }

  assertActive(index) {
    const t = this.worker[index];
    if (!t || t.cancelled) throw new a();
    return t;
  }

  setStage(index, stage) {
    const n = this.worker[index];
    n && (n.stage = stage, this.refresh());
  }

  addDiagnostic(index, stage, error, extra = {}) {
    const a = this.worker[index];
    if (!a) return;
    const i = error instanceof Error ? error.message : String(error || "未知错误");
    a.diagnostics.push({
      time: new Date().toISOString(),
      stage: stage,
      message: i,
      ...extra
    }), a.diagnostics.length > 80 && a.diagnostics.shift();
  }

  addFailure(index, imgurl, imgIndex, reason) {
    const a = this.worker[index];
    if (!a) return;
    if (a.hasError = !0, String(imgurl || "").startsWith("blob:")) return void this.addDiagnostic(index, "图片下载", reason, {
      url: "临时画布图片",
      imgIndex: imgIndex || 0
    });
    const i = [imgIndex || 0, imgurl || ""].join("\n"),
          o = a.failures.find(e => e.key === i);
    o ? o.reason = reason : a.failures.push({
      key: i,
      url: imgurl || "",
      imgIndex: imgIndex || 0,
      reason: reason
    }), this.addDiagnostic(index, "图片下载", reason, {
      url: imgurl || "",
      imgIndex: imgIndex || 0
    });
  }

  resetSpeed(worker) {
    worker.speedBps = 0, worker.etaSeconds = null, worker.speedSamples = [{
      time: Date.now(),
      bytes: worker.downloadedBytes
    }];
  }

  advance(index, imgurl, imgIndex, bytes = 0) {
    const a = this.worker[index];
    if (!a) return;
    a.inFlight = a.inFlight.filter(e => e.imgIndex !== imgIndex || e.url !== imgurl);
    const i = Math.max(0, Number(bytes) || 0);
    i && (a.downloadedBytes += i, a.byteImageCount += 1), a.successNum += 1, a.progress = a.totalNumber > 0 ? Math.min(100, Math.round(a.successNum / a.totalNumber * 100)) : 0;
    const o = Date.now();

    for (a.speedSamples.push({
      time: o,
      bytes: a.downloadedBytes
    }); a.speedSamples.length > 2 && a.speedSamples[1].time < o - 8e3;) a.speedSamples.shift();

    const s = a.speedSamples[0],
          c = (o - s.time) / 1e3,
          d = c >= .2 ? (a.downloadedBytes - s.bytes) / c : 0;
    d > 0 && (a.speedBps = a.speedBps > 0 ? .65 * a.speedBps + .35 * d : d);
    const l = Math.max(0, a.totalNumber - a.successNum),
          u = a.byteImageCount ? a.downloadedBytes / a.byteImageCount : 0;
    a.etaSeconds = a.speedBps > 0 && u > 0 ? Math.ceil(l * u / a.speedBps) : null, this.refresh();
  }

  async exeDown(index) {
    const t = this.worker[index];

    try {
      if (await this.waitUntilRunnable(index), t.resumeOnly) this.setStage(index, "正在恢复未完成下载"), this.resetSpeed(t), await this.down(index);else if (t.retryOnly) await this.downFailures(index);else if (1 === Number(t.readtype)) {
        let a;
        this.setStage(index, "正在解析章节图片");

        try {
          a = await (0, n.gJ)({
            url: t.url,
            isPay: t.isPay,
            signal: t.abortController.signal
          });
        } catch (t) {
          throw this.addDiagnostic(index, "章节解析", t), new Error("未能解析章节图片，请检查站点规则或网络状态");
        }

        if (this.assertActive(index), !Array.isArray(a) || !a.length) throw this.addDiagnostic(index, "章节解析", "规则没有返回图片地址"), new Error("章节中没有可下载的图片");
        const i = (0, r.cF)("imgDownRange"),
              o = Array.isArray(i) ? Math.max(1, parseInt(i[0]) || 1) : 1,
              s = Array.isArray(i) ? parseInt(i[1]) : -1;
        if (t.imgs = (-1 === s ? a.slice(o - 1) : a.slice(o - 1, s)).map((e, t) => ({
          url: e,
          imgIndex: o + t
        })), t.totalNumber = t.imgs.length, !t.totalNumber) throw new Error("所选下载范围内没有图片");
        this.resetSpeed(t), await this.down(index);
      } else this.resetSpeed(t), await this.down2(index);
      await this.finishWorker(index);
    } catch (t) {
      this.failWorker(index, t);
    }
  }

  async down(workerId) {
    const t = this.assertActive(workerId);

    for (; t.imgs.length;) {
      const a = Date.now();
      await this.waitUntilRunnable(workerId), this.setStage(workerId, t.downType ? "正在获取图片数据" : "正在保存图片");
      const n = t.imgs.splice(0, this.pictureNum);
      t.inFlight = n.slice(), this.refresh();
      const r = await Promise.all(n.map(n => t.downType ? this.addImgPromise(workerId, n.url, t.downHeaders, 0, n.imgIndex) : this.addImgDownPromise(workerId, n.url, n.imgIndex, t.downHeaders)));
      t.downType && this.workerDownInfo[workerId].push(...r), t.inFlight = [], this.refresh();

      if (t.imgs.length) {
        const o = Number(t.batchDelay);

        if (Number.isFinite(o) && o >= 0) {
          const s = document.hidden ? 0 : Math.max(0, o - (Date.now() - a));
          await this.controlledDelay(workerId, s);
        } else await this.controlledDelay(workerId, 1e3);
      }
    }

    await this.finalizeOutput(workerId);
  }

  async down2(workerId) {
    const t = this.assertActive(workerId);
    let r = !0;

    try {
      for (; r;) {
        const d = Date.now();
        await this.waitUntilRunnable(workerId), this.setStage(workerId, "正在解析下一页图片");
        const a = await (0, n.gJ)({
          url: t.url,
          imgIndex: t.imgIndex,
          totalNumber: t.totalNumber,
          isPay: t.isPay,
          otherData: t.otherData,
          batchSize: !document.hidden && t.heavyCanvasExport && document.querySelector('#ten-panel.is-open .ten-view.is-active[data-view="settings"]') ? 1 : this.pictureNum,
          signal: t.abortController.signal
        });
        const i = Array.isArray(a && a.imgUrlArr) ? a.imgUrlArr.slice() : [],
              h = Number(a && a.imgIndexStart);
        let m = Number.isInteger(h) && h > 0 ? h : null;
        t.otherData = a && a.otherData, t.totalNumber = Math.max(parseInt(a && a.imgCount) || 0, t.totalNumber, t.imgIndex + i.length);

        try {
          this.assertActive(workerId);

          for (; i.length;) {
            await this.waitUntilRunnable(workerId);
            const n = i.splice(0, this.pictureNum).map(e => ({
              url: e,
              imgIndex: null === m ? ++t.imgIndex : (t.imgIndex++, m++)
            }));

            try {
              const r = await Promise.all(n.map(n => t.downType ? this.addImgPromise(workerId, n.url, t.downHeaders, 0, n.imgIndex) : this.addImgDownPromise(workerId, n.url, n.imgIndex, t.downHeaders)));
              t.downType && this.workerDownInfo[workerId].push(...r);
            } catch (e) {
              for (const e of n) if ("string" == typeof e.url && e.url.startsWith("blob:")) try {
                URL.revokeObjectURL(e.url);
              } catch (e) {}

              throw e;
            }
          }
        } finally {
          for (const e of i) if ("string" == typeof e && e.startsWith("blob:")) try {
            URL.revokeObjectURL(e);
          } catch (e) {}
        }

        const o = a && a.nextPageUrl,
              s = Number(a && a.nextPageDelay),
              c = Number.isFinite(s) && s >= 0 ? s : 1e3,
              l = a && a.adaptivePageDelay ? document.hidden ? 0 : Math.max(0, c - (Date.now() - d)) : c;
        r = Boolean(o && t.imgIndex < t.totalNumber), r && (t.url = o, await this.controlledDelay(workerId, l));
      }

      await this.finalizeOutput(workerId);
    } finally {
      if (t.otherData && "function" == typeof t.otherData.cleanup) try {
        t.otherData.cleanup();
      } catch (e) {}
    }
  }

  async downFailures(workerId) {
    const t = this.assertActive(workerId);
    this.setStage(workerId, "正在补下载失败图片"), this.resetSpeed(t);
    const n = t.retryPending;

    for (; n.length;) {
      await this.waitUntilRunnable(workerId);
      const r = n.splice(0, this.pictureNum);
      t.inFlight = r.slice(), this.refresh(), await Promise.all(r.map(n => this.addImgDownPromise(workerId, n.url, Number(n.imgIndex) || ++t.imgIndex, t.downHeaders))), t.inFlight = [], this.refresh(), n.length && (await this.controlledDelay(workerId, 500));
    }
  }

  async addImgDownPromise(index, imgurl, imgIndex, newHeaders, retryTimes = 0) {
    const o = this.assertActive(index);
    if (await this.waitUntilRunnable(index), !imgurl) return this.addFailure(index, imgurl, imgIndex, "图片地址为空"), this.advance(index, imgurl, imgIndex), !1;
    const d = (0, n.pN)(o.comicName) + "\\" + (0, n.pN)(o.downChapterName) + "\\" + (0, n.xo)(imgIndex, this.imgIndexBitNum) + ".";

    if (1 === Number(o.directFlow) && o.directRemoteDownload && !o.useDirectory && /^https?:\/\//i.test(String(imgurl))) {
      const s = await (0, n.zd)({
        url: imgurl,
        name: d + this.getSuffix(imgurl, {}),
        headers: newHeaders || {
          referer: o.url
        },
        signal: o.abortController.signal
      });
      if (this.assertActive(index), s) return o.directRemoteCount = (Number(o.directRemoteCount) || 0) + 1, this.advance(index, imgurl, imgIndex), !0;
      this.addDiagnostic(index, "快速直连", "直接保存失败，已回退兼容流程", {
        url: imgurl,
        imgIndex: imgIndex
      });
    }

    0 === retryTimes && (o.compatDownloadCount = (Number(o.compatDownloadCount) || 0) + 1);
    const s = await (0, n.WY)({
      method: "get",
      url: imgurl,
      responseType: "blob",
      headers: newHeaders || {
        referer: o.url
      },
      timeout: 6e4,
      signal: o.abortController.signal
    });
    this.assertActive(index);
    const c = this.requestFailure(s);
    if ((0, n.sR)(imgurl, c, retryTimes)) return await this.controlledDelay(index, 500 * (retryTimes + 1)), this.addImgDownPromise(index, imgurl, imgIndex, newHeaders, retryTimes + 1);
    let l, u;
    c ? (String(imgurl || "").startsWith("blob:") ? (o.hasError = !0, this.addDiagnostic(index, "图片下载", c, {
      url: "临时画布图片",
      imgIndex: imgIndex
    })) : this.addFailure(index, imgurl, imgIndex, c), l = new Blob([imgurl], {
      type: "text/plain"
    }), u = "txt") : (l = s.response, u = this.getSuffix(s.finalUrl || imgurl, s)), await this.waitUntilRunnable(index);
    const p = await (0, n.zd)(l, d + u);
    return p || c || this.addFailure(index, imgurl, imgIndex, "文件写入失败，请检查目录权限"), this.advance(index, imgurl, imgIndex, c ? 0 : Number(s.response && s.response.size)), p && !c;
  }

  async addImgPromise(index, imgurl, newHeaders, retryTimes = 0, imgIndex = 0) {
    const o = this.assertActive(index);
    if (await this.waitUntilRunnable(index), !imgurl) return this.addFailure(index, imgurl, imgIndex, "图片地址为空"), this.advance(index, imgurl, imgIndex), {
      blob: 1,
      imgurl: imgurl,
      suffix: "",
      imgIndex: imgIndex
    };
    const s = await (0, n.WY)({
      method: "get",
      url: imgurl,
      responseType: "blob",
      headers: newHeaders || {
        referer: o.url
      },
      timeout: 6e4,
      signal: o.abortController.signal
    });
    this.assertActive(index);
    const c = this.requestFailure(s);
    return (0, n.sR)(imgurl, c, retryTimes) ? (await this.controlledDelay(index, 500 * (retryTimes + 1)), this.addImgPromise(index, imgurl, newHeaders, retryTimes + 1, imgIndex)) : c ? (String(imgurl || "").startsWith("blob:") ? (o.hasError = !0, this.addDiagnostic(index, "图片下载", c, {
      url: "临时画布图片",
      imgIndex: imgIndex
    })) : this.addFailure(index, imgurl, imgIndex, c), this.advance(index, imgurl, imgIndex), {
      blob: 1,
      imgurl: imgurl,
      suffix: "",
      imgIndex: imgIndex
    }) : (this.advance(index, imgurl, imgIndex, Number(s.response && s.response.size)), {
      blob: s.response,
      imgurl: imgurl,
      suffix: this.getSuffix(s.finalUrl || imgurl, s),
      imgIndex: imgIndex
    });
  }

  requestFailure(response) {
    return "abort" === response ? "请求已取消" : "timeout" === response ? "图片请求超时" : "onerror" !== response && response && "object" == typeof response ? Number(response.status) >= 400 ? "图片请求返回 HTTP " + response.status : response.response instanceof Blob ? "" : "图片响应不是有效文件" : "图片请求失败";
  }

  getSuffix(url, response) {
    const n = String(response && response.response && response.response.type || "").toLowerCase(),
          r = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/bmp": "bmp",
      "image/svg+xml": "svg"
    };
    if (r[n]) return r[n];
    const a = String(url || "").toLowerCase().match(/\.(jpe?g|webp|png|gif|bmp|tiff?|svg|ico)(?:$|[?#])/);
    return a ? a[1].replace("jpeg", "jpg") : "jpg";
  }

  async finalizeOutput(workerId) {
    const t = this.assertActive(workerId);
    1 === t.downType ? await this.makeZip(workerId) : 2 === t.downType && (await this.combineImages(workerId));
  }

  async makeZip(workerId) {
    const t = this.assertActive(workerId),
          r = this.workerDownInfo[workerId];
    this.setStage(workerId, "正在打包章节");

    try {
      if (!(await (0, n.zM)((0, n.pN)(t.comicName) + "\\" + (0, n.pN)(t.downChapterName) + ".zip", r, this.imgIndexBitNum, (e, n) => {
        t.stage = "正在打包 " + e + "/" + n, this.refresh();
      }, t.abortController && t.abortController.signal))) throw new Error("压缩下载需要先选择保存目录；请重新选择目录或改用原图下载");
      await i(0), await this.waitUntilRunnable(workerId);
    } finally {
      r.forEach(e => {
        e.blob = null;
      });
    }
  }

  async combineImages(workerId) {
    const t = this.assertActive(workerId),
          a = Number((0, r.cF)("maxSplicingHeight")) || 2e4,
          o = e => Math.max(1, Math.min(a, 32760, Math.floor(4e7 / Math.max(1, e))));

    let s = null,
        c = 0,
        f = null,
        g = new Set();

    const d = async e => {
      if ("function" == typeof createImageBitmap) try {
        return await createImageBitmap(e);
      } catch (e) {}
      return new Promise((t, n) => {
        const r = URL.createObjectURL(e),
              a = document.createElement("img");
        a.onload = () => {
          URL.revokeObjectURL(r), t(a);
        }, a.onerror = () => {
          URL.revokeObjectURL(r), n(new Error("浏览器无法解码图片"));
        }, a.src = r;
      });
    },
          l = async r => {
      if (!s || !s.parts.length) return;
      await this.waitUntilRunnable(workerId), this.setStage(workerId, "正在生成拼接图 " + (c + 1));
      const a = document.createElement("canvas");
      a.width = s.width, a.height = s.height;
      const o = a.getContext("2d", {
        alpha: !1
      });
      if (!o) throw new Error("浏览器无法创建图片拼接画布");
      o.fillStyle = "#ffffff", o.fillRect(0, 0, a.width, a.height);
      let d = 0;

      for (const e of s.parts) o.drawImage(e.image, 0, e.sourceY, e.width, e.height, 0, d, e.width, e.height), d += e.height;

      const l = await new Promise((e, t) => {
        a.toBlob(n => n ? e(n) : t(new Error("画布导出失败")), "image/jpeg", .88);
      }),
            u = (0, n.pN)(t.comicName) + "\\" + (0, n.pN)(t.downChapterName) + "\\" + (0, n.xo)(++c, this.imgIndexBitNum) + ".jpg";
      if (!(await (0, n.zd)(l, u))) throw new Error("拼接图 " + c + " 写入失败");

      for (const e of s.resources) e !== r && "function" == typeof e.close && e.close();

      a.width = 1, a.height = 1, s = null, await i(0);
    },
          u = this.workerDownInfo[workerId];

    try {
      for (let y = 0; y < u.length; y += this.pictureNum) {
        await this.waitUntilRunnable(workerId);
        const r = u.slice(y, y + this.pictureNum),
              a = await Promise.all(r.map(async (r, a) => {
          const i = y + a,
                o = r.imgIndex || i + 1;
          if (!r.blob || 1 === r.blob || 0 === r.blob || !String(r.blob.type || "").includes("image")) return {
            item: r,
            imgIndex: o,
            invalid: !0
          };
          const s = r.blob;
          r.blob = null;

          try {
            const e = await d(s);
            return g.add(e), {
              item: r,
              imgIndex: o,
              bitmap: e
            };
          } catch (e) {
            return {
              item: r,
              imgIndex: o,
              error: e
            };
          }
        }));

        for (const v of a) {
          await this.waitUntilRunnable(workerId);
          const r = v.item,
                a = v.imgIndex;

          if (v.invalid) {
            this.addFailure(workerId, r.imgurl, a, "图片数据无效，无法参与拼接"), await (0, n.zd)(new Blob([r.imgurl || ""], {
              type: "text/plain"
            }), (0, n.pN)(t.comicName) + "\\" + (0, n.pN)(t.downChapterName) + "\\error_" + (0, n.xo)(a, this.imgIndexBitNum) + ".txt"), r.blob = null;
            continue;
          }

          if (v.error) {
            this.addFailure(workerId, r.imgurl, a, v.error.message);
            continue;
          }

          const i = v.bitmap;
          g.delete(i), f = i;
          const p = i.width,
                h = i.height;

          if (!p || !h) {
            this.addFailure(workerId, r.imgurl, a, "图片尺寸无效"), "function" == typeof i.close && i.close(), f = null;
            continue;
          }

          s && s.width !== p && (await l());
          let m = 0;

          for (; m < h;) {
            s || (s = {
              width: p,
              height: 0,
              parts: [],
              resources: new Set()
            });
            const e = o(p),
                  t = Math.min(h - m, e - s.height);
            s.parts.push({
              image: i,
              sourceY: m,
              width: p,
              height: t
            }), s.resources.add(i), f = null, s.height += t, m += t;

            if (s.height >= e) {
              const e = m < h ? i : null;
              await l(e), f = e;
            }
          }
        }
      }

      await l();
      if (!c && !t.failures.length) throw new Error("没有可用于拼接的图片");
    } finally {
      if (s) {
        for (const e of s.resources) if ("function" == typeof e.close) try {
          e.close();
        } catch (e) {}

        s = null;
      }

      if (f && "function" == typeof f.close) try {
        f.close();
      } catch (e) {}

      for (const e of g) if ("function" == typeof e.close) try {
        e.close();
      } catch (e) {}
    }
  }

  async controlledDelay(index, milliseconds) {
    await i(milliseconds), await this.waitUntilRunnable(index);
  }

  async finishWorker(index) {
    const t = this.assertActive(index);
    t.status = t.hasError ? "partial" : "completed", t.stage = t.hasError ? "下载完成，部分图片失败" : t.retryOnly ? "失败图片补下载完成" : "下载完成", this.saveHistory(t), this.Vue && "function" == typeof this.Vue.notifyTask && this.Vue.notifyTask(t), this.worker[index] = void 0, this.workerDownInfo[index] = void 0, this.refresh(), setTimeout(() => this.run(), 350);
  }

  failWorker(index, error) {
    const n = this.worker[index];
    if (!n) return;
    const r = n.cancelled || error instanceof a;
    r || (n.hasError = !0, this.addDiagnostic(index, n.stage || "下载任务", error), console.error("10漫画：下载任务异常终止。", error)), n.status = r ? "cancelled" : "failed", n.stage = r ? "任务已取消" : "任务失败", this.saveHistory(n), !r && this.Vue && "function" == typeof this.Vue.notifyTask && this.Vue.notifyTask(n), this.worker[index] = void 0, this.workerDownInfo[index] = void 0, this.refresh(), setTimeout(() => this.run(), 350);
  }

  saveHistory(worker) {
    let t = [];

    try {
      t = JSON.parse(localStorage.getItem("ylComicDownHistory") || "[]"), Array.isArray(t) || (t = []);
    } catch (e) {
      t = [];
    }

    const n = worker.failures.map(({
      url: e,
      imgIndex: t,
      reason: n
    }) => ({
      url: e,
      imgIndex: t,
      reason: n
    })),
          timing = this.taskTiming(worker),
          completedAt = new Date().toISOString(),
          a = {
      id: 100 * Date.now() + this.historySequence++ % 100,
      comicName: worker.comicName,
      downChapterName: worker.downChapterName,
      comicPageUrl: window.location.href,
      hasError: worker.hasError || "failed" === worker.status,
      status: worker.status,
      stage: worker.stage,
      durationMs: timing.activeMs,
      totalDurationMs: timing.totalMs,
      pausedDurationMs: timing.pausedMs,
      completedAt: completedAt,
      directFlow: Number(worker.directFlow) || 0,
      flowUsed: Number(worker.directRemoteCount) > 0 ? Number(worker.compatDownloadCount) > 0 ? "混合流程" : "快速直连" : "兼容流程",
      failedImages: n,
      diagnostics: worker.diagnostics,
      task: worker.task
    };
    t = t.filter(e => e.comicName !== a.comicName || e.downChapterName !== a.downChapterName), t.unshift(a);
    const i = Math.max(10, Math.min(500, Number((0, r.cF)("historyLimit")) || 100));
    t = t.slice(0, i), localStorage.setItem("ylComicDownHistory", JSON.stringify(t)), this.Vue && this.Vue.getHistoryData();
  }

};
