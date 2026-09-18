# m4bcheck

`m4bcheck` is a conservative M4B/M4A audiobook inspector and repair utility. It checks codec and decoder compatibility, MP4 container layout, chapters, seeking, metadata, artwork, duration, and channel characteristics, then repairs only cases it can verify safely.

Current version: **2.2.7**

## Why m4bcheck exists

m4bcheck began with an audiobook that behaved normally during linear playback but failed when seeking to chapter marks in Audiobookshelf: selecting a chapter could jump back to 00:00, while seeking slightly beyond the chapter boundary worked.

The affected files used xHE-AAC (USAC). Random access in this format depends on suitable decoder support and valid seek points, and the browser playback path used by Audiobookshelf did not reliably seek these files.

On macOS, FFmpeg's native AAC decoder could not decode the affected files and could emit `Not yet implemented in FFmpeg, patches welcome`, while Apple's AudioToolbox decoder could. m4bcheck therefore detects this condition and, when required, uses FFmpeg's `aac_at` decoder for input and re-encodes the audio to widely compatible AAC-LC.

What began as an xHE-AAC repair script has since grown into a conservative M4B inspection and repair utility covering container layout, chapters, seeking, metadata, artwork, decoder viability, and channel characteristics.

## Highlights

- Scans individual `.m4b` / `.m4a` files or whole directory trees.
- Detects xHE-AAC/USAC and selects a working decoder when available.
- Repairs browser-unfriendly xHE-AAC by re-encoding to AAC-LC.
- Uses lossless remuxing when audio re-encoding is unnecessary.
- Verifies full audio decode to EOF after repair.
- Verifies random-access decoding at every chapter start.
- Verifies chapter count, titles, start/end times, and bounds.
- Verifies faststart layout and rejects fragmented output.
- Preserves standard-mode MP4 user metadata through a `moov.udta` capsule transplant, including native iTunes atoms, repeated freeform Mp3tag values, `chpl` chapter data when present, and embedded cover art.
- Performs distributed stereo-content sampling across up to seven positions before offering an advisory mono downmix choice.
- Supports transactional `--replace` with a no-clobber `.bak` backup.
- Can re-verify and promote an already-created `[Fixed ...]` sibling with `--replace-fixed`.
- Requires no third-party Python packages.

## Requirements

- Python **3.10+**. Tested on 3.10, 3.11, and 3.12.
- `ffmpeg`
- `ffprobe`

### macOS

Homebrew FFmpeg is the primary tested environment. For xHE-AAC/USAC files that FFmpeg's native decoder cannot decode, `m4bcheck` can use the macOS AudioToolbox `aac_at` decoder when that component is present in the installed FFmpeg build.

```bash
brew install ffmpeg
```

Detection and repair have been exercised on Apple silicon with Homebrew FFmpeg against Audible-sourced audiobooks of 19–34 hours and 58–100 chapters, covering xHE-AAC detection and `aac_at` decoder selection, AAC-LC re-encoding, faststart repair of sources whose `moov` atom followed `mdat`, exact `moov.udta` transplantation with chunk-offset adjustment, transactional `--replace`, and `--replace-fixed` promotion.

### Linux

The scan, diagnosis, remux, AAC-LC encode, exact `moov.udta` metadata transplant, full verification gate, and transactional `--replace` workflow have been independently exercised on Linux with FFmpeg 6.1.1. xHE-AAC/USAC repair additionally depends on whether the installed FFmpeg build has a decoder capable of decoding the source stream. `aac_at` is macOS-specific.

### AtomicParsley

AtomicParsley is optional and is not required for the default `--tags standard` mode.

## Quick start

Scan a file:

```bash
python3 m4bcheck.py "/path/to/book.m4b"
```

Scan a directory recursively:

```bash
python3 m4bcheck.py "/path/to/Audiobooks"
```

Scan/report only, without repairing anything:

```bash
python3 m4bcheck.py --dry-run "/path/to/Audiobooks"
```

By default, when repairable files are found, `m4bcheck` shows the diagnosis and asks before making repairs.

## Installing as a personal CLI

Keep the script somewhere stable, make it executable, and symlink it into a directory on your `PATH`:

```bash
chmod +x m4bcheck.py
mkdir -p ~/.local/bin ~/.local/share/m4bcheck
cp m4bcheck.py ~/.local/share/m4bcheck/m4bcheck.py
ln -sf ~/.local/share/m4bcheck/m4bcheck.py ~/.local/bin/m4bcheck
```

Make sure `~/.local/bin` is on your `PATH`, then:

```bash
m4bcheck --version
m4bcheck --help
```

## Common workflows

### Safe scan first

```bash
m4bcheck --dry-run "/path/to/Audiobooks"
```

### Repair and write a separate fixed file

```bash
m4bcheck "/path/to/book.m4b"
```

The default output suffix describes the repair, for example:

```text
Book [Fixed 64k mono].m4b
```

### Repair and replace the original, retaining a backup

```bash
m4bcheck --replace "/path/to/book.m4b"
```

The repaired file takes the original filename only after verification succeeds. The original is retained as:

```text
Book.m4b.bak
```

Existing `.bak` files are never silently overwritten. Likewise, normal non-replacement repair refuses to overwrite an existing `[Fixed ...]` output and exits with an error instead of skipping or clobbering it.

### Promote an already-created fixed sibling

If you already have both:

```text
Book.m4b
Book [Fixed 64k mono].m4b
```

run:

```bash
m4bcheck --replace-fixed "/path/to/book.m4b"
```

`m4bcheck` re-runs the full verification gate against the fixed sibling, creates `Book.m4b.bak`, and only then promotes the verified fixed file to `Book.m4b`. Other repairable books are not encoded by `--replace-fixed`. Candidates with associated sidecars are refused rather than promoted, avoiding orphaned metadata or artwork files.

### Explicit mono downmix

```bash
m4bcheck --mono "/path/to/book.m4b"
```

An explicit mono repair defaults to **64 kbps AAC-LC** unless another bitrate is supplied with `--bitrate`.

Stereo/mono analysis is advisory. Distributed sampling reduces the chance of missing isolated stereo material, such as a song or publisher bumper, but it is not proof that every second of a long audiobook is mono.

### Skip distributed stereo analysis

```bash
m4bcheck --quick "/path/to/Audiobooks"
```

## Verification gate

Before any repaired file is committed, the applicable verification checks include:

- AAC-LC codec/profile for encoded output
- expected channel count
- preserved audio duration
- agreement between audio and container duration
- exact chapter count, titles, starts, and ends within tolerance
- chapter bounds
- `moov` before `mdat` (faststart)
- non-fragmented MP4 output
- metadata preservation
- embedded cover preservation when expected
- complete audio decode to EOF
- decoded PCM after seeking to every chapter start

A staged repair is not moved to its final pathname unless mandatory verification passes.

## Metadata behavior

The default mode is:

```bash
--tags standard
```

Rather than reconstructing tags from ffprobe's simplified metadata dictionary, standard mode preserves the source MP4 `moov.udta` user-data capsule and transplants it into the repaired file. This preserves metadata structures that ffprobe cannot represent faithfully, including repeated freeform values and native iTunes atoms used by tools such as Mp3tag.

The muxer-owned encoder atom is intentionally regenerated. `--no-cover` intentionally removes embedded cover art.

An alternate `--tags qt` mode uses FFmpeg's QuickTime metadata representation and may create sidecars for metadata or artwork that cannot be represented safely in-file. Standard mode is recommended for normal audiobook use.

## Important options

```text
-b, --bitrate RATE      target audio bitrate (default 96k; explicit mono defaults to 64k)
-m, --mono              explicitly downmix re-encoded files to mono
--encoder aac|aac_at    output AAC encoder (default: aac)
-o, --outdir DIR        write repaired files under another directory
--suffix TEXT           choose the fixed-output suffix
--replace               replace verified originals while retaining .bak
--replace-fixed         promote verified [Fixed ...] siblings, retaining .bak
-y, --yes               repair without prompting
-n, --dry-run           scan/report only
-q, --quick             skip distributed stereo-content analysis
-f, --force-encode      encode a file that would otherwise only need remuxing
--tags standard|qt      metadata preservation mode
--no-cover              omit cover art
--flat                  do not recurse into subdirectories
--version               print the version
```

Run `m4bcheck --help` for the authoritative option list.

## Exit codes

- `0` — healthy input or successful repair
- `1` — operational/repair failure
- `2` — undecodable input
- `3` — input flagged for manual attention

## Safety notes

`m4bcheck` is intentionally conservative. It does not try to invent chapter data or guess how corrupted metadata should be reconstructed. Conditions that cannot be repaired confidently are flagged for manual attention instead.

`--replace` and `--replace-fixed` retain the original as `.bak`, but you should still keep independent backups of important media and test repaired books in your actual player/library before deleting those backups.

The verification gate decodes at every chapter start, but that is a proxy for the behavior you actually care about. Before deleting backups, open a repaired book in your player and jump to several chapter marks, confirming playback starts at the chapter rather than resetting to 00:00.

`m4bcheck` does not decrypt DRM-protected audiobooks.

## License

MIT. See the repository-level `LICENSE` file.
