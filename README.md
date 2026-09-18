# tools

Small utilities, CLI tools, userscripts, browser helpers, and assorted projects built for my own use and shared in case they're useful to someone else.

The tools here generally favor conservative behavior, explicit actions, and predictable output over clever automation.

## CLI tools

### [m4bcheck](cli/m4bcheck/)

A conservative M4B/M4A audiobook inspector and repair utility.

It checks codec and decoder compatibility, MP4 container layout, chapters, seeking, metadata, artwork, duration, and channel characteristics, then repairs only cases it can verify safely.

Notable features include:

* xHE-AAC/USAC detection and AAC-LC repair
* lossless remuxing for container-only problems
* full decode-to-EOF verification
* random-access verification at every chapter start
* exact chapter verification
* MP4 metadata and embedded artwork preservation
* distributed stereo-content analysis
* transactional `--replace` with `.bak` preservation
* `--replace-fixed` promotion of previously repaired siblings

Current version: **2.2.7**

See the [m4bcheck README](cli/m4bcheck/README.md) for requirements, installation, usage, and safety notes.

### [media-bundler](cli/media-bundler/)

A filesystem utility for grouping media files and their related sidecars into consistently named, date-stamped folders.

An anchor file such as a WAV, FLAC, or AIFF establishes a bundle. Related files with the same basename can then be moved alongside it into a folder such as:

```text
Amor Fati (2024-07-07)/
├── Amor Fati.wav
├── Amor Fati.flac
└── Amor Fati.png
```

Notable features include:

* dry-run behavior by default
* explicit `--execute` required for filesystem changes
* configurable anchor formats and priority
* exact or prefix-based sidecar matching
* longest-prefix matching for overlapping filenames
* filesystem creation or modification date selection
* recursive scanning with previously bundled directories pruned
* full preflight validation before any filesystem mutation
* destination collision refusal rather than silent overwriting or renaming
* per-bundle rollback if a move fails
* symlink rejection and macOS metadata-file handling
* no third-party Python dependencies

Current version: **1.0.0**

See the [media-bundler README](cli/media-bundler/README.md) for usage, matching rules, date behavior, installation, and safety notes.

## Userscripts

### [Audible Cover Opener](userscripts/audible-cover-opener/)

Browser userscript for opening higher-resolution Audible cover artwork.

### [Podium Cover Opener](userscripts/podium-cover-opener/)

Browser userscript for opening higher-resolution Podium audiobook cover artwork.

## Repository structure

```text
tools/
├── cli/
│   ├── m4bcheck/
│   └── media-bundler/
└── userscripts/
    ├── audible-cover-opener/
    └── podium-cover-opener/
```

The repository is organized primarily by tool type rather than implementation language. Individual tools keep their own documentation and changelogs where appropriate.

## License

MIT. See [LICENSE](LICENSE).
