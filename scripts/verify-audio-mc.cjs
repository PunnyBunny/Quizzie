// Executes source with an in-memory Firestore and fake browser APIs. No cloud writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function componentStubs(names) {
  const uiExports = {
    Alert: ["Alert", "AlertAction", "AlertDescription", "AlertTitle"],
    Button: ["Button"],
    Dialog: [
      "Dialog",
      "DialogBody",
      "DialogClose",
      "DialogContent",
      "DialogDescription",
      "DialogFooter",
      "DialogHeader",
      "DialogTitle",
      "DialogTrigger",
    ],
  };
  return Object.fromEntries(
    names.map((name) => [
      path.join(
        root,
        `apps/web/src/components/${name in uiExports ? `ui/${name.toLowerCase()}` : name}.tsx`,
      ),
      Object.fromEntries((uiExports[name] ?? [name]).map((exportName) => [exportName, exportName])),
    ]),
  );
}
const clone = (value) => {
  if (!value || typeof value !== "object" || typeof value.toDate === "function") return value;
  if (Array.isArray(value)) return value.map(clone);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
};
function sourceLoader(overrides = {}, globals = {}) {
  const cache = new Map();
  const load = (filename) => {
    filename = path.resolve(root, filename);
    if (overrides[filename]) return overrides[filename];
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    }).outputText;
    const requireSource = (name) => {
      if (overrides[name]) return overrides[name];
      if (!name.startsWith(".") && !name.startsWith("@/")) return require(name);
      const base = name.startsWith("@/")
        ? path.join(root, "apps/web/src", name.slice(2))
        : path.resolve(path.dirname(filename), name);
      const found = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      );
      return load(found);
    };
    vm.runInNewContext(
      code,
      {
        module,
        exports: module.exports,
        require: requireSource,
        console,
        setTimeout,
        clearTimeout,
        Buffer,
        Blob,
        crypto: require("node:crypto").webcrypto,
        React: overrides.react,
        ...globals,
      },
      { filename },
    );
    return module.exports;
  };
  load.overrides = overrides;
  return load;
}
function backend() {
  const documents = new Map(),
    routes = new Map(),
    objects = new Set(),
    errors = [];
  let signingError = null;
  const timestamp = { toDate: () => new Date(0) };
  const fieldValue = {
    serverTimestamp: () => ({ _timestamp: true }),
    delete: () => ({ _delete: true }),
  };
  const normalize = (value) =>
    value?._timestamp
      ? timestamp
      : !value || typeof value !== "object" || typeof value.toDate === "function"
        ? value
        : Array.isArray(value)
          ? value.map(normalize)
          : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  const snapshot = (ref) => ({
    id: ref.id,
    ref,
    exists: documents.has(ref.path),
    data: () => clone(documents.get(ref.path)),
  });
  const update = (ref, data) => {
    if (!documents.has(ref.path)) throw new Error(`Missing document: ${ref.path}`);
    const existing = clone(documents.get(ref.path));
    for (const [field, value] of Object.entries(data)) {
      const keys = field.split(".");
      let target = existing;
      for (const key of keys.slice(0, -1)) target = target[key] ??= {};
      if (value?._delete) delete target[keys.at(-1)];
      else target[keys.at(-1)] = normalize(value);
    }
    documents.set(ref.path, existing);
  };
  const ref = (documentPath) => ({
    path: documentPath,
    id: documentPath.split("/").at(-1),
    get: async () => snapshot(ref(documentPath)),
    set: async (data) => documents.set(documentPath, normalize(data)),
    collection: (name) => collection(`${documentPath}/${name}`),
    update: async (data) => update(ref(documentPath), data),
  });
  let counter = 0;
  const collection = (collectionPath, filters = [], limit = Infinity) => ({
    withConverter() {
      return this;
    },
    doc: (id) => ref(`${collectionPath}/${id}`),
    where: (key, _, value) => collection(collectionPath, [...filters, [key, value]], limit),
    orderBy: () => collection(collectionPath, filters, limit),
    limit: (n) => collection(collectionPath, filters, n),
    get: async () => {
      const docs = [...documents.keys()]
        .filter(
          (key) =>
            key.startsWith(`${collectionPath}/`) &&
            key.split("/").length === collectionPath.split("/").length + 1,
        )
        .sort()
        .filter((key) => filters.every(([field, value]) => documents.get(key)[field] === value))
        .slice(0, limit)
        .map((key) => snapshot(ref(key)));
      return { docs, empty: docs.length === 0 };
    },
    add: async (data) => {
      const target = ref(`${collectionPath}/new-${++counter}`);
      documents.set(target.path, normalize(data));
      return target;
    },
  });
  let failCommit = false;
  const db = {
    collection,
    runTransaction: async (callback) => {
      const writes = [];
      const result = await callback({
        get: async (target) => (target.path ? snapshot(target) : target.get()),
        set: (target, data) => writes.push(() => documents.set(target.path, normalize(data))),
        update: (target, data) => writes.push(() => update(target, data)),
      });
      if (failCommit) {
        failCommit = false;
        throw new Error("Simulated save failure");
      }
      for (const write of writes) write();
      return result;
    },
  };
  const load = sourceLoader(
    {
      express: { Router: () => ({ post: (name, ...handlers) => routes.set(name, handlers) }) },
      [path.join(root, "apps/functions/src/firebase.ts")]: {
        db,
        FieldValue: fieldValue,
        admin: {
          firestore: () => db,
          storage: () => ({
            bucket: () => ({
              name: "bucket",
              file: (object) => ({
                exists: async () => [objects.has(object)],
                getSignedUrl: async () => {
                  if (signingError) {
                    const error = signingError;
                    signingError = null;
                    throw error;
                  }
                  return [`signed:${object}`];
                },
              }),
            }),
          }),
        },
      },
    },
    {
      Error,
      console: { ...console, error: (...args) => errors.push(args) },
    },
  );
  for (const name of ["questions", "assessments", "submissions", "grading"])
    load(`apps/functions/src/routes/${name}.ts`);
  const call = async (name, data, email = "owner", claims = {}) => {
    const request = { body: { data } };
    let result, code;
    const response = {
      locals: { callerEmail: email, callerClaims: claims },
      status: (status) => {
        code = status;
        return response;
      },
      json: (body) => {
        result = body;
      },
    };
    const handlers = routes.get(name);
    for (const handler of handlers) {
      if (handler.length === 3) {
        let advanced = false,
          failed;
        await handler(request, response, (error) => {
          if (error) failed = error;
          else advanced = true;
        });
        if (failed) throw failed;
        if (!advanced) {
          const error = new Error(result?.error?.message);
          error.statusCode = code;
          throw error;
        }
      } else await handler(request, response);
    }
    return result.data;
  };
  return {
    documents,
    objects,
    call,
    load,
    ref,
    timestamp,
    errors,
    failNextSigning: (error) => {
      signingError = error;
    },
    failNextCommit: () => {
      failCommit = true;
    },
  };
}
function hookRuntime() {
  let index = 0;
  const slots = [],
    effects = [];
  const React = {
    createContext: () => ({ Provider: "provider" }),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => {
      const key = index++;
      if (!(key in slots)) slots[key] = typeof initial === "function" ? initial() : initial;
      return [
        slots[key],
        (value) => {
          slots[key] = typeof value === "function" ? value(slots[key]) : value;
        },
      ];
    },
    useRef: (initial) => {
      const key = index++;
      return (slots[key] ??= { current: initial });
    },
    useMemo: (fn) => {
      const key = index++;
      return (slots[key] ??= fn());
    },
    useCallback: (fn) => fn,
    useEffect: (fn) => {
      const key = index++;
      if (!(key in slots)) {
        slots[key] = true;
        effects.push(fn);
      }
    },
  };
  React.useLayoutEffect = React.useEffect;
  return {
    React,
    slots,
    render: (fn) => {
      index = 0;
      return fn();
    },
    effects,
  };
}
async function gradingAudioChecks() {
  const requests = [],
    timeouts = [];
  const audioBlob = new Blob(["recording bytes"], { type: "audio/webm" });
  let mode = "success",
    bodyReads = 0,
    finishBody;
  const waitForAbort = (signal) =>
    new Promise((_, reject) => {
      signal.throwIfAborted();
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  const { downloadGradingAudio } = sourceLoader(
    {
      react: {},
      [path.join(root, "apps/web/src/lib/firebase-hooks.ts")]: {},
    },
    {
      AbortSignal: {
        timeout: (milliseconds) => {
          assert.equal(milliseconds, 60_000);
          const controller = new AbortController();
          timeouts.push(controller);
          return controller.signal;
        },
      },
      DOMException,
      fetch: async (url, { signal }) => {
        signal.throwIfAborted();
        requests.push({ url, signal });
        if (mode === "network-error") throw new TypeError("Network unavailable");
        if (mode === "pending-headers") return waitForAbort(signal);
        return {
          ok: mode !== "http-error",
          status: mode === "http-error" ? 403 : 200,
          blob: async () => {
            bodyReads++;
            if (mode === "pending-body") return waitForAbort(signal);
            if (mode === "body-race") {
              return new Promise((resolve) => {
                finishBody = () => resolve(audioBlob);
              });
            }
            return mode === "empty" ? new Blob([]) : audioBlob;
          },
        };
      },
    },
  )("apps/web/src/hooks/useGradingAudio.ts");
  const download = () => downloadGradingAudio("signed-recording-url");
  assert.equal(await download(), audioBlob);
  assert.equal(requests[0].url, "signed-recording-url");
  mode = "http-error";
  const readsBeforeError = bodyReads;
  await assert.rejects(download());
  assert.equal(
    bodyReads,
    readsBeforeError,
    "An expired URL response must not become an audio blob",
  );
  mode = "empty";
  await assert.rejects(download(), /empty/i);
  mode = "network-error";
  await assert.rejects(download(), /Network unavailable/);
  for (const phase of ["pending-headers", "pending-body"]) {
    mode = phase;
    const timedOut = download();
    await new Promise(setImmediate);
    timeouts.at(-1).abort(new DOMException("Download timed out", "TimeoutError"));
    await assert.rejects(timedOut, { name: "TimeoutError" });
    assert.equal(requests.at(-1).signal.aborted, true);
  }
  mode = "body-race";
  const raced = download();
  await new Promise(setImmediate);
  timeouts.at(-1).abort(new DOMException("Download timed out", "TimeoutError"));
  finishBody();
  await assert.rejects(raced, { name: "TimeoutError" });
  mode = "pending-body";
  const first = download();
  const second = download();
  await new Promise(setImmediate);
  timeouts.at(-2).abort(new DOMException("Download timed out", "TimeoutError"));
  await assert.rejects(first, { name: "TimeoutError" });
  assert.equal(requests.at(-1).signal.aborted, false, "Each download owns its timeout");
  timeouts.at(-1).abort(new DOMException("Download timed out", "TimeoutError"));
  await assert.rejects(second, { name: "TimeoutError" });
  console.log(
    "PASS: blob downloads, HTTP/network/empty failures, and fetch timeout during headers/body.",
  );
}
async function gradingSectionChecks() {
  const hooks = hookRuntime();
  // Commit effects when dependencies change, including cleanup before the next effect.
  // This catches accidental reloads caused by per-recording state updates.
  const effects = [],
    pendingEffects = [];
  let effectIndex = 0;
  hooks.React.useMemo = (calculate, dependencies) => {
    const memo = hooks.React.useRef();
    if (
      !memo.current ||
      dependencies.some((value, index) => !Object.is(value, memo.current.dependencies[index]))
    ) {
      memo.current = { value: calculate(), dependencies };
    }
    return memo.current.value;
  };
  hooks.React.useEffect = (callback, dependencies) => {
    const index = effectIndex++;
    const previous = effects[index];
    if (
      !previous ||
      !dependencies ||
      dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))
    ) {
      pendingEffects.push(() => {
        previous?.cleanup?.();
        effects[index] = { dependencies, cleanup: callback() };
      });
    }
  };
  let sectionIndex = 0,
    refreshes = 0,
    failResponses = false,
    missingUrl = false,
    responseWait;
  const data = {
    sections: [
      { kind: "mc", length: 1 },
      { kind: "audio", length: 2 },
      { kind: "audio_mc", length: 2 },
      { kind: "audio", length: 1 },
    ],
    studentResponsesBySection: {
      0: { type: "mc" },
      1: { type: "audio", files: { 0: "one", 1: "two" } },
      2: { type: "audio_mc", files: { 0: "three", 1: "four" } },
      3: { type: "audio", files: { 0: "five" } },
    },
  };
  const loads = [],
    created = [],
    revoked = [];
  const key = (relative) => path.join(root, `apps/web/src/${relative}`);
  const fetchResponses = async () => {
    const refresh = ++refreshes;
    if (failResponses) throw new Error("URL refresh failed");
    if (responseWait) await responseWait;
    return {
      data: {
        ...data,
        studentResponsesBySection: Object.fromEntries(
          Object.entries(data.studentResponsesBySection).map(([section, response]) => [
            section,
            response.type === "mc"
              ? response
              : {
                  ...response,
                  files: Object.fromEntries(
                    Object.entries(response.files).map(([question, url]) => [
                      question,
                      missingUrl && section === "2" && question === "1"
                        ? null
                        : `${url}-fresh-${refresh}`,
                    ]),
                  ),
                },
          ]),
        ),
      },
    };
  };
  const { useGradingAudio } = sourceLoader(
    {
      react: hooks.React,
      [key("lib/firebase-hooks.ts")]: { useCallable: () => [fetchResponses, false] },
    },
    {
      AbortSignal: { timeout: () => new AbortController().signal },
      fetch: (url) =>
        new Promise((resolve, reject) => {
          loads.push({
            url,
            finish: () =>
              resolve({ ok: true, blob: async () => new Blob([url], { type: "audio/webm" }) }),
            fail: () => reject(new Error("Download failed")),
          });
        }),
      URL: {
        createObjectURL: (blob) => {
          const url = `blob:recording-${created.length + 1}`;
          created.push({ url, blob });
          return url;
        },
        revokeObjectURL: (url) => revoked.push(url),
      },
    },
  )("apps/web/src/hooks/useGradingAudio.ts");
  const render = () => {
    effectIndex = 0;
    const result = hooks.render(() => useGradingAudio("test", data, sectionIndex));
    pendingEffects.splice(0).forEach((effect) => effect());
    return result;
  };
  const flush = async () => {
    await new Promise(setImmediate);
    return render();
  };
  assert.equal(Object.keys(render().recordings).length, 0);
  await flush();
  assert.equal(loads.length, 0, "MC sections need no downloads");
  sectionIndex = 1;
  render();
  await flush();
  assert.deepEqual(
    loads.map(({ url }) => url),
    ["one-fresh-1", "two-fresh-1"],
  );
  loads[0].finish();
  let state = await flush();
  assert.equal(state.recordings["1:0"].status, "ready");
  assert.equal(state.recordings["1:1"], undefined, "The other recording can still be loading");
  const firstUrl = state.recordings["1:0"].url;
  loads[1].fail();
  state = await flush();
  assert.equal(state.recordings["1:1"].status, "failed");
  assert.equal(state.recordings["1:0"].url, firstUrl, "One failure preserves successful audio");
  state.retry();
  render();
  state = await flush();
  assert.equal(loads.length, 3, "Retry downloads only the uncached recording");
  assert.equal(loads[2].url, "two-fresh-2");
  assert.equal(state.recordings["1:1"], undefined, "Retry clears the failed state while loading");
  loads[2].finish();
  state = await flush();
  assert.equal(state.recordings["1:1"].status, "ready");
  const secondUrl = state.recordings["1:1"].url;
  sectionIndex = 0;
  render();
  sectionIndex = 1;
  state = render();
  await flush();
  assert.equal(refreshes, 2, "Cached sections do not refresh links or download again");
  assert.equal(state.recordings["1:0"].url, firstUrl);
  assert.equal(state.recordings["1:1"].url, secondUrl);
  assert.equal(revoked.length, 0, "Switching sections keeps cached blobs alive");

  sectionIndex = 2;
  render();
  await flush();
  assert.equal(loads.length, 5);
  loads[3].finish();
  state = await flush();
  const thirdUrl = state.recordings["2:0"].url;
  sectionIndex = 1;
  render();
  const objectsBeforeStale = created.length;
  loads[4].finish(); // The background download finishes after switching sections.
  state = await flush();
  assert.equal(state.recordings["2:1"], undefined);
  assert.equal(created.length, objectsBeforeStale, "Ignored completion cannot leak a blob URL");
  assert.equal(state.recordings["2:0"].url, thirdUrl);

  missingUrl = true;
  sectionIndex = 2;
  render();
  state = await flush();
  assert.equal(state.recordings["2:1"].status, "failed", "Missing fresh URLs are local failures");
  assert.equal(state.recordings["2:0"].url, thirdUrl);
  assert.equal(loads.length, 5);
  missingUrl = false;
  state.retry();
  render();
  await flush();
  assert.equal(loads.length, 6);
  assert.equal(loads[5].url, "four-fresh-5");
  loads[5].finish();
  state = await flush();
  assert.equal(state.recordings["2:1"].status, "ready");

  failResponses = true;
  sectionIndex = 3;
  render();
  state = await flush();
  assert.equal(state.recordings["3:0"].status, "failed");
  assert.equal(state.recordings["1:0"].url, firstUrl);
  failResponses = false;
  let finishRefresh;
  responseWait = new Promise((resolve) => {
    finishRefresh = resolve;
  });
  state.retry();
  render();
  await flush();
  sectionIndex = 0;
  render();
  finishRefresh();
  responseWait = undefined;
  await flush();
  assert.equal(loads.length, 6, "A URL refresh completed after leaving must not start downloads");
  sectionIndex = 3;
  render();
  state = await flush();
  assert.equal(loads.length, 7);
  state.retry();
  render();
  await flush();
  assert.equal(loads.length, 8);
  loads[6].finish();
  state = await flush();
  assert.equal(state.recordings["3:0"], undefined, "Retry ignores the previous download result");
  assert.equal(created.length, 4, "Stale retry results never create object URLs");
  effects.forEach(({ cleanup }) => cleanup?.());
  assert.deepEqual([...revoked].sort(), created.map(({ url }) => url).sort());
  assert.equal(
    new Set(revoked).size,
    revoked.length,
    "Every cached object URL is released exactly once",
  );
  loads[7].finish();
  await new Promise(setImmediate);
  assert.equal(created.length, 4, "Unmounted downloads never publish an object URL");
  console.log(
    "PASS: section-only blob loading, independent failures, fresh retries, caching, stale completion, and URL cleanup.",
  );
}
async function recordingChecks() {
  const hooks = hookRuntime();
  let recorder,
    recognition,
    denyOld,
    failStart = false,
    failRecognition = false;
  const streams = [],
    requestQueue = [],
    timers = [];
  class Recorder {
    static isTypeSupported() {
      return true;
    }
    constructor(_, options) {
      recorder = this;
      this.state = "inactive";
      this.mimeType = options.mimeType;
    }
    start() {
      if (failStart) throw new Error("start failed");
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
    }
  }
  class Recognition {
    constructor() {
      recognition = this;
    }
    start() {
      if (failRecognition) throw new Error("recognition startup failed");
    }
    stop() {}
    abort() {}
  }
  const stream = () => {
    const value = {
      stopped: false,
      getTracks: () => [
        {
          stop: () => {
            value.stopped = true;
          },
        },
      ],
      getAudioTracks: () => [],
    };
    streams.push(value);
    return value;
  };
  const load = sourceLoader(
    {
      react: hooks.React,
      [path.join(root, "apps/web/src/hooks/useTranslation.ts")]: {
        useTranslation: () => ({ t: (key) => key }),
      },
      [path.join(root, "apps/web/src/lib/finalize-recording.ts")]: {
        finalizeRecording: async (blob) => blob,
      },
    },
    {
      window: { SpeechRecognition: Recognition },
      document: {
        body: { appendChild: () => ({ contentWindow: null, remove() {} }) },
        createElement: () => ({}),
      },
      navigator: {
        mediaDevices: {
          getUserMedia: () =>
            requestQueue.length ? requestQueue.shift()() : Promise.resolve(stream()),
        },
      },
      MediaRecorder: Recorder,
      URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
      setTimeout: (fn) => {
        const timer = { fn, cancelled: false };
        timers.push(timer);
        return timer;
      },
      clearTimeout: (timer) => {
        timer.cancelled = true;
      },
    },
  );
  const Provider = load(
    "apps/web/src/providers/RecordingSessionProvider.tsx",
  ).RecordingSessionProvider;
  const value = () => hooks.render(() => Provider({ children: null })).props.value;
  await value().startRecording();
  value().stopRecording();
  assert.equal(value().status, "finalizing");
  recorder.ondataavailable({ data: new Blob(["attempt"]) });
  recorder.onstop();
  assert.equal(value().status, "finalizing");
  recognition.onresult({
    resultIndex: 0,
    results: [{ 0: { transcript: "final words" }, isFinal: true }],
  });
  recognition.onend();
  assert.equal(value().status, "finalizing", "Metadata finalization also gates readiness");
  await new Promise(setImmediate);
  assert.equal(value().status, "idle");
  assert.equal(value().transcript, "final words ");
  assert(value().audioBlob);
  assert.equal(value().errorSeverity, null);
  await value().startRecording();
  recognition.onerror({ error: "no-speech" });
  assert.equal(value().status, "recording");
  assert.equal(value().error, "recording.noSpeech");
  assert.equal(value().errorSeverity, "warning");
  recognition.onerror({ error: "network" });
  assert.equal(value().status, "recording");
  assert.equal(value().error, "recording.transcriptionFailed");
  assert.equal(value().errorSeverity, "warning");
  value().stopRecording();
  recorder.ondataavailable({ data: new Blob(["audio despite transcription failure"]) });
  recorder.onstop();
  recognition.onend();
  await new Promise(setImmediate);
  assert.equal(await value().audioBlob.text(), "audio despite transcription failure");
  assert.equal(value().errorSeverity, "warning");
  await value().startRecording();
  assert.equal(value().errorSeverity, null);
  recorder.onerror();
  assert.equal(value().errorSeverity, "error");
  recognition.onerror({ error: "network" });
  assert.equal(value().error, "recording.captureFailed");
  assert.equal(value().errorSeverity, "error");
  assert.equal(value().status, "finalizing");
  recognition.onend();
  assert.equal(value().status, "finalizing");
  recorder.ondataavailable({ data: new Blob(["retained after error"]) });
  recorder.onstop();
  await new Promise(setImmediate);
  assert.equal(await value().audioBlob.text(), "retained after error");
  assert.equal(value().status, "idle");
  const staleRecorder = recorder,
    staleRecognition = recognition;
  value().resetAudio();
  await value().startRecording();
  staleRecorder.onerror();
  staleRecorder.onstop();
  staleRecognition.onresult({
    resultIndex: 0,
    results: [{ 0: { transcript: "stale" }, isFinal: true }],
  });
  staleRecognition.onend();
  assert.equal(value().status, "recording");
  assert.equal(value().transcript, "");
  value().resetAudio();
  requestQueue.push(
    () =>
      new Promise((_, reject) => {
        denyOld = reject;
      }),
  );
  const oldStart = value().startRecording();
  value().resetAudio();
  await value().startRecording();
  denyOld(new Error("old permission denied"));
  await oldStart;
  assert.equal(value().status, "recording");
  assert.equal(streams.at(-1).stopped, false);
  value().stopRecording();
  recorder.ondataavailable({ data: new Blob(["timeout retained"]) });
  recorder.onstop();
  timers.filter((timer) => !timer.cancelled).forEach((timer) => timer.fn());
  await new Promise(setImmediate);
  assert.equal(value().status, "idle");
  assert.equal(await value().audioBlob.text(), "timeout retained");
  assert.equal(value().error, "recording.transcriptionTimeout");
  assert.equal(value().errorSeverity, "warning");
  value().resetAudio();
  failStart = true;
  await value().startRecording();
  assert.equal(value().status, "error");
  assert.equal(value().errorSeverity, "error");
  failStart = false;
  failRecognition = true;
  await value().startRecording();
  assert.equal(value().status, "finalizing");
  recorder.ondataavailable({ data: new Blob(["startup evidence"]) });
  recorder.onstop();
  await new Promise(setImmediate);
  assert.equal(await value().audioBlob.text(), "startup evidence");
  value().resetAudio();
  assert.equal(value().audioBlob, null);
  assert.equal(value().transcript, "");
  assert.equal(value().status, "idle");
  assert.equal(value().errorSeverity, null);
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
const isButton = (node) => ["button", "Button", "DialogTrigger"].includes(node.type);
const isGradeButton = (node) =>
  isButton(node) && "aria-pressed" in node.props && typeof node.props.children[0] === "number";
async function questionProviderChecks() {
  const hooks = hookRuntime();
  const key = (relative) => path.join(root, `apps/web/src/${relative}`);
  const Provider = sourceLoader({
    react: hooks.React,
    [key("lib/firebase-hooks.ts")]: {
      useCallable: () => [
        async () => ({
          data: {
            sections: [
              {
                title: "MC",
                kind: "mc",
                length: 1,
                goal: "",
                questions: ["Q"],
                audios: ["q.mp3"],
                choices: [{ D: "second", B: "first" }],
                instructions: { text: "", audio: "" },
              },
            ],
          },
        }),
        false,
      ],
    },
    [key("lib/errors.ts")]: { toUserMessage: (error) => error.message },
    ...componentStubs(["Alert"]),
  })("apps/web/src/providers/QuestionProvider.tsx").QuestionProvider;
  const render = () => hooks.render(() => Provider({ children: null }));
  render();
  hooks.effects.forEach((effect) => effect());
  await new Promise(setImmediate);
  const question = render().props.value[0].questions[0];
  assert.deepEqual(Array.from(question.choiceKeys), ["B", "D"]);
  assert.equal(question.choices, undefined, "assessment models exclude admin hints");
}
async function uiChecks() {
  function questionUI(
    blob = new Blob(["initial attempt"], { type: "audio/webm" }),
    kind = "audio_mc",
  ) {
    const hooks = hookRuntime(),
      calls = [],
      uploads = [],
      navigations = [],
      cleanups = [];
    let failUpload = false,
      failSave = false,
      uploadWait = null,
      status = "idle";
    const key = (relative) => path.join(root, `apps/web/src/${relative}`);
    class Player {
      constructor() {
        this.paused = false;
      }
      pause() {
        this.paused = true;
      }
    }
    const questionPlayer = new Player(),
      choicesPlayer = new Player();
    const load = sourceLoader(
      {
        react: hooks.React,
        "react-router-dom": {
          useParams: () => ({ id: "test", section: "1", question: "0" }),
          useNavigate: () => (destination) => navigations.push(destination),
        },
        "firebase/storage": {
          ref: (_, objectPath) => objectPath,
          uploadBytes: async (objectPath, value) => {
            uploads.push({ objectPath, value });
            if (uploadWait) await uploadWait;
            if (failUpload) {
              failUpload = false;
              throw new Error("upload failed");
            }
            return { metadata: { bucket: "bucket", fullPath: objectPath } };
          },
        },
        mime: { getExtension: () => "webm" },
        [key("providers/QuestionProvider.tsx")]: {
          useQuestion: () => ({
            kind,
            question: "Q",
            image: null,
            audio: "q.mp3",
            choicesAudio: "c.mp3",
            optionAudios: { B: "b.mp3", D: "d.mp3" },
            maxOptionPlays: 2,
            choices: ["first", "second"],
            choiceKeys: ["B", "D"],
          }),
          useSection: () => ({
            section: { title: "Section", questions: [{}, {}] },
            totalSections: 3,
          }),
        },
        [key("providers/RecordingSessionProvider.tsx")]: {
          useRecordingState: () => ({ status, error: "" }),
          useTranscriptText: () => ({ transcript: "initial words", interimTranscript: "" }),
          useAudioRecording: () => ({ audioBlob: blob, audioBlobUrl: "blob:test" }),
          useRecordingControls: () => ({
            resetAudio() {},
            startRecording: async () => {
              status = "recording";
            },
            stopRecording: () => {
              status = "finalizing";
            },
          }),
        },
        [key("lib/firebase-hooks.ts")]: {
          useCallable: (name) => [
            async (data) => {
              calls.push({ name, data });
              if (failSave) {
                failSave = false;
                throw new Error("save failed");
              }
              return { data: {} };
            },
            false,
          ],
        },
        [key("lib/firebase.ts")]: { storage: {} },
        [key("lib/errors.ts")]: { toUserMessage: (error) => error.message },
        [key("hooks/useStorageUrl.ts")]: {
          useStorageUrl: () => ({ url: "asset:test", loading: false, error: null }),
        },
        [key("hooks/useTranslation.ts")]: { useTranslation: () => ({ t: (key) => key }) },
        ...componentStubs([
          "Alert",
          "AssessmentHeader",
          "McOptions",
          "AudioPlayer",
          "Button",
          "Dialog",
          "SectionInstructionBody",
        ]),
      },
      {
        window: { confirm: () => true },
        HTMLAudioElement: Player,
        document: { querySelectorAll: () => [questionPlayer, choicesPlayer] },
        console: { error() {}, log() {} },
      },
    );
    const Component = load("apps/web/src/pages/AssessmentQuestion.tsx").AssessmentQuestion;
    const render = () =>
      hooks.render(() => {
        const element = Component();
        return element.type(element.props);
      });
    const findButton = (label) =>
      nodes(render()).find((node) => isButton(node) && node.props.children.includes(label));
    const initial = render();
    for (const effect of hooks.effects) {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    }
    return {
      render,
      calls,
      uploads,
      navigations,
      initial,
      questionPlayer,
      choicesPlayer,
      button: findButton,
      offer: () => findButton("question.offerMc").props.onClick(),
      select: (index) =>
        nodes(render())
          .find((node) => node.type === "McOptions")
          .props.onSelect(index),
      submit: () =>
        nodes(render())
          .find((node) => node.type === "form")
          .props.onSubmit({ preventDefault() {} }),
      skip: () => findButton("common.skip").props.onClick(),
      failNextUpload: () => {
        failUpload = true;
      },
      failNextSave: () => {
        failSave = true;
      },
      waitForUpload: (promise) => {
        uploadWait = promise;
      },
      setStatus: (value) => {
        status = value;
      },
      unmount: () => cleanups.forEach((fn) => fn()),
      nextDisabled: () =>
        nodes(render()).find((node) => isButton(node) && node.props.type === "submit").props
          .disabled,
    };
  }
  const ui = questionUI();
  ui.offer();
  ui.select(1);
  assert(
    nodes(ui.render()).some(
      (node) =>
        node.type === "McOptions" && node.props.keys[1] === "D" && node.props.audios.D === "d.mp3",
    ),
  );
  ui.failNextUpload();
  await ui.submit();
  assert.equal(ui.calls.length, 0);
  ui.failNextSave();
  await ui.submit();
  assert.equal(ui.uploads.length, 2);
  await ui.submit();
  assert.equal(ui.uploads.length, 2); // Save retries reuse successful upload.
  assert.equal(ui.calls.at(-1).data.selectedOption, "D");
  assert.equal(ui.calls.at(-1).data.transcript, "initial words");
  await ui.skip();
  assert.equal(ui.calls.at(-1).data.selectedOption, null);
  assert.equal(ui.calls.at(-1).data.skipped, true);
  assert(ui.calls.at(-1).data.gsUri);
  const direct = questionUI(null);
  direct.offer();
  direct.select(0);
  await direct.submit();
  assert.equal(direct.uploads.length, 0);
  assert.equal(direct.calls[0].data.gsUri, null);
  assert.equal(direct.calls[0].data.transcript, null);
  const mc = questionUI(undefined, "mc");
  assert.equal(mc.nextDisabled(), true);
  mc.select(1);
  assert(
    nodes(mc.render()).some(
      (node) =>
        node.type === "McOptions" && node.props.keys[1] === "D" && node.props.audios.D === "d.mp3",
    ),
  );
  await mc.submit();
  assert.equal(mc.calls[0].name, "api/submit-mc-answer");
  assert.equal(mc.calls[0].data.answer, "D");
  assert.equal(mc.uploads.length, 0);
  await mc.skip();
  assert.equal(mc.calls.at(-1).data.answer, null);
  const toggled = questionUI();
  toggled.offer();
  toggled.select(1);
  assert.equal(toggled.button("question.hideMc").props.disabled, false);
  assert.equal(toggled.button("question.startRecording").props.disabled, false);
  toggled.button("question.hideMc").props.onClick();
  assert.equal(
    nodes(toggled.render()).some((node) => node.type === "McOptions"),
    false,
  );
  assert.equal(toggled.button("question.offerMc").props["aria-expanded"], false);
  assert.equal(nodes(toggled.render()).filter((node) => node.type === "input").length, 0);
  assert.equal(nodes(toggled.render()).filter((node) => node.type === "AudioPlayer").length, 2);
  await toggled.submit();
  assert.equal(toggled.calls.at(-1).data.assistanceOffered, false);
  assert.equal(toggled.calls.at(-1).data.selectedOption, null);
  assert(toggled.calls.at(-1).data.gsUri);
  assert.equal(toggled.calls.at(-1).data.transcript, "initial words");
  toggled.offer();
  assert.equal(
    nodes(toggled.render()).find((node) => node.type === "McOptions").props.selectedIndex,
    1,
  );
  await toggled.button("question.startRecording").props.onClick();
  assert.equal(toggled.nextDisabled(), true);
  assert.equal(toggled.button("question.hideMc").props.disabled, true);
  toggled.select(0);
  toggled.button("question.hideMc").props.onClick();
  toggled.offer();
  toggled.render().props.onPlayCapture({ target: toggled.choicesPlayer });
  assert.equal(toggled.choicesPlayer.paused, true);
  toggled.setStatus("idle");
  await toggled.submit();
  assert.equal(toggled.calls.at(-1).data.assistanceOffered, true);
  assert.equal(toggled.calls.at(-1).data.selectedOption, "B");
  const collapsedFallback = questionUI(null);
  collapsedFallback.offer();
  collapsedFallback.select(1);
  collapsedFallback.button("question.hideMc").props.onClick();
  assert.equal(collapsedFallback.nextDisabled(), true);
  await collapsedFallback.submit();
  assert.equal(collapsedFallback.calls.length, 0);
  const recording = questionUI();
  recording.setStatus("finalizing");
  assert.equal(recording.nextDisabled(), true);
  await recording.submit();
  assert.equal(recording.calls.length, 0);
  recording.render().props.onPlayCapture({ target: recording.choicesPlayer });
  assert.equal(recording.choicesPlayer.paused, true);
  recording.setStatus("idle");
  recording.render().props.onPlayCapture({ target: recording.questionPlayer });
  assert.equal(recording.choicesPlayer.paused, true);
  let resolveUpload;
  const pending = questionUI();
  pending.waitForUpload(
    new Promise((resolve) => {
      resolveUpload = resolve;
    }),
  );
  const save = pending.submit();
  await pending.submit();
  assert.equal(pending.uploads.length, 1);
  pending.unmount();
  resolveUpload();
  await save;
  assert.equal(pending.calls.length, 1); // Leaving allows the initiated save to complete.
  assert.equal(pending.navigations.length, 0);
  const hooks = hookRuntime();
  const data = {
    assessment: { name: "Test", school: "Test", grade: "1" },
    sections: [
      {
        title: "MC",
        kind: "mc",
        length: 3,
        choices: [
          { D: "second", B: "first" },
          { D: "second", B: "first" },
          { D: "second", B: "first" },
        ],
        correctAnswers: ["D", "D", "B"],
      },
      {
        title: "Hybrid",
        kind: "audio_mc",
        length: 2,
        choices: [{ B: "first", D: "second" }],
        correctAnswers: ["B"],
      },
    ],
    studentResponsesBySection: {
      0: { type: "mc", studentResponses: { 0: "D", 1: "B", 2: null } },
      1: {
        type: "audio_mc",
        files: { 0: null },
        transcripts: { 0: null },
        attempts: { 0: { assistanceOffered: true, selectedOption: "D", skipped: false } },
      },
    },
  };
  const key = (relative) => path.join(root, `apps/web/src/${relative}`);
  let audioState = "ready";
  let audioRetries = 0;
  const grade = sourceLoader({
    react: hooks.React,
    "react-router-dom": {
      useParams: () => ({ id: "test" }),
      useLocation: () => ({ pathname: "/grade/test" }),
    },
    [key("lib/firebase-hooks.ts")]: { useCallable: () => [async () => ({ data }), false] },
    [key("lib/errors.ts")]: { toUserMessage: (error) => error.message },
    [key("hooks/useTranslation.ts")]: { useTranslation: () => ({ t: (key) => key }) },
    [key("hooks/useGradingAudio.ts")]: {
      useGradingAudio: (_id, responseData, sectionIndex) => {
        const response = responseData?.studentResponsesBySection[sectionIndex];
        const recordings = Object.fromEntries(
          Object.entries(response?.files ?? {})
            .filter(([, url]) => url)
            .map(([question]) => [
              `${sectionIndex}:${question}`,
              audioState === "ready"
                ? { status: "ready", url: `blob:section-${sectionIndex}-question-${question}` }
                : audioState === "failed"
                  ? { status: "failed" }
                  : undefined,
            ]),
        );
        return {
          recordings,
          retry: () => {
            audioRetries++;
            audioState = "ready";
          },
        };
      },
    },
    [key("components/ScoreModal.tsx")]: { default: "score" },
    ...componentStubs(["PageHeader", "Button", "Alert", "Tooltip", "AudioPlayer"]),
    [key("components/icons.tsx")]: { CheckIcon: "check", SpinnerIcon: "spinner", XIcon: "cross" },
  })("apps/web/src/pages/GradeAssessment.tsx").default;
  const renderGrade = () =>
    hooks.render(() => {
      const page = grade();
      return page.type(page.props);
    });
  renderGrade();
  assert(
    nodes(renderGrade()).some((node) => node.props.children.includes("gradeAssessment.loading")),
  );
  assert(!nodes(renderGrade()).some((node) => node.type === "PageHeader"));
  const cleanups = hooks.effects.map((effect) => effect());
  await new Promise(setImmediate);
  assert(
    nodes(renderGrade()).some(
      (node) => node.type === "span" && node.props.children.includes("1/3"),
    ),
  );
  const mcCards = nodes(renderGrade()).filter(
    (node) => node.type === "div" && node.props.className === "p-4",
  );
  assert.equal(mcCards.length, 3);
  const choiceRow = (question, key) =>
    nodes(mcCards[question]).find((node) => node.type === "div" && node.props.key === key);
  assert(choiceRow(0, "D").props.className.includes("bg-green-50"));
  assert(choiceRow(1, "B").props.className.includes("bg-red-50"));
  assert(choiceRow(1, "D").props.className.includes("bg-green-50"));
  assert(choiceRow(2, "B").props.className.includes("bg-amber-50"));
  assert(
    nodes(choiceRow(0, "D")).some(
      (node) => node.type === "span" && node.props.children.join("") === "D.",
    ),
  );
  nodes(renderGrade())
    .find((node) => isButton(node) && node.props.children[0]?.props?.children?.includes("Hybrid"))
    .props.onClick();
  assert.equal(nodes(renderGrade()).filter(isGradeButton).length, 6);
  assert.equal(nodes(renderGrade()).filter((node) => node.type === "AudioPlayer").length, 0);
  assert(
    nodes(renderGrade()).every((node) =>
      node.props.children.every(
        (child) => typeof child !== "string" || !/first|second/.test(child),
      ),
    ),
    "hybrid grading excludes selected and correct option hints",
  );

  const oldMc = { type: "mc", studentResponses: { 0: "D", 1: "D" } };
  const oldAudio = {
    type: "audio",
    files: { 0: "recording.webm" },
    transcripts: { 0: "Existing transcript" },
    grades: { 0: 4, 1: 5 },
  };
  const oldHybrid = {
    ...oldAudio,
    type: "audio_mc",
    attempts: { 0: { assistanceOffered: true, selectedOption: "B", skipped: false } },
  };
  for (const [kind, response, expectedStatus, hasRecording] of [
    ["mc", oldAudio, "0/1", false],
    ["mc", oldHybrid, "0/1", false],
    ["mc", undefined, "0/1", false],
    ["mc", oldMc, "1/1", false],
    ["audio", oldMc, "gradeAssessment.tab.graded 0/1", false],
    ["audio_mc", oldMc, "gradeAssessment.tab.graded 0/1", false],
    ["audio", oldHybrid, "gradeAssessment.tab.graded 1/1", true],
    ["audio_mc", oldAudio, "gradeAssessment.tab.graded 1/1", true],
  ]) {
    const sectionIdx = data.sections.length;
    const title = `Current section ${sectionIdx}`;
    data.sections.push({
      title,
      kind,
      length: 1,
      questions: ["Current question", "Removed question"],
      choices: [{ B: "first", D: "second" }],
      correctAnswers: ["D", "D"],
    });
    if (response) data.studentResponsesBySection[sectionIdx] = response;
    cleanups.push(...hooks.effects.map((effect) => effect()));
    await new Promise(setImmediate);
    const tab = nodes(renderGrade()).find(
      (node) => isButton(node) && node.props.children[0]?.props?.children?.includes(title),
    );
    assert.equal(tab.props.children[1].props.children[0], expectedStatus);
    tab.props.onClick();
    const sectionNodes = nodes(renderGrade());
    const hasText = (text) => sectionNodes.some((node) => node.props.children.includes(text));
    assert.equal(hasText("Current question"), true);
    assert.equal(hasText("Removed question"), false);
    assert.equal(
      sectionNodes.filter((node) => node.type === "AudioPlayer").length,
      hasRecording ? 1 : 0,
    );
    assert.equal(sectionNodes.filter(isGradeButton).length, hasRecording ? 6 : 0);
    if (hasRecording) {
      const player = sectionNodes.find((node) => node.type === "AudioPlayer");
      assert.equal(player.props.src, `blob:section-${sectionIdx}-question-0`);
      assert.equal(player.props.preloadedAudio, undefined);
    }
    assert.equal(hasText("question.mcOffered"), false);
    if (kind === "mc") {
      assert.equal(hasText("gradeAssessment.noAnswer"), response?.type !== "mc");
      assert.equal(hasText("first"), false, "grading excludes admin hints");
      assert.equal(hasText("second"), false, "grading excludes admin hints");
    } else if (!hasRecording) {
      assert.equal(hasText("gradeAssessment.noRecording"), true);
    }
  }
  cleanups.forEach((cleanup) => cleanup());
  audioState = "loading";
  assert(nodes(renderGrade()).some((node) => node.type === "PageHeader"));
  assert(
    nodes(renderGrade()).some((node) =>
      node.props.children.includes("gradeAssessment.loadingAudio"),
    ),
  );
  assert.equal(nodes(renderGrade()).filter((node) => node.type === "AudioPlayer").length, 0);
  assert.equal(
    nodes(renderGrade()).filter(isGradeButton).length,
    6,
    "Downloads do not hide grading controls",
  );
  assert(nodes(renderGrade()).some((node) => node.props.children.includes("Existing transcript")));
  audioState = "failed";
  assert(
    nodes(renderGrade()).some((node) => node.props.children.includes("gradeAssessment.errorAudio")),
  );
  assert.equal(
    nodes(renderGrade()).filter(isGradeButton).length,
    6,
    "Download failures do not hide grading controls",
  );
  assert(nodes(renderGrade()).some((node) => node.props.children.includes("Existing transcript")));
  nodes(renderGrade())
    .find((node) => isButton(node) && node.props.children.includes("common.retry"))
    .props.onClick();
  assert.equal(audioRetries, 1);
  assert(nodes(renderGrade()).some((node) => node.type === "PageHeader"));
}
async function adminQuestionsChecks(app) {
  const hooks = hookRuntime(),
    saved = [];
  const sections = Array.from({ length: 7 }, (_, index) => ({
    id: String(index),
    title: `Section ${index}`,
    kind: "mc",
    length: 0,
    goal: "",
    questions: [],
    audios: [],
    instructions: { text: "", audio: "" },
  }));
  const key = (relative) => path.join(root, `apps/web/src/${relative}`);
  const AdminQuestions = sourceLoader({
    react: hooks.React,
    [key("lib/firebase-hooks.ts")]: {
      useCallable: (name) => [
        async (input) => {
          if (name === "api/get-questions") return { data: { sections: [...sections] } };
          const result = await app.call("/admin/save-question-section", input, "owner", {
            isAdmin: true,
          });
          saved.push(input);
          sections.push({ ...input });
          return { data: result };
        },
        false,
      ],
    },
    [key("lib/errors.ts")]: { toUserMessage: (error) => error.message },
    [key("hooks/useTranslation.ts")]: { useTranslation: () => ({ t: (key) => key }) },
    ...componentStubs(["PageHeader", "Button", "Dialog", "Alert", "AssetUploader"]),
  })("apps/web/src/pages/AdminQuestions.tsx").default;
  const render = () => nodes(hooks.render(() => AdminQuestions()));
  const button = (label) =>
    render().find((node) => isButton(node) && node.props.children.includes(label));
  const kindSelect = () => render().find((node) => node.type === "select");
  const submit = () =>
    render()
      .find((node) => node.type === "form")
      .props.onSubmit({ preventDefault() {} });
  render();
  hooks.effects.forEach((effect) => effect());
  await new Promise(setImmediate);
  button("adminQuestions.new").props.onClick();
  assert.equal(
    render().find((node) => node.type === "input" && node.props.id === "section-id").props.value,
    "s8",
  );
  assert(
    nodes(kindSelect()).some((node) => node.type === "option" && node.props.value === "audio_mc"),
  );
  kindSelect().props.onChange({ target: { value: "audio_mc" } });
  button("adminQuestions.addQuestion").props.onClick();
  const hintInputs = () =>
    render()
      .filter(
        (node) =>
          node.type === "label" && node.props.children.includes("adminQuestions.choiceHint"),
      )
      .map((node) => nodes(node).find((child) => child.type === "input"));
  assert.equal(hintInputs().length, 4);
  hintInputs()[1].props.onChange({ target: { value: "Admin-only hint" } });
  await submit();
  assert.equal(saved.length, 0);
  assert(
    render().some(
      (node) =>
        node.type === "AlertDescription" &&
        node.props.children.includes("adminQuestions.hybridInvalid"),
    ),
  );
  const uploaders = render().filter((node) => node.type === "AssetUploader");
  uploaders[1].props.onChange("s8/question.mp3");
  for (const [index, uploader] of uploaders.filter((node) => node.props.label).entries()) {
    uploader.props.onChange(`s8/option-${index + 1}.mp3`);
  }
  render()
    .find((node) => node.type === "input" && node.props.placeholder === "e.g. A")
    .props.onChange({ target: { value: "B" } });
  const saveButton = () => render().find((node) => isButton(node) && node.props.type === "submit");
  const submitBeforeUpload = render().find((node) => node.type === "form").props.onSubmit;
  uploaders[0].props.onUploadingChange(true);
  uploaders[2].props.onUploadingChange(true);
  assert.equal(saveButton().props.disabled, true, "Save waits for concurrent editor uploads");
  assert.equal(saveButton().props["aria-busy"], true);
  await submitBeforeUpload({ preventDefault() {} });
  assert.equal(saved.length, 0, "Enter cannot save, even before the upload state rerenders");
  uploaders[0].props.onUploadingChange(false);
  assert.equal(saveButton().props.disabled, true, "one completed upload cannot enable Save early");
  await submit();
  assert.equal(saved.length, 0);
  uploaders[2].props.onUploadingChange(false);
  assert.equal(saveButton().props.disabled, false, "Save enables after the last upload finishes");
  await submit();
  assert.equal(saved.length, 1);
  const stored = app.documents.get("questions/s8");
  assert.equal(stored.kind, "audio_mc");
  assert.equal(stored.audios[0], "s8/question.mp3");
  assert.equal(stored.optionAudios[0].B, "s8/option-2.mp3");
  assert.equal(stored.choices[0].B, "Admin-only hint");
  assert.equal(stored.maxOptionPlays, 2);
  assert.equal(stored.correctAnswers[0], "B");
  render()
    .filter((node) => isButton(node) && node.props.children.includes("common.edit"))
    .at(-1)
    .props.onClick();
  render()
    .find((node) => isButton(node) && "aria-expanded" in node.props)
    .props.onClick();
  assert.equal(kindSelect().props.value, "audio_mc");
  assert.equal(hintInputs()[1].props.value, "Admin-only hint", "saved hints remain editable");
  assert.equal(
    render().filter((node) => node.type === "AssetUploader" && node.props.label)[1].props.value,
    "s8/option-2.mp3",
  );
  assert.equal(
    render().find((node) => node.type === "input" && node.props.placeholder === "e.g. A").props
      .value,
    "B",
  );
  for (const uploader of render().filter((node) => node.type === "AssetUploader"))
    uploader.props.onChange("");
  await submit();
  assert.equal(saved.length, 2, "the editor saves a section without recordings");
  const withoutAudio = app.documents.get("questions/s8");
  assert.equal(withoutAudio.audios[0], "");
  assert.equal(withoutAudio.optionAudios[0].B, "");
  assert.equal(withoutAudio.correctAnswers[0], "B");
}
async function archiveHookChecks() {
  const hooks = hookRuntime();
  let finish,
    calls = 0;
  const removed = [];
  const hook = sourceLoader({
    react: hooks.React,
    [path.join(root, "apps/web/src/lib/firebase-hooks.ts")]: {
      useCallable: () => [
        () => {
          calls++;
          return new Promise((resolve, reject) => {
            finish = { resolve, reject };
          });
        },
        false,
      ],
    },
    [path.join(root, "apps/web/src/lib/errors.ts")]: { toUserMessage: (error) => error.message },
    [path.join(root, "apps/web/src/hooks/useTranslation.ts")]: {
      useTranslation: () => ({ t: (key) => key }),
    },
  })("apps/web/src/hooks/useAssessmentArchive.ts").useAssessmentArchive;
  const render = () => hooks.render(() => hook((id) => removed.push(id)));
  let state = render();
  const saving = state.setArchived("a", "Student", true);
  await state.setArchived("a", "Student", true);
  assert.equal(calls, 1);
  assert.equal(render().pendingId, "a");
  assert.equal(removed.length, 0);
  finish.reject(new Error("Save failed"));
  await saving;
  state = render();
  assert.equal(state.error, "Save failed");
  assert.equal(state.pendingId, null);
  assert.equal(removed.length, 0);
  const retry = state.setArchived("a", "Student", true);
  finish.resolve({ data: { ok: true } });
  await retry;
  state = render();
  assert.equal(removed[0], "a");
  assert.equal(state.message.key, "archive.success");
  assert.equal(state.message.name, "Student");
  assert.equal(state.error, null);
  const restore = state.setArchived("a", "Student", false);
  finish.resolve({ data: { ok: true } });
  await restore;
  assert.equal(render().message.key, "archive.restoreSuccess");
}
async function validationChecks() {
  const { z } = require("zod");
  const { validate } = sourceLoader()("apps/functions/src/middleware/validation.ts");
  const run = async (schema, body) => {
    const req = { body };
    const result = { req, nextCalls: 0 };
    const res = {
      status(code) {
        result.status = code;
        return this;
      },
      json(body) {
        result.response = body;
      },
    };
    await validate(schema)(req, res, (error) => {
      result.nextCalls++;
      result.error = error;
      if (!error) result.data = req.body.data;
    });
    return result;
  };
  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1)
      .transform(async (name) => name.toUpperCase()),
    count: z.number().default(1),
  });
  const payload = { name: " Alice ", extra: "discard" };
  const metadata = { requestId: "test" };
  for (const body of [{ data: payload, metadata }, payload]) {
    const result = await run(schema, body);
    assert.equal(result.nextCalls, 1);
    assert.equal(result.error, undefined);
    assert.deepEqual(result.data, { name: "ALICE", count: 1 });
    if ("data" in body) assert.equal(result.req.body.metadata, metadata);
  }
  const optional = await run(z.object({}).optional(), undefined);
  assert.equal(optional.nextCalls, 1);
  assert.equal(optional.req.body.data, undefined);
  const invalidBody = { data: { name: 42 } };
  const invalid = await run(schema, invalidBody);
  assert.equal(invalid.nextCalls, 1);
  assert.equal(invalid.error.statusCode, 400);
  assert.equal(invalid.error.message, "Invalid request");
  assert(invalid.error.details.issues.length > 0);
  assert.equal(invalid.response, undefined);
  assert.equal(invalid.req.body, invalidBody);
  const failure = new Error("Transform failed");
  const failed = await run(
    z.string().transform(() => {
      throw failure;
    }),
    { data: "test" },
  );
  assert.equal(failed.error, failure);
  assert.equal(failed.nextCalls, 1);
  assert.equal(failed.response, undefined);
  console.log("PASS: parsed validation payloads, defaults, async transforms, and error handling.");
}
async function finishAssessmentChecks() {
  const app = backend();
  for (const [id, creatorEmail] of [
    ["owned", "owner"],
    ["foreign", "someone-else"],
  ]) {
    app.documents.set(`assessments/${id}`, {
      creatorEmail,
      createdAt: app.timestamp,
      finished: false,
    });
  }
  const call = mountedRouterCall(app);
  const before = JSON.stringify([...app.documents]);
  await assert.rejects(
    call("/finish-assessment", { assessmentId: "foreign" }),
    (error) => error.statusCode === 403,
  );
  await assert.rejects(
    call("/finish-assessment", { assessmentId: "missing" }),
    (error) => error.statusCode === 404,
  );
  assert.equal(JSON.stringify([...app.documents]), before, "Rejected requests do not write data");
  for (const [id, claims] of [
    ["owned", {}],
    ["foreign", { isAdmin: true }],
  ]) {
    const result = await call("/finish-assessment", { assessmentId: id }, claims);
    assert.equal(result.ok, true);
    const saved = app.documents.get(`assessments/${id}`);
    assert.equal(saved.finished, true);
    assert.equal(saved.finishedAt, app.timestamp);
    assert.equal(saved.updatedAt, app.timestamp);
  }
  console.log("PASS: finish assessment owner/admin access, non-owner denial, and missing records.");
}
async function archiveChecks() {
  const app = backend();
  const seed = {
    creatorEmail: "owner",
    createdAt: app.timestamp,
    finished: false,
    name: "Archive test",
    currentSection: 1,
    currentQuestion: 2,
  };
  app.documents.set("assessments/legacy", { ...seed });
  app.documents.set("assessments/complete", { ...seed, finished: true, archived: false });
  app.documents.set("assessments/other", { ...seed, creatorEmail: "someone-else" });
  app.documents.set("studentResponses/legacy-1", { "assessment-id": "legacy", grades: { 0: 4 } });
  app.objects.add("assessments/legacy/1/0.webm");
  const ids = async (input, email) =>
    (await app.call("/get-assessments", input, email)).assessments.map((item) => item.id).sort();
  assert.deepEqual(await ids({ finished: false }), ["legacy"]);
  assert.equal(
    (await app.call("/get-assessments", { finished: false })).assessments[0].archived,
    false,
  );
  for (const id of ["legacy", "complete"]) {
    await assert.rejects(
      app.call("/set-assessment-archived", { assessmentId: id, archived: true }, "stranger"),
      (error) => error.statusCode === 403,
    );
    await app.call("/set-assessment-archived", { assessmentId: id, archived: true });
    await app.call("/set-assessment-archived", { assessmentId: id, archived: true });
  }
  assert.deepEqual(await ids({ finished: false }), []);
  assert.deepEqual(await ids({ finished: true }), []);
  assert.deepEqual(await ids({ archived: true }), ["complete", "legacy"]);
  assert.deepEqual(await ids({ archived: true, finished: true }), ["complete"]);
  assert.deepEqual(await ids({ archived: true }, "stranger"), []);
  await app.call(
    "/set-assessment-archived",
    { assessmentId: "legacy", archived: false },
    "administrator",
    { isAdmin: true },
  );
  assert.deepEqual(await ids({ finished: false }), ["legacy"]);
  assert.equal(app.documents.get("assessments/legacy").currentSection, 1);
  assert.equal(app.documents.get("assessments/legacy").currentQuestion, 2);
  assert.equal(app.documents.get("assessments/legacy").finished, false);
  assert.equal(app.documents.get("studentResponses/legacy-1").grades[0], 4);
  assert(app.objects.has("assessments/legacy/1/0.webm"));
  await assert.rejects(
    app.call("/set-assessment-archived", { assessmentId: "missing", archived: true }),
    (error) => error.statusCode === 404,
  );
  for (const input of [
    { assessmentId: "legacy" },
    { assessmentId: "legacy", archived: "true" },
    { assessmentId: "", archived: true },
    { assessmentId: "a/b", archived: true },
  ]) {
    await assert.rejects(
      app.call("/set-assessment-archived", input),
      (error) => error.statusCode === 400,
    );
  }
  await assert.rejects(
    app.call("/get-assessments", { archived: "true" }),
    (error) => error.statusCode === 400,
  );
  await mountedRouterChecks(app);
  console.log(
    "PASS: archive/restore, legacy defaults, ownership/admin access, filtering, validation, repeated requests, and retained evidence.",
  );
}
function mountedRouterCall(app) {
  // Exercise real Express mounting (including the admin guard) without opening a socket.
  const router = sourceLoader({
    [path.join(root, "apps/functions/src/firebase.ts")]:
      app.load.overrides[path.join(root, "apps/functions/src/firebase.ts")],
  })("apps/functions/src/routes/index.ts").router;
  return (url, data = {}, claims = {}) =>
    new Promise((resolve, reject) => {
      const req = { method: "POST", url, headers: {}, body: { data } };
      let statusCode = 200;
      const res = {
        locals: { callerEmail: "owner", callerClaims: claims },
        status(code) {
          statusCode = code;
          return this;
        },
        json: (body) => {
          if (statusCode >= 400) {
            const error = new Error(body.error.message);
            error.statusCode = statusCode;
            reject(error);
          } else resolve(body.data);
        },
      };
      router.handle(req, res, (error) => reject(error ?? new Error("Route not handled")));
    });
}
async function mountedRouterChecks(app) {
  const call = mountedRouterCall(app);
  const active = await call("/admin/get-assessments", {}, { isAdmin: true });
  assert(active.assessments.every((item) => item.archived === false));
  const archived = await call("/admin/get-assessments", { archived: true }, { isAdmin: true });
  assert(archived.assessments.every((item) => item.archived === true));
  if (app.documents.has("assessments/complete"))
    assert(archived.assessments.some((item) => item.id === "complete"));
  await assert.rejects(
    call("/admin/get-assessments", { archived: "true" }, { isAdmin: true }),
    (error) => error.statusCode === 400,
  );
  await call("/get-questions");
  await call("/get-subtasks");
  await assert.rejects(call("/admin/get-assessments"), (error) => error.statusCode === 403);
  await assert.rejects(call("/admin/export-assessments"), (error) => error.statusCode === 403);
  await assert.rejects(
    call("/admin/save-question-section", {}),
    (error) => error.statusCode === 403,
  );
}
async function assessmentExportChecks() {
  const app = backend();
  const seed = {
    name: '陳, "一"\n學生',
    birthDate: "2010-03",
    gender: "female",
    specialEducationalNeeds: "none",
    grade: "S2",
    school: "學校\\path\\n",
    motherTongue: { language: "cantonese" },
    otherLanguages: [
      { language: "english" },
      { language: "other", otherSpecify: "日本語, 韓語\r\nその他" },
    ],
    creatorEmail: "owner@example.test",
    createdAt: app.timestamp,
    currentSection: 2,
    currentQuestion: 1,
    finished: false,
  };
  app.documents.set("assessments/a", { ...seed, updatedAt: app.timestamp });
  app.documents.set("assessments/b", {
    ...seed,
    specialEducationalNeeds: "autism_spectrum_disorder",
    name: '=HYPERLINK("test")',
    grade: "S3",
    finished: true,
    archived: true,
    finishedAt: app.timestamp,
    otherLanguages: [],
  });
  app.documents.set("assessments/c", {
    ...seed,
    specialEducationalNeeds: "developmental_language_disorder",
    otherLanguages: [],
  });
  const section = {
    title: "題目",
    goal: "",
    questions: ["Q1\rcontinued", "Q2", "Q3"],
    audios: [],
    instructions: { audio: "", text: "" },
  };
  app.documents.set("questions/11", {
    ...section,
    kind: "mc",
    length: 3,
    correctAnswers: ["A", "B", "A"],
  });
  app.documents.set("questions/3", { ...section, kind: "audio", length: 2 });
  app.documents.set("questions/7", {
    ...section,
    kind: "audio_mc",
    length: 2,
    correctAnswers: ["A", "B"],
  });
  const base = { "assessment-id": "a", createdAt: app.timestamp };
  app.documents.set("studentResponses/a-0", {
    ...base,
    section: 0,
    type: "mc",
    studentResponses: { 0: "A", 1: null },
  });
  app.documents.set("studentResponses/a-1", {
    ...base,
    section: 1,
    type: "audio",
    files: { 0: "gs://bucket/recording.webm" },
    transcripts: { 0: '第一行, "答案"\n第二行' },
    grades: { 0: 0 },
  });
  app.documents.set("studentResponses/a-2", {
    ...base,
    section: 2,
    type: "audio_mc",
    files: { 0: null, 1: null },
    transcripts: { 0: "spoken", 1: null },
    grades: { 0: 3 },
    attempts: {
      0: { assistanceOffered: false, selectedOption: null, skipped: false },
      1: { assistanceOffered: true, selectedOption: "B", skipped: false },
    },
  });
  app.documents.set("studentResponses/a-9", {
    ...base,
    section: 9,
    type: "audio",
    files: { 0: null },
    transcripts: { 0: "Historic answer" },
    grades: { 0: 4 },
  });
  app.documents.set("studentResponses/orphan", {
    ...base,
    "assessment-id": "missing",
    section: 0,
    type: "mc",
    studentResponses: { 0: "A" },
  });
  const subtask = {
    name: "Summary",
    questionIds: [
      { sectionIndex: 0, questionIndex: 0 },
      { sectionIndex: 1, questionIndex: 0 },
      { sectionIndex: 2, questionIndex: 0 },
    ],
    norms: {
      S1: null,
      S2: { min: 0, max: 11, n: 40, mean: 5, stdDev: 2 },
      S3: null,
      S4: null,
      S5: null,
      S6: null,
    },
    createdAt: app.timestamp,
    updatedAt: app.timestamp,
  };
  app.documents.set("subtasks/summary", subtask);
  app.documents.set("subtasks/summary_score", {
    ...subtask,
    norms: { ...subtask.norms, S2: { ...subtask.norms.S2, stdDev: 0 } },
  });
  const before = JSON.stringify([...app.documents]);
  const call = mountedRouterCall(app);
  await assert.rejects(call("/admin/export-assessments"), (error) => error.statusCode === 403);
  await assert.rejects(
    call("/admin/export-assessments", { archived: true }, { isAdmin: true }),
    (error) => error.statusCode === 400,
  );
  const data = await call("/admin/export-assessments", {}, { isAdmin: true });
  assert.equal(data.assessments.length, 3);
  assert.equal(data.assessments.find((item) => item.id === "a").archived, false);
  assert.equal(data.assessments.find((item) => item.id === "b").archived, true);
  assert.equal(
    data.assessments.find((item) => item.id === "a").updatedAtIsoTimestamp,
    new Date(0).toISOString(),
  );
  assert.equal(data.assessments.find((item) => item.id === "c").finishedAtIsoTimestamp, null);
  assert.equal(data.responses.length, 4);
  assert.equal(
    data.responses.find((item) => item.section === 1).files[0],
    "gs://bucket/recording.webm",
  );
  assert.equal(JSON.stringify([...app.documents]), before, "Export does not write data");
  // The workbook writer checks plain-object prototypes; bridge the VM's objects to Node.
  const nativeValue = (value) =>
    Array.isArray(value)
      ? Array.from(value, nativeValue)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, nativeValue(item)]))
        : value;
  const writer = require("write-excel-file/universal").default;
  const { buildAssessmentWorkbook, createWorkbookBlob } = sourceLoader(
    {
      "write-excel-file/universal": {
        __esModule: true,
        default: (sheets) => writer(nativeValue(sheets)),
      },
    },
    { String, Number },
  )("apps/web/src/lib/assessment-export.ts");
  const sheets = buildAssessmentWorkbook(data);
  assert.equal(sheets.length, 7);
  assert.equal(new Set(sheets.map((sheet) => sheet.name)).size, sheets.length);
  for (const sheet of sheets) {
    assert.equal(new Set(sheet.headers).size, sheet.headers.length);
    assert(
      sheet.headers.every((header) => header.length <= 16),
      "Short column names",
    );
    assert(sheet.rows.every((row) => row.length === sheet.headers.length));
    assert(!sheet.headers.some((header) => /audio|uri|url/i.test(header)), "No recording links");
  }
  const getSheet = (name) => {
    const sheet = sheets.find((sheet) => sheet.name === name);
    assert(sheet, name);
    return sheet;
  };
  const cell = (sheet, row, key) => {
    assert(sheet.headers.includes(key), key);
    return row[sheet.headers.indexOf(key)];
  };
  const demographics = getSheet("Demographics");
  const [a, b, c] = demographics.rows;
  assert.deepEqual(
    [a, b, c].map((row) => cell(demographics, row, "special_needs")),
    ["none", "autism_spectrum_disorder", "developmental_language_disorder"],
  );
  assert.equal(cell(demographics, a, "name"), seed.name);
  assert.equal(cell(demographics, a, "school"), seed.school);
  assert.equal(cell(demographics, a, "birth_date"), "2010-03");
  assert.equal(cell(demographics, a, "lang2_other"), "日本語, 韓語\r\nその他");
  assert.equal(cell(demographics, b, "name"), '=HYPERLINK("test")');
  assert.equal(cell(demographics, b, "archived"), 1);
  assert.equal(cell(demographics, a, "score"), 4);
  assert.equal(cell(demographics, a, "max_score"), 23);
  assert.equal(cell(demographics, a, "scored"), 3);
  assert.equal(cell(demographics, a, "ungraded"), 2);
  assert.equal(cell(demographics, c, "scored"), 0);
  const mc = getSheet("11 - 題目"),
    audio = getSheet("3 - 題目"),
    hybrid = getSheet("7 - 題目"),
    history = getSheet("Historical 9");
  assert.deepEqual(
    Array.from(data.sections, (section) => section.id),
    ["11", "3", "7"],
  );
  assert.deepEqual(
    Array.from(sheets.slice(1, 4), (sheet) => sheet.name),
    ["11 - 題目", "3 - 題目", "7 - 題目"],
  );
  assert.equal(mc.rows.length, 3);
  assert.deepEqual(Array.from(mc.headers), ["name", "id", "q1", "q2", "q3"]);
  assert.deepEqual(Array.from(audio.headers), ["name", "id", "q1", "q2"]);
  assert.deepEqual(Array.from(hybrid.headers), [
    "name",
    "id",
    "q1_transcript",
    "q1_choice",
    "q1_help",
    "q2_transcript",
    "q2_choice",
    "q2_help",
  ]);
  assert.deepEqual(Array.from(history.headers), ["name", "id", "q1"]);
  assert.equal(cell(mc, mc.rows[0], "q1"), "A");
  assert.equal(cell(mc, mc.rows[0], "q2"), null);
  assert.equal(cell(mc, mc.rows[0], "q3"), undefined);
  assert.equal(cell(audio, audio.rows[0], "q1"), '第一行, "答案"\n第二行');
  assert.equal(cell(audio, audio.rows[0], "q2"), undefined);
  assert.equal(cell(hybrid, hybrid.rows[0], "q1_transcript"), "spoken");
  assert.equal(cell(hybrid, hybrid.rows[0], "q1_choice"), null);
  assert.equal(cell(hybrid, hybrid.rows[0], "q1_help"), 0);
  assert.equal(cell(hybrid, hybrid.rows[0], "q2_choice"), "B");
  assert.equal(cell(hybrid, hybrid.rows[0], "q2_help"), 1);
  assert.equal(cell(hybrid, hybrid.rows[2], "q1_help"), null);
  assert.equal(cell(history, history.rows[0], "q1"), "Historic answer");
  const subtasks = getSheet("Subtasks");
  assert.equal(subtasks.rows.length, 6);
  assert.equal(cell(subtasks, subtasks.rows[0], "score"), 4);
  assert.equal(cell(subtasks, subtasks.rows[0], "z"), -0.5);
  assert.equal(cell(subtasks, subtasks.rows[1], "z"), null);
  assert.equal(cell(subtasks, subtasks.rows[2], "z"), null);
  const guide = getSheet("Questions");
  assert.equal(cell(guide, guide.rows[0], "text"), "Q1\rcontinued");
  const unusual = buildAssessmentWorkbook({
    ...data,
    sections: data.sections.map((section, index) => ({
      ...section,
      id: index === 0 ? "Demographics" : "同名 / [測試]:*?\\'".repeat(8) + index,
      title: index === 0 ? "" : section.title,
    })),
  });
  assert.equal(unusual[1].name, "Demographics (2)");
  assert.equal(new Set(unusual.map((sheet) => sheet.name.toLowerCase())).size, unusual.length);
  assert(unusual.every((sheet) => sheet.name.length <= 31 && !/[\\/?*[\]:']/.test(sheet.name)));
  const empty = buildAssessmentWorkbook({ ...data, assessments: [], responses: [] });
  assert(
    empty.filter((sheet) => sheet.name !== "Questions").every((sheet) => sheet.rows.length === 0),
  );
  const blob = await createWorkbookBlob(sheets);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const { unzipSync, strFromU8 } = require("fflate");
  const archive = unzipSync(bytes);
  assert(archive["xl/workbook.xml"]);
  for (const [name, content] of Object.entries(archive))
    if (name.endsWith(".xml")) {
      const text = strFromU8(content);
      assert(!text.includes("gs://"), "No Storage links in the actual workbook");
      assert(!/<f(?:\s|>)/.test(text), "User-entered strings are not formulas");
    }
  fs.writeFileSync("/tmp/vaca-assessment-workbook-test.xlsx", bytes);
  console.log(
    "PASS: admin-only complete XLSX export, section sheets/short headers, native Unicode/text/numbers, missing versus zero scores, hybrid/historical evidence, norms, safe sheet names, empty data, and no Storage links/formulas.",
  );
}
function assessmentSelectChecks() {
  const hooks = hookRuntime();
  const parts = [
    "Select",
    "SelectContent",
    "SelectGroup",
    "SelectItem",
    "SelectTrigger",
    "SelectValue",
  ];
  const { AssessmentSelect } = sourceLoader({
    react: hooks.React,
    [path.join(root, "apps/web/src/components/ui/select.tsx")]: Object.fromEntries(
      parts.map((part) => [part, part]),
    ),
  })("apps/web/src/components/AssessmentSelect.tsx");
  const selected = [];
  const props = {
    id: "needs",
    value: "",
    placeholder: "請選擇",
    options: [{ value: "none", label: "沒有" }],
    required: true,
    "aria-invalid": true,
    "aria-describedby": "needs-error",
    onValueChange: (value) => selected.push(value),
  };
  const tree = AssessmentSelect(props);
  assert.equal(tree.props.value, null, "empty form value uses Base UI's empty selection");
  assert.equal(tree.props.required, true);
  assert.equal(tree.props.items[0].label, "請選擇");
  assert.equal(tree.props.items[0].value, null, "placeholder can clear an existing selection");
  assert.equal(tree.props.items[1].label, "沒有", "display labels are separate from stored keys");
  const trigger = nodes(tree).find((node) => node.type === "SelectTrigger");
  assert.equal(trigger.props.id, "needs");
  assert.equal(trigger.props["aria-invalid"], true);
  assert.equal(trigger.props["aria-describedby"], "needs-error");
  tree.props.onValueChange("none");
  tree.props.onValueChange(null);
  assert.deepEqual(selected, ["none", ""], "clearing preserves required form validation");
  assert.equal(AssessmentSelect({ ...props, value: "none" }).props.value, "none");
}

async function newAssessmentDemographicsChecks(validFirst = false) {
  const hooks = hookRuntime();
  const submitted = [];
  const key = (relative) => path.join(root, `apps/web/src/${relative}`);
  const Component = sourceLoader(
    {
      react: hooks.React,
      "use-force-update": { __esModule: true, default: () => () => {} },
      [key("providers/RecordingSessionProvider.tsx")]: { useBrowserSupport: () => true },
      [key("lib/firebase-hooks.ts")]: {
        useCallable: () => [
          async (input) => {
            submitted.push(input);
            return { data: { id: "test" } };
          },
        ],
      },
      [key("hooks/useTranslation.ts")]: { useTranslation: () => ({ t: (value) => value }) },
      ...componentStubs(["Button", "Alert"]),
      [key("components/ui/input.tsx")]: { Input: "Input" },
      [key("components/AssessmentSelect.tsx")]: { AssessmentSelect: "AssessmentSelect" },
    },
    { window: { location: {} } },
  )("apps/web/src/pages/NewAssessment.tsx").default;
  const render = () => nodes(hooks.render(() => Component()));
  const select = () => render().find((node) => node.props?.id === "specialEducationalNeeds");
  const submit = () =>
    render()
      .find((node) => node.type === "form")
      .props.onSubmit({ preventDefault() {} });
  const change = (node, value) =>
    node.type === "AssessmentSelect"
      ? node.props.onValueChange(value)
      : node.props.onChange({ target: { value } });
  const values = ["none", "autism_spectrum_disorder", "developmental_language_disorder"];
  const byId = (id) => render().find((node) => node.props?.id === id);
  const otherSelect = () =>
    render().find(
      (node) =>
        node.type === "AssessmentSelect" &&
        node.props["aria-label"] === "newAssessment.otherLanguages",
    );
  const add = () =>
    render()
      .find(
        (node) =>
          isButton(node) &&
          JSON.stringify(node.props.children).includes("newAssessment.lang.addAnother"),
      )
      .props.onClick();
  const remove = () =>
    render()
      .find(
        (node) => isButton(node) && JSON.stringify(node.props.children).includes("common.remove"),
      )
      .props.onClick();
  const invalid = (node) => node.props["aria-invalid"] === true;
  for (const id of [
    "birthYear",
    "birthMonth",
    "grade",
    "motherTongue",
    "specialEducationalNeeds",
  ]) {
    assert.equal(invalid(byId(id)), false, `${id} initially neutral`);
  }
  for (const [id, invalidValue] of [
    ["studentName", "T"],
    ["school", ""],
  ]) {
    assert.equal(byId(id).props.required, true);
    assert.equal(invalid(byId(id)), false, `${id} initially neutral`);
    assert.equal(byId(id).props["aria-describedby"], undefined);
    assert(!nodes(byId(`${id}-error`)).some((node) => node.type === "p"));
    change(byId(id), invalidValue);
    assert.equal(invalid(byId(id)), false, `${id} stays neutral before submit`);
    assert.equal(byId(id).props["aria-describedby"], undefined);
  }
  const controls = render().filter((node) =>
    ["input", "Input", "AssessmentSelect"].includes(node.type),
  );
  assert.equal(controls.at(-1).props.id, "specialEducationalNeeds", "SEN is the last data control");
  add();
  assert.equal(invalid(otherSelect()), false);
  remove();
  if (!validFirst) {
    await submit();
    assert.equal(submitted.length, 0);
    for (const id of [
      "birthYear",
      "birthMonth",
      "grade",
      "motherTongue",
      "specialEducationalNeeds",
    ]) {
      assert.equal(invalid(byId(id)), true, `${id} invalid after submit`);
      assert(byId(id).props["aria-describedby"]);
      assert(byId(`${id}-error`));
    }
    for (const [id, invalidValue] of [
      ["studentName", "T"],
      ["school", ""],
    ]) {
      assert.equal(invalid(byId(id)), true, `${id} invalid after submit`);
      assert.equal(byId(id).props["aria-describedby"], `${id}-error`);
      assert(nodes(byId(`${id}-error`)).some((node) => node.type === "p"));
      change(byId(id), "Test");
      assert.equal(invalid(byId(id)), false, `${id} clears immediately`);
      assert.equal(byId(id).props["aria-describedby"], undefined);
      change(byId(id), invalidValue);
      assert.equal(invalid(byId(id)), true, `${id} restores immediately`);
      await submit();
      assert.equal(submitted.length, 0, `${id} blocks submission`);
    }
    for (const [id, value] of [
      ["birthYear", "2010"],
      ["birthMonth", "1"],
      ["grade", "S1"],
      ["motherTongue", "cantonese"],
      ["specialEducationalNeeds", "none"],
    ]) {
      change(byId(id), value);
      assert.equal(invalid(byId(id)), false, `${id} clears immediately`);
      change(byId(id), "");
      assert.equal(invalid(byId(id)), true, `${id} restores immediately`);
    }
    add();
    assert.equal(invalid(otherSelect()), true);
    await submit();
    assert.equal(submitted.length, 0);
    change(otherSelect(), "english");
    assert.equal(invalid(otherSelect()), false);
    change(otherSelect(), "");
    assert.equal(invalid(otherSelect()), true);
    remove();
  }
  assert.equal(select().props.value, "");
  assert.deepEqual(
    Array.from(select().props.options, (option) => option.value),
    values,
  );
  for (const [id, value] of [
    ["studentName", "Test"],
    ["birthYear", "2010"],
    ["birthMonth", "1"],
    ["grade", "S1"],
    ["school", "Test"],
  ]) {
    change(
      render().find((node) => node.props?.id === id),
      value,
    );
    if (id === "studentName" || id === "school") {
      assert.equal(invalid(byId(id)), false, `${id} clears immediately`);
    }
  }
  for (const [id, invalidValue] of [
    ["studentName", "T"],
    ["school", ""],
  ]) {
    assert.equal(invalid(byId(id)), false, `${id} remains valid on rerender`);
    change(byId(id), invalidValue);
    assert.equal(invalid(byId(id)), !validFirst, `${id} follows error visibility`);
    change(byId(id), "Test");
    assert.equal(invalid(byId(id)), false, `${id} corrects immediately`);
  }
  change(
    render().find((node) => node.type === "input" && node.props.name === "gender"),
    "male",
  );
  change(
    render().find((node) => node.type === "AssessmentSelect" && node.props.id === "motherTongue"),
    "cantonese",
  );
  if (validFirst) {
    change(select(), "none");
    await submit();
    assert.equal(submitted.length, 1, "valid first submit succeeds after removing an empty row");
    for (const [id, invalidValue] of [
      ["studentName", "T"],
      ["school", ""],
    ]) {
      change(byId(id), invalidValue);
      await submit();
      assert.equal(submitted.length, 1, `${id} alone blocks submission`);
      assert.equal(invalid(byId(id)), true);
      change(byId(id), "Test");
      assert.equal(invalid(byId(id)), false);
    }
    add();
    await submit();
    assert.equal(submitted.length, 1, "an empty added language blocks submission");
    remove();
    await submit();
    assert.equal(submitted.length, 2, "valid submit succeeds after removing an empty row");
    change(byId("grade"), "");
    await submit();
    assert.equal(submitted.length, 2, "a changed required field blocks submission");
    assert.equal(invalid(byId("grade")), true);
    return;
  }
  await submit();
  assert.equal(submitted.length, 0);
  assert.equal(select().props["aria-invalid"], true);
  assert.equal(select().props["aria-describedby"], "specialEducationalNeeds-error");
  for (const value of values) {
    change(select(), value);
    await submit();
  }
  assert.deepEqual(
    submitted.map((input) => input.specialEducationalNeeds),
    values,
  );
  change(select(), "");
  await submit();
  assert.equal(submitted.length, 3);
  assert.equal(select().props["aria-invalid"], true);
}

async function optionPlaybackChecks() {
  const app = backend();
  const config = {
    title: "Audio options",
    kind: "mc",
    length: 2,
    goal: "",
    questions: ["Q1", "Q2"],
    audios: [],
    choices: [
      { B: "", D: "" },
      { B: "", D: "" },
    ],
    optionAudios: [
      { B: "b.mp3", D: "d.mp3" },
      { B: "b2.mp3", D: "d2.mp3" },
    ],
    correctAnswers: ["B", "D"],
    instructions: { text: "", audio: "" },
  };
  await app.call("/admin/save-question-section", { id: "0", ...config }, "admin", {
    isAdmin: true,
  });
  await app.call(
    "/admin/save-question-section",
    { id: "1", ...config, kind: "audio_mc", maxOptionPlays: 3 },
    "admin",
    { isAdmin: true },
  );
  app.documents.set("assessments/plays", {
    name: "Test",
    grade: "S1",
    creatorEmail: "owner",
    createdAt: app.timestamp,
    currentSection: 0,
    currentQuestion: 0,
    finished: false,
  });
  const address = { assessmentId: "plays", section: 0, question: 0 };
  const first = { ...address, optionKey: "B", playbackId: crypto.randomUUID() };
  const read = () => app.call("/get-option-audio-playback", address);
  assert.equal((await read()).maxPlays, 2);
  assert.deepEqual(Object.keys((await read()).counts), []);
  await assert.rejects(
    app.call("/update-option-audio-playback", first, "other"),
    (e) => e.statusCode === 403,
  );
  await assert.rejects(
    app.call("/get-option-audio-playback", address, "other"),
    (e) => e.statusCode === 403,
  );
  for (const invalid of [
    { ...first, optionKey: "A" },
    { ...first, optionKey: "toString" },
    { ...first, playbackId: "bad" },
    { ...first, section: 99 },
    { ...first, question: 99 },
  ])
    await assert.rejects(
      app.call("/update-option-audio-playback", invalid),
      (e) => e.statusCode === 400,
    );
  app.failNextCommit();
  await assert.rejects(app.call("/update-option-audio-playback", first));
  assert.equal((await read()).counts.B, undefined);
  assert.equal((await app.call("/update-option-audio-playback", first)).counts.B, 1);
  assert.equal(
    (await app.call("/update-option-audio-playback", first)).counts.B,
    1,
    "lost response retry is idempotent",
  );
  assert.equal(
    app.documents.get("assessments/plays").currentQuestion,
    0,
    "listening does not advance progress",
  );
  assert.equal(
    Object.keys(app.documents.get("studentResponses/plays-0").studentResponses).length,
    0,
  );
  const second = { ...first, playbackId: crypto.randomUUID() };
  assert.equal((await app.call("/update-option-audio-playback", second)).counts.B, 2);
  assert.equal(
    (await app.call("/update-option-audio-playback", { ...first, playbackId: crypto.randomUUID() }))
      .counts.B,
    3,
    "the backend records plays without enforcing the frontend limit",
  );
  assert.equal((await read()).counts.B, 3, "reloading retains the count");
  assert.equal(
    (
      await app.call("/update-option-audio-playback", {
        ...first,
        optionKey: "D",
        playbackId: crypto.randomUUID(),
      })
    ).counts.D,
    1,
    "each option has its own limit",
  );
  await app.call("/submit-mc-answer", { ...address, answer: null });
  assert.equal((await read()).counts.B, 3, "skipping retains counts");
  const late = { ...first, optionKey: "D", playbackId: crypto.randomUUID() };
  assert.equal(
    (await app.call("/update-option-audio-playback", late)).counts.D,
    2,
    "background saves can finish after the answer is submitted",
  );
  const saved = await app.call("/get-assessment-student-responses", { assessmentId: "plays" });
  assert.equal(saved.studentResponsesBySection[0].optionPlayCounts[0].B, 3);
  assert.equal(
    saved.studentResponsesBySection[0].optionPlaybackIds,
    undefined,
    "internal request IDs stay private",
  );
  const exportData = {
    assessments: [saved.assessment],
    responses: Object.values(saved.studentResponsesBySection),
    sections: saved.sections,
    subtasks: [],
    exportedAtIsoTimestamp: new Date(0).toISOString(),
  };
  const workbook = app
    .load("apps/web/src/lib/assessment-export.ts")
    .buildAssessmentWorkbook(exportData);
  const sheet = workbook.find((sheet) => sheet.headers.includes("q1_plays_B"));
  assert.equal(sheet.rows[0][sheet.headers.indexOf("q1_plays_B")], 3);
  assert.equal(sheet.rows[0][sheet.headers.indexOf("q1_plays_D")], 2);
  assert.equal(
    sheet.rows[0][sheet.headers.indexOf("q2_plays_B")],
    null,
    "untracked counts are unknown",
  );
  const hybrid = { ...first, section: 1, playbackId: crypto.randomUUID() };
  for (let i = 0; i < 3; i++) {
    const result = await app.call("/update-option-audio-playback", {
      ...hybrid,
      playbackId: crypto.randomUUID(),
    });
    assert.equal(result.counts.B, i + 1);
    assert.equal(result.maxPlays, 3);
  }
  const fourth = await app.call("/update-option-audio-playback", hybrid);
  assert.equal(fourth.counts.B, 4);
  assert.equal((await app.call("/update-option-audio-playback", hybrid)).counts.B, 4);
  await app.call("/submit-audio-mc-answer", {
    ...address,
    section: 1,
    gsUri: null,
    transcript: null,
    assistanceOffered: true,
    selectedOption: "B",
    skipped: false,
  });
  await app.call("/submit-audio-grade", { ...address, section: 1, grade: 4 });
  const hybridData = await app.call("/get-assessment-student-responses", { assessmentId: "plays" });
  assert.equal(hybridData.studentResponsesBySection[1].optionPlayCounts[0].B, 4);
  assert.equal(hybridData.studentResponsesBySection[1].grades[0], 4);
  await app.call("/submit-mc-answer", { ...address, question: 1, answer: "D" });
  const unplayed = await app.call("/get-option-audio-playback", { ...address, question: 1 });
  assert.equal(unplayed.counts.B, 0, "submitted but unplayed options have a known zero count");
  assert.equal(unplayed.counts.D, 0);
  assert.equal((await read()).counts.B, 3, "submitting another question preserves earlier counts");
  app.documents.get("assessments/plays").finished = true;
  assert.equal(
    (await app.call("/update-option-audio-playback", { ...first, section: 1, question: 1 })).counts
      .B,
    1,
    "a playback save can finish after the assessment is completed",
  );
  // Updating playback rewrites the document inside a transaction; retain all evidence.
  app.documents.set("assessments/retained", {
    creatorEmail: "owner",
    createdAt: app.timestamp,
    finished: false,
  });
  const legacyMc = {
    "assessment-id": "retained",
    section: 0,
    type: "mc",
    createdAt: app.timestamp,
    studentResponses: { 1: "D" },
    optionPlaybackIds: { 1: { D: [crypto.randomUUID()] } },
    auditNote: "retain extra stored fields",
  };
  app.documents.set("studentResponses/legacy-mc-id", legacyMc);
  const retainedRequest = { ...first, assessmentId: "retained", playbackId: crypto.randomUUID() };
  await app.call("/update-option-audio-playback", retainedRequest);
  const retainedMc = app.documents.get("studentResponses/legacy-mc-id");
  assert.equal(retainedMc.studentResponses[1], "D");
  assert.equal(retainedMc.optionPlaybackIds[1].D[0], legacyMc.optionPlaybackIds[1].D[0]);
  assert.equal(retainedMc.createdAt, app.timestamp);
  assert.equal(retainedMc.auditNote, legacyMc.auditNote);
  assert.equal(
    app.documents.has("studentResponses/retained-0"),
    false,
    "reuse the legacy response ID",
  );
  const legacyHybrid = {
    "assessment-id": "retained",
    section: 1,
    type: "audio_mc",
    createdAt: app.timestamp,
    files: { 1: "gs://bucket/retained.webm" },
    transcripts: { 1: "Keep these words" },
    grades: { 1: 4 },
    attempts: { 1: { assistanceOffered: true, selectedOption: "D", skipped: false } },
  };
  app.documents.set("studentResponses/legacy-hybrid-id", legacyHybrid);
  await app.call("/update-option-audio-playback", { ...retainedRequest, section: 1 });
  const retainedHybrid = app.documents.get("studentResponses/legacy-hybrid-id");
  for (const field of ["files", "transcripts", "grades", "attempts"])
    assert.equal(JSON.stringify(retainedHybrid[field]), JSON.stringify(legacyHybrid[field]));
  assert.equal(retainedHybrid.createdAt, app.timestamp);
  assert.equal(app.documents.has("studentResponses/retained-1"), false);
  const schema = app.load(
    "apps/functions/src/types/zod/routes/questions.ts",
  ).AdminSaveQuestionSectionSchema;
  for (const invalid of [
    { ...config, maxOptionPlays: 0 },
    { ...config, maxOptionPlays: 1.5 },
    { ...config, maxOptionPlays: 21 },
    { ...config, optionAudios: [{ missing: "missing.mp3" }] },
  ])
    assert.equal(schema.safeParse({ id: "0", ...invalid }).success, false);
  for (const kind of ["mc", "audio_mc"]) {
    for (const optionAudios of [undefined, [], [{}], [{ B: "" }], [{ B: "b.mp3" }]]) {
      const draft = { id: "draft", ...config, kind, audios: ["", ""], optionAudios };
      assert.equal(
        schema.safeParse(draft).success,
        true,
        `${kind} accepts missing or partial recordings`,
      );
      await app.call("/admin/save-question-section", draft, "admin", { isAdmin: true });
      assert.equal(app.documents.get("questions/draft").kind, kind);
      assert.equal(app.documents.get("questions/draft").audios[0], "");
    }
  }
  console.log(
    "PASS: optional audio, background playback events, duplicate-save protection, ownership, late saves, retained evidence, grading, and export.",
  );
}

async function optionPlayerChecks() {
  const hooks = hookRuntime();
  hooks.React.useImperativeHandle = () => {};
  const { AudioPlayer } = sourceLoader(
    {
      react: hooks.React,
      "lucide-react": Object.fromEntries(
        ["ChevronsLeft", "ChevronsRight", "Pause", "Play", "RotateCcw", "Square"].map((name) => [
          name,
          name,
        ]),
      ),
      [path.join(root, "apps/web/src/hooks/useTranslation.ts")]: {
        useTranslation: () => ({ t: (key) => key }),
      },
      ...componentStubs(["Button"]),
    },
    { DOMException },
  )("apps/web/src/components/AudioPlayer.tsx");
  let count = 0,
    starts = 0,
    failed = false;
  const listeners = new Map();
  const audio = {
    paused: true,
    ended: false,
    readyState: 1,
    currentTime: 0,
    duration: 4,
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
    load() {},
    removeAttribute() {},
    pause() {
      this.paused = true;
      listeners.get("pause")?.();
    },
    async play() {
      if (failed) {
        failed = false;
        throw new DOMException("Unavailable", "NotSupportedError");
      }
      starts++;
      this.paused = false;
      this.ended = false;
      listeners.get("play")?.();
      listeners.get("playing")?.();
    },
  };
  const render = () =>
    hooks.render(() => {
      const element = AudioPlayer({
        src: "asset:option",
        label: "Option B",
        variant: "option",
        playCount: count,
        maxPlays: 2,
        onPlay: () => {
          count++;
        },
      });
      return element.type(element.props);
    });
  const button = () => nodes(render()).find((node) => isButton(node));
  const flush = () => new Promise(setImmediate);
  nodes(render()).find((node) => node.type === "audio").props.ref.current = audio;
  const cleanups = hooks.effects.map((effect) => effect()).filter(Boolean);
  assert.equal(
    nodes(render()).some((node) => node.type === "input" && node.props.type === "range"),
    false,
  );
  assert.equal(
    nodes(render()).filter(isButton).length,
    1,
    "limited playback has no seek or uncounted replay control",
  );
  failed = true;
  button().props.onClick();
  await flush();
  assert.equal(count, 0, "a failed start does not consume a play");
  button().props.onClick();
  assert.equal(starts, 1, "native audio starts synchronously in the click handler");
  button().props.onClick();
  await flush();
  assert.equal(starts, 1);
  assert.equal(count, 1);
  audio.currentTime = 2;
  button().props.onClick();
  await flush(); // Stop midway.
  assert.equal(count, 1);
  button().props.onClick();
  await flush();
  assert.equal(audio.currentTime, 0, "a new play restarts from the beginning");
  assert.equal(count, 2);
  assert.equal(starts, 2);
  audio.pause();
  assert.equal(button().props.disabled, true, "third playback is disabled");
  button().props.onClick();
  await flush();
  assert.equal(starts, 2);
  cleanups.forEach((cleanup) => cleanup());
  assert.equal(audio.paused, true);
  console.log(
    "PASS: limited player failed starts, duplicate clicks, stop/restart counting, exhaustion, and cleanup.",
  );
}

async function mcOptionsChecks() {
  const cache = new Map(),
    requests = [],
    serverCounts = { B: 0, D: 0 };
  const storedPlays = new Set();
  let pendingRead,
    finishRead,
    failSave = false,
    loseResponse = false;
  const pendingSaves = [];
  const storage = {
    getItem: (key) => cache.get(key) ?? null,
    setItem: (key, value) => cache.set(key, value),
  };
  const makeOptions = () => {
    const hooks = hookRuntime();
    const key = (relative) => path.join(root, `apps/web/src/${relative}`);
    const Component = sourceLoader(
      {
        react: hooks.React,
        [key("lib/firebase-hooks.ts")]: {
          useCallable: (name) => [
            async (input) => {
              if (name === "api/get-option-audio-playback") {
                if (pendingRead) await pendingRead;
                return { data: { counts: { ...serverCounts }, maxPlays: 2 } };
              }
              requests.push(input);
              await new Promise((resolve) => pendingSaves.push(resolve));
              if (failSave) {
                failSave = false;
                throw new Error("Offline");
              }
              if (!storedPlays.has(input.playbackId)) {
                storedPlays.add(input.playbackId);
                serverCounts[input.optionKey]++;
              }
              if (loseResponse) {
                loseResponse = false;
                throw new Error("Lost response");
              }
              return { data: { counts: { ...serverCounts }, maxPlays: 2 } };
            },
            false,
          ],
        },
        [key("hooks/useTranslation.ts")]: { useTranslation: () => ({ t: (key) => key }) },
        [key("hooks/useStorageUrl.ts")]: {
          useStorageUrl: () => ({ url: "asset:option", loading: false, error: null }),
        },
        ...componentStubs(["AudioPlayer", "Alert", "Button"]),
      },
      { localStorage: storage },
    )("apps/web/src/components/McOptions.tsx").McOptions;
    const props = {
      assessmentId: "test",
      section: 0,
      question: 0,
      keys: ["B", "D"],
      audios: { B: "b.mp3", D: "d.mp3" },
      maxPlays: 2,
      selectedIndex: null,
      onSelect() {},
      disabled: false,
    };
    const render = () => nodes(hooks.render(() => Component(props)));
    const recordings = () =>
      render().filter(
        (node) => typeof node.type === "function" && node.type.name === "OptionRecording",
      );
    const retry = () =>
      render()
        .find((node) => isButton(node) && node.props.children.includes("common.retry"))
        .props.onClick();
    render();
    const cleanups = hooks.effects.map((effect) => effect()).filter(Boolean);
    return { render, recordings, retry, cleanup: () => cleanups.forEach((cleanup) => cleanup()) };
  };
  const flush = () => new Promise(setImmediate);
  const finishSaves = () => pendingSaves.splice(0).forEach((resolve) => resolve());
  pendingRead = new Promise((resolve) => {
    finishRead = resolve;
  });
  const first = makeOptions();
  assert.equal(
    first.recordings()[0].props.disabled,
    false,
    "loading backend counts never blocks playback",
  );
  first.recordings()[0].props.onPlayed();
  assert.equal(
    first.recordings()[0].props.count,
    1,
    "count updates before the background response",
  );
  assert.equal(first.recordings()[1].props.disabled, false);
  const element = first.recordings()[0];
  const player = nodes(element.type(element.props)).find((node) => node.type === "AudioPlayer");
  assert.equal(player.props.onBeforePlay, undefined);
  assert.equal(player.props.maxPlays, 2);
  first.recordings()[0].props.onPlayed();
  assert.equal(first.recordings()[0].props.count, 2);
  assert.equal(requests.length, 2);
  assert(requests.every((request) => !("action" in request)));
  finishRead();
  await flush();
  pendingRead = null;
  assert.equal(first.recordings()[0].props.count, 2, "a stale read cannot lower local counts");
  first.cleanup();
  const remounted = makeOptions();
  assert.equal(
    remounted.recordings()[0].props.count,
    2,
    "frontend counts survive collapse and remount",
  );
  finishSaves();
  await flush();
  assert.equal(serverCounts.B, 2);
  loseResponse = true;
  remounted.recordings()[1].props.onPlayed();
  const lostId = requests.at(-1).playbackId;
  finishSaves();
  await flush();
  assert.equal(serverCounts.D, 1);
  assert.equal(
    remounted.recordings()[1].props.count,
    1,
    "a failed save never refunds an audible play",
  );
  assert.equal(
    remounted.recordings()[1].props.disabled,
    false,
    "a save failure does not block remaining plays",
  );
  remounted.retry();
  assert.equal(requests.at(-1).playbackId, lostId, "save Retry reuses the event ID");
  finishSaves();
  await flush();
  assert.equal(serverCounts.D, 1, "lost response retries cannot duplicate a play");
  failSave = true;
  remounted.recordings()[1].props.onPlayed();
  finishSaves();
  await flush();
  assert.equal(remounted.recordings()[1].props.count, 2);
  remounted.retry();
  finishSaves();
  await flush();
  assert.equal(serverCounts.D, 2);
  remounted.cleanup();
  console.log(
    "PASS: immediate local playback counts, nonblocking background saves, cached allowances, stale reads, failed saves, and idempotent Retry.",
  );
}

async function assetUploaderChecks() {
  const hooks = hookRuntime();
  const key = (relative) => path.join(root, `apps/web/src/${relative}`);
  const files = new Map([["question-assets/audios/legacy/old.mp3", "original recording"]]);
  const changes = [],
    invalidated = [],
    uploadStates = [];
  let failUpload = false,
    finishUpload,
    uploadWait,
    finishDownload,
    downloadWait;
  const props = {
    kind: "audio",
    value: "legacy/old.mp3",
    sectionId: "section-0/q1",
    label: "Option B recording",
    onUploadingChange: (uploading) => uploadStates.push({ uploading, path: props.value }),
    onChange: (value) => {
      changes.push(value);
      props.value = value;
    },
  };
  const Component = sourceLoader(
    {
      react: hooks.React,
      "firebase/storage": {
        ref: (_, fullPath) => ({ fullPath }),
        uploadBytes: async (ref, file) => {
          if (uploadWait) await uploadWait;
          if (failUpload) {
            failUpload = false;
            throw new Error("Upload failed");
          }
          files.set(ref.fullPath, file);
          return { ref };
        },
        getDownloadURL: async (ref) => {
          if (downloadWait) await downloadWait;
          return `https://assets.example.test/${ref.fullPath}`;
        },
      },
      [key("lib/firebase.ts")]: { storage: {} },
      [key("hooks/useStorageUrl.ts")]: {
        useStorageUrl: (storagePath) => ({
          url: storagePath ? `preview:${storagePath}` : null,
          error: null,
        }),
        invalidateStorageUrl: (storagePath) => invalidated.push(storagePath),
      },
      [key("hooks/useTranslation.ts")]: { useTranslation: () => ({ t: (key) => key }) },
      [key("lib/errors.ts")]: { toUserMessage: (error) => error.message },
      ...componentStubs(["AudioPlayer", "Alert", "Button"]),
    },
    { console: { error() {} } },
  )("apps/web/src/components/AssetUploader.tsx").AssetUploader;
  const render = () => nodes(hooks.render(() => Component(props)));
  const picker = () => render().find((node) => node.type === "input" && node.props.type === "file");
  const uploadButton = () =>
    render().find(
      (node) =>
        isButton(node) &&
        node.props.children.includes(props.value ? "asset.replaceFile" : "asset.uploadFile"),
    );
  const flush = () => new Promise(setImmediate);
  let pickerOpens = 0;
  picker().props.ref.current = {
    value: "selected file",
    click: () => {
      pickerOpens++;
    },
  };
  hooks.effects.forEach((effect) => effect());
  assert.equal(
    render().filter((node) => node.type === "input").length,
    1,
    "upload has only a file picker",
  );
  assert.equal(picker().props.accept, "audio/*");
  assert.equal(picker().props["aria-label"], props.label);
  assert.equal(picker().props.hidden, true, "the native picker is behind the visible button");
  assert.equal(uploadButton().props.type, "button", "file selection does not submit the editor");
  uploadButton().props.onClick();
  assert.equal(pickerOpens, 1, "the shared button opens the file picker");
  const file = { name: "answer.MP3", type: "audio/mpeg" };
  uploadWait = new Promise((resolve) => {
    finishUpload = resolve;
  });
  downloadWait = new Promise((resolve) => {
    finishDownload = resolve;
  });
  picker().props.onChange({ target: { files: [file] } });
  assert.deepEqual(
    uploadStates.map((state) => state.uploading),
    [true],
  );
  assert.equal(picker().props.disabled, true);
  assert.equal(uploadButton().props.disabled, true);
  assert.equal(uploadButton().props["aria-busy"], true);
  finishUpload();
  await flush();
  uploadWait = null;
  assert.equal(uploadButton().props.disabled, true, "upload remains active during URL lookup");
  assert.deepEqual(
    uploadStates.map((state) => state.uploading),
    [true],
  );
  assert.equal(changes.length, 0);
  finishDownload();
  await flush();
  downloadWait = null;
  assert.deepEqual(
    uploadStates.map((state) => state.uploading),
    [true, false],
  );
  assert.equal(
    uploadStates.at(-1).path,
    props.value,
    "the form receives the path before upload ends",
  );
  assert.equal(picker().props.disabled, false);
  assert.equal(uploadButton().props.disabled, false);
  const firstPath = props.value;
  assert.match(firstPath, /^section-0\/q1\/.+\.mp3$/);
  assert.equal(files.get(`question-assets/audios/${firstPath}`), file);
  assert.equal(files.get("question-assets/audios/legacy/old.mp3"), "original recording");
  picker().props.onChange({ target: { files: [file] } });
  await flush();
  const replacementPath = props.value;
  assert.notEqual(
    replacementPath,
    firstPath,
    "replacing the same filename gets a new storage path",
  );
  assert.equal(
    files.get(`question-assets/audios/${firstPath}`),
    file,
    "the previous saved file is retained",
  );
  failUpload = true;
  picker().props.onChange({ target: { files: [file] } });
  await flush();
  assert.equal(props.value, replacementPath, "failed upload keeps the previous value");
  assert.equal(changes.length, 2);
  assert.equal(
    uploadStates.at(-1).uploading,
    false,
    "failed uploads release the editor's Save guard",
  );
  assert.equal(uploadStates.at(-1).path, replacementPath);
  assert.equal(picker().props.disabled, false);
  assert(
    render().some(
      (node) => node.type === "AlertDescription" && node.props.children.includes("Upload failed"),
    ),
  );
  props.kind = "image";
  props.label = "Question image";
  const image = { name: "question.PNG", type: "image/png" };
  picker().props.onChange({ target: { files: [image] } });
  await flush();
  assert.equal(picker().props.accept, "image/*");
  assert.match(props.value, /\.png$/);
  assert.equal(files.get(`question-assets/images/${props.value}`), image);
  assert.equal(render().find((node) => node.type === "img").props.alt, "Question image");
  assert.equal(invalidated.length, 3);
  const savedImagePath = props.value;
  render()
    .find((node) => isButton(node) && node.props.children.includes("common.remove"))
    .props.onClick();
  assert.equal(props.value, "");
  uploadButton().props.onClick();
  assert.equal(pickerOpens, 2, "the empty uploader offers Upload file again");
  assert.equal(
    render().some((node) => node.type === "img"),
    false,
  );
  assert.equal(
    files.get(`question-assets/images/${savedImagePath}`),
    image,
    "clearing the editor keeps the stored file",
  );
  console.log(
    "PASS: file-picker-only uploads, automatic unique names, replacement retention, failure recovery, and audio/image previews.",
  );
}

async function main() {
  await assetUploaderChecks();
  await mcOptionsChecks();
  await optionPlaybackChecks();
  await optionPlayerChecks();
  assessmentSelectChecks();
  await newAssessmentDemographicsChecks();
  await newAssessmentDemographicsChecks(true);
  const app = backend();
  const config = {
    title: "Section",
    kind: "mc",
    length: 2,
    goal: "",
    questions: ["Q1", "Q2"],
    audios: ["q1.mp3", "q2.mp3"],
    choices: [
      { D: "second", B: "first" },
      { D: "second", B: "first" },
    ],
    correctAnswers: ["B", "D"],
    instructions: { text: "", audio: "" },
  };
  app.documents.set("questions/0", config);
  app.documents.set("questions/1", config);
  const hybrid = {
    ...config,
    id: "1",
    kind: "audio_mc",
    choicesAudios: ["c1.mp3", "c2.mp3"],
    choices: [
      { B: "first", D: "second" },
      { B: "first", D: "second" },
    ],
    correctAnswers: ["B", "D"],
  };
  await app.call("/admin/save-question-section", hybrid, "owner", { isAdmin: true });
  const newAssessment = await app.call("/create-assessment", {
    name: " Test ",
    birthDate: "2010-01-01",
    gender: "male",
    specialEducationalNeeds: "none",
    grade: "1",
    school: "Test",
    motherTongue: { language: "cantonese" },
    otherLanguages: [],
  });
  const id = newAssessment.id;
  for (const value of ["none", "autism_spectrum_disorder", "developmental_language_disorder"]) {
    const created = await app.call("/create-assessment", {
      name: "Test",
      birthDate: "2010-01",
      gender: "male",
      specialEducationalNeeds: value,
      grade: "S1",
      school: "Test",
      motherTongue: { language: "cantonese" },
      otherLanguages: [],
    });
    assert.equal(app.documents.get(`assessments/${created.id}`).specialEducationalNeeds, value);
    const assessments = await app.call("/get-assessments", {});
    assert.equal(
      assessments.assessments.find((item) => item.id === created.id).specialEducationalNeeds,
      value,
    );
  }
  for (const value of [undefined, "", "unknown", ["none"], null]) {
    await assert.rejects(
      app.call("/create-assessment", {
        name: "Test",
        birthDate: "2010-01",
        gender: "male",
        specialEducationalNeeds: value,
        grade: "S1",
        school: "Test",
        motherTongue: { language: "cantonese" },
        otherLanguages: [],
      }),
      (error) => error.statusCode === 400,
    );
  }
  assert.equal(app.documents.get(`assessments/${id}`).name, "Test");
  await app.call("/submit-mc-answer", {
    assessmentId: id,
    section: 0,
    question: 0,
    answer: "B",
  });
  assert.equal(app.documents.get(`studentResponses/${id}-0`).studentResponses[0], "B");
  const scoring = app.load("apps/web/src/lib/scoring.ts");
  for (let form = 1; form <= 6; form++) {
    assert.equal(scoring.getNormGrade(`S${form}`), `S${form}`);
  }
  for (const answer of [0, "", "A", "toString", "b"])
    await assert.rejects(
      app.call("/submit-mc-answer", {
        assessmentId: id,
        section: 0,
        question: 1,
        answer,
      }),
      (error) => error.statusCode === 400,
    );
  await assert.rejects(
    app.call(
      "/submit-mc-answer",
      {
        assessmentId: id,
        section: 0,
        question: 1,
        answer: "D",
      },
      "other",
    ),
    (error) => error.statusCode === 403,
  );
  for (const [answer, expectedScore] of [
    ["B", 0],
    ["D", 1],
    [null, null],
  ]) {
    await app.call("/submit-mc-answer", { assessmentId: id, section: 0, question: 1, answer });
    const saved = await app.call("/get-assessment-student-responses", { assessmentId: id });
    assert.equal(saved.studentResponsesBySection[0].studentResponses[1], answer);
    assert.equal(
      scoring.getQuestionScore(0, 1, saved.studentResponsesBySection, saved.sections),
      expectedScore,
    );
  }
  const base = {
    assessmentId: id,
    section: 1,
    question: 0,
    transcript: "initial words",
    gsUri: `gs://bucket/assessments/${id}/1/0.webm`,
    assistanceOffered: false,
    selectedOption: null,
    skipped: false,
  };
  app.objects.add(`assessments/${id}/1/0.webm`);
  await app.call("/submit-audio-mc-answer", base);
  await app.call("/submit-audio-mc-answer", {
    ...base,
    question: 1,
    gsUri: null,
    transcript: null,
    assistanceOffered: true,
    selectedOption: "B",
  });
  const response = app.documents.get(`studentResponses/${id}-1`);
  assert.equal(response.files[0], base.gsUri);
  assert.equal(response.transcripts[0], base.transcript);
  assert.equal(response.attempts[1].selectedOption, "B");
  assert.equal(response.grades?.[0], undefined);
  const hybridRef = `studentResponses/${id}-1`;
  await app.call("/submit-audio-mc-answer", { ...base, assistanceOffered: true, skipped: true });
  assert.equal(app.documents.get(hybridRef).files[0], base.gsUri);
  assert.equal(app.documents.get(hybridRef).attempts[0].selectedOption, null);
  await app.call("/submit-audio-mc-answer", {
    ...base,
    assistanceOffered: true,
    selectedOption: "D",
  });
  await app.call("/submit-audio-grade", { assessmentId: id, section: 1, question: 0, grade: 3 });
  assert.equal(app.documents.get(hybridRef).grades[0], 3);
  await assert.rejects(
    app.call("/submit-audio-grade", { assessmentId: id, section: 1, question: 99, grade: 5 }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    app.call("/update-audio-transcript", {
      assessmentId: id,
      section: 1,
      question: 99,
      transcript: "invalid",
    }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    app.call("/submit-audio-grade", { assessmentId: id, section: 0, question: 0, grade: 5 }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    app.call("/submit-audio-mc-answer", { ...base, assistanceOffered: true }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    app.call("/submit-audio-mc-answer", {
      ...base,
      assistanceOffered: true,
      selectedOption: "missing",
    }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    app.call("/submit-audio-mc-answer", {
      ...base,
      gsUri: "gs://bucket/assessments/other/1/0.webm",
    }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    app.call("/submit-audio-mc-answer", { ...base, gsUri: `${base.gsUri}/extra` }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    app.call("/submit-audio-mc-answer", base, "other"),
    (error) => error.statusCode === 403,
  );
  await assert.rejects(
    app.call("/get-assessment-student-responses", { assessmentId: id }, "other"),
    (error) => error.statusCode === 403,
  );
  await app.call("/submit-audio-mc-answer", base, "admin", { isAdmin: true });
  assert.equal(app.documents.get(hybridRef).grades[0], undefined); // New evidence invalidates the old grade.
  app.failNextCommit();
  await assert.rejects(
    app.call("/submit-audio-mc-answer", { ...base, assistanceOffered: true, selectedOption: "B" }),
  );
  assert.equal(app.documents.get(hybridRef).attempts[0].assistanceOffered, false);
  await app.call("/submit-audio-mc-answer", {
    ...base,
    assistanceOffered: true,
    selectedOption: "B",
  });
  assert.equal(app.documents.get(hybridRef).attempts[0].selectedOption, "B");
  const changed = {
    ...hybrid,
    choices: [
      { Z: "new first", Y: "new second" },
      { Z: "new first", Y: "new second" },
    ],
    correctAnswers: ["Z", "Y"],
  };
  await app.call("/admin/save-question-section", changed, "owner", { isAdmin: true });
  assert.equal((await app.call("/get-questions")).sections[1].correctAnswers[0], "Z");
  assert.equal(
    (await app.call("/get-assessment-student-responses", { assessmentId: id })).sections[1]
      .correctAnswers[0],
    "Z",
  );
  await assert.rejects(
    app.call("/submit-audio-mc-answer", { ...base, assistanceOffered: true, selectedOption: "D" }),
    (error) => error.statusCode === 400,
  );
  await app.call("/admin/save-question-section", hybrid, "owner", { isAdmin: true });
  await app.call("/submit-audio-mc-answer", {
    ...base,
    assistanceOffered: true,
    selectedOption: "D",
  });
  await app.call("/submit-audio-grade", { assessmentId: id, section: 1, question: 0, grade: 3 });
  const data = await app.call("/get-assessment-student-responses", { assessmentId: id });
  app.failNextSigning(new Error("Cannot sign data without client_email"));
  const signingFailure = await app.call("/get-assessment-student-responses", { assessmentId: id });
  assert.equal(signingFailure.studentResponsesBySection[1].files[0], null);
  assert.equal(signingFailure.studentResponsesBySection[1].grades[0], 3);
  assert.equal(
    signingFailure.studentResponsesBySection[1].transcripts[0],
    data.studentResponsesBySection[1].transcripts[0],
  );
  assert.equal(app.documents.get(hybridRef).files[0], base.gsUri);
  assert.equal(app.errors.at(-1)[0], "Failed to generate recording URL");
  assert.equal(app.errors.at(-1)[1].error, "Cannot sign data without client_email");
  const signingRetry = await app.call("/get-assessment-student-responses", { assessmentId: id });
  assert(signingRetry.studentResponsesBySection[1].files[0].startsWith("signed:"));
  assert.equal(data.sections[1].correctAnswers[0], "B");
  assert.equal(data.studentResponsesBySection[1].type, "audio_mc");
  assert.equal(data.studentResponsesBySection[1].files[1], null);
  assert.equal(scoring.getQuestionScore(0, 0, data.studentResponsesBySection, data.sections), 1);
  assert.equal(scoring.getQuestionScore(1, 0, data.studentResponsesBySection, data.sections), 3);
  for (const kind of ["mc", "audio", "audio_mc"]) {
    const sections = [{ ...config, kind, length: 1 }];
    for (const response of [
      undefined,
      { type: "mc", studentResponses: { 0: "B", 1: "D" } },
      { type: "audio", grades: { 0: 4, 1: 5 } },
      { type: "audio_mc", grades: { 0: 4, 1: 5 } },
    ]) {
      const responses = response ? { 0: response } : {};
      const compatible = response && (kind === "mc") === (response.type === "mc");
      const expectedScore = compatible ? (kind === "mc" ? 1 : 4) : null;
      assert.equal(scoring.getQuestionScore(0, 0, responses, sections), expectedScore);
      assert.equal(scoring.getQuestionScore(0, 1, responses, sections), null);
      const result = scoring.computeSubtaskScore(
        [
          { sectionIndex: 0, questionIndex: 0 },
          { sectionIndex: 0, questionIndex: 1 },
          { sectionIndex: 1, questionIndex: 0 },
        ],
        responses,
        sections,
      );
      assert.equal(result.score, expectedScore ?? 0);
      assert.equal(result.maxScore, kind === "mc" ? 1 : 5);
      assert.equal(result.ungradedCount, kind !== "mc" && !compatible ? 1 : 0);
    }
  }
  const mixedScore = scoring.computeSubtaskScore(
    [
      { sectionIndex: 0, questionIndex: 0 },
      { sectionIndex: 1, questionIndex: 0 },
    ],
    data.studentResponsesBySection,
    data.sections,
  );
  assert.equal(mixedScore.score, 4);
  assert.equal(mixedScore.maxScore, 6);
  const score = scoring.computeSubtaskScore(
    [{ sectionIndex: 1, questionIndex: 0 }],
    data.studentResponsesBySection,
    data.sections,
  );
  assert.equal(score.score, 3);
  assert.equal(score.maxScore, 5);
  assert.equal(scoring.computeZScore(score.score, 2, 2), 0.5);
  assert.equal(
    scoring.computeSubtaskScore(
      [{ sectionIndex: 1, questionIndex: 1 }],
      data.studentResponsesBySection,
      data.sections,
    ).ungradedCount,
    1,
  );
  const schema = app.load(
    "apps/functions/src/types/zod/routes/questions.ts",
  ).AdminSaveQuestionSectionSchema;
  for (const invalid of [
    { ...hybrid, id: "" },
    { ...hybrid, correctAnswers: ["missing", "D"] },
  ])
    assert.equal(schema.safeParse(invalid).success, false);
  assert.equal(schema.safeParse({ ...hybrid, choicesAudios: [] }).success, true);
  const sharedAudio = { ...hybrid, choicesAudios: config.audios };
  assert.equal(schema.safeParse(sharedAudio).success, true);
  await app.call("/admin/save-question-section", sharedAudio, "owner", { isAdmin: true });
  assert.deepEqual(app.documents.get("questions/1").choicesAudios, sharedAudio.audios);
  await mountedRouterChecks(app);
  const repeated = { ...base, assistanceOffered: true, selectedOption: "D" };
  await app.call("/submit-audio-mc-answer", repeated);
  assert.equal(app.documents.get(hybridRef).grades[0], 3);
  app.objects.add(`assessments/${id}/1/0.new-recording.webm`);
  await app.call("/submit-audio-mc-answer", {
    ...repeated,
    gsUri: `gs://bucket/assessments/${id}/1/0.new-recording.webm`,
  });
  assert.equal(app.documents.get(hybridRef).grades[0], undefined);
  for (const sectionId of ["0", "4", "7"])
    assert.equal(schema.safeParse({ ...hybrid, id: sectionId }).success, true);
  app.documents.set("questions/4", {
    ...config,
    kind: "audio",
    choices: undefined,
    correctAnswers: undefined,
  });
  app.documents.set("assessments/audio", {
    creatorEmail: "owner",
    createdAt: app.timestamp,
  });
  app.documents.set("studentResponses/audio-2", {
    "assessment-id": "audio",
    section: 2,
    type: "audio",
    files: { 0: null },
    transcripts: { 0: null },
    grades: { 0: 4 },
    createdAt: app.timestamp,
  });
  await app.call("/submit-audio-answer", {
    assessmentId: "audio",
    section: 2,
    question: 1,
    gsUri: null,
    transcript: null,
  });
  const audioData = await app.call("/get-assessment-student-responses", {
    assessmentId: "audio",
  });
  assert.equal(audioData.sections[2].kind, "audio");
  assert.equal(
    scoring.getQuestionScore(2, 0, audioData.studentResponsesBySection, audioData.sections),
    4,
  );
  await validationChecks();
  await finishAssessmentChecks();
  await archiveChecks();
  await archiveHookChecks();
  await recordingChecks();
  await gradingAudioChecks();
  await gradingSectionChecks();
  await questionProviderChecks();
  await uiChecks();
  await adminQuestionsChecks(app);
  await assessmentExportChecks();
  console.log(
    "PASS: admin creation/editing, current configuration, MC/audio scoring, all evidence forms, manual grading, access/validation, atomic retries, recording finalization/errors/navigation.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
