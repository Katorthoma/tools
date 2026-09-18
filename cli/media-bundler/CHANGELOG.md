# Changelog

## [1.0.0] - 2026-09-17

First public release of `media-bundler`, a generalized and safety-focused successor to the earlier `group_wavs.py` utility.

### Added

- Added WAV-first media bundling into `Name (YYYY-MM-DD)` directories.
- Added ordered multi-anchor support through `--anchor`, including comma-separated and repeated values.
- Added logical grouping of same-stem anchors so multiple configured media formats are bundled once rather than processed independently.
- Added exact sidecar matching as the conservative default.
- Added optional `--match prefix` matching with separator boundaries and longest-anchor-stem precedence.
- Added `--date-source auto|created|modified` with explicit reporting when `auto` falls back to modification time.
- Added recursive scanning with pruning of previously generated dated bundle directories.
- Added explicit single-file targeting.
- Added ignored-file handling for `.DS_Store`, `Thumbs.db`, `desktop.ini`, and macOS AppleDouble `._*` files.
- Added symlink rejection for explicit targets and source files.
- Added deterministic discovery and output ordering.
- Added global preflight validation before any filesystem mutation.
- Added per-bundle transactional moves with rollback on partial failure.
- Added `--version` and a stable `media-bundler` CLI program name.

### Safety behavior

- Dry run is the default. Files are moved only when `--execute` is supplied.
- Existing destination directories are never merged, overwritten, or automatically renamed.
- Target collisions fail loudly instead of generating suffixes such as `(1)` or `(2)`.
- Duplicate source ownership and duplicate destination paths are rejected before execution.
- Destinations are constrained to the source directory, keeping rename operations on the same filesystem.

### Replaces the original WAV-specific script

The earlier `group_wavs.py` implementation established the original workflow but processed each WAV independently and treated every same-stem file as a sidecar. On case-sensitive filesystems, differently cased same-stem WAV anchors could therefore claim one another and cause a later processing pass to encounter a file that had already been moved.

`media-bundler` fixes that class of problem by discovering anchor files first, combining same-stem anchors into a single logical group, and planning each group exactly once.

The rewrite also replaces silent collision renaming with explicit preflight failure, adds true recursive pruning of generated output directories, and introduces rollback for partially completed bundles.
