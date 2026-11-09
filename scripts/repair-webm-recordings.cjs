#!/usr/bin/env node
// One-time maintenance tool. No cloud writes unless --apply is supplied.
// Reports use hashed object identities; audio and credentials never enter logs.
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { createRequire } = require("node:module");

const execute = promisify(execFile);
const root = path.resolve(__dirname, "..");
const requireFunctions = createRequire(path.join(root, "apps/functions/package.json"));
const REPAIR_VERSION = "1";
const BACKUP_PREFIX = "maintenance/webm-duration-v1";
const digest = (bytes, algorithm = "sha256", encoding = "hex") =>
  crypto.createHash(algorithm).update(bytes).digest(encoding);
const sourceId = (bucket, name) => digest(`${bucket}/${name}`);

class RepairError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function parseArgs(args) {
  const options = {
    apply: false,
    ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",
    ffprobe: process.env.FFPROBE_PATH || "ffprobe",
    maxBytes: 256 * 1024 * 1024,
    limit: Infinity,
  };
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--apply") options.apply = true;
    else if (key === "--help") options.help = true;
    else if (
      [
        "--project",
        "--bucket",
        "--manifest",
        "--ffmpeg",
        "--ffprobe",
        "--limit",
        "--max-bytes",
        "--only-id",
      ].includes(key)
    ) {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new RepairError("missing-option-value");
      const name = { "--max-bytes": "maxBytes", "--only-id": "onlyId" }[key] || key.slice(2);
      options[name] = ["limit", "maxBytes"].includes(name) ? Number(value) : value;
    } else throw new RepairError("unknown-option");
  }
  if (options.help) return options;
  if (!options.project || !options.bucket || !options.manifest)
    throw new RepairError("project-bucket-and-manifest-required");
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0)
    throw new RepairError("invalid-max-bytes");
  if (options.limit !== Infinity && (!Number.isSafeInteger(options.limit) || options.limit < 1))
    throw new RepairError("invalid-limit");
  if (options.onlyId && !/^[a-f0-9]{64}$/.test(options.onlyId))
    throw new RepairError("invalid-only-id");
  options.manifest = path.resolve(options.manifest);
  // Reports are private operational artifacts, never repository source.
  if (options.manifest === root || options.manifest.startsWith(`${root}${path.sep}`))
    throw new RepairError("manifest-must-be-outside-repository");
  return options;
}

// Read only EBML element boundaries. Skip encoded Cluster data; never rewrite it.
function* elements(bytes, start, end) {
  let offset = start;
  while (offset < end) {
    const begin = offset;
    const width = (first, max) => {
      for (let count = 1; count <= max; count++) if (first & (0x80 >> (count - 1))) return count;
      throw new RepairError("invalid-webm-header");
    };
    const idWidth = width(bytes[offset], 4);
    if (offset + idWidth >= end) throw new RepairError("truncated-webm");
    const id = bytes.readUIntBE(offset, idWidth);
    offset += idWidth;
    const sizeWidth = width(bytes[offset], 8);
    if (offset + sizeWidth > end) throw new RepairError("truncated-webm");
    let size = BigInt(bytes[offset] & (0xff >> sizeWidth));
    for (let index = 1; index < sizeWidth; index++)
      size = (size << 8n) | BigInt(bytes[offset + index]);
    offset += sizeWidth;
    const unknown = size === (1n << BigInt(7 * sizeWidth)) - 1n;
    if (!unknown && size > BigInt(end - offset)) throw new RepairError("truncated-webm");
    const finish = unknown ? end : offset + Number(size);
    yield { id, begin, start: offset, end: finish, unknown };
    offset = finish;
  }
}

function readWebmMetadata(bytes) {
  if (bytes.length < 4 || bytes.readUInt32BE(0) !== 0x1a45dfa3)
    return { webm: false, duration: NaN, cues: false };
  let webm = false;
  let scale = 1_000_000;
  let duration = NaN;
  let cues = false;
  for (const top of elements(bytes, 0, bytes.length)) {
    if (top.id === 0x1a45dfa3) {
      for (const child of elements(bytes, top.start, top.end)) {
        if (child.id === 0x4282) webm = bytes.toString("utf8", child.start, child.end) === "webm";
      }
    }
    if (top.id !== 0x18538067) continue;
    for (const child of elements(bytes, top.start, top.end)) {
      if (child.id === 0x1c53bb6b) cues = child.end > child.start;
      if (child.id !== 0x1549a966) continue;
      for (const entry of elements(bytes, child.start, child.end)) {
        const size = entry.end - entry.start;
        if (entry.id === 0x2ad7b1 && size > 0 && size <= 6)
          scale = bytes.readUIntBE(entry.start, size);
        if (entry.id === 0x4489 && [4, 8].includes(size))
          duration = size === 4 ? bytes.readFloatBE(entry.start) : bytes.readDoubleBE(entry.start);
      }
    }
  }
  return { webm, duration: (duration * scale) / 1_000_000_000, cues };
}

async function mediaCommand(binary, args) {
  try {
    const { stdout } = await execute(binary, args, {
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  } catch (error) {
    // ffmpeg stderr can contain file paths. Keep it out of logs and manifests.
    throw new RepairError(
      error.code === "ENOENT" ? "media-tool-unavailable" : "media-verification-failed",
    );
  }
}

async function probe(filename, options) {
  const output = await mediaCommand(options.ffprobe, [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,codec_name,sample_rate,channels:format=duration",
    "-of",
    "json",
    filename,
  ]);
  const data = JSON.parse(output);
  if (data.streams?.length !== 1 || data.streams[0].codec_type !== "audio")
    throw new RepairError("expected-single-audio-stream");
  return data.streams[0];
}

async function decodedDigest(filename, options, seek = null) {
  return (
    await mediaCommand(options.ffmpeg, [
      "-nostdin",
      "-hide_banner",
      "-v",
      "error",
      "-xerror",
      ...(seek === null ? [] : ["-ss", String(seek)]),
      "-i",
      filename,
      ...(seek === null ? [] : ["-t", "0.1"]),
      "-map",
      "0:a:0",
      "-c:a",
      "pcm_f32le",
      "-f",
      "hash",
      "-hash",
      "sha256",
      "-",
    ])
  ).trim();
}

async function remuxRecording(input, output, options) {
  const beforeStream = await probe(input, options);
  const beforeDigest = await decodedDigest(input, options);
  if (beforeDigest === `SHA256=${digest(Buffer.alloc(0))}`) throw new RepairError("empty-audio");
  await mediaCommand(options.ffmpeg, [
    "-nostdin",
    "-hide_banner",
    "-v",
    "error",
    "-xerror",
    "-y",
    "-i",
    input,
    "-map",
    "0",
    "-map_metadata",
    "0",
    "-c",
    "copy",
    "-f",
    "webm",
    output,
  ]);
  const repairedBytes = await fs.readFile(output);
  const metadata = readWebmMetadata(repairedBytes);
  if (
    !metadata.webm ||
    !Number.isFinite(metadata.duration) ||
    metadata.duration <= 0 ||
    !metadata.cues
  )
    throw new RepairError("invalid-repaired-metadata");
  const afterStream = await probe(output, options);
  if (JSON.stringify(beforeStream) !== JSON.stringify(afterStream))
    throw new RepairError("audio-stream-changed");
  if (beforeDigest !== (await decodedDigest(output, options)))
    throw new RepairError("decoded-audio-changed");
  if (
    (await decodedDigest(output, options, metadata.duration / 2)) ===
    `SHA256=${digest(Buffer.alloc(0))}`
  )
    throw new RepairError("seeking-produced-no-audio");
  return { bytes: repairedBytes, duration: metadata.duration };
}

function preservedMetadata(metadata) {
  const fields = [
    "cacheControl",
    "contentDisposition",
    "contentEncoding",
    "contentLanguage",
    "contentType",
    "customTime",
    "storageClass",
  ];
  return Object.fromEntries(
    fields.filter((key) => metadata[key] !== undefined).map((key) => [key, metadata[key]]),
  );
}

async function ensureBackup(bucket, id, original, metadata) {
  const backup = bucket.file(`${BACKUP_PREFIX}/${id}/${metadata.generation}.webm`);
  const expectedMd5 = digest(original, "md5", "base64");
  try {
    await backup.save(original, {
      resumable: false,
      validation: "crc32c",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: metadata.contentType || "audio/webm",
        cacheControl: "no-store",
        metadata: {
          vacaWebmRepairVersion: REPAIR_VERSION,
          sourceGeneration: String(metadata.generation),
          sourceSha256: digest(original),
        },
      },
    });
  } catch (error) {
    if (Number(error.code) !== 412) throw error;
  }
  const [saved] = await backup.getMetadata();
  if (saved.md5Hash !== expectedMd5 || saved.metadata?.firebaseStorageDownloadTokens)
    throw new RepairError("backup-verification-failed");
  return backup.name;
}

async function processRecording(source, bucket, options, workdir) {
  const file = bucket.file(source.name);
  const [metadata] = await file.getMetadata();
  const result = { generation: String(metadata.generation), bytes: Number(metadata.size) };
  if (
    !source.name.toLowerCase().endsWith(".webm") &&
    !/^(audio|video)\/webm(?:;|$)/i.test(metadata.contentType || "")
  )
    return { ...result, status: "other-format" };
  if (
    metadata.metadata?.vacaWebmRepairVersion === REPAIR_VERSION &&
    metadata.metadata?.vacaWebmRepairMd5 === metadata.md5Hash
  ) {
    return { ...result, status: "already-repaired" };
  }
  if (!Number.isSafeInteger(result.bytes) || result.bytes <= 0 || result.bytes > options.maxBytes)
    throw new RepairError("invalid-or-oversized-object");
  if (metadata.contentEncoding && metadata.contentEncoding !== "identity")
    throw new RepairError("encoded-storage-object");
  if (
    metadata.customerEncryption ||
    metadata.kmsKeyName ||
    metadata.temporaryHold ||
    metadata.eventBasedHold ||
    metadata.retention
  )
    throw new RepairError("protected-storage-object");
  const input = path.join(workdir, "original.webm");
  const output = path.join(workdir, "repaired.webm");
  await bucket.file(source.name, { generation: metadata.generation }).download({
    destination: input,
    validation: "crc32c",
    decompress: false,
  });
  const original = await fs.readFile(input);
  if (original.length !== result.bytes) throw new RepairError("download-size-mismatch");
  const media = readWebmMetadata(original);
  if (!media.webm) return { ...result, status: "other-format" };
  if (Number.isFinite(media.duration) && media.duration > 0 && media.cues) {
    await probe(input, options);
    const hash = await decodedDigest(input, options);
    if (hash === `SHA256=${digest(Buffer.alloc(0))}`) throw new RepairError("empty-audio");
    return { ...result, status: "healthy", duration: media.duration };
  }
  const repaired = await remuxRecording(input, output, options);
  result.duration = repaired.duration;
  result.originalSha256 = digest(original);
  result.repairedSha256 = digest(repaired.bytes);
  if (!options.apply) return { ...result, status: "needs-repair" };

  // A verified immutable backup must exist before the live object is touched.
  result.backup = await ensureBackup(bucket, source.id, original, metadata);
  const replacement = {
    ...preservedMetadata(metadata),
    contentType: metadata.contentType || "audio/webm",
    metadata: {
      ...metadata.metadata,
      vacaWebmRepairVersion: REPAIR_VERSION,
      vacaWebmRepairSourceGeneration: String(metadata.generation),
      vacaWebmRepairSha256: result.repairedSha256,
      vacaWebmRepairMd5: digest(repaired.bytes, "md5", "base64"),
    },
  };
  try {
    await file.save(repaired.bytes, {
      resumable: false,
      validation: "crc32c",
      metadata: replacement,
      preconditionOpts: {
        ifGenerationMatch: metadata.generation,
        ifMetagenerationMatch: metadata.metageneration,
      },
    });
  } catch (error) {
    if (Number(error.code) !== 412) throw error;
    // A retry after a lost success response can also produce 412. Only accept
    // exactly our verified output; never overwrite an unrelated newer version.
  }
  const [saved] = await file.getMetadata();
  if (
    saved.md5Hash !== digest(repaired.bytes, "md5", "base64") ||
    saved.metadata?.vacaWebmRepairSourceGeneration !== String(metadata.generation) ||
    saved.metadata?.vacaWebmRepairSha256 !== result.repairedSha256
  )
    throw new RepairError("source-changed-or-upload-unverified");
  return {
    ...result,
    status: "repaired",
    generation: String(saved.generation),
    sourceGeneration: String(metadata.generation),
  };
}

async function collectSources(db, bucketName) {
  const sources = new Map();
  const counts = {
    documents: 0,
    audioDocuments: 0,
    references: 0,
    invalidReferences: 0,
    otherBuckets: 0,
  };
  // No assessment/archive/current-question filter: retain coverage of historical evidence.
  for await (const doc of db.collection("studentResponses").select("type", "files").stream()) {
    counts.documents++;
    const data = doc.data();
    if (!["audio", "audio_mc"].includes(data.type)) continue;
    counts.audioDocuments++;
    for (const uri of Object.values(data.files || {})) {
      if (uri == null) continue;
      const match = typeof uri === "string" && /^gs:\/\/([^/]+)\/(.+)$/.exec(uri);
      if (!match) {
        counts.invalidReferences++;
        continue;
      }
      counts.references++;
      if (match[1] !== bucketName) {
        counts.otherBuckets++;
        continue;
      }
      const name = match[2];
      if (name.startsWith(`${BACKUP_PREFIX}/`)) {
        counts.invalidReferences++;
        continue;
      }
      const id = sourceId(bucketName, name);
      sources.set(id, { id, name });
    }
  }
  return { sources: [...sources.values()].sort((a, b) => a.id.localeCompare(b.id)), counts };
}

async function writeManifest(filename, manifest) {
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(temporary, 0o600);
  await fs.rename(temporary, filename);
}

function failureCode(error) {
  if (error instanceof RepairError) return error.code;
  const code = Number(error.code);
  if (code === 404) return "missing-object";
  if (code === 403 || code === 7) return "permission-denied";
  if (code === 412) return "source-changed";
  return Number.isFinite(code) ? `operation-failed-${code}` : "operation-failed";
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    console.log(
      "Usage: node scripts/repair-webm-recordings.cjs --project PROJECT --bucket BUCKET --manifest /private/report.json [--apply] [--limit N] [--only-id HASH] [--ffmpeg PATH] [--ffprobe PATH] [--max-bytes N]",
    );
    return;
  }
  await mediaCommand(options.ffmpeg, ["-version"]);
  await mediaCommand(options.ffprobe, ["-version"]);
  let previous;
  try {
    previous = JSON.parse(await fs.readFile(options.manifest, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (
    previous &&
    (previous.schemaVersion !== 1 ||
      previous.project !== options.project ||
      previous.bucket !== options.bucket)
  )
    throw new RepairError("manifest-project-or-bucket-mismatch");

  const { initializeApp, deleteApp } = requireFunctions("firebase-admin/app");
  const { getFirestore } = requireFunctions("firebase-admin/firestore");
  const { Storage } = requireFunctions("@google-cloud/storage");
  const app = initializeApp({ projectId: options.project });
  const db = getFirestore(app);
  const storage = new Storage({
    projectId: options.project,
    retryOptions: { autoRetry: true, maxRetries: 3, totalTimeout: 120 },
  });
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), "vaca-webm-repair-"));
  try {
    const { sources, counts } = await collectSources(db, options.bucket);
    const selected = sources
      .filter((source) => !options.onlyId || options.onlyId === source.id)
      .slice(0, options.limit);
    const manifest = {
      schemaVersion: 1,
      project: options.project,
      bucket: options.bucket,
      mode: options.apply ? "apply" : "dry-run",
      startedAt: new Date().toISOString(),
      inventory: { ...counts, uniqueObjects: sources.length, selectedObjects: selected.length },
      entries: previous?.entries || {},
      summary: {},
    };
    const bucket = storage.bucket(options.bucket);
    await writeManifest(options.manifest, manifest);
    console.log(JSON.stringify({ mode: manifest.mode, inventory: manifest.inventory }));
    for (const source of selected) {
      let entry;
      try {
        entry = await processRecording(source, bucket, options, workdir);
      } catch (error) {
        entry = { status: "failed", code: failureCode(error) };
      }
      manifest.entries[source.id] = { ...entry, checkedAt: new Date().toISOString() };
      manifest.summary[entry.status] = (manifest.summary[entry.status] || 0) + 1;
      await writeManifest(options.manifest, manifest);
      // Aggregate progress only; no object names, transcripts, URLs, or metadata.
      console.log(
        JSON.stringify({
          processed: Object.values(manifest.summary).reduce((a, b) => a + b, 0),
          total: selected.length,
          summary: manifest.summary,
        }),
      );
    }
    manifest.finishedAt = new Date().toISOString();
    await writeManifest(options.manifest, manifest);
    if (manifest.summary.failed || counts.invalidReferences || counts.otherBuckets)
      process.exitCode = 1;
  } finally {
    await fs.rm(workdir, { recursive: true, force: true });
    await db.terminate();
    await deleteApp(app);
  }
}

module.exports = {
  parseArgs,
  readWebmMetadata,
  remuxRecording,
  processRecording,
  collectSources,
  sourceId,
  failureCode,
};
if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ status: "failed", code: failureCode(error) }));
    process.exitCode = 1;
  });
}
