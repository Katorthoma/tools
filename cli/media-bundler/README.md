# media-bundler

`media-bundler` is a conservative command-line utility for grouping media files and their related sidecars into dated folders. It is designed for flat export directories where one media file acts as the anchor for artwork, alternate encodes, metadata, notes, or other files that share the same base name.

Current version: **1.0.0**

## Why media-bundler exists

The original workflow was simple: find each WAV file, derive a date from it, create a folder such as `Amor Fati (2024-07-07)`, and move `Amor Fati.wav` plus same-named supporting files into that folder.

`media-bundler` generalizes that idea while making it safer. It supports multiple anchor formats, optional prefix-based sidecar matching, recursive scans, explicit date-source selection, deterministic planning, collision detection, and per-bundle rollback.

The workflow is intentionally conservative:

```text
discover -> plan -> preflight -> commit
```

Dry run is the default. No filesystem changes are made unless `--execute` is supplied.

## Highlights

- Uses `.wav` as the default anchor format.
- Supports multiple ordered anchor formats such as WAV, FLAC, and AIFF.
- Groups same-stem anchor files into one logical bundle instead of processing them independently.
- Matches sidecars by exact basename by default.
- Offers optional prefix matching for files such as `Song-cover.png` or `Song notes.txt`.
- Gives exact stem matches priority and uses the longest applicable anchor stem for prefix matches.
- Uses filesystem creation/birth time when available, with explicit controls for fallback behavior.
- Prunes previously generated `Name (YYYY-MM-DD)` directories during recursive scans.
- Ignores common metadata files such as `.DS_Store`, `Thumbs.db`, `desktop.ini`, and macOS AppleDouble `._*` files.
- Refuses symlink targets and symlink source files rather than following them implicitly.
- Preflights all planned bundles before making any filesystem changes.
- Never merges, overwrites, or silently renames an existing destination.
- Commits each bundle as a unit and attempts rollback if a move fails partway through.
- Requires no third-party Python packages.

## Requirements

- Python **3.10+**
- macOS, Linux, or Windows with a filesystem accessible through Python's standard library

The 3.10+ baseline is intentional and matches the supported Python baseline used by other Python utilities in this repository.

## Quick start

Preview a directory using WAV files as anchors:

```bash
python3 media_bundler.py "/path/to/exports"
```

Actually perform the planned moves:

```bash
python3 media_bundler.py "/path/to/exports" --execute
```

Use multiple anchor formats, ordered by priority:

```bash
python3 media_bundler.py "/path/to/audio" --anchor wav,flac,aiff
```

Scan recursively:

```bash
python3 media_bundler.py "/path/to/projects" --anchor wav,flac,aiff --recursive
```

Include prefix-named sidecars:

```bash
python3 media_bundler.py "/path/to/projects" --match prefix
```

## Example

> **Note:** Bare `media-bundler` commands below assume the script has been installed on your `PATH` as described in [Installing as a personal CLI](#installing-as-a-personal-cli). Until then, substitute `python3 media_bundler.py`.

Given:

```text
Amor Fati.wav
Amor Fati.flac
Amor Fati.png
Another Song.wav
Another Song-cover.png
```

this command:

```bash
media-bundler . --anchor wav,flac --match prefix
```

previews bundles such as:

```text
Amor Fati (2024-07-07)/
    Amor Fati.wav
    Amor Fati.flac
    Amor Fati.png

Another Song (2024-07-11)/
    Another Song.wav
    Another Song-cover.png
```

If both `Amor Fati.wav` and `Amor Fati.flac` exist and the anchors were supplied as `wav,flac`, the WAV is the preferred anchor and determines the bundle date.

## Installing as a personal CLI

Keep the script somewhere stable, make it executable, and symlink it into a directory on your `PATH`:

```bash
chmod +x media_bundler.py
mkdir -p ~/.local/bin ~/.local/share/media-bundler
cp media_bundler.py ~/.local/share/media-bundler/media_bundler.py
ln -sf ~/.local/share/media-bundler/media_bundler.py ~/.local/bin/media-bundler
```

Make sure `~/.local/bin` is on your `PATH`, then:

```bash
media-bundler --version
media-bundler --help
```

The CLI intentionally presents its program name as `media-bundler` even when the Python file is invoked directly.

## Anchor behavior

Anchor extensions are ordered by priority:

```bash
media-bundler . --anchor wav,flac,aiff
```

For files that share a case-insensitive stem, all configured anchor files form one logical `AnchorGroup`. The highest-priority anchor becomes the preferred anchor.

For example:

```text
Track.wav
Track.FLAC
Track.png
```

forms one bundle when both `wav` and `flac` are configured. This also prevents duplicate processing on case-sensitive filesystems when separate anchor files differ only by extension or filename case.

`--anchor` may be repeated or supplied as a comma-separated list:

```bash
media-bundler . --anchor wav --anchor flac,aiff
```

Leading dots are optional, so `.wav` and `wav` are equivalent.

## Sidecar matching

### Exact mode

Exact matching is the default:

```bash
media-bundler . --match exact
```

An anchor named:

```text
Amor Fati.wav
```

will claim files such as:

```text
Amor Fati.png
Amor Fati.mp3
Amor Fati.json
```

but not:

```text
Amor Fati-cover.png
Amor Fati Notes.txt
```

### Prefix mode

Prefix matching allows a sidecar stem to begin with the anchor stem when the next character is a recognized separator:

```bash
media-bundler . --match prefix
```

Recognized boundaries are:

```text
space  -  _  .  (  [  {
```

This can match files such as:

```text
Amor Fati-cover.png
Amor Fati_notes.txt
Amor Fati.master.mp3
Amor Fati (lyrics).txt
```

Exact matches always win. If several anchors could claim a prefix sidecar, the longest matching anchor stem wins. For example, with anchors `Song.wav` and `Song Extended.wav`, `Song Extended-cover.png` belongs to `Song Extended` rather than `Song`.

## Date sources

The folder name uses an ISO 8601 calendar date:

```text
Name (YYYY-MM-DD)
```

Select the source with:

```text
--date-source auto
--date-source created
--date-source modified
```

### `auto` (default)

Uses filesystem creation/birth time when Python exposes it:

- macOS/BSD: `st_birthtime`
- Windows: creation time via `st_ctime`
- other platforms: modification time when creation/birth time is unavailable

When `auto` falls back to modification time, the dry-run output reports that fallback explicitly.

### `created`

Requires an actual filesystem creation/birth time. If one is unavailable, the plan fails instead of silently substituting another timestamp.

### `modified`

Always uses the file's modification time.

Dates are formatted using the machine's local time zone.

## Recursive scans and re-runs

Use:

```bash
media-bundler "/path/to/projects" --recursive
```

Directories whose names already end in ` (YYYY-MM-DD)` are pruned from recursive traversal. This prevents previously generated bundles from being scanned and nested again on later runs.

A re-run against an already-organized tree therefore leaves existing generated bundle directories alone.

## Explicit file targets

You may target an individual anchor file rather than a directory:

```bash
media-bundler "/path/to/Amor Fati.wav"
```

The file must have one of the configured anchor extensions. Its logical anchor group and matching sidecars are discovered from its parent directory.

## Safety model

`media-bundler` favors refusing ambiguous filesystem states over guessing.

### Dry run by default

Without `--execute`, it prints the complete plan and makes no changes:

```bash
media-bundler "/path/to/exports"
```

Execution must be requested explicitly:

```bash
media-bundler "/path/to/exports" --execute
```

### Preflight before mutation

Before execution begins, the utility checks the complete plan for conditions including:

- duplicate destination paths
- existing destination directories
- source files claimed by more than one bundle
- missing or changed source files
- symlink sources
- sources outside their expected bundle directory
- destinations outside their source directory
- target-file collisions

If preflight fails, no planned bundle is committed.

### Existing destinations are never merged

Unlike the original WAV organizer, `media-bundler` does **not** resolve collisions by inventing names such as `file (1).wav`.

If a destination such as:

```text
Amor Fati (2024-07-07)/
```

already exists, preflight stops with an error. The utility never merges into it, overwrites it, or silently changes the naming scheme.

This is deliberate. An existing destination can indicate prior output, a manually created directory, restored source files, or another filesystem state that deserves review rather than an automatic guess.

### Per-bundle rollback

A bundle is committed using same-directory filesystem renames. If a move fails partway through, `media-bundler` attempts to move already-moved files back to their original names and remove the empty destination directory.

Rollback is **per bundle**. Bundles successfully completed earlier in the same execution are not rolled back if a later bundle fails.

The use of `Path.rename()` relies on an intentional invariant: every destination is created directly beneath the source files' existing directory, so the moves remain on the same filesystem. If a future version allows arbitrary output directories, that assumption must be revisited.

## Important options

```text
--anchor EXT[,EXT...]       anchor extension(s), ordered by priority (default: wav)
--match exact|prefix        sidecar matching mode (default: exact)
--date-source SOURCE        auto, created, or modified (default: auto)
-r, --recursive             recurse into subdirectories
--execute                   commit the planned moves; default is dry run
--version                   print the version
```

Run `media-bundler --help` for the authoritative option list.

## Exit codes

- `0` — successful dry run, no matching anchors, or successful execution
- `1` — argument-independent operational or filesystem failure
- `2` — command-line usage/argument error reported by `argparse`

## Design notes

`media-bundler` is intentionally small and standard-library-only. Its safety model is more important than automatically resolving every unusual filesystem state.

The tool discovers all relevant files first, builds deterministic bundle plans, validates those plans globally, and only then performs requested moves. It does not follow symlinks, merge into existing outputs, infer alternate collision names, or quietly substitute creation dates when `--date-source created` was explicitly requested.

## License

MIT. See the repository-level `LICENSE` file.
