# LaTale Dungeon Tracker

Compact GitHub Pages dungeon browser generated from the Google Sheet **LT Boss Matts Tracker**.

Current generated snapshot:

- 132 dungeons
- 78 title records
- Entry limits sourced from the `Entry Number per Day` row
- Drop, Codex, title-material, badge-material, and Codex-equipment rows merged into each dungeon card
- Codex equipment is normalized to the `(Equipment)` item tag
- Items that are Codexable and/or title materials appear before regular drops

## Deploy to GitHub Pages

Keep `index.html` in the repository root and keep the JS/CSS files in `assets/`.

Enable **Settings → Pages → Deploy from a branch → main → / (root)**.

## Automatic Google Sheet sync

The repository includes:

- `scripts/sync_sheet.py` — downloads the public `Dungeon Boss Material` tab and regenerates `assets/data.js`
- `.github/workflows/sync-sheet.yml` — runs the sync every 6 hours and can also be run manually

### Requirements

The Google Sheet must be viewable without signing in (for example **Anyone with the link → Viewer**). The sync uses the public CSV export endpoint and does not need a Google API key.

### Test it after upload

1. Upload the complete project to GitHub, including the hidden `.github` folder and `scripts` folder.
2. Open the repository's **Actions** tab.
3. Select **Sync Google Sheet**.
4. Choose **Run workflow**.
5. When the run finishes, `assets/data.js` should either be updated automatically or the log will say there were no sheet changes.

If the workflow can read the sheet but cannot push the update, check **Settings → Actions → General → Workflow permissions** and allow GitHub Actions to have read/write repository permissions.

The scheduled workflow uses `17 */6 * * *`, meaning it checks about every 6 hours. Edit the `cron` line in `.github/workflows/sync-sheet.yml` if you want a different interval.

## Source layout

The sync script expects the source tab to remain named `Dungeon Boss Material` and identifies important rows by their labels (`Dng Name`, `Entry Number per Day`, `Drop 1`, `Codexable Battle Equipment`, `Title`, and so on). Adding new dungeon columns is supported automatically.

## Build v6 data rules
- Dungeon list includes all levels from the source sheet, including Lv. 1–199.
- Items from `Codexable Battle Equipment` are normalized to `(Equipment)`.
- Items from `Badge 5 Mats` are stored separately and displayed with `Badge 5 ✓`.
- Card order: Equipment → Event Codex → Event Title → all other drops.
- Automatic sync uses `.github/workflows/sync-sheet.yml` and `scripts/sync_sheet.py`.


### Entry-limit exceptions
Unknown Forest and Unknown Beach are displayed as **1 entry/day/account**. The sync script preserves this account-wide limit on every regeneration.


## Title Tracker (v11.3)

Open `titles.html` for the title-material progress tracker. Current material counts and completion states are saved in the visitor's browser; synced title definitions still come from `assets/data.js`.


## Build v11.4
Title Tracker uses a compact six-column table with stacked material progress rows and Event/ETC type badges.


## V13.5
Titles marked in the Google Sheet row `Instance Dungeon Guaranteed Titlebook Coupon II` display `assets/title-coupon.png` beside the title name.


## V13.7 data source policy

The website sync uses **Dungeon Boss Material** as the only Google Sheet source for both dungeon and title data. The separate **Title Tracker** tab is not read by `scripts/sync_sheet.py`.


### V13.7.1
Titles are parsed independently of dungeon presence, so reputation/exchange-only titles are retained. The dedicated Ely row is also synced as `elyRequired`.


### V13.7.2 notes
- Dungeon Boss Material remains the single source of truth.
- Flexible Ely row detection supports Ely / Ely Required / Ely Requirement.
- Adjacent title columns can represent multiple titlebooks for one dungeon; for best reliability, repeat Dungeon Name and Dungeon Lv in each title column.
- Multiple Title Sets render as `Title Set 1 | Title Set 2`.

## Monster Illustration tracking (v13.8)
The Dungeons tab includes per-dungeon Monster Illustration checklists sourced from the Official La Tale Wiki Monster Illustrations page. Progress is saved locally in the browser under a separate localStorage key from Codex progress.

Data snapshot source: https://latale.wiki.gg/wiki/Monster_Illustrations

## Monster Illustration sync

`assets/monster-illustrations.js` is refreshed from the Official La Tale Wiki by `.github/workflows/sync-monster-illustrations.yml` once per day at 03:37 UTC and can also be run manually from GitHub Actions. The job only commits when the parsed illustration list changes. If the wiki/API cannot be parsed, the script fails without replacing the existing snapshot.


## Page structure (v13.9.4.2)

- `index.html` — tutorial/disclaimer landing page
- `dungeons.html` — dungeon tracker
- `titles.html` — title tracker

GitHub Pages will open the tutorial first at the repository root.


## v13.9.4.11
Full bundle preserves the rowspan-aware Monster Illustration sync and includes current Forgotten Garden and Ymir Institute mappings. The Monster Illustration workflow also refreshes when its sync script/workflow is updated.


## v13.9.4.13
- Replaced the site favicon and header brand icon with the new purple icon.
- Bumped favicon cache keys so browsers fetch the new artwork immediately.


## v13.9.4.16
- Replaced the favicon with the user-provided purple icon.
- Browser favicon now points directly to root `favicon.ico` with a new cache-busting version.
- Header brand icon uses `assets/favicon-purple.png` so no legacy favicon file can appear there.
