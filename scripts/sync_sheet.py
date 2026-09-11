#!/usr/bin/env python3
"""Sync the public Google Sheet into assets/data.js.

Source layout: tab "Dungeon Boss Material" in LT Boss Matts Tracker.
No third-party Python packages are required.
"""
from __future__ import annotations

import csv
import io
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

SHEET_ID = "15aKwZohEpEwa9fOOnrcqZvAQ-JdHrVLcRTKglM2g1EQ"
DUNGEON_SHEET_NAME = "Dungeon Boss Material"
TITLE_SHEET_NAME = "Title Tracker"
OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "data.js"


def fetch_rows(sheet_name: str) -> list[list[str]]:
    url = (
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?"
        + urllib.parse.urlencode({"tqx": "out:csv", "sheet": sheet_name})
    )
    req = urllib.request.Request(url, headers={"User-Agent": "lt-boss-material-register-sync/1.0"})
    with urllib.request.urlopen(req, timeout=60) as response:
        text = response.read().decode("utf-8-sig")
    return list(csv.reader(io.StringIO(text)))


def clean_number(value: str):
    value = (value or "").strip()
    if not value:
        return None
    try:
        number = float(value.replace(",", ""))
        return int(number) if number.is_integer() else number
    except ValueError:
        return value


def split_cell(value: str) -> list[str]:
    if value is None:
        return []
    text = str(value).replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text or text == "-":
        return []
    result = []
    for line in text.split("\n"):
        line = line.strip()
        if not line or line == "-" or line.startswith("->"):
            continue
        result.append(line)
    return result


def normalize_type_tag(name: str, force_equipment: bool = False) -> str:
    name = re.sub(r"\s+", " ", name).strip()
    name = re.sub(r"\(\s*equip\s*\)", "(Equipment)", name, flags=re.I)
    name = re.sub(r"\(\s*equipment\s*\)", "(Equipment)", name, flags=re.I)
    name = re.sub(r"\(\s*event\s*\)", "(Event)", name, flags=re.I)
    name = re.sub(r"\(\s*etc\s*\)", "(ETC)", name, flags=re.I)
    name = re.sub(r"\(\s*consume\s*\)", "(Consume)", name, flags=re.I)
    if force_equipment and "(Equipment)" not in name:
        name += " (Equipment)"
    return name


def item_key(name: str) -> str:
    value = name.lower()
    value = re.sub(r"\((event|etc|consume|equipment|equip)\)", "", value)
    value = re.sub(r"\s*-\s*d5 only\s*$", "", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


def add_item(items, name, *, codex=False, title=False, badge5=False, force_equipment=False):
    name = normalize_type_tag(name, force_equipment)
    if name.lower() in {"not yet", "n/a", "na"}:
        return
    key = item_key(name)
    if not key:
        return
    existing = next((item for item in items if item["_key"] == key), None)
    if existing is None:
        existing = {"_key": key, "name": name, "codex": False, "titleMaterial": False, "badge5Material": False}
        items.append(existing)
    elif (
        re.search(r"\((Event|ETC|Consume|Equipment)\)$", name, re.I)
        and not re.search(r"\((Event|ETC|Consume|Equipment)\)$", existing["name"], re.I)
    ):
        existing["name"] = name
    existing["codex"] = existing["codex"] or bool(codex)
    existing["titleMaterial"] = existing["titleMaterial"] or bool(title)
    existing["badge5Material"] = existing["badge5Material"] or bool(badge5)


def level_info(raw: str):
    text = str(raw or "").strip().upper().replace(" ", "")
    match = re.match(r"^SL(?:V)?\.?([0-9]+)", text)
    if match:
        return "SLv", int(match.group(1)), "SLv. 1+"
    match = re.match(r"^UL(?:V)?\.?([0-9]+)", text)
    if match:
        value = int(match.group(1))
        if value <= 1000:
            category = "ULv. 1–1000"
        elif 1300 <= value <= 3500:
            category = "ULv. 1300–3500"
        elif 3700 <= value <= 8000:
            category = "ULv. 3700–8000"
        elif 8300 <= value <= 9999:
            category = "ULv. 8300–9999"
        else:
            category = "Other"
        return "ULv", value, category
    match = re.search(r"([0-9]+)", text)
    if match:
        value = int(match.group(1))
        return "Lv", value, "Lv. 1–199" if value <= 199 else "Lv. 200–235"
    return "Unknown", None, "Other"


def build_dungeon_data(rows: list[list[str]]) -> dict:
    if len(rows) < 36:
        raise RuntimeError("Google Sheet returned too few rows; check sharing and tab name.")

    width = max(len(row) for row in rows)
    rows = [row + [""] * (width - len(row)) for row in rows]

    # Resolve row numbers from the labels in column B so small layout shifts are safer.
    labels = {row[1].strip(): i for i, row in enumerate(rows) if len(row) > 1 and row[1].strip()}
    required = ["Dng Lv", "Dng Name", "Entry Number per Day", "Drop 1", "Badge 5 Mats", "Codexable Battle Equipment", "Title"]
    missing = [label for label in required if label not in labels]
    if missing:
        raise RuntimeError(f"Missing expected sheet labels: {', '.join(missing)}")

    drop_rows = [labels[f"Drop {n}"] for n in range(1, 11)]
    badge_row = labels["Badge 5 Mats"]
    codex_equipment_row = labels["Codexable Battle Equipment"]
    codex_rows = []
    for prefix, count in (("Codexable Event", 6), ("Codexable ETC", 8)):
        for n in range(1, count + 1):
            key = f"{prefix} {n}"
            if key in labels:
                codex_rows.append(labels[key])

    title_row = labels["Title"]
    title_amount_row = labels.get("Title Amount Req.")
    title_material_rows = [labels[key] for key in ("Material 1", "Material 2", "Material 3") if key in labels]
    title_set_row = labels.get("Ttile Set")
    coupon_row = labels.get("Instance Dungeon Guaranteed Titlebook Coupon II")

    dungeons = []
    titles = []
    for col in range(2, width):
        name = rows[labels["Dng Name"]][col].strip()
        if not name:
            continue
        raw_level = rows[labels["Dng Lv"]][col].strip()
        entries = clean_number(rows[labels["Entry Number per Day"]][col])
        items = []
        drops = []
        codex_items = []

        for row_index in drop_rows:
            for raw_item in split_cell(rows[row_index][col]):
                item = normalize_type_tag(raw_item)
                if item.lower() == "not yet":
                    continue
                drops.append(item)
                add_item(items, item)

        badge_materials = []
        for raw_item in split_cell(rows[badge_row][col]):
            item = normalize_type_tag(raw_item)
            if item.lower() == "not yet":
                continue
            badge_materials.append(item)
            add_item(items, item, badge5=True)

        for raw_item in split_cell(rows[codex_equipment_row][col]):
            item = normalize_type_tag(raw_item, force_equipment=True)
            codex_items.append(item)
            add_item(items, item, codex=True, force_equipment=True)

        for row_index in codex_rows:
            for raw_item in split_cell(rows[row_index][col]):
                item = normalize_type_tag(raw_item)
                if item.lower() == "not yet":
                    continue
                codex_items.append(item)
                add_item(items, item, codex=True)

        title_name = rows[title_row][col].strip()
        materials = []
        if title_name and title_name not in {"-", "Not yet"}:
            for row_index in title_material_rows:
                for raw_item in split_cell(rows[row_index][col]):
                    if re.fullmatch(r"[\d,]+\s+Ely", raw_item, flags=re.I):
                        continue
                    item = normalize_type_tag(raw_item)
                    materials.append(item)
                    add_item(items, item, title=True)

            titles.append({
                "id": f"title-{len(titles) + 1}",
                "title": title_name,
                "dungeon": name,
                "dungeonLevel": raw_level,
                "amountRequired": clean_number(rows[title_amount_row][col]) if title_amount_row is not None else None,
                "materials": materials,
                "titleSet": rows[title_set_row][col].strip() or None if title_set_row is not None else None,
                "coupon": rows[coupon_row][col].strip() or None if coupon_row is not None else None,
            })

        level_type, numeric_level, category = level_info(raw_level)
        dungeons.append({
            "id": f"dungeon-{len(dungeons) + 1}",
            "level": raw_level,
            "numericLevel": numeric_level,
            "levelType": level_type,
            "levelCategory": category,
            "name": name,
            "entriesPerDay": entries,
            "entryScope": "account" if name in {"Unknown Forest", "Unknown Beach"} else None,
            "drops": drops,
            "badgeMaterials": badge_materials,
            "codexItems": codex_items,
            "loot": [
                {"name": item["name"], "codex": item["codex"], "titleMaterial": item["titleMaterial"], "badge5Material": item["badge5Material"]}
                for item in items
            ],
        })

    return {
        "lastSyncedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "generatedFrom": "Google Sheets — LT Boss Matts Tracker / Dungeon Boss Material",
        "schemaVersion": "v6",
        "levelFilters": [
            {"id": "all", "label": "All"},
            {"id": "lv-1-199", "label": "Lv. 1–199"},
            {"id": "lv-200-235", "label": "Lv. 200–235"},
            {"id": "ulv-1-1000", "label": "ULv. 1–1000"},
            {"id": "ulv-1300-3500", "label": "ULv. 1300–3500"},
            {"id": "ulv-3700-8000", "label": "ULv. 3700–8000"},
            {"id": "ulv-8300-9999", "label": "ULv. 8300–9999"},
            {"id": "slv-1-plus", "label": "SLv. 1+"},
        ],
        "dungeons": dungeons,
        "titles": titles,
    }



def _header_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def build_titles_from_tracker(rows: list[list[str]]) -> list[dict]:
    """Build title records from the dedicated Title Tracker tab.

    Google Sheets' CSV export evaluates the formulas in this tab, so this is
    more reliable for title-specific fields than reconstructing them from the
    horizontal Dungeon Boss Material matrix.
    """
    if not rows:
        return []

    # Find the header row rather than assuming it is row 1.
    header_index = None
    for i, row in enumerate(rows[:25]):
        keys = {_header_key(cell) for cell in row}
        if "title" in keys and "dungeon" in keys and any(k.startswith("material 1") for k in keys):
            header_index = i
            break
    if header_index is None:
        raise RuntimeError("Could not find the Title Tracker header row.")

    header = rows[header_index]
    width = max(len(header), *(len(r) for r in rows[header_index + 1:]))
    header = header + [""] * (width - len(header))
    columns = {_header_key(name): idx for idx, name in enumerate(header) if str(name).strip()}

    def find_col(*candidates, startswith=None):
        for candidate in candidates:
            key = _header_key(candidate)
            if key in columns:
                return columns[key]
        if startswith:
            prefix = _header_key(startswith)
            for key, idx in columns.items():
                if key.startswith(prefix):
                    return idx
        return None

    title_col = find_col("Title")
    dungeon_col = find_col("Dungeon")
    level_col = find_col("Dungeon Lv", "Dungeon Level")
    amount_col = find_col("Amount Required", "Title Amount Req.")
    material_cols = [find_col(f"Material {n}") for n in range(1, 4)]
    title_set_col = find_col("Title Set (Not incl. Scenario)", "Title Set", "Ttile Set", startswith="Title Set")
    coupon_col = find_col("Instance Dungeon Guaranteed Titlebook Coupon II", startswith="Instance Dungeon Guaranteed Titlebook Coupon II")

    if title_col is None or dungeon_col is None:
        raise RuntimeError("Title Tracker is missing Title or Dungeon columns.")

    titles = []
    for raw_row in rows[header_index + 1:]:
        row = raw_row + [""] * (width - len(raw_row))
        title_name = row[title_col].strip() if title_col < len(row) else ""
        dungeon = row[dungeon_col].strip() if dungeon_col < len(row) else ""
        if not title_name or title_name in {"-", "#N/A", "#NAME?"}:
            continue

        raw_amount = row[amount_col].strip() if amount_col is not None and amount_col < len(row) else ""
        amount = clean_number(raw_amount)
        materials = []
        for col in material_cols:
            if col is None or col >= len(row):
                continue
            for raw_item in split_cell(row[col]):
                # Preserve special requirements such as Ely/reputation text.
                materials.append(normalize_type_tag(raw_item))

        titles.append({
            "id": f"title-{len(titles) + 1}",
            "title": title_name,
            "dungeon": dungeon,
            "dungeonLevel": row[level_col].strip() if level_col is not None and level_col < len(row) else "",
            "amountRequired": amount,
            "materials": materials,
            "titleSet": row[title_set_col].strip() or None if title_set_col is not None and title_set_col < len(row) else None,
            "coupon": row[coupon_col].strip() or None if coupon_col is not None and coupon_col < len(row) else None,
        })

    return titles

def main() -> None:
    dungeon_rows = fetch_rows(DUNGEON_SHEET_NAME)
    title_rows = fetch_rows(TITLE_SHEET_NAME)
    data = build_dungeon_data(dungeon_rows)
    tracker_titles = build_titles_from_tracker(title_rows)
    if tracker_titles:
        data["titles"] = tracker_titles
        data["generatedFrom"] = "Google Sheets — LT Boss Matts Tracker / Dungeon Boss Material + Title Tracker"
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        "window.LT_DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(data['dungeons'])} dungeons and {len(data['titles'])} titles to {OUTPUT}")


if __name__ == "__main__":
    main()
