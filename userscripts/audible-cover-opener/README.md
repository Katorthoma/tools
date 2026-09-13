# Audible Hi-Res Cover Opener

A userscript that adds a small expand control to Audible audiobook cover art and opens the highest-resolution cover available from Audible's public catalog API.

Built for people who want the original cover artwork without manually inspecting image URLs or guessing Amazon CDN size modifiers.

## Features

- Adds an unobtrusive expand button to Audible audiobook covers
- Works across product, series, author, search, and other audiobook listing pages
- Looks up cover art only when you click the button
- Requests Audible's available `2400`, `1000`, `700`, and `500` image sizes
- Opens the best available cover in a background tab
- Marks covers you have already opened with a small check indicator
- Stores opened-cover history in userscript-manager private storage
- Handles dynamically loaded Audible content
- Restricts opened cover URLs to known HTTPS Amazon image hosts
- Makes no cover API request until you explicitly click a cover button

## Installation

A userscript manager is required.

Recommended:

- Tampermonkey
- Violentmonkey

Install the script directly from:

[Audible-Hi-Res-Cover-Opener.user.js](./Audible-Hi-Res-Cover-Opener.user.js)

If your userscript manager does not automatically prompt to install the file, open the raw file and install it manually through your manager.

## Usage

1. Browse Audible normally.
2. Look for the expand button in the upper-right corner of supported cover art.
3. Click the button.
4. The script queries Audible's catalog API for the available high-resolution artwork.
5. The best available cover opens in a background tab.
6. After a successful open, the cover button receives a small checkmark so you can see which covers you have already opened.

The expand control remains visible at low opacity and becomes more prominent on hover.

## How It Works

Audible pages often display a relatively small Amazon CDN image, such as a 500 px cover. Simply changing the size portion of that image URL does not always reveal the true high-resolution artwork because Audible may use a different underlying Amazon image ID for larger versions.

This script instead:

1. Resolves the audiobook's Audible ASIN from the surrounding page markup.
2. Requests the audiobook's image metadata from Audible's catalog API.
3. Checks available image sizes in this order:

```text
2400
1000
700
500
```

4. Validates the returned image URL.
5. Opens the highest-resolution valid cover.

## Privacy

The script is designed to keep network and storage access narrow.

### Network requests

No catalog request is made until you click a cover's expand button.

When clicked, the script sends the audiobook ASIN to:

```text
https://api.audible.com/
```

The request asks only for Audible's `media` response group and the supported cover sizes.

The script uses `anonymous: true` for userscript-manager HTTP requests where supported. Tampermonkey and Violentmonkey honor this option so Audible session cookies are not sent with the catalog request.

Some userscript managers, including Greasemonkey 4, may ignore `anonymous: true`. If cookie-free catalog requests are important to you, use Tampermonkey or Violentmonkey.

### Stored data

The script stores only whether a particular Audible ASIN has previously had its cover opened.

That history is kept in userscript-manager private storage rather than Audible's `localStorage`, so normal Audible page scripts cannot read it.

The script does not store:

- Cover image contents
- Audible account credentials
- Browsing history beyond the ASINs whose expand buttons you clicked
- Product descriptions, ratings, authors, narrators, or other catalog metadata

## Permissions

The userscript requests the following permissions:

| Permission | Purpose |
| --- | --- |
| `GM_xmlhttpRequest` | Query Audible's public catalog API |
| `GM_openInTab` | Open the high-resolution cover in a background tab |
| `GM_getValue` | Read private opened-cover history |
| `GM_setValue` | Save private opened-cover history |
| `@connect api.audible.com` | Restrict cross-origin userscript requests to Audible's API |
| `@noframes` | Prevent unnecessary execution inside frames |

The script runs only on:

```text
https://www.audible.com/*
```

## Security

Returned image URLs are treated as untrusted input.

Before a cover is opened, the script requires:

- HTTPS
- A known Amazon image hostname

Currently accepted image hosts are:

```text
m.media-amazon.com
images-na.ssl-images-amazon.com
```

The URL is validated both when the API response is parsed and again immediately before the image is opened.

## Compatibility

Primary target:

- Audible US (`audible.com`)
- Desktop browsers
- Tampermonkey or Violentmonkey

The script has been designed around Audible's current product and listing markup. Audible can change its site structure at any time, so future markup changes may require selector updates.

Other Audible regional domains are not currently included in the userscript metadata.

## Troubleshooting

### The expand button does not appear

Reload the page after installing or updating the script.

If it still does not appear, Audible may have changed the page structure or the cover may not expose enough information to resolve its ASIN safely.

The script intentionally prefers no button over associating a cover with the wrong audiobook.

### Clicking the button does nothing

Confirm that your userscript manager supports:

- `GM_xmlhttpRequest`
- `GM_openInTab`

Also verify that the script has permission to connect to `api.audible.com`.

### A cover has no 2400 px image

Not every Audible title has a 2400 px source image. The script falls back through:

```text
2400 -> 1000 -> 700 -> 500
```

It does not upscale smaller artwork.

### Debugging

The script contains:

```js
const DEBUG = false;
```

Changing it to `true` enables diagnostic console messages, including resolved ASIN information.

## Updating

The userscript includes GitHub `@updateURL` and `@downloadURL` metadata. Compatible userscript managers can check the raw GitHub-hosted script for updates automatically.

## Project Status

This is a personal utility shared in case it is useful to others.

Audible is not affiliated with this project, and Audible may change its site or API behavior without notice. Maintenance and backwards compatibility are not guaranteed.

Bug reports and useful fixes are welcome.

## License

Released under the [MIT License](../../LICENSE).

Copyright (c) 2026 Katorthoma

## Disclaimer

This is an unofficial third-party userscript. It is not affiliated with, endorsed by, or supported by Audible, Amazon, or their affiliates.

Audible, Amazon, and related names and trademarks belong to their respective owners.
