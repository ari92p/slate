# Privacy policy

_Last updated: October 20, 2026_

Slate is a browser extension that removes history entries of domains found on public adult-content blocklists. Everything happens inside your browser. Slate has no server, no account, no analytics and no tracking.

## What Slate reads

- **Browsing history of the current browser profile**, to find visits to domains on the active lists and your own rules. Slate also listens for new visits so that it can recognize matches, including the start of redirects, as they happen.
- **Cookies**, only if you turn on "Also delete matching cookies". Slate then reads cookies to find and delete those of matching domains.

## What Slate stores, and where

All of this stays in the extension's local storage in your browser and is never sent anywhere:

- your settings (lists on or off, check schedule, cookie option, light or dark appearance)
- your own rules ("Always clean" and "Never clean")
- the downloaded blocklists and when they were last updated
- a summary of the last check: number of matching domains and entries, time of the check, and the number of entries deleted by the last cleanup
- addresses of matching visits that Slate noticed, until they are cleaned; Slate forgets each address once it has been deleted or no longer exists

Removing the extension deletes this data.

## What Slate changes

Slate deletes history entries and, if enabled, cookies of matching domains when you click its icon or "Clean history". While cleaning, Slate briefly adds and immediately deletes the start pages of the cleaned sites in the history, so that the browser also removes the address bar suggestions it learned for them. If browser sync is turned on, the browser may sync these short-lived entries and their deletion. Deletions cannot be undone.

## Network connections

Slate downloads the public blocklists from GitHub (`raw.githubusercontent.com`) and any filter list you add from the HTTPS address you enter. These providers receive the usual connection data, such as your IP address. Slate sends no history, cookies, rules or other personal data with these requests. Downloaded lists are only read as text; Slate never runs code from the internet.

## Permissions

- `history`: find and delete matching history entries, and notice new visits
- `storage` and `unlimitedStorage`: keep settings, rules and the large blocklists locally
- `alarms`: optional scheduled checks and the daily list update
- `contextMenus`: open the settings from the icon's menu
- access to `raw.githubusercontent.com`: download the bundled lists' updates
- `cookies` and access to all websites: optional, requested only when you turn on cookie cleanup
- access to a filter list's website: optional, requested only when you add that list

## Sharing and selling

Slate does not sell, share or transfer any data. There is no data to share, because nothing leaves your browser.

## Changes and contact

Changes to this policy are published in this repository. Questions: open an issue at <https://github.com/ari92p/slate/issues>.
