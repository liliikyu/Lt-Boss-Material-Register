#!/usr/bin/env python3
"""Refresh assets/monster-illustrations.js from the Official La Tale Wiki.

The script uses wiki.gg's MediaWiki API, extracts rows from tables containing
Name and Location, keeps dungeon locations only, maps known wiki naming
variants to the tracker names, and rewrites the snapshot only when the parsed
monster list changes.

If the wiki/API is unavailable or parsing produces no dungeon data, the script
fails without replacing the existing snapshot.
"""
from __future__ import annotations

from html.parser import HTMLParser
import json
import re
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

PAGE = "Monster_Illustrations"
SOURCE = "https://latale.wiki.gg/wiki/Monster_Illustrations"
API = "https://latale.wiki.gg/api.php"
OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "monster-illustrations.js"

# Official-wiki dungeon names that differ from the tracker sheet.
ALIASES = {
    "Dragon's Lair": "Dragon Lair",
    "Shangri-La": "Shangri-la",
    "Pyramid": "Treasure Vault",
    "Phantom Ship": "Captain Johnny's Room",
    "Ktuka Underworld": "Heart of Ktuka",
    "Challenge Choco Garden": "TAID Choco Garden",
    "Taid: Dragon Garden": "TAID Dragon Garden",
    "TAID: Dragon Garden": "TAID Dragon Garden",
    "World Genesis": "World's Genesis",
    "Jewel Forest": "Jewell Forest",
    "Promised Sanctuary": "Promised Sancutary",
    "Oblivion Lake": "Oblivon Lake",
    "Munchkin Storage": "Muchkin Storage",
}


def clean_text(value: str) -> str:
    value = re.sub(r"\[[^\]]+\]", "", value or "")
    value = re.sub(r"\s+", " ", value).strip()
    return value


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables: list[list[list[str]]] = []
        self._table_depth = 0
        self._rows: list[list[str]] | None = None
        self._row: list[str] | None = None
        self._cell_parts: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "table":
            self._table_depth += 1
            if self._table_depth == 1:
                self._rows = []
        elif self._table_depth == 1 and tag == "tr":
            self._row = []
        elif self._table_depth == 1 and tag in {"td", "th"} and self._row is not None:
            self._cell_parts = []
        elif self._cell_parts is not None and tag in {"br", "p", "div", "li"}:
            self._cell_parts.append(" ")

    def handle_data(self, data):
        if self._cell_parts is not None:
            self._cell_parts.append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self._table_depth == 1 and tag in {"td", "th"} and self._cell_parts is not None:
            self._row.append(clean_text("".join(self._cell_parts)))
            self._cell_parts = None
        elif self._table_depth == 1 and tag == "tr" and self._row is not None:
            if self._row:
                self._rows.append(self._row)
            self._row = None
        elif tag == "table" and self._table_depth:
            if self._table_depth == 1 and self._rows is not None:
                self.tables.append(self._rows)
                self._rows = None
            self._table_depth -= 1


def fetch_html() -> str:
    query = urllib.parse.urlencode({
        "action": "parse",
        "page": PAGE,
        "prop": "text",
        "format": "json",
        "formatversion": "2",
    })
    req = urllib.request.Request(
        f"{API}?{query}",
        headers={
            "User-Agent": "LtBossMaterialRegister/1.0 (GitHub Pages data sync)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    html = payload.get("parse", {}).get("text", "")
    if not html:
        raise RuntimeError("Wiki API returned no parsed HTML")
    return html


def canonical_dungeon(location: str) -> str | None:
    location = clean_text(location)
    # Only entries explicitly located in dungeons are relevant to this tracker.
    match = re.match(r"^(.*?)\s*\(Dungeon\)\s*$", location, flags=re.I)
    if not match:
        return None
    name = match.group(1).strip()
    return ALIASES.get(name, name)


def parse_dungeons(html: str) -> dict[str, list[str]]:
    parser = TableParser()
    parser.feed(html)
    dungeons: dict[str, list[str]] = {}

    for table in parser.tables:
        if not table:
            continue
        headers = [clean_text(v).lower() for v in table[0]]
        if "name" not in headers or "location" not in headers:
            continue
        name_index = headers.index("name")
        location_index = headers.index("location")
        last_location = ""

        for row in table[1:]:
            if not row or name_index >= len(row):
                continue
            name = clean_text(row[name_index])
            if not name:
                continue

            # wiki.gg tables often use rowspan for Location, so subsequent rows
            # may physically omit the Location cell. Preserve the preceding one.
            location = ""
            if len(row) > location_index:
                location = clean_text(row[location_index])
            elif len(row) >= 3:
                location = clean_text(row[-1])
            if location:
                last_location = location
            else:
                location = last_location

            dungeon = canonical_dungeon(location)
            if not dungeon:
                continue
            bucket = dungeons.setdefault(dungeon, [])
            if name not in bucket:
                bucket.append(name)

    if not dungeons:
        raise RuntimeError("No dungeon Monster Illustrations could be parsed; keeping existing snapshot")
    return dungeons


def read_existing() -> dict:
    if not OUTPUT.exists():
        return {}
    text = OUTPUT.read_text(encoding="utf-8")
    match = re.search(r"window\.LT_MONSTER_ILLUSTRATIONS\s*=\s*(\{.*\})\s*;?\s*$", text, flags=re.S)
    if not match:
        return {}
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return {}


def main():
    dungeons = parse_dungeons(fetch_html())
    existing = read_existing()
    if existing.get("dungeons") == dungeons:
        print(f"Monster Illustration list unchanged ({sum(map(len, dungeons.values()))} entries).")
        return

    data = {
        "source": SOURCE,
        "updated": date.today().isoformat(),
        "dungeons": dungeons,
    }
    OUTPUT.write_text(
        "window.LT_MONSTER_ILLUSTRATIONS = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {sum(map(len, dungeons.values()))} Monster Illustrations across {len(dungeons)} dungeons.")


if __name__ == "__main__":
    main()
