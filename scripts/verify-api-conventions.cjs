// Runs real Express routers against isolated service doubles; never loads Firebase.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const express = require("express");
const root = path.resolve(__dirname, "../apps/functions/src");
const cache = new Map();
let deletes = 0;
let reads = 0;
const claims = [undefined, false, true, "true", "false", 1, 0, {}, []];
const collection = () => ({
  get: async () => {
    reads++;
    return { docs: [] };
  },
  orderBy: () => collection(),
});
const model = {
  collection,
  doc: (id) => ({
    get: async () => ({ exists: id === "existing" }),
    delete: async () => {
      deletes++;
    },
  }),
};
const overrides = {
  "firebase.ts": {
    FieldValue: { serverTimestamp: () => 0 },
    admin: {
      auth: () => ({
        listUsers: async () => ({
          users: claims.map((isAdmin) => ({
            email: "test@example.com",
            customClaims: { isAdmin },
          })),
        }),
      }),
    },
  },
  "types/models/assessments.ts": { assessments: model, toAssessmentDto: (x) => x },
  "types/models/student-responses.ts": { studentResponses: model, toStudentResponseDto: (x) => x },
  "types/models/subtasks.ts": { subtasks: model, toSubtaskDto: (x) => x },
  "types/models/questions.ts": {
    questionSections: model,
    getQuestionSections: async () => {
      reads++;
      return [];
    },
  },
};
function load(relative) {
  const filename = path.resolve(root, relative);
  const key = path.relative(root, filename);
  if (overrides[key]) return overrides[key];
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const requireSource = (name) =>
    name.startsWith(".")
      ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)))
      : require(name);
  new Function("require", "module", "exports", code)(requireSource, module, module.exports);
  return module.exports;
}
async function main() {
  const routers = ["admin", "questions", "subtasks"].map(
    (name) => load(`routes/${name}.ts`).router,
  );
  const { errorHandler } = load("middleware/error.ts");
  const adminPaths = routers.flatMap((router) =>
    router.stack
      .filter((layer) => layer.route?.path.startsWith("/admin/"))
      .map((layer) => layer.route.path),
  );
  assert.equal(adminPaths.length, 9);
  // Both mount orders catch guard leakage into later routers and duplicate guards.
  for (const order of [routers, [...routers].reverse()]) {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      res.locals.callerEmail = "test@example.com";
      res.locals.callerClaims =
        req.headers.claim === undefined ? undefined : { isAdmin: JSON.parse(req.headers.claim) };
      next();
    });
    order.forEach((router) => app.use(router));
    app.use(errorHandler);
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const post = async (route, claim, body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, {
        method: "POST",
        headers: {
          ...(claim === undefined ? {} : { claim: JSON.stringify(claim) }),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    };
    try {
      for (const claim of claims.filter((value) => value !== true)) {
        for (const route of adminPaths) {
          const before = reads;
          assert.equal(
            (await post(route, claim)).status,
            403,
            `${route}: ${JSON.stringify(claim)}`,
          );
          assert.equal(reads, before);
        }
        for (const route of ["/get-questions", "/get-subtasks"]) {
          assert.equal((await post(route, claim)).status, 200);
        }
      }
      for (const body of [undefined, {}, { data: {} }, { data: null }]) {
        for (const route of ["/get-questions", "/get-subtasks", "/admin/get-users"]) {
          assert.equal((await post(route, true, body)).status, 200);
        }
      }
      const listed = (await post("/admin/get-users", true)).body.data.users;
      assert.deepEqual(
        listed.map((user) => user.isAdmin),
        claims.map((claim) => claim === true),
      );
      const deleted = await post("/admin/delete-subtask", true, { data: { id: "existing" } });
      assert.deepEqual(deleted, { status: 200, body: { data: { ok: true } } });
      const before = deletes;
      const missing = await post("/admin/delete-subtask", true, { data: { id: "missing" } });
      assert.equal(missing.status, 404);
      assert.equal(missing.body.error.status, "NOT_FOUND");
      assert.equal(deletes, before);
      // A later admin route's guard runs once, even when the admin router is first.
      for (const router of routers) {
        for (const layer of router.stack.filter((entry) => entry.route)) {
          assert.equal(
            layer.route.stack.filter((entry) => entry.handle.name === "adminHandler").length,
            layer.route.path.startsWith("/admin/") ? 1 : 0,
          );
        }
      }
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }
  console.log("API convention regression checks passed");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
