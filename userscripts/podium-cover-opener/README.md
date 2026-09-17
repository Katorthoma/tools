# Podium Hi-Res Cover Opener

A userscript that adds a small expand control to audiobook cover art on Podium Entertainment and opens the direct, non-Next.js-resized cover image in a background tab.

It is intended for people who want the cleanest cover asset Podium exposes without manually inspecting `src`, `srcset`, or `/_next/image` URLs.

## Features

- Adds an unobtrusive expand button to supported Podium cover art
- Works on title pages and dynamically rendered cover listings
- Opens the direct cover asset in a background tab
- Removes Podium's Next.js image-resizing wrapper instead of downloading the displayed derivative
- Promotes listing-card `/small/direct_cover_art/` paths to Podium's `/medium/direct_cover_art/` asset path
- Marks covers you have already opened with a small check indicator
- Stores opened-cover history in userscript-manager private storage
- Handles dynamically inserted or updated images
- Restricts opened URLs to Podium's HTTPS cover-asset host
- Makes no API or cross-origin XHR/fetch request

## Installation

A userscript manager is required.

Recommended:

- Tampermonkey
- Violentmonkey

**Install:** [Podium-Hi-Res-Cover-Opener.user.js](https://raw.githubusercontent.com/Katorthoma/tools/main/userscripts/podium-cover-opener/Podium-Hi-Res-Cover-Opener.user.js)

If your userscript manager does not automatically offer to install the file, open the raw script and install it manually through your manager.

## Usage

1. Browse [Podium Entertainment](https://podiumentertainment.com/) normally.
2. Look for the semi-transparent expand button in the upper-right corner of supported cover art.
3. Click the button.
4. The direct Podium cover asset opens in a background tab.
5. After a successful open, the button receives a small checkmark so you can see which covers you have already opened.

The expand button remains visible at low opacity and becomes more prominent on hover.

## How It Works

Podium commonly serves cover artwork through a Next.js image URL similar to:

```text
/_next/image?url=https%3A%2F%2Fassets.podiumentertainment.com%2Fmedium%2Fdirect_cover_art%2F9781039499751.jpg&w=1080&q=75
```

The userscript extracts the embedded source URL and opens the direct asset instead:

```text
https://assets.podiumentertainment.com/medium/direct_cover_art/9781039499751.jpg
```

For listing cards that expose a `/small/direct_cover_art/` asset, the script substitutes Podium's `/medium/direct_cover_art/` path before opening it.

This does **not** upscale artwork or invent a larger image. It opens the direct cover asset Podium exposes through its site structure, without the browser-facing Next.js resize and quality parameters.

## Privacy

The script has a deliberately small network and storage surface.

### Network behavior

The script does not call an API and does not perform cross-origin `fetch` or `GM_xmlhttpRequest` requests.

When you click the expand button, your browser opens the validated direct image URL on:

```text
https://assets.podiumentertainment.com/
```

No image request is made by the script before you explicitly click the button beyond the images Podium itself already loads as part of the page.

### Stored data

The script stores only whether a particular cover identifier has previously been opened.

That state is kept in userscript-manager private storage rather than Podium page storage, so normal Podium page scripts cannot read it.

The script does not store:

- Cover image contents
- Podium account credentials
- Book descriptions, authors, narrators, or other title metadata
- General browsing history

## Permissions

The userscript requests only the permissions needed for background-tab opening and private opened-state history.

| Permission | Purpose |
| --- | --- |
| `GM_openInTab` | Open the direct cover image in a background tab |
| `GM_getValue` | Read private opened-cover history |
| `GM_setValue` | Save private opened-cover history |
| `@noframes` | Prevent unnecessary execution inside frames |

The script runs only on:

```text
https://podiumentertainment.com/*
https://www.podiumentertainment.com/*
```

It does **not** request `GM_xmlhttpRequest` or an `@connect` permission.

## Security

Image URLs are treated as untrusted input even though they originate from Podium's page markup.

Before a cover is opened, the script requires all of the following:

- HTTPS
- Hostname exactly `assets.podiumentertainment.com`
- A path containing `/direct_cover_art/`
- A supported image extension (`.jpg`, `.jpeg`, `.png`, or `.webp`)

Next.js image URLs are unwrapped only when they originate from the current Podium site.

## Compatibility

Primary target:

- Podium Entertainment (`podiumentertainment.com`)
- Desktop browsers
- Tampermonkey or Violentmonkey

The script watches for dynamically inserted images and `src`/`srcset` changes, which helps it work with Podium's Next.js-rendered pages.

Podium can change its site structure or asset paths at any time, so future site changes may require selector or URL-handling updates.

## Limitations

- The script opens the best direct cover path it can derive from Podium's own markup; it does not probe undocumented asset sizes.
- A `/small/direct_cover_art/` path is promoted to `/medium/direct_cover_art/` because Podium title pages expose the medium path. If Podium changes that convention, the mapping may need adjustment.
- Background-tab behavior depends on userscript-manager support for `GM_openInTab`.

## Troubleshooting

### The expand button does not appear

Reload the page after installing or updating the userscript.

If it still does not appear, Podium may have changed the way it renders cover images, or the image may not resolve to a validated `direct_cover_art` asset.

### Clicking the button does nothing

Confirm that your userscript manager supports `GM_openInTab` and that the script is enabled for Podium Entertainment.

### The image is not larger than the displayed cover

The script removes Podium's Next.js resize wrapper and opens the direct asset, but the direct source itself may not be larger than what Podium already displayed. The script does not upscale images.

### Debugging

The script contains:

```js
const DEBUG = false;
```

Changing it to `true` enables diagnostic console messages.

## Updating

The userscript includes GitHub `@updateURL` and `@downloadURL` metadata. Compatible userscript managers can check the raw GitHub-hosted script for updates automatically after it is installed from this repository path.

## Project Status

This is a personal utility shared in case it is useful to others.

Podium Entertainment is not affiliated with this project, and Podium may change its website or asset behavior without notice. Maintenance and backwards compatibility are not guaranteed.

Bug reports and useful fixes are welcome.

## License

Released under the [MIT License](../../LICENSE).

Copyright (c) 2026 Katorthoma

## Disclaimer

This is an unofficial third-party userscript. It is not affiliated with, endorsed by, or supported by Podium Entertainment.

Podium Entertainment and related names and trademarks belong to their respective owners.
