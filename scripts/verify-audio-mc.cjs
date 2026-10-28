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
          const error = new Error(result?.error);
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
  assert.deepEqual(Array.from(question.choices), ["first", "second"]);
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
        "react-h5-audio-player": { RHAP_UI: {}, default: "playback" },
        "react-h5-audio-player/lib/styles.css": {},
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
          .filter((node) => node.type === "input" && node.props.name === "choice")
          [index].props.onChange(),
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
      (node) => node.type === "span" && node.props.children.join("") === "D. second",
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
      (node) => node.type === "span" && node.props.children.join("") === "D. second",
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
  nodes(toggled.render()).find(
    (node) => node.type === "audio" && node.props.ref,
  ).props.ref.current = toggled.choicesPlayer;
  toggled.button("question.hideMc").props.onClick();
  assert.equal(toggled.choicesPlayer.paused, true);
  assert.equal(toggled.button("question.offerMc").props["aria-expanded"], false);
  assert.equal(nodes(toggled.render()).filter((node) => node.type === "input").length, 0);
  assert.equal(nodes(toggled.render()).filter((node) => node.type === "audio").length, 1);
  await toggled.submit();
  assert.equal(toggled.calls.at(-1).data.assistanceOffered, false);
  assert.equal(toggled.calls.at(-1).data.selectedOption, null);
  assert(toggled.calls.at(-1).data.gsUri);
  assert.equal(toggled.calls.at(-1).data.transcript, "initial words");
  toggled.offer();
  assert.equal(nodes(toggled.render()).filter((node) => node.type === "audio").length, 2);
  assert.equal(
    nodes(toggled.render()).filter((node) => node.type === "input")[1].props.checked,
    true,
  );
  await toggled.button("question.startRecording").props.onClick();
  assert.equal(toggled.nextDisabled(), true);
  assert.equal(toggled.button("question.hideMc").props.disabled, false);
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
  const grade = sourceLoader({
    react: hooks.React,
    "react-router-dom": {
      useParams: () => ({ id: "test" }),
      useLocation: () => ({ pathname: "/grade/test" }),
    },
    [key("lib/firebase-hooks.ts")]: { useCallable: () => [async () => ({ data }), false] },
    [key("lib/errors.ts")]: { toUserMessage: (error) => error.message },
    [key("hooks/useTranslation.ts")]: { useTranslation: () => ({ t: (key) => key }) },
    [key("components/ScoreModal.tsx")]: { default: "score" },
    ...componentStubs(["PageHeader", "Button", "Alert", "Tooltip"]),
    [key("components/icons.tsx")]: { CheckIcon: "check", SpinnerIcon: "spinner", XIcon: "cross" },
  })("apps/web/src/pages/GradeAssessment.tsx").default;
  const renderGrade = () => hooks.render(() => grade());
  renderGrade();
  for (const effect of hooks.effects) effect();
  await Promise.resolve();
  await Promise.resolve();
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
  assert.equal(nodes(renderGrade()).filter((node) => node.type === "audio").length, 0);

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
    for (const effect of hooks.effects) effect();
    await Promise.resolve();
    await Promise.resolve();
    const tab = nodes(renderGrade()).find(
      (node) => isButton(node) && node.props.children[0]?.props?.children?.includes(title),
    );
    assert.equal(tab.props.children[1].props.children[0], expectedStatus);
    tab.props.onClick();
    const sectionNodes = nodes(renderGrade());
    const hasText = (text) => sectionNodes.some((node) => node.props.children.includes(text));
    assert.equal(hasText("Current question"), true);
    assert.equal(hasText("Removed question"), false);
    assert.equal(sectionNodes.filter((node) => node.type === "audio").length, hasRecording ? 1 : 0);
    assert.equal(sectionNodes.filter(isGradeButton).length, hasRecording ? 6 : 0);
    assert.equal(hasText("question.mcOffered"), false);
    if (kind === "mc") {
      assert.equal(hasText("gradeAssessment.noAnswer"), response?.type !== "mc");
      assert.equal(hasText("first"), true);
      assert.equal(hasText("second"), true);
    } else if (!hasRecording) {
      assert.equal(hasText("gradeAssessment.noRecording"), true);
    }
  }
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
    render().find((node) => node.type === "input" && node.props.placeholder === "e.g. 0").props
      .value,
    "7",
  );
  assert(
    nodes(kindSelect()).some((node) => node.type === "option" && node.props.value === "audio_mc"),
  );
  kindSelect().props.onChange({ target: { value: "audio_mc" } });
  button("adminQuestions.addQuestion").props.onClick();
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
  uploaders[1].props.onChange("7/question.mp3");
  uploaders[2].props.onChange("7/choices.mp3");
  for (let index = 0; index < 4; index++) {
    render()
      .filter(
        (node) => node.type === "input" && node.props.placeholder === "adminQuestions.choiceValue",
      )
      [index].props.onChange({ target: { value: `Option ${index + 1}` } });
  }
  render()
    .find((node) => node.type === "input" && node.props.placeholder === "e.g. A")
    .props.onChange({ target: { value: "B" } });
  await submit();
  assert.equal(saved.length, 1);
  const stored = app.documents.get("questions/7");
  assert.equal(stored.kind, "audio_mc");
  assert.equal(stored.audios[0], "7/question.mp3");
  assert.equal(stored.choicesAudios[0], "7/choices.mp3");
  assert.equal(stored.choices[0].B, "Option 2");
  assert.equal(stored.correctAnswers[0], "B");
  render()
    .filter((node) => isButton(node) && node.props.children.includes("common.edit"))
    .at(-1)
    .props.onClick();
  render()
    .find((node) => isButton(node) && "aria-expanded" in node.props)
    .props.onClick();
  assert.equal(kindSelect().props.value, "audio_mc");
  assert.equal(
    render().filter((node) => node.type === "AssetUploader")[2].props.value,
    "7/choices.mp3",
  );
  assert.equal(
    render().find((node) => node.type === "input" && node.props.placeholder === "e.g. A").props
      .value,
    "B",
  );
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
async function mountedRouterChecks(app) {
  // Exercise real Express mounting (including the admin guard) without opening a socket.
  const router = sourceLoader({
    [path.join(root, "apps/functions/src/firebase.ts")]:
      app.load.overrides[path.join(root, "apps/functions/src/firebase.ts")],
  })("apps/functions/src/routes/index.ts").router;
  const call = (url, data = {}, claims = {}) =>
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
            const error = new Error(body.error);
            error.statusCode = statusCode;
            reject(error);
          } else resolve(body.data);
        },
      };
      router.handle(req, res, (error) => reject(error ?? new Error("Route not handled")));
    });
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
  await assert.rejects(
    call("/admin/save-question-section", {}),
    (error) => error.statusCode === 403,
  );
}
async function main() {
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
    name: "Test",
    birthDate: "2010-01-01",
    gender: "male",
    grade: "1",
    school: "Test",
    motherTongue: { language: "cantonese" },
    otherLanguages: [],
  });
  const id = newAssessment.id;
  await app.call("/submit-mc-answer", {
    assessmentId: id,
    section: 0,
    question: 0,
    answer: "B",
  });
  assert.equal(app.documents.get(`studentResponses/${id}-0`).studentResponses[0], "B");
  const scoring = app.load("apps/web/src/lib/scoring.ts");
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
  ).SaveQuestionSectionSchema;
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
  await archiveChecks();
  await archiveHookChecks();
  await recordingChecks();
  await questionProviderChecks();
  await uiChecks();
  await adminQuestionsChecks(app);
  console.log(
    "PASS: admin creation/editing, current configuration, MC/audio scoring, all evidence forms, manual grading, access/validation, atomic retries, recording finalization/errors/navigation.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
