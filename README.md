<h1>
  Slate
  <a href="https://github.com/mlemors/slate/releases/latest">
    <img alt="Latest release" src="https://img.shields.io/github/v/release/mlemors/slate?display_name=tag&style=for-the-badge&label=Download&logo=github">
  </a>
</h1>

Slate is a discreet browser extension for Chromium-based browsers. It checks the current browser profile against curated domain lists and removes matching history entries with one click. Matching cookies can be removed optionally.

![Slate settings](assets/preview.png)

## Features

- One-click cleanup from the extension icon
- Individually switchable lists from HaGeZi and Block List Project
- Custom HTTPS filter lists with their own update status
- Custom blacklist and prioritized whitelist
- Optional cookie cleanup with optional permissions
- Manual, hourly, six-hourly or daily checks
- Local processing without analytics
- Badge counts affected domains, not individual URLs or cookies

## Installation from a GitHub release

1. Open the repository's [Releases](https://github.com/mlemors/slate/releases) page.
2. Download and extract the latest ZIP.
3. Open `brave://extensions` or `chrome://extensions`.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the extracted folder.

Keep the extracted folder in place because the browser loads the extension directly from it.

## Installation from source

Clone this repository, open the browser's extension page, enable Developer mode and load the repository folder as an unpacked extension.

## Usage

Click the Slate icon to clean matching history entries. Open the icon's context menu and choose **Slate: Einstellungen und Status** to manage scans, sources, cookie cleanup, blacklist and whitelist.

Cookie cleanup is disabled by default. Enabling it triggers the browser's permission prompt and may sign you out of matching sites.

## Privacy and limitations

History, cookies and custom rules are processed locally. Public and user-added lists are downloaded from their configured provider, which receives normal connection data such as the IP address. Slate does not use analytics or transmit browser data. See [PRIVACY.md](PRIVACY.md) for details.

Public lists can contain errors and cannot cover every site. Slate does not clear cache, Local Storage, downloads, bookmarks, open tabs or other browser profiles. Deletion cannot be undone.

## Development

Node.js 22 or newer is required. No package installation is needed.

```sh
npm test
npm run build
```

The release ZIP is written to `dist/` and uses the version from `manifest.json`.

## Third-party lists and licenses

- [HaGeZi DNS Blocklists](https://github.com/hagezi/dns-blocklists), `nsfw-onlydomains.txt`, GPL-3.0
- [Block List Project](https://github.com/blocklistproject/Lists), `porn.txt`, Unlicense; the delivered list header also mentions MIT

License texts and attribution are included in [`licenses/`](licenses/). Slate's original source code is licensed under the [MIT License](LICENSE).
