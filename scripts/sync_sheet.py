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
TITLE_MATERIAL_SHEET_ROWS = (32, 33, 34)  # Material 1/2/3, 1-based Google Sheet rows
ELY_SHEET_ROW = 35  # 1-based Google Sheet row number
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


def normalized_label(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").strip().lower()).strip()


def find_label(labels: dict[str, int], *aliases: str):
    normalized = {normalized_label(label): index for label, index in labels.items()}
    for alias in aliases:
        key = normalized_label(alias)
        if key in normalized:
            return normalized[key]
    return None


def clean_ely(value: str):
    text = str(value or "").strip()
    if not text or text == "-":
        return None
    # Supports raw numbers as well as cells formatted like "5,000,000 Ely".
    match = re.search(r"([0-9][0-9,]*(?:\.[0-9]+)?)", text)
    if match:
        number = float(match.group(1).replace(",", ""))
        return int(number) if number.is_integer() else number
    return text


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
    title_amount_row = find_label(labels, "Title Amount Req.", "Title Amount Required", "Amount Required")
    # Title material rows are fixed in the source sheet. Reading the exact rows prevents
    # label/layout drift from silently dropping Material 2 or Material 3.
    title_material_rows = [row_num - 1 for row_num in TITLE_MATERIAL_SHEET_ROWS]
    if any(row_index >= len(rows) for row_index in title_material_rows):
        raise RuntimeError("Expected title Material 1/2/3 on Google Sheet rows 32-34, but the sheet is too short.")
    # Ely is stored in a fixed dedicated row in the source sheet.
    # Google Sheets row 35 => zero-based CSV row index 34.
    title_ely_row = ELY_SHEET_ROW - 1
    if title_ely_row >= len(rows):
        raise RuntimeError(f"Expected Ely requirements on Google Sheet row {ELY_SHEET_ROW}, but the sheet is too short.")
    title_set_row = find_label(labels, "Ttile Set", "Title Set", "Title Set (Not incl. Scenario)")
    coupon_row = find_label(labels, "Instance Dungeon Guaranteed Titlebook Coupon II")

    dungeons = []
    titles = []
    previous_title_context = None
    for col in range(2, width):
        name = rows[labels["Dng Name"]][col].strip()
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

            amount_required = clean_number(rows[title_amount_row][col]) if title_amount_row is not None else None
            ely_required = clean_ely(rows[title_ely_row][col]) if title_ely_row is not None else None

            # Row 35 is authoritative for Ely. For backward compatibility with older
            # sheet snapshots, recover an Ely value from a legacy material cell only
            # when row 35 is blank, then keep Ely out of the material list.
            if ely_required is None:
                for row_index in title_material_rows:
                    for raw_item in split_cell(rows[row_index][col]):
                        if re.fullmatch(r"[\d,]+\s+Ely", raw_item, flags=re.I):
                            ely_required = clean_ely(raw_item)
                            break
                    if ely_required is not None:
                        break

            # A non-numeric Amount Required is itself the unlock condition. Do not
            # duplicate obsolete free-text requirement notes from Material 1/2/3.
            # Explicit item rows with type tags remain valid.
            if isinstance(amount_required, str) and amount_required.strip():
                materials = [m for m in materials if re.search(r"\((?:Event|ETC|Equipment|Consume)\)\s*$", m, re.I)]

            # Support multiple title columns for the same dungeon (e.g. BP/BQ).
            # A secondary title column may intentionally leave Dungeon Name / Lv blank.
            # First prefer the current column, then the immediately previous title context,
            # then scan a few columns left for the nearest populated dungeon metadata.
            title_dungeon = name or None
            title_level = raw_level or None
            if not title_dungeon and previous_title_context is not None:
                title_dungeon, title_level = previous_title_context
            if not title_dungeon:
                for left_col in range(col - 1, max(1, col - 5), -1):
                    inherited_name = rows[labels["Dng Name"]][left_col].strip()
                    if inherited_name:
                        title_dungeon = inherited_name
                        title_level = rows[labels["Dng Lv"]][left_col].strip() or None
                        break
            if title_dungeon:
                previous_title_context = (title_dungeon, title_level)

            titles.append({
                "id": f"title-{len(titles) + 1}",
                "title": title_name,
                "dungeon": title_dungeon,
                "dungeonLevel": title_level,
                "amountRequired": amount_required,
                "elyRequired": ely_required,
                "materials": materials,
                "titleSet": rows[title_set_row][col].strip() or None if title_set_row is not None else None,
                "coupon": rows[coupon_row][col].strip() or None if coupon_row is not None else None,
            })
        else:
            # Do not carry a dungeon across unrelated non-title columns.
            previous_title_context = None

        if not name:
            continue

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


def main() -> None:
    # Single source of truth: every dungeon and title field is read only from
    # the horizontal "Dungeon Boss Material" sheet.  The website intentionally
    # ignores the separate Title Tracker tab to avoid cross-sheet inconsistencies.
    dungeon_rows = fetch_rows(DUNGEON_SHEET_NAME)
    data = build_dungeon_data(dungeon_rows)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        "window.LT_DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(data['dungeons'])} dungeons and {len(data['titles'])} titles to {OUTPUT}")


if __name__ == "__main__":
    main()
