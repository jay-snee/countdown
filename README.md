# Countdown

A minimal, full-screen countdown page with rotating quotes, served by GitHub Pages at
<https://snee.io/countdown/>. Plain HTML/CSS/JS: no framework, no build step, no external requests.

- `index.html`, `style.css`, `app.js`: the page
- `config.json`: target time and wording
- `quotes.json`: the quotes that rotate
- `.nojekyll`: tells GitHub Pages to serve files as-is

## Editing quotes

Open `quotes.json` in GitHub, click the pencil icon, edit, and commit. The format is a JSON list:

```json
[
  { "text": "The quote itself.", "author": "Who said it" },
  { "text": "A quote with no attribution line." }
]
```

`author` is optional; leave it out (or empty) to hide the attribution. Watch the commas and
quotes: if the file isn't valid JSON, the page shows a single fallback line instead (the countdown
keeps working).

## Editing the config

`config.json`:

| Key | Meaning |
| --- | --- |
| `target` | The moment the countdown reaches zero, as a UTC timestamp ending in `Z` (e.g. `2026-10-01T08:30:00Z` is 09:30 BST). |
| `targetLabel` | Human-readable label shown under the counter. |
| `zeroMessage` | Shown (fading in) when the countdown hits zero. |
| `quoteIntervalSeconds` | Seconds each quote stays up (minimum 2). |

## When changes go live

GitHub Pages redeploys about a minute after a commit (see the repo's Actions tab). The page fetches
`quotes.json` and `config.json` with `no-store`, so a reload picks them up straight away. Browsers
may cache the other files (HTML/CSS/JS) for up to 10 minutes; a hard refresh gets around that.

## Local preview

```sh
cd ..                      # the folder containing countdown/
python3 -m http.server 8000
```

Then open <http://localhost:8000/countdown/>. (Opening `index.html` directly from disk won't load the
JSON files; it needs a server.)

Testing hook: `window.__countdown.remainingMs()` returns the milliseconds left (0 once finished).
