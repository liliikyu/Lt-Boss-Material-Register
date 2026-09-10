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

  const THEME_KEY = "lt-theme";
  const COMPLETION_KEY = "lt-item-completion-v1";

  function loadCompletion() {
    try {
      const raw = JSON.parse(localStorage.getItem(COMPLETION_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  const completionState = loadCompletion();

  function itemCompletionKey(dungeonName, itemName) {
    return `${normalize(dungeonName)}::${normalize(itemName)}`;
  }

  function saveCompletion() {
    localStorage.setItem(COMPLETION_KEY, JSON.stringify(completionState));
  }

  function renderLastSync() {
    const el = $("last-sync");
    if (!el) return;
    const raw = D.lastSyncedAt;
    if (!raw) {
      el.textContent = "Not available";
      el.removeAttribute("datetime");
      return;
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      el.textContent = String(raw);
      return;
    }
    el.dateTime = date.toISOString();
    el.textContent = date.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZoneName: "short"
    });
    el.title = `Google Sheet sync completed at ${date.toISOString()}`;
  }
  const expandedState = new Map();

  function preferredTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function savedThemeMode() {
    const saved = localStorage.getItem(THEME_KEY);
    return ["system", "light", "dark"].includes(saved) ? saved : "system";
  }

  function applyTheme(mode) {
    const resolved = mode === "system" ? preferredTheme() : mode;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    const button = $("theme-toggle");
    if (button) {
      const icon = mode === "light" ? "☀" : mode === "dark" ? "☾" : "◐";
      const label = mode.charAt(0).toUpperCase() + mode.slice(1);
      button.textContent = icon;
      button.title = `Theme: ${label}`;
      button.setAttribute("aria-label", `Theme: ${label}. Click to switch theme.`);
      button.dataset.mode = mode;
    }
  }

  function cycleTheme() {
    const current = savedThemeMode();
    const next = current === "system" ? "light" : current === "light" ? "dark" : "system";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

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
      item = { name, codex: false, titleMaterial: false, badge5Material: false };
      items.push(item);
    }
    item.codex = item.codex || Boolean(flags.codex);
    item.titleMaterial = item.titleMaterial || Boolean(flags.titleMaterial);
    item.badge5Material = item.badge5Material || Boolean(flags.badge5Material);
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
      for (const item of dungeon.badgeMaterials || []) addOrMergeItem(entry.items, item, { badge5Material: true });
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

  function updateExpandAllButton() {
    const button = $("expand-all");
    const cards = [...document.querySelectorAll("#dungeon-grid .dungeon-card.has-drops")];
    const allExpanded = cards.length > 0 && cards.every((card) => card.classList.contains("expanded"));
    button.textContent = allExpanded ? "Close All" : "Expand All";
    button.setAttribute("aria-label", allExpanded ? "Close all dungeon details" : "Expand all dungeon details");
    button.title = allExpanded ? "Return all dungeons to summary view" : "Show full lists for all visible dungeons";
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
      const itemType = (item) => {
        const name = String(item.name || "");
        if (/\(Equipment\)\s*$/i.test(name)) return "equipment";
        if (/\(Event\)\s*$/i.test(name)) return "event";
        if (/\(ETC\)\s*$/i.test(name)) return "etc";
        return "other";
      };

      const cleanItemName = (name) => String(name || "")
        .replace(/\s*\((?:Equipment|Event|ETC)\)\s*$/i, "")
        .trim();

      const itemPriority = (item) => {
        if (item.codex && item.titleMaterial) return 0;
        if (item.codex) return 1;
        if (item.titleMaterial) return 2;
        if (item.badge5Material) return 3;
        return 4;
      };

      const grouped = { equipment: [], event: [], etc: [], other: [] };
      for (const item of dungeon.items || []) grouped[itemType(item)].push(item);
      for (const group of Object.values(grouped)) {
        group.sort((a, b) => itemPriority(a) - itemPriority(b) || cleanItemName(a.name).localeCompare(cleanItemName(b.name)));
      }

      const renderFlags = (item) => [
        item.codex ? '<span class="flag codex" title="Can be registered in Codex">Codex ✓</span>' : "",
        item.titleMaterial ? '<span class="flag title" title="Used for a title">Title ✓</span>' : "",
        item.badge5Material ? '<span class="flag badge5" title="Material used for Badge 5">Badge 5 ✓</span>' : ""
      ].join("");

      const renderGroup = (key, label) => {
        const items = grouped[key];
        const rows = items.length ? items.map((item) => {
          const flags = renderFlags(item);
          const completionKey = itemCompletionKey(dungeon.name, item.name);
          const completed = completionState[completionKey] === true;
          return `<li class="item-row${completed ? " completed" : ""}" data-completion-key="${esc(completionKey)}">
            <span class="item-main">
              <input class="item-check" type="checkbox" ${completed ? "checked" : ""} aria-label="Mark ${esc(cleanItemName(item.name))} as completed">
              <span class="item-name">${esc(cleanItemName(item.name))}</span>
            </span>
            <span class="item-flags">${flags}</span>
          </li>`;
        }).join("") : '<li class="column-empty">—</li>';
        return `<section class="item-column item-column-${key}">
          <div class="item-column-head">${esc(label)}</div>
          <ul class="item-list">${rows}</ul>
        </section>`;
      };

      const hasAnyItems = (dungeon.items || []).length > 0;
      const columnsHtml = hasAnyItems ? `
        <div class="item-columns">
          ${renderGroup("equipment", "Equipment")}
          ${renderGroup("event", "Event")}
          ${renderGroup("etc", "ETC")}
          ${renderGroup("other", "Other")}
        </div>` : '<div class="no-items">No drops listed in the current data.</div>';

      const meta = dungeon.entriesPerDay ? `<span>${esc(dungeon.entriesPerDay)} ${Number(dungeon.entriesPerDay) === 1 ? "entry" : "entries"}/day${dungeon.entryScope === "account" ? "/account" : ""}</span>` : "";
      const titleNote = dungeon.titleNames?.length
        ? `<div class="card-note"><strong>Title:</strong> ${dungeon.titleNames.map(esc).join(" · ")}</div>`
        : "";

      const dungeonKey = normalize(dungeon.name);
      const hasDrops = (dungeon.items || []).length > 0;
      const isExpanded = hasDrops && (expandedState.get(dungeonKey) === true);
      const completedCount = (dungeon.items || []).filter((item) => completionState[itemCompletionKey(dungeon.name, item.name)] === true).length;
      const summaryHtml = hasDrops ? `<div class="dungeon-summary" aria-hidden="${isExpanded ? "true" : "false"}">
        <span><strong>Equipment</strong> ${grouped.equipment.length}</span>
        <span><strong>Event</strong> ${grouped.event.length}</span>
        <span><strong>ETC</strong> ${grouped.etc.length}</span>
        <span><strong>Other</strong> ${grouped.other.length}</span>
        <span class="summary-progress"><strong>Done</strong> ${completedCount}/${dungeon.items.length}</span>
      </div>` : "";

      const headerHtml = hasDrops ? `<button class="dungeon-toggle" type="button" aria-expanded="${isExpanded ? "true" : "false"}" title="${isExpanded ? "Return to summary" : "Show full list"} ${esc(dungeon.name)}">
        <div class="dungeon-title-wrap">
          <div class="dungeon-name">${esc(dungeon.name)}</div>
          <div class="dungeon-meta">${meta}</div>
        </div>
        <span class="dungeon-head-right">
          <span class="level-badge">${esc(displayLevel(dungeon.level))}</span>
          <span class="collapse-chevron" aria-hidden="true">▼</span>
        </span>
      </button>` : `<div class="dungeon-static-head">
        <div class="dungeon-title-wrap">
          <div class="dungeon-name">${esc(dungeon.name)}</div>
          <div class="dungeon-meta">${meta}</div>
        </div>
        <span class="level-badge">${esc(displayLevel(dungeon.level))}</span>
      </div>`;

      return `<article class="dungeon-card${isExpanded ? " expanded" : ""}${hasDrops ? " has-drops" : " no-drops"}" data-category="${categoryFor(dungeon.level)}" data-dungeon-key="${esc(dungeonKey)}">
        <header class="dungeon-head">${headerHtml}</header>
        ${summaryHtml}
        <div class="dungeon-body">
          ${columnsHtml}
          ${titleNote}
        </div>
      </article>`;
    }).join("");
    $("result-count").textContent = `${visible.length} dungeon${visible.length === 1 ? "" : "s"}`;
    $("empty-state").classList.toggle("hidden", visible.length > 0);
    updateExpandAllButton();
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
    expandedState.clear();
    render();
  });

  $("expand-all").addEventListener("click", () => {
    const cards = [...document.querySelectorAll("#dungeon-grid .dungeon-card.has-drops")];
    const allExpanded = cards.length > 0 && cards.every((card) => card.classList.contains("expanded"));

    if (allExpanded) {
      expandedState.clear();
    } else {
      cards.forEach((card) => expandedState.set(card.dataset.dungeonKey, true));
    }
    render();
  });

  $("dungeon-grid").addEventListener("click", (event) => {
    const toggle = event.target.closest(".dungeon-toggle");
    if (!toggle) return;
    const card = toggle.closest(".dungeon-card");
    const key = card.dataset.dungeonKey;
    const nextExpanded = !card.classList.contains("expanded");
    expandedState.set(key, nextExpanded);
    card.classList.toggle("expanded", nextExpanded);
    toggle.setAttribute("aria-expanded", String(nextExpanded));
    toggle.title = `${nextExpanded ? "Return to summary" : "Show full list"} ${card.querySelector(".dungeon-name")?.textContent || "dungeon"}`;
    updateExpandAllButton();
  });


  $("dungeon-grid").addEventListener("change", (event) => {
    const checkbox = event.target.closest(".item-check");
    if (!checkbox) return;
    const row = checkbox.closest(".item-row");
    const key = row?.dataset.completionKey;
    if (!key) return;
    if (checkbox.checked) completionState[key] = true;
    else delete completionState[key];
    saveCompletion();
    row.classList.toggle("completed", checkbox.checked);

    const card = checkbox.closest(".dungeon-card");
    const dungeonKey = card?.dataset.dungeonKey;
    const dungeon = dungeons.find((entry) => normalize(entry.name) === dungeonKey);
    const progress = card?.querySelector(".summary-progress");
    if (dungeon && progress) {
      const done = dungeon.items.filter((item) => completionState[itemCompletionKey(dungeon.name, item.name)] === true).length;
      progress.innerHTML = `<strong>Done</strong> ${done}/${dungeon.items.length}`;
    }
  });

  $("theme-toggle").addEventListener("click", cycleTheme);
  const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  if (media) media.addEventListener("change", () => {
    if (savedThemeMode() === "system") applyTheme("system");
  });
  applyTheme(savedThemeMode());
  renderLastSync();
  render();
})();
