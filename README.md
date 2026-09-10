# LaTale Boss Loot & Title Tracker

Initial GitHub Pages project generated from `LT Boss Matts Tracker.xlsx`.

- 56 dungeon records
- 78 title records
- Loot, Codex, title-material and badge data normalized into `assets/data.js`
- Title quantities and completion states saved in browser `localStorage`
- Level filter categories mirror the supplied Apps Script

## Deploy
Upload these files to a GitHub repository, then enable **Settings → Pages → Deploy from a branch → main / root**.

## Data source
This first build is a static workbook snapshot. The next data-handling iteration can replace `assets/data.js` with a Google Sheet CSV/JSON loader so the Google Sheet remains the source of truth.
