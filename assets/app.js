(() => {
  const D = window.LT_DATA || { dungeons: [], titles: [] };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

  const normalize = (value) => String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  function parseLevel(raw) {
    const text = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
    let match;
    if ((match = text.match(/^SL(?:V)?\.?([0-9]+)/))) return { type: "slv", value: Number(match[1]) };
    if ((match = text.match(/^UL(?:V)?\.?([0-9]+)/))) return { type: "ulv", value: Number(match[1]) };
    if ((match = text.match(/^LV\.?([0-9]+)/))) return { type: "lv", value: Number(match[1]) };
    if ((match = text.match(/^([0-9]+)/))) return { type: "lv", value: Number(match[1]) };
    return { type: "other", value: 0 };
  }

  function categoryFor(raw) {
    const { type, value } = parseLevel(raw);
    if (type === "lv") return value <= 199 ? "lv-1-199" : "lv-200-235";
    if (type === "slv") return "slv-1-plus";
    if (type === "ulv") {
      if (value <= 1000) return "ulv-1-1000";
      if (value >= 1300 && value <= 3500) return "ulv-1300-3500";
      if (value >= 3700 && value <= 8000) return "ulv-3700-8000";
      if (value >= 8300 && value <= 9999) return "ulv-8300-9999";
    }
    return "other";
  }

  function displayLevel(raw) {
    const { type, value } = parseLevel(raw);
    if (type === "ulv") return `ULv. ${value}`;
    if (type === "slv") return `SLv. ${value}`;
    if (type === "lv") return `Lv. ${value}`;
    return String(raw || "—");
  }

  function addOrMergeItem(items, name, flags = {}) {
    if (!name) return;
    const key = normalize(name.replace(/\s*\(event\)\s*$/i, ""));
    let item = items.find((entry) => normalize(entry.name.replace(/\s*\(event\)\s*$/i, "")) === key);
    if (!item) {
      item = { name, codex: false, titleMaterial: false };
      items.push(item);
    }
    item.codex = item.codex || Boolean(flags.codex);
    item.titleMaterial = item.titleMaterial || Boolean(flags.titleMaterial);
  }

  function buildDungeonList() {
    const map = new Map();

    for (const dungeon of D.dungeons || []) {
      const key = normalize(dungeon.name);
      const entry = {
        ...dungeon,
        name: dungeon.name,
        level: dungeon.level,
        items: [],
        titleNames: []
      };
      for (const item of dungeon.loot || []) addOrMergeItem(entry.items, item.name, item);
      for (const item of dungeon.codexItems || []) addOrMergeItem(entry.items, item, { codex: true });
      map.set(key, entry);
    }

    for (const title of D.titles || []) {
      if (!title.dungeon) continue;
      const key = normalize(title.dungeon);
      let entry = map.get(key);
      if (!entry) {
        entry = {
          name: title.dungeon,
          level: title.dungeonLevel || title.level || "",
          entriesPerDay: null,
          badgeMaterials: [],
          codexItems: [],
          items: [],
          titleNames: []
        };
        map.set(key, entry);
      }
      if (!entry.level && title.dungeonLevel) entry.level = title.dungeonLevel;
      if (title.title && !entry.titleNames.includes(title.title)) entry.titleNames.push(title.title);
      for (const material of title.materials || []) {
        if (/^\s*[\d,.]+\s+ely\s*$/i.test(material)) continue;
        addOrMergeItem(entry.items, material, { titleMaterial: true });
      }
    }

    return [...map.values()].sort((a, b) => {
      const pa = parseLevel(a.level), pb = parseLevel(b.level);
      const order = { lv: 0, ulv: 1, slv: 2, other: 3 };
      return (order[pa.type] - order[pb.type]) || (pa.value - pb.value) || a.name.localeCompare(b.name);
    });
  }

  const dungeons = buildDungeonList();
  const checkboxes = [...document.querySelectorAll('#range-filters input[type="checkbox"]')];
  const allBox = checkboxes.find((box) => box.value === "all");
  const rangeBoxes = checkboxes.filter((box) => box.value !== "all");

  function selectedRanges() {
    if (allBox.checked) return new Set(["all"]);
    return new Set(rangeBoxes.filter((box) => box.checked).map((box) => box.value));
  }

  function render() {
    const query = normalize($("search").value);
    const ranges = selectedRanges();
    const visible = dungeons.filter((dungeon) => {
      const category = categoryFor(dungeon.level);
      if (!ranges.has("all") && !ranges.has(category)) return false;
      if (!query) return true;
      const haystack = normalize([
        dungeon.name,
        displayLevel(dungeon.level),
        ...(dungeon.items || []).map((item) => item.name),
        ...(dungeon.titleNames || [])
      ].join(" "));
      return haystack.includes(query);
    });

    $("dungeon-grid").innerHTML = visible.map((dungeon) => {
      const items = dungeon.items || [];
      const itemHtml = items.length ? items.map((item) => {
        const flags = [
          item.codex ? '<span class="flag codex" title="Can be registered in Codex">Codex ✓</span>' : "",
          item.titleMaterial ? '<span class="flag title" title="Used for a title">Title ✓</span>' : ""
        ].join("");
        return `<li class="item-row">
          <span class="item-name">${esc(item.name)}</span>
          <span class="item-flags">${flags || '<span class="no-flags">Drop</span>'}</span>
        </li>`;
      }).join("") : '<li class="no-items">No drops listed in the current data.</li>';

      const meta = dungeon.entriesPerDay ? `<span>${esc(dungeon.entriesPerDay)} entries/day</span>` : "";
      const titleNote = dungeon.titleNames?.length
        ? `<div class="card-note"><strong>Title:</strong> ${dungeon.titleNames.map(esc).join(" · ")}</div>`
        : "";

      return `<article class="dungeon-card" data-category="${categoryFor(dungeon.level)}">
        <header class="dungeon-head">
          <div class="dungeon-title-wrap">
            <div class="dungeon-name">${esc(dungeon.name)}</div>
            <div class="dungeon-meta">${meta}</div>
          </div>
          <span class="level-badge">${esc(displayLevel(dungeon.level))}</span>
        </header>
        <ul class="item-list">${itemHtml}</ul>
        ${titleNote}
      </article>`;
    }).join("");

    $("result-count").textContent = `${visible.length} dungeon${visible.length === 1 ? "" : "s"}`;
    $("empty-state").classList.toggle("hidden", visible.length > 0);
  }

  function chooseAll() {
    allBox.checked = true;
    rangeBoxes.forEach((box) => { box.checked = false; });
  }

  allBox.addEventListener("change", () => {
    if (allBox.checked) rangeBoxes.forEach((box) => { box.checked = false; });
    else if (!rangeBoxes.some((box) => box.checked)) allBox.checked = true;
    render();
  });

  rangeBoxes.forEach((box) => box.addEventListener("change", () => {
    if (box.checked) allBox.checked = false;
    if (!rangeBoxes.some((item) => item.checked)) allBox.checked = true;
    render();
  }));

  $("search").addEventListener("input", render);
  $("clear-filters").addEventListener("click", () => {
    $("search").value = "";
    chooseAll();
    render();
  });

  render();
})();
