# LaTale Dungeon Tracker — v13.9.4.18

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
