// Offline finalization/lifecycle checks. Add --browser for real Chromium recordings.
// Browser mode uses Playwright from VACA_BROWSER_TOOLS (a directory containing node_modules)
// and VACA_BROWSER_EXECUTABLE, or an installed Playwright browser when unset.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "apps/web/src/lib/finalize-recording.ts");
const flush = () => new Promise(setImmediate);

function load(filename, overrides, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      Blob,
      Uint8Array,
      setTimeout,
      clearTimeout,
      require: (name) => overrides[name] ?? require(name),
      ...globals,
    },
    { filename },
  );
  return module.exports;
}

async function helperChecks() {
  let duration = 1.2345,
    existingDuration = null,
    decodeError = null,
    repairSucceeds = true,
    timecodeScale = 1_000_000;
  let decoderCalls = 0,
    patchedDuration,
    expired;
  const repaired = new Blob(["repaired"], { type: "audio/webm" });
  const { finalizeRecording } = load(
    helperPath,
    {
      "@fix-webm-duration/fix": {
        fixParsedWebmDuration: (_file, milliseconds) => {
          patchedDuration = milliseconds;
          return repairSucceeds;
        },
      },
      "@fix-webm-duration/parser": {
        WebmFile: class {
          getSectionById(id) {
            return id === 0xad7b1 ? { getValue: () => timecodeScale } : this;
          }
          getValue() {
            return existingDuration;
          }
          toBlob() {
            return repaired;
          }
        },
      },
    },
    {
      OfflineAudioContext: class {
        async decodeAudioData() {
          decoderCalls++;
          if (decodeError) throw decodeError;
          if (duration === "pending") return new Promise(() => {});
          return { duration };
        }
      },
      setTimeout: (callback) => {
        expired = callback;
        return 1;
      },
      clearTimeout() {},
    },
  );
  const webm = new Blob(["recording"], { type: "audio/webm;codecs=opus" });
  assert.equal(await finalizeRecording(webm), repaired);
  assert.equal(patchedDuration, 1234.5, "Use decoded samples, not elapsed wall time");
  const mp4 = new Blob(["mp4"], { type: "audio/mp4" });
  assert.equal(await finalizeRecording(mp4), mp4);
  existingDuration = 1234.5;
  assert.equal(await finalizeRecording(webm), webm);
  assert.equal(decoderCalls, 1, "MP4 and WebM with duration need no decoding");
  existingDuration = null;
  timecodeScale = 100_000;
  await assert.rejects(finalizeRecording(webm), /unsupported WebM time scale/);
  timecodeScale = 1_000_000;
  decodeError = new Error("Invalid audio");
  await assert.rejects(finalizeRecording(webm), /Invalid audio/);
  decodeError = null;
  duration = 0;
  await assert.rejects(finalizeRecording(webm), /no measurable audio duration/);
  duration = 2;
  repairSucceeds = false;
  await assert.rejects(finalizeRecording(webm), /metadata could not be written/);
  duration = "pending";
  const pending = finalizeRecording(webm);
  await flush();
  const rejected = assert.rejects(pending, /timed out/);
  expired();
  await rejected;
}

async function lifecycleChecks() {
  let index = 0,
    recorder,
    recognition;
  const slots = [],
    pending = [],
    created = [],
    revoked = [],
    streams = [];
  const React = {
    createContext: () => ({ Provider: "Provider" }),
    createElement: (type, props) => ({ type, props }),
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [
        slots[slot],
        (value) => {
          slots[slot] = typeof value === "function" ? value(slots[slot]) : value;
        },
      ];
    },
    useRef(initial) {
      return (slots[index++] ??= { current: initial });
    },
    useMemo(calculate) {
      return (slots[index++] ??= calculate());
    },
    useCallback: (callback) => callback,
    useEffect() {},
  };
  class Recorder {
    static isTypeSupported() {
      return true;
    }
    constructor(_stream, options) {
      recorder = this;
      this.mimeType = options.mimeType;
      this.state = "inactive";
    }
    start() {
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
    start() {}
    stop() {}
    abort() {}
  }
  const { RecordingSessionProvider } = load(
    path.join(root, "apps/web/src/providers/RecordingSessionProvider.tsx"),
    {
      react: React,
      "../hooks/useTranslation": { useTranslation: () => ({ t: (key) => key }) },
      "../lib/finalize-recording": {
        finalizeRecording: (original) =>
          new Promise((resolve, reject) => pending.push({ original, resolve, reject })),
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
          getUserMedia: async () => {
            const stream = {
              stopped: false,
              getTracks: () => [
                {
                  stop: () => {
                    stream.stopped = true;
                  },
                },
              ],
              getAudioTracks: () => [],
            };
            streams.push(stream);
            return stream;
          },
        },
      },
      MediaRecorder: Recorder,
      URL: {
        createObjectURL: (blob) => {
          created.push(blob);
          return `blob:${created.length}`;
        },
        revokeObjectURL: (url) => revoked.push(url),
      },
      setTimeout: () => 1,
      clearTimeout() {},
    },
  );
  const value = () => {
    index = 0;
    return RecordingSessionProvider({ children: null }).props.value;
  };
  const stop = () => {
    value().stopRecording();
    recorder.ondataavailable({ data: new Blob(["raw evidence"]) });
    recorder.onstop();
    recognition.onend();
  };
  await value().startRecording();
  stop();
  assert.equal(value().status, "finalizing");
  assert.equal(value().audioBlob, null, "Upload/preview wait for the finalized file");
  assert.equal(streams.at(-1).stopped, true, "Release capture while metadata is being prepared");
  const fixed = new Blob(["fixed evidence"], { type: "audio/webm" });
  pending.at(-1).resolve(fixed);
  await flush();
  assert.equal(value().status, "idle");
  assert.equal(value().audioBlob, fixed);
  assert.equal(created.at(-1), fixed, "Preview uses the same fixed blob as upload");
  value().resetAudio();
  assert.deepEqual(revoked, ["blob:1"]);

  await value().startRecording();
  stop();
  const stale = pending.at(-1);
  value().resetAudio();
  await value().startRecording();
  stale.resolve(fixed);
  await flush();
  assert.equal(value().status, "recording");
  assert.equal(value().audioBlob, null);
  assert.equal(created.length, 1, "A stale repair cannot publish or allocate a preview URL");

  stop();
  const failed = pending.at(-1);
  failed.reject(new Error("Decoder failed"));
  await flush();
  assert.equal(value().status, "idle");
  assert.equal(value().audioBlob, failed.original, "Retain evidence if metadata repair fails");
  assert.equal(value().error, "recording.durationFailed");
  assert.equal(value().errorSeverity, "warning");

  await value().startRecording();
  recorder.onerror();
  stop();
  pending.at(-1).reject(new Error("Decoder failed"));
  await flush();
  assert.equal(
    value().error,
    "recording.captureFailed",
    "Repair warnings cannot hide capture errors",
  );
  assert.equal(value().errorSeverity, "error");
  value().resetAudio();
}

async function browserChecks() {
  const { rolldown } = require("rolldown");
  const { chromium } = require(
    require.resolve("playwright", {
      paths: [process.env.VACA_BROWSER_TOOLS || root],
    }),
  );
  const bundle = await rolldown({ input: helperPath, platform: "browser" });
  const { output } = await bundle.generate({ format: "iife", name: "RecordingFinalizer" });
  await bundle.close();
  const browser = await chromium.launch({
    executablePath: process.env.VACA_BROWSER_EXECUTABLE,
    headless: true,
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: output[0].code });
    const result = await page.evaluate(async () => {
      const context = new AudioContext();
      await context.resume();
      const destination = context.createMediaStreamDestination();
      const oscillator = context.createOscillator();
      oscillator.connect(destination);
      oscillator.start();
      const recorder = new MediaRecorder(destination.stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      recorder.start(100);
      await new Promise((resolve) => setTimeout(resolve, 650));
      recorder.stop();
      await stopped;
      oscillator.stop();
      destination.stream.getTracks().forEach((track) => track.stop());
      await context.close();
      const original = new Blob(chunks, { type: recorder.mimeType });
      const repaired = await RecordingFinalizer.finalizeRecording(original);
      const decoder = new OfflineAudioContext(1, 1, 48_000);
      const rawSamples = await decoder.decodeAudioData(await original.arrayBuffer());
      const fixedSamples = await decoder.decodeAudioData(await repaired.arrayBuffer());
      const sameSamples =
        rawSamples.length === fixedSamples.length &&
        rawSamples
          .getChannelData(0)
          .every((value, i) => value === fixedSamples.getChannelData(0)[i]);
      const audio = new Audio();
      const url = URL.createObjectURL(repaired);
      try {
        const loaded = new Promise((resolve, reject) => {
          audio.onloadedmetadata = resolve;
          audio.onerror = reject;
        });
        audio.preload = "metadata";
        audio.src = url;
        await loaded;
        const duration = audio.duration;
        const sought = new Promise((resolve, reject) => {
          audio.onseeked = resolve;
          audio.onerror = reject;
        });
        audio.currentTime = duration / 2;
        await sought;
        return {
          duration,
          decodedDuration: rawSamples.duration,
          currentTime: audio.currentTime,
          paused: audio.paused,
          sameSamples,
          chunks: chunks.length,
        };
      } finally {
        audio.removeAttribute("src");
        audio.load();
        URL.revokeObjectURL(url);
      }
    });
    assert(result.chunks > 1, "Exercise the app's chunked recording format");
    assert(Number.isFinite(result.duration) && result.duration > 0);
    assert(Math.abs(result.duration - result.decodedDuration) < 0.001);
    assert(Math.abs(result.currentTime - result.duration / 2) < 0.001);
    assert.equal(result.paused, true);
    assert.equal(result.sameSamples, true, "Duration repair must preserve decoded audio exactly");
    console.log(
      "PASS: real Chromium chunked WebM has finite metadata before playback, seeks while paused, and retains identical audio samples.",
    );
  } finally {
    await browser.close();
  }
}

(async () => {
  await helperChecks();
  await lifecycleChecks();
  console.log(
    "PASS: decoded duration, existing metadata/MP4 bypass, timeout/failure, async recording finalization, stale-session cleanup, and retained evidence.",
  );
  if (process.argv.includes("--browser")) await browserChecks();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
