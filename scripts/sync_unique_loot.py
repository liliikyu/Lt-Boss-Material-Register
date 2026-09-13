#!/usr/bin/env python3
"""Refresh assets/dungeon-unique-loot.js from the Official La Tale Wiki Dungeons page.

Reads the wiki's Dungeons tables and extracts the Name + Unique Loot columns.
If the wiki/API is unavailable or parsing returns no usable data, the existing
snapshot is left untouched.
"""
from __future__ import annotations

from html.parser import HTMLParser
import json
import re
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

PAGE = "Dungeons"
SOURCE = "https://latale.wiki.gg/wiki/Dungeons"
API = "https://latale.wiki.gg/api.php"
OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "dungeon-unique-loot.js"

# Canonical names used by this tracker when they differ from the wiki.
ALIASES = {
    "Dragon's Lair": "Dragon Lair",
    "Garden of the Priring": "Garden Of the Priring",
    "Jewel Forest": "Jewell Forest",
    "Champion's Memorial": "Champions' Memorial",
    "Oblivion Lake": "Oblivon Lake",
    "Promised Sanctuary": "Promised Sancutary",
    "Heart of Reminiscence": "Heart of Reminiscience",
    "Purgatory Azrael": "Purgatory Azreal",
    "Munchkin Storage": "Muchkin Storage",
    "Plemora": "Pleroma",
}


def clean_text(value: str) -> str:
    value = re.sub(r"\[[^\]]+\]", "", value or "")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def positive_int(value: str | None, default: int = 1) -> int:
    try:
        return max(1, int(str(value or default)))
    except (TypeError, ValueError):
        return default


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables: list[list[list[dict]]] = []
        self._table_depth = 0
        self._rows = None
        self._row = None
        self._cell_parts = None
        self._cell_attrs = {}

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
            # Preserve a delimiter so a <br>-separated Unique Loot cell can be split.
            self._cell_parts.append(" | ")

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
    active: dict[int, tuple[int, str]] = {}
    expanded: list[list[str]] = []
    for raw_row in raw_rows:
        row_map: dict[int, str] = {}
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
            "User-Agent": "LtDungeonTracker/1.0 (GitHub Pages data sync)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    html = payload.get("parse", {}).get("text", "")
    if not html:
        raise RuntimeError("Wiki API returned no parsed Dungeons HTML")
    return html


def split_loot(value: str) -> list[str]:
    value = clean_text(value)
    if not value or value in {"-", "—"}:
        return []
    # The wiki predominantly separates entries with commas; also accept <br> / semicolon.
    parts = re.split(r"\s*(?:,|;|\|)\s*", value)
    result = []
    for part in parts:
        part = clean_text(part)
        if part and part not in result:
            result.append(part)
    return result


def parse_unique_loot(html: str) -> dict[str, list[str]]:
    parser = TableParser()
    parser.feed(html)
    dungeons: dict[str, list[str]] = {}

    for raw_table in parser.tables:
        table = expand_spans(raw_table)
        if not table:
            continue
        header_index = None
        name_index = loot_index = None
        for idx, row in enumerate(table[:8]):
            headers = [clean_text(v).lower() for v in row]
            if "name" in headers and "unique loot" in headers:
                header_index = idx
                name_index = headers.index("name")
                loot_index = headers.index("unique loot")
                break
        if header_index is None:
            continue

        for row in table[header_index + 1:]:
            if name_index >= len(row) or loot_index >= len(row):
                continue
            name = clean_text(row[name_index])
            loot = split_loot(row[loot_index])
            if not name or not loot:
                continue
            name = ALIASES.get(name, name)
            bucket = dungeons.setdefault(name, [])
            for item in loot:
                if item not in bucket:
                    bucket.append(item)

    if not dungeons:
        raise RuntimeError("No Dungeon Unique Loot could be parsed; keeping existing snapshot")
    return dungeons


def read_existing() -> dict:
    if not OUTPUT.exists():
        return {}
    text = OUTPUT.read_text(encoding="utf-8")
    match = re.search(r"window\.LT_DUNGEON_UNIQUE_LOOT\s*=\s*(\{.*\})\s*;?\s*$", text, flags=re.S)
    if not match:
        return {}
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return {}


def self_test() -> None:
    sample = '''<table>
      <tr><th>Icon</th><th>Name</th><th>Level</th><th>Unique Loot</th></tr>
      <tr><td></td><td>Dragon's Lair</td><td>1</td><td>Invoke Set</td></tr>
      <tr><td></td><td>Icicle Prison</td><td>2100</td><td>Argos Belt<br>Argos Gem</td></tr>
      <tr><td></td><td>No Loot</td><td>1</td><td></td></tr>
    </table>'''
    parsed = parse_unique_loot(sample)
    assert parsed["Dragon Lair"] == ["Invoke Set"], parsed
    assert parsed["Icicle Prison"] == ["Argos Belt", "Argos Gem"], parsed
    assert "No Loot" not in parsed, parsed


def main() -> None:
    self_test()
    dungeons = parse_unique_loot(fetch_html())
    existing = read_existing()
    if existing.get("dungeons") == dungeons:
        print(f"Dungeon Unique Loot unchanged ({sum(map(len, dungeons.values()))} entries).")
        return
    data = {
        "source": SOURCE,
        "updated": date.today().isoformat(),
        "dungeons": dungeons,
    }
    OUTPUT.write_text(
        "window.LT_DUNGEON_UNIQUE_LOOT = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {sum(map(len, dungeons.values()))} Unique Loot entries across {len(dungeons)} dungeons.")


if __name__ == "__main__":
    main()
