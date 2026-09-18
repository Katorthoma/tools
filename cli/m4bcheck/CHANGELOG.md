# Changelog

This is the first public release of m4bcheck. Earlier versions were developed privately.

## 2.2.7

- Hardened the interactive batch mono-choice display against inconsistent candidate/plan data.
- Removed a latent `StopIteration` failure path in display-only code.
- Added graceful reporting for future per-file mono bitrate differences.

## 2.2.6

- Replaced the single early stereo sample with seven distributed windows across the audiobook.
- Mono advisory status now requires all planned samples to decode successfully and remain below the mono-like threshold.
- Improved detection of isolated stereo sections such as songs, bumpers, or dramatized passages.

## 2.2.5

- Added `--replace-fixed` to re-verify and promote an existing `[Fixed ...]` sibling over its original while preserving a `.bak` copy.
- Added progress reporting for fallback `.bak` copies when hard-link backup creation is unavailable.
- Corrected existing-fix reporting to show the actual matched fixed sibling.

## 2.2.0–2.2.4 highlights

- Added exact MP4 `moov.udta` metadata-capsule preservation for Mp3tag-safe standard mode.
- Added full decode-to-EOF verification.
- Added random-access decode verification at every chapter start.
- Added transactional replacement with no-clobber `.bak` preservation.
- Added robust MP4 atom parsing, chapter verification, faststart validation, and xHE-AAC/USAC decoder selection.

## Python rewrite

m4bcheck was rewritten in Python after review of the original Bash implementation exposed several failure modes caused primarily by shell parsing and transaction handling rather than by the audiobook repair logic itself.

The rewrite introduced structured `ffprobe` JSON parsing, explicit diagnosis and repair planning, exception-based failure handling, transactional replacement, and substantially stronger post-repair verification.

## Historical Bash implementation

The original `m4bcheck.sh` targeted Bash 3.2 and carried `VERSION="1.0"` throughout its development. The stages below describe its development history rather than released version numbers.

### Initial implementation

- Scanned a single M4B or folder and reported codec/profile, duration, size, chapter count, decoder availability, and channel difference.
- Detected xHE-AAC/USAC audio, non-faststart MP4 layout, duration mismatches, chapter-boundary problems, and missing chapter metadata.
- Re-encoded problematic xHE-AAC files to AAC-LC, using AudioToolbox `aac_at` as the input decoder on macOS when required.
- Extracted and restored cover artwork.
- Added an MP4 top-level atom walker.
- Supported `--bitrate`, `--mono`, `--encoder`, `--outdir`, `--suffix`, `--replace`, `--yes`, `--dry-run`, `--quick`, `--no-cover`, and `--flat`.

### Portability and parsing

- Removed Bash 3.2-incompatible assumptions around empty arrays.
- Replaced `xxd` with `od`.
- Corrected chapter counting and end-time parsing.
- Added a lossless remux path for container-only problems.
- Corrected misleading `--mono` help text.

### Decoder detection

- Corrected decoder probing that tested a midpoint seek, the specific operation broken in the affected xHE-AAC files, instead of proving linear decoding from position zero.
- Fixed false-negative decoder detection caused by `grep -q` and `pipefail`.
- Added explicit handling for files with no usable decoder.
- Made channel-difference sampling adaptive for short files.

### Metadata preservation

- Investigated FFmpeg's standard-atom, QuickTime-key, freeform-tag, and cover-art muxing behavior. In the tested configurations, no FFmpeg-only mux produced standard iTunes atoms, freeform atoms, and embedded cover art together.
- Added `--tags standard|qt` to make the available metadata trade-offs explicit.
- Added AtomicParsley support for restoring freeform metadata.
- Added preflight dependency checks.
- Corrected restoration of container fields, tags containing spaces, and unreadable metadata dumps.
- Rechecked faststart after metadata rewriting.

### Advisory mono and reporting

- Added interactive and automatic mono choices for likely dual-mono sources.
- Made channel and bitrate decisions per-file for mixed batches.
- Added repair-specific output naming such as `[Fixed 64k mono]`.
- Added pre-encode size estimates and improved batch reporting.

### Retirement

The Bash implementation was retired after review exposed safety and correctness issues that were better addressed by rewriting the tool around structured data and explicit transactions.

#### Known defects at retirement

- `--replace` could destroy the original when the output path equalled the source path. Reproduced and confirmed.
- Options requiring a value could loop indefinitely when invoked without one. Reproduced and confirmed.
- Some verification failures were warnings rather than hard failures.
- Duration verification could compare against a container duration already known to be incorrect.
- Chapter-end problems could be routed to a remux even though remuxing cannot repair chapter timestamps.
- Zero chapters could still result in a healthy verdict.
- Indeterminate MP4 atom scans could be treated as healthy.
- Mixed batches could return a successful exit status despite unrepairable files.
- Duplicate inputs were not deduplicated.
- `--outdir` could collide when two books shared a basename.
- Newlines in filenames were not safely handled.
- ffmetadata escaping could be restored incorrectly.
- Tag verification compared names rather than values.
