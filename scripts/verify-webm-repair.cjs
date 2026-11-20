// Uses generated audio and fake Cloud Storage only. No cloud reads or writes.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const {
  parseArgs,
  readWebmMetadata,
  processRecording,
  collectSources,
  sourceId,
} = require("./repair-webm-recordings.cjs");

const hash = (data) => crypto.createHash("md5").update(data).digest("base64");
const error = (code) => Object.assign(new Error("Fake storage failure"), { code });
class FakeBucket {
  constructor(name, bytes) {
    this.source = name;
    this.objects = new Map([
      [
        name,
        {
          bytes,
          metadata: {
            generation: "1",
            metageneration: "1",
            size: String(bytes.length),
            contentType: "audio/webm",
            contentDisposition: "inline",
            cacheControl: "private",
            md5Hash: hash(bytes),
            metadata: { firebaseStorageDownloadTokens: "fake-token", retained: "yes" },
          },
        },
      ],
    ]);
    this.writes = [];
    this.nextGeneration = 1;
  }
  file(name, options = {}) {
    return {
      name,
      getMetadata: async () => {
        const entry = this.objects.get(name);
        if (!entry) throw error(404);
        return [structuredClone(entry.metadata)];
      },
      download: async ({ destination }) => {
        const entry = this.objects.get(name);
        if (!entry) throw error(404);
        if (options.generation !== entry.metadata.generation) throw error(412);
        await fs.writeFile(destination, entry.bytes);
      },
      save: async (bytes, saveOptions) => {
        if (name === this.source && this.concurrentMetadataChange)
          this.objects.get(name).metadata.metageneration = "2";
        const previous = this.objects.get(name);
        const { ifGenerationMatch, ifMetagenerationMatch } = saveOptions.preconditionOpts;
        if (
          ifGenerationMatch === 0 ? previous : previous?.metadata.generation !== ifGenerationMatch
        )
          throw error(412);
        if (
          ifMetagenerationMatch !== undefined &&
          previous?.metadata.metageneration !== ifMetagenerationMatch
        )
          throw error(412);
        this.writes.push(name);
        this.objects.set(name, {
          bytes: Buffer.from(bytes),
          metadata: {
            ...structuredClone(saveOptions.metadata),
            generation: String(++this.nextGeneration),
            metageneration: "1",
            size: String(bytes.length),
            md5Hash: hash(bytes),
          },
        });
        if (name === this.source && this.lostSuccessResponse) throw error(412);
      },
    };
  }
}

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vaca-webm-repair-test-"));
  const options = {
    ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",
    ffprobe: process.env.FFPROBE_PATH || "ffprobe",
    maxBytes: 1024 * 1024,
    apply: false,
  };
  try {
    const input = path.join(directory, "fixture.webm");
    execFileSync(options.ffmpeg, [
      "-nostdin",
      "-hide_banner",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000",
      "-t",
      "0.4",
      "-c:a",
      "libopus",
      "-f",
      "webm",
      "-live",
      "1",
      input,
    ]);
    const bytes = await fs.readFile(input);
    assert.equal(readWebmMetadata(bytes).webm, true);
    assert.equal(Number.isFinite(readWebmMetadata(bytes).duration), false);
    assert.equal(readWebmMetadata(bytes).cues, false);
    assert.equal(readWebmMetadata(Buffer.from("not webm")).webm, false);

    const source = {
      id: sourceId("test-bucket", "assessments/test/no-extension"),
      name: "assessments/test/no-extension",
    };
    const bucket = new FakeBucket(source.name, bytes);
    const dry = await processRecording(source, bucket, options, directory);
    assert.equal(dry.status, "needs-repair");
    assert(dry.duration > 0.39 && dry.duration < 0.45);
    assert.equal(bucket.writes.length, 0, "Dry-run must never write to Storage");

    const apply = { ...options, apply: true };
    const repaired = await processRecording(source, bucket, apply, directory);
    assert.equal(repaired.status, "repaired");
    assert.equal(bucket.writes.length, 2, "Back up the original, then replace the live file");
    assert(bucket.writes[0].startsWith("maintenance/webm-duration-v1/"));
    assert.equal(bucket.writes[1], source.name);
    const backup = bucket.objects.get(bucket.writes[0]);
    assert.deepEqual(backup.bytes, bytes);
    assert.equal(backup.metadata.metadata.firebaseStorageDownloadTokens, undefined);
    const saved = bucket.objects.get(source.name);
    assert.equal(saved.metadata.metadata.firebaseStorageDownloadTokens, "fake-token");
    assert.equal(saved.metadata.metadata.retained, "yes");
    assert.equal(saved.metadata.cacheControl, "private");
    assert.equal(saved.metadata.contentDisposition, "inline");
    assert.equal(readWebmMetadata(saved.bytes).cues, true);
    assert.equal(
      (await processRecording(source, bucket, apply, directory)).status,
      "already-repaired",
    );
    assert.equal(bucket.writes.length, 2, "Re-running the migration must not upload again");

    const healthy = new FakeBucket(source.name, saved.bytes);
    assert.equal((await processRecording(source, healthy, apply, directory)).status, "healthy");
    assert.equal(healthy.writes.length, 0);

    const concurrent = new FakeBucket(source.name, bytes);
    concurrent.concurrentMetadataChange = true;
    await assert.rejects(
      processRecording(source, concurrent, apply, directory),
      /source-changed-or-upload-unverified/,
    );
    assert.deepEqual(concurrent.objects.get(source.name).bytes, bytes);
    assert.equal(
      concurrent.writes.length,
      1,
      "A concurrent metadata edit must block source replacement",
    );
    concurrent.concurrentMetadataChange = false;
    assert.equal((await processRecording(source, concurrent, apply, directory)).status, "repaired");
    assert.equal(concurrent.writes.length, 2, "Resume reuses the original backup");

    const lostResponse = new FakeBucket(source.name, bytes);
    lostResponse.lostSuccessResponse = true;
    assert.equal(
      (await processRecording(source, lostResponse, apply, directory)).status,
      "repaired",
    );

    const other = new FakeBucket(source.name, bytes);
    other.objects.get(source.name).metadata.contentType = "audio/mp4";
    assert.equal((await processRecording(source, other, apply, directory)).status, "other-format");
    assert.equal(other.writes.length, 0);
    const missing = new FakeBucket(source.name, bytes);
    missing.objects.clear();
    await assert.rejects(processRecording(source, missing, apply, directory), { code: 404 });
    const corrupt = new FakeBucket(source.name, Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]));
    await assert.rejects(
      processRecording(source, corrupt, apply, directory),
      /invalid-webm-header/,
    );
    assert.equal(corrupt.writes.length, 0);

    const docs = [
      { type: "mc", files: { 0: "gs://test-bucket/ignored" } },
      {
        type: "audio",
        files: { 0: "gs://test-bucket/historical", 99: "gs://test-bucket/removed-question" },
      },
      { type: "audio_mc", files: { 0: "gs://test-bucket/historical", 1: null } },
      { type: "audio", files: { 0: "invalid", 1: "gs://different-bucket/audio" } },
    ];
    const db = {
      collection: (name) => {
        assert.equal(name, "studentResponses");
        return {
          select: (...fields) => {
            assert.deepEqual(fields, ["type", "files"]);
            return {
              stream: async function* () {
                for (const data of docs) yield { data: () => data };
              },
            };
          },
        };
      },
    };
    const inventory = await collectSources(db, "test-bucket");
    assert.equal(inventory.sources.length, 2);
    assert.equal(inventory.counts.references, 4);
    assert.equal(inventory.counts.invalidReferences, 1);
    assert.equal(inventory.counts.otherBuckets, 1);
    assert.equal(
      parseArgs([
        "--project",
        "test",
        "--bucket",
        "test",
        "--manifest",
        path.join(directory, "report.json"),
      ]).apply,
      false,
    );
    assert.throws(
      () => parseArgs(["--project", "test", "--bucket", "test", "--manifest", "report.json"]),
      /outside-repository/,
    );
    console.log(
      "PASS: real WebM duration/cues repair, unchanged decoded PCM, seek verification, extensionless recordings, dry-run, backups, metadata/token preservation, concurrency, resume/idempotency, corrupt/missing/other files, and historical/deduplicated inventory.",
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
