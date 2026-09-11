# LaTale Dungeon Tracker — v13.9.4.31

### v13.9.4.31
- Removed the Fields toolbar Monster Illustration / Item Codex legend.
- Added Soprano Snowfield to Jiendia so the current unmapped bucket can disappear.

Static GitHub Pages tracker with shared navigation:

**Fields | Dungeons | Titles | Wiki**

All three tracker pages use the same Light / Dark / System theme control and the same `?` Welcome/Help popup. Light mode uses the pink site accent; Dark mode uses blue. Semantic Illustration Book colors stay consistent: Monster Illustrations are pink and Item Codex is blue.

## Data sources

- Dungeons and Titles: project Google Sheet (`Dungeon Boss Material`)
- Dungeon Monster Illustrations: Official La Tale Wiki
- Fields Monster Illustrations and Item Codex: Official La Tale Wiki

## GitHub Actions

- `Sync Google Sheet`
- `Sync Monster Illustrations`
- `Sync Fields Illustration Data`

After first upload, run **Sync Fields Illustration Data** once (or let its push trigger run) so `assets/field-data.js` is populated from the current wiki. The script preserves the existing snapshot if parsing fails.

Field and Dungeon completion are intentionally stored separately, even when names match.


## Fields regions
The Fields tracker groups map locations into collapsible Jiendia, Freios, Western Freios, and Eastland regions. Unknown wiki locations remain visible under Other / Unmapped.

### v13.9.4.31
- Dungeon Monster Illustration summary returned to the neutral summary-row hierarchy used by Equipment/Title; detailed illustration tracking follows the dynamic theme accent (pink in Light, blue in Dark).
- Titles are grouped in a collapsible **Titles from Dungeons** section.
- Fields Illustration Book popup now mirrors Dungeons with the SHINING Codex disclaimer and Category / Total / Done / Left breakdown.

### v13.9.4.31
- Unified Dungeon and Field completion checkbox colors with the dynamic theme accent (Light pink / Dark blue).
- Monster Illustration headings remain neutral rather than accent-colored.
- Added regional aliases for Behemoth, Storm Watcher Ruins, Underworld Cave, and Snowfield.


### v13.9.4.31
- Added multi-select region filters to Fields: All, Jiendia, Freios, Western Freios, and Eastland.
- Reset restores the All-regions view.


## v13.9.4.31
- Added a Dungeon Conquest placeholder section to expanded Dungeon cards (Coming Soon).
- Added Dungeon Conquest Preview page with translated SHINING update notes and official source link.
- Added Dungeon Conquest Preview navigation between Titles and Wiki.
