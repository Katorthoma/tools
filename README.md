# tools

Small utilities, CLI tools, userscripts, browser helpers, and assorted projects built for my own use and shared in case they're useful to someone else.

## CLI tools

### [m4bcheck](cli/m4bcheck/)

A conservative M4B/M4A audiobook inspector and repair utility.

It checks codec and decoder compatibility, MP4 container layout, chapters, seeking, metadata, artwork, duration, and channel characteristics, then repairs only cases it can verify safely.

Notable features include:

- xHE-AAC/USAC detection and AAC-LC repair
- lossless remuxing for container-only problems
- full decode-to-EOF verification
- random-access verification at every chapter start
- exact chapter verification
- MP4 metadata and embedded artwork preservation
- distributed stereo-content analysis
- transactional `--replace` with `.bak` preservation
- `--replace-fixed` promotion of previously repaired siblings

Current version: **2.2.7**

See the [m4bcheck README](cli/m4bcheck/README.md) for requirements, installation, usage, and safety notes.

## Userscripts

### [Audible Cover Opener](userscripts/audible-cover-opener/)

Browser userscript for opening higher-resolution Audible cover artwork.

### [Podium Cover Opener](userscripts/podium-cover-opener/)

Browser userscript for opening higher-resolution Podium audiobook cover artwork.

## Structure

```text
tools/
├── cli/
│   └── m4bcheck/
└── userscripts/
    ├── audible-cover-opener/
    └── podium-cover-opener/
```

The repository is organized primarily by tool type rather than implementation language.

## License

MIT. See [LICENSE](LICENSE).
