# Recording duration and existing WebM repair

Assessment recording files live in Cloud Storage. Firestore's `studentResponses`
documents contain their `gs://` references in the `files` map. A duration field in
Firestore would not repair a WebM container's native media duration or seeking.

New WebM recordings are decoded to measure sample duration, then their container
Duration is written using `@fix-webm-duration/fix` and its parser. This does not
re-encode audio or use elapsed transcription time. MP4 and WebM with a valid
duration pass through. Finalization is bounded to ten seconds; if decoding or
repair fails, the original audio is retained with a warning and may still have
unavailable duration. It can be handled by a later maintenance run.

Grading downloads recordings into local blobs and reads their duration through
native media metadata. Existing
WebM files need a one-time repair before the old duration-probing workaround can
be removed. Blob downloads alone do not repair missing container metadata.

## Completed repair

On 2026-11-09, all 282 referenced recordings in
`quizzie-hku.firebasestorage.app` were repaired successfully, including archived
and historical assessment evidence. There were no repair failures. All 282 live
files and 282 original backups passed checksum, repair-marker, and WebM metadata
verification. A fresh Firestore-reference inventory found 282 already-repaired
recordings and none still needing repair. Firestore records were not modified.
Private manifests and the backup audit remain outside this repository.

The app's blob-download CORS configuration was applied and verified against
signed-URL responses. Application deployment is separate from this maintenance
run; repeat the inventory after deployment to cover files from older clients.

## Migration tool

`scripts/repair-webm-recordings.cjs` inventories every `audio` and `audio_mc`
document in `studentResponses`, including archived assessments and historical
question indexes. It deduplicates stored references and restricts operations to
the explicitly supplied bucket. It never changes Firestore documents, grades,
transcripts, or recording paths.

The tool uses Application Default Credentials, the existing Functions workspace's
Firebase Admin / Cloud Storage dependencies, and external `ffmpeg` and `ffprobe`
binaries. Run `npm ci` first if dependencies are absent. The binaries may be on
`PATH`, supplied with `--ffmpeg` / `--ffprobe`, or configured through
`FFMPEG_PATH` / `FFPROBE_PATH`. A named gcloud CLI configuration does not by itself
select the ADC file used by the Node libraries.

Use credentials that can read `studentResponses` and read/create/replace objects
in the selected bucket. Impersonated ADC additionally needs the IAM permissions
documented in `AGENTS.md`. Never put credential files in this repository.

The default is a dry run. It downloads and validates candidate files, generates
repaired files locally, and records what would change; it performs no cloud writes:

```sh
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/adc.json \
GCLOUD_PROJECT=quizzie-hku \
node scripts/repair-webm-recordings.cjs \
  --project quizzie-hku \
  --bucket quizzie-hku.firebasestorage.app \
  --manifest /absolute/private/path/webm-repair.json
```

Add `--limit 1` to validate one object first. Add `--apply` to the same command to
perform the verified repairs. Apply re-reads the current generation and repeats
validation; a previous dry-run report is not treated as permission to replace a
newer generation. Run the same command again to resume interrupted work or retry
failures. The manifest must be outside the repository, is written atomically with
mode `0600`, and contains hashes rather than object paths, student identifiers,
transcripts, download tokens, or signed URLs.

`--only-id HASH` selects an object using its full manifest identity hash.
`--max-bytes N` adjusts the default 256 MiB per-object limit. Files over the limit
are reported, never partially rewritten. Processing is sequential to bound local
disk, memory, and cloud request load.

## Verification and replacement

Candidate selection uses the `.webm` extension **or** the Storage content type;
existing recordings may have no extension. The tool checks the EBML document type
and embedded Duration/Cues rather than assuming an `ffprobe` duration estimate
proves the file is finalized. Other media formats are skipped. Already healthy
WebM files are decoded for validation and left unchanged.

For a WebM needing repair, FFmpeg remuxes to a seekable local WebM file with
`-c copy`. The audio is not re-encoded. Before any cloud write, the tool verifies:

- Exactly one audio stream, with unchanged codec, sample rate, and channel count.
- A finite positive embedded duration and a nonempty Cues index.
- Identical SHA-256 hashes of the complete decoded floating-point PCM before and
  after repair, including a successful error-free decode.
- Successful decoding after seeking to the repaired recording's midpoint.

Apply first uploads an exact original-byte backup to:

```text
maintenance/webm-duration-v1/<object-identity-hash>/<original-generation>.webm
```

This prefix is outside the application's `assessments` and `question-assets`
Storage rules. Backups deliberately omit Firebase download tokens and use
`Cache-Control: no-store`. The tool verifies the backup's content checksum before
replacing the live file. A previously created backup must match the original
bytes; it is never silently overwritten.

The live upload preserves its original content type, cache policy, disposition,
language, custom metadata, and Firebase download tokens. It adds repair-version,
source-generation, and checksum markers. Both generation and metageneration
preconditions prevent overwriting a concurrent content or metadata update. The
new live object's checksum is verified after upload. A repeat run skips repaired
objects only when the repair marker's checksum still matches the stored content.

Encrypted or held/retained objects are reported for separate handling rather than
weakening their protection. Missing, invalid, corrupt, oversize, cross-bucket, or
concurrently changed data produces a nonzero exit code and an aggregate report.
Other healthy recordings continue processing. No raw Cloud SDK error messages,
FFmpeg output, or metadata are written to console output or the manifest.

## Recovery and rollout

Deploy the new recorder finalization first so older clients stop adding files that
need repair; then apply the migration and run a final dry-run inventory. Existing
open browser sessions can still submit old-format files, so repeat the inventory
after those sessions have ended. Remove the legacy playback workaround only when
the intended recording population has been repaired and verified. Deployments are
separate requested operations, not a migration command.

Keep backups until the repaired files have passed playback verification. To
restore a file, resolve its manifest identity hash against its Firestore `gs://`
reference (`SHA-256(bucket + "/" + objectName)`). Read the deterministic backup,
verify its checksum, and replace the live object using a precondition on its
**current** generation and metageneration. Preserve the live file's content
metadata and download tokens, and remove the `vacaWebmRepair*` custom markers.
The tool does not automatically roll back over a newer recording or metadata edit.

Downloading blobs from signed URLs requires the bucket's CORS policy to allow
the app's actual origins and GET requests. CORS configuration is separate from
this migration and does not change object authorization. The blob cache should
be scoped to the grading session and release object URLs when the session ends.
Each fetch has its own 60-second timeout signal. React effects use boolean cleanup
flags to ignore stale results after switching sections, retrying, or leaving;
unfinished downloads can continue until they finish or time out. Ignored results
never create object URLs or update the cache.
`storage.cors.json` records the deployed Firebase Hosting origins and local port
5173 origins. Firebase deployment does not apply this file automatically. Apply it
explicitly with the appropriate GCP credentials when the allowed origins change:

```sh
gcloud storage buckets update gs://quizzie-hku.firebasestorage.app --cors-file=storage.cors.json
```

## Local verification

```sh
node scripts/verify-audio-mc.cjs
node scripts/verify-recording-duration.cjs
node scripts/verify-webm-repair.cjs
```

The duration verifier also accepts `--browser` for an actual Chromium chunked
MediaRecorder recording, metadata loading, paused seeking, and decoded sample
comparison. It uses installed Playwright, or `VACA_BROWSER_TOOLS` pointing at a
directory containing `node_modules/playwright`. `VACA_BROWSER_EXECUTABLE` selects
a Chromium executable when needed.

This generates a small audio fixture with missing WebM Duration/Cues and exercises
the real FFmpeg repair against fake Storage. It covers decoded-audio preservation,
seeking, extensionless files, read-only dry runs, backup ordering, token and
metadata preservation, concurrent metadata edits, lost success responses,
resuming/idempotency, healthy/corrupt/missing/other formats, and historical-reference
deduplication. It requires the same FFmpeg/ffprobe configuration and makes no cloud
requests.

References: [FFmpeg stream copying](https://ffmpeg.org/ffmpeg.html#Streamcopy),
[Cloud Storage preconditions](https://cloud.google.com/storage/docs/request-preconditions),
and [Cloud Storage CORS](https://cloud.google.com/storage/docs/cross-origin).
