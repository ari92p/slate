# Chrome Web Store listing

Everything needed to submit Slate in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Upload `dist/slate-v<version>.zip` from `npm run build`.

## Store listing tab

**Name** (from the manifest): Slate

**Summary** (from the manifest, 132 characters max): Private browser history cleanup with customizable domain lists.

**Category:** Privacy & Security

**Language:** English

**Description:**

```
Slate removes visits to adult websites from your browser history with one click, quietly and locally.

It checks the history of the current browser profile against two public blocklists, HaGeZi and Block List Project, plus any rules you add. The toolbar icon shows a small slate: chalk writing means there is something to clean, a tick means your history is clean. Click the icon, and Slate deletes every matching history entry.

What Slate does
• Cleans matching history entries with one click on the toolbar icon
• Recognizes new matching visits as they happen, including pages that redirect elsewhere
• Removes the address bar suggestions the browser learned for the start pages of cleaned sites
• Optionally deletes matching cookies too (off by default; the permission is only requested when you turn it on)
• Lets you add your own HTTPS filter lists, and your own domains to always or never clean
• Checks at browser start, or hourly, every 6 or 12 hours, or daily
• Light and dark appearance

Private by design
• Everything happens inside your browser. No account, no server, no analytics, no tracking.
• Slate never sends your history, cookies or rules anywhere. It only downloads the public lists.
• Open source: https://github.com/ari92p/slate

Limits
Lists are never complete and can contain mistakes. Slate does not clear search queries, cache, downloads, bookmarks, open tabs or other browser profiles. Deletions cannot be undone.
```

**Graphics** (files in this folder):

| Field | File |
|---|---|
| Store icon (128×128) | `../icons/slate-128.png` |
| Screenshots (1280×800) | `screenshot-1-findings.png`, `screenshot-2-cleaned-dark.png`, `screenshot-3-settings.png` |
| Small promo tile (440×280) | `promo-small-440x280.png` (source: `promo-small.html`) |

**Official URL / Homepage:** https://github.com/ari92p/slate

**Support URL:** https://github.com/ari92p/slate/issues

**Mature content:** leave unchecked. Slate shows no adult content; it only matches domain names.

## Privacy practices tab

**Single purpose:**

```
Slate removes browsing-history entries, and optionally cookies, of websites listed on public adult-content blocklists from the current browser profile.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| `history` | Slate's single purpose is to find and delete history entries of listed websites. It searches the history, listens for new visits to recognize matches as they happen, and deletes matching entries. |
| `storage` | Keeps the user's settings, own rules, the downloaded blocklists and a summary of the last check locally. |
| `unlimitedStorage` | The two bundled blocklists contain about one million domains (about 26 MB of text); updated copies are stored locally and exceed the default storage quota. |
| `alarms` | Runs the optional scheduled checks the user selects and the daily update of the blocklists. |
| `contextMenus` | Adds "Slate: Settings and status" to the toolbar icon's menu, because clicking the icon itself starts a cleanup. |
| `cookies` (optional) | Requested only when the user turns on "Also delete matching cookies", to find and delete cookies of listed websites. |
| Host permission `https://raw.githubusercontent.com/*` | Downloads updates of the two bundled blocklists, which are hosted on GitHub. Only the list text is downloaded; no user data is sent. |
| Optional host permissions `http://*/*`, `https://*/*` | Requested only when the user enables cookie cleanup (cookies of any listed website can then be read and deleted) or adds a custom filter list (access to that list's address only). |

**Remote code:** No, I am not using remote code. (The blocklists are plain text data; Slate never runs downloaded code.)

**Data usage:**

- Check **Web history**. Slate reads the browsing history to do its job; the data never leaves the device.
- Leave every other category unchecked.
- Certify all three statements: no selling or transferring of user data to third parties, no use for unrelated purposes, no use for creditworthiness or lending.

**Privacy policy URL:** https://github.com/ari92p/slate/blob/main/PRIVACY.md

## Distribution tab

- Visibility: Public (or Unlisted to test the store version first)
- Regions: all regions

## Submitting

1. Sign in at the Developer Dashboard with the Google account that should own the listing and pay the one-time registration fee.
2. Click **New item** and upload the ZIP.
3. Fill in the three tabs above, then **Submit for review**.
4. Review usually takes a few days. Extensions with the `history` permission and broad optional host permissions are reviewed more closely; the justifications above address that.
