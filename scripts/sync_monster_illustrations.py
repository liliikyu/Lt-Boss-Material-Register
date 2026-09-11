#!/usr/bin/env python3
"""Refresh assets/monster-illustrations.js from the Official La Tale Wiki.

This version expands HTML rowspan/colspan before reading table columns. That is
important because wiki.gg uses merged Location cells for long dungeon groups;
without span expansion, later monster rows can shift left and lose their dungeon.

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
    "Ymir Institute": "Ymir Institute",
    "Forgotten Garden": "Forgotten Garden",
}


def clean_text(value: str) -> str:
    value = re.sub(r"\[[^\]]+\]", "", value or "")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def positive_int(value: str | None, default: int = 1) -> int:
    try:
        n = int(str(value or default))
        return max(1, n)
    except (TypeError, ValueError):
        return default


class TableParser(HTMLParser):
    """Capture top-level wiki tables while preserving rowspan/colspan metadata."""

    def __init__(self):
        super().__init__()
        self.tables: list[list[list[dict]]] = []
        self._table_depth = 0
        self._rows: list[list[dict]] | None = None
        self._row: list[dict] | None = None
        self._cell_parts: list[str] | None = None
        self._cell_attrs: dict[str, str] = {}

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attrs = dict(attrs)
        if tag == "table":
            self._table_depth += 1
            if self._table_depth == 1:
                self._rows = []
        elif self._table_depth == 1 and tag == "tr":
            self._row = []
        elif self._table_depth == 1 and tag in {"td", "th"} and self._row is not None:
            self._cell_parts = []
            self._cell_attrs = attrs
        elif self._cell_parts is not None and tag in {"br", "p", "div", "li"}:
            self._cell_parts.append(" ")

    def handle_data(self, data):
        if self._cell_parts is not None:
            self._cell_parts.append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self._table_depth == 1 and tag in {"td", "th"} and self._cell_parts is not None:
            self._row.append({
                "text": clean_text("".join(self._cell_parts)),
                "rowspan": positive_int(self._cell_attrs.get("rowspan")),
                "colspan": positive_int(self._cell_attrs.get("colspan")),
            })
            self._cell_parts = None
            self._cell_attrs = {}
        elif self._table_depth == 1 and tag == "tr" and self._row is not None:
            if self._row:
                self._rows.append(self._row)
            self._row = None
        elif tag == "table" and self._table_depth:
            if self._table_depth == 1 and self._rows is not None:
                self.tables.append(self._rows)
                self._rows = None
            self._table_depth -= 1


def expand_spans(raw_rows: list[list[dict]]) -> list[list[str]]:
    """Expand HTML rowspan/colspan into a rectangular logical table."""
    active: dict[int, tuple[int, str]] = {}  # column -> (future rows remaining, text)
    expanded: list[list[str]] = []

    for raw_row in raw_rows:
        row_map: dict[int, str] = {}

        # Cells inherited from a rowspan occupy their original logical columns.
        for col, (remaining, text) in list(active.items()):
            row_map[col] = text
            if remaining <= 1:
                del active[col]
            else:
                active[col] = (remaining - 1, text)

        col = 0
        for cell in raw_row:
            while col in row_map:
                col += 1
            text = clean_text(cell.get("text", ""))
            rowspan = positive_int(cell.get("rowspan"))
            colspan = positive_int(cell.get("colspan"))
            for offset in range(colspan):
                target = col + offset
                row_map[target] = text
                if rowspan > 1:
                    active[target] = (rowspan - 1, text)
            col += colspan

        width = max(row_map.keys(), default=-1) + 1
        expanded.append([row_map.get(i, "") for i in range(width)])

    # Normalize all rows to the same width for safe column indexing.
    width = max((len(row) for row in expanded), default=0)
    return [row + [""] * (width - len(row)) for row in expanded]


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
            "User-Agent": "LtBossMaterialRegister/1.1 (GitHub Pages data sync)",
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
    # wiki location cells can contain line breaks; clean_text already flattens them.
    match = re.match(r"^(.*?)\s*\(Dungeon\)\s*$", location, flags=re.I)
    if not match:
        return None
    name = clean_text(match.group(1))
    return ALIASES.get(name, name)


def parse_dungeons(html: str) -> dict[str, list[str]]:
    parser = TableParser()
    parser.feed(html)
    dungeons: dict[str, list[str]] = {}

    for raw_table in parser.tables:
        table = expand_spans(raw_table)
        if not table:
            continue

        # Locate a header row instead of assuming it is always row 0.
        header_index = None
        name_index = location_index = None
        for idx, row in enumerate(table[:8]):
            headers = [clean_text(v).lower() for v in row]
            if "name" in headers and "location" in headers:
                header_index = idx
                name_index = headers.index("name")
                location_index = headers.index("location")
                break
        if header_index is None or name_index is None or location_index is None:
            continue

        for row in table[header_index + 1:]:
            if name_index >= len(row) or location_index >= len(row):
                continue
            name = clean_text(row[name_index])
            location = clean_text(row[location_index])
            if not name or not location:
                continue
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


def self_test() -> None:
    # The key regression case: one Location cell spans multiple monster rows.
    sample = '''<table><tr><th>Name</th><th>Stat</th><th>Location</th></tr>
      <tr><td>A</td><td>+1</td><td rowspan="3">Forgotten Garden<br>(Dungeon)</td></tr>
      <tr><td>B</td><td>+2</td></tr><tr><td>C</td><td>+3</td></tr></table>'''
    parsed = parse_dungeons(sample)
    assert parsed.get("Forgotten Garden") == ["A", "B", "C"], parsed


def main():
    self_test()
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
