// Offline middleware integration checks. Firebase Auth is stubbed; only loopback HTTP is used.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const express = require("express");
const { z } = require("zod");
const { initializeApp, deleteApp } = require("firebase/app");
const { getFunctions, httpsCallableFromURL } = require("firebase/functions");
const { FirebaseAuthError } = require("firebase-admin/auth");
const authFailures = new Map(
  [
    ["malformed", "argument-error", "Decoding Firebase ID token failed. Private detail"],
    ["signature", "argument-error", "Firebase ID token has invalid signature. Private detail"],
    [
      "custom",
      "argument-error",
      "verifyIdToken() expects an ID token, but was given a custom token.",
    ],
    ["expired", "id-token-expired", "Private expiry detail"],
    ["revoked", "id-token-revoked", "Private revocation detail"],
    ["invalid", "invalid-id-token", "Private token detail"],
    ["credentials", "invalid-credential", "Private credential detail"],
    ["internal", "internal-error", "Private internal detail"],
    ["certificates", "argument-error", "Error fetching public keys for Google certs: unavailable"],
    ["network", "argument-error", "Error while making request: connection reset"],
    ["unknown-argument", "argument-error", "Unrecognized SDK failure"],
  ].map(([token, code, message]) => [token, new FirebaseAuthError({ code, message })]),
);
authFailures.set("unexpected", new Error("Private unexpected verification failure"));
const root = path.resolve(__dirname, "..");
const cache = new Map();
let verificationCalls = 0;
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (name) => {
    if (name === "../firebase")
      return {
        admin: {
          auth: () => ({
            verifyIdToken: async (token) => {
              verificationCalls++;
              if (authFailures.has(token)) throw authFailures.get(token);
              return token === "valid"
                ? { email: "student@example.com", isAdmin: true }
                : { email: token === "blank" ? "  " : undefined };
            },
          }),
        },
      };
    if (name.startsWith(".")) return load(path.resolve(path.dirname(filename), `${name}.ts`));
    return require(name);
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
  return mod.exports;
}
const { ApiError, ForbiddenError, errorHandler, notFoundHandler } = load(
  "apps/functions/src/middleware/error.ts",
);
const { validate } = load("apps/functions/src/middleware/validation.ts");
const { authHandler } = load("apps/functions/src/middleware/auth.ts");
const logs = [];
const originalError = console.error;
async function main() {
  console.error = (...args) => logs.push(args);
  const app = express();
  app.use(express.json({ limit: 128 }));
  app.use(authHandler);
  app.post(
    "/validate",
    validate(
      z.object({
        count: z
          .string()
          .default("2")
          .transform(async (v) => Number(v)),
      }),
    ),
    (req, res) =>
      res.json({
        data: { ...req.body, email: res.locals.callerEmail, claims: res.locals.callerClaims },
      }),
  );
  app.post("/error/:code", (req, _res, next) =>
    next(new ApiError("Known failure", Number(req.params.code), { reason: "example" })),
  );
  app.post("/forbidden", () => {
    throw new ForbiddenError();
  });
  app.post("/unexpected", () => {
    throw Object.assign(new Error("private database credentials"), { status: 400 });
  });
  app.post("/plain", () => {
    throw { status: 401, message: "private plain error" };
  });
  app.post(
    "/async",
    validate(
      z.object({}).transform(async () => {
        throw new Error("private transform");
      }),
    ),
    (_req, res) => res.end(),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const firebase = initializeApp({ projectId: "offline-errors" }, "offline-errors");
  async function request(route, body = {}, token = "valid", extraHeaders = {}) {
    const response = await fetch(base + route, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
        ...extraHeaders,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    for (const [http, status] of [
      [400, "INVALID_ARGUMENT"],
      [401, "UNAUTHENTICATED"],
      [403, "PERMISSION_DENIED"],
      [404, "NOT_FOUND"],
      [409, "ABORTED"],
      [413, "RESOURCE_EXHAUSTED"],
      [429, "RESOURCE_EXHAUSTED"],
      [500, "INTERNAL"],
      [503, "UNAVAILABLE"],
      [504, "DEADLINE_EXCEEDED"],
    ]) {
      const result = await request(`/error/${http}`);
      assert.equal(result.status, http);
      assert.deepEqual(result.body, {
        error: { status, message: "Known failure", details: { reason: "example" } },
      });
    }
    for (const token of [
      null,
      "",
      "malformed",
      "signature",
      "custom",
      "expired",
      "revoked",
      "invalid",
      "missing",
      "blank",
    ]) {
      assert.deepEqual(await request("/missing", {}, token), {
        status: 401,
        body: { error: { status: "UNAUTHENTICATED", message: "Unauthorized" } },
      });
    }
    assert.equal(logs.length, 0, "token rejections do not log credentials or token details");
    for (const token of [
      "credentials",
      "internal",
      "certificates",
      "network",
      "unknown-argument",
      "unexpected",
    ]) {
      assert.deepEqual(await request("/validate", {}, token), {
        status: 500,
        body: { error: { status: "INTERNAL", message: "Internal Server Error" } },
      });
      assert.equal(
        logs.at(-1)[1],
        authFailures.get(token),
        "retain the original error for diagnostics",
      );
    }
    logs.length = 0;
    assert.equal((await request("/missing")).body.error.status, "NOT_FOUND");
    assert.equal((await request("/forbidden")).body.error.status, "PERMISSION_DENIED");
    const invalid = await request("/validate", { count: 2 });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.details.issues[0].path[0], "count");
    for (const body of [{}, { data: {}, trace: "kept" }]) {
      const valid = (await request("/validate", body)).body.data;
      assert.equal(valid.data.count, 2);
      assert.equal(valid.email, "student@example.com");
      assert.equal(valid.claims.isAdmin, true);
      if (body.trace) assert.equal(valid.trace, "kept");
    }
    assert.equal((await request("/validate", { count: "7" })).body.data.data.count, 7);
    const before = verificationCalls;
    assert.equal((await request("/validate", "{")).body.error.message, "Invalid JSON");
    assert.equal(verificationCalls, before, "JSON parsing precedes auth");
    assert.equal((await request("/validate", { large: "x".repeat(200) })).status, 413);
    assert.equal(
      (await request("/validate", "{}", "valid", { "Content-Encoding": "unsupported" })).status,
      415,
    );
    assert.equal(
      (
        await request("/validate", "{}", "valid", {
          "Content-Type": "application/json; charset=bogus",
        })
      ).status,
      415,
    );
    for (const [route, body] of [
      ["/unexpected", {}],
      ["/plain", {}],
      ["/async", {}],
    ]) {
      assert.deepEqual(await request(route, body), {
        status: 500,
        body: { error: { status: "INTERNAL", message: "Internal Server Error" } },
      });
    }
    assert.equal(logs.length, 3);
    const sentError = new Error("already sent");
    let forwarded;
    errorHandler(
      sentError,
      {},
      { headersSent: true, status: () => assert.fail("must not write") },
      (err) => {
        forwarded = err;
      },
    );
    assert.equal(forwarded, sentError);
    // Run the installed client end-to-end, with an auth header supplied by an offline fetch wrapper.
    const originalFetch = global.fetch;
    global.fetch = (url, options) =>
      originalFetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: "Bearer valid" },
      });
    try {
      const functions = getFunctions(firebase);
      await assert.rejects(httpsCallableFromURL(functions, base + "/error/409")({}), (error) => {
        assert.equal(error.code, "functions/aborted");
        assert.equal(error.message, "Known failure");
        assert.deepEqual(error.details, { reason: "example" });
        return true;
      });
      await assert.rejects(
        httpsCallableFromURL(functions, base + "/validate")({ count: 2 }),
        (error) => {
          assert.equal(error.code, "functions/invalid-argument");
          assert.equal(error.message, "Invalid request");
          assert.equal(error.details.issues[0].path[0], "count");
          return true;
        },
      );
    } finally {
      global.fetch = originalFetch;
    }
    console.log("API error middleware and Firebase callable decoding checks passed");
  } finally {
    await deleteApp(firebase);
    await new Promise((resolve) => server.close(resolve));
    console.error = originalError;
  }
}
main().catch((error) => {
  console.error = originalError;
  console.error(error);
  process.exitCode = 1;
});
