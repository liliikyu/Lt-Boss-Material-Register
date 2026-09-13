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
  const MONSTER_COMPLETION_KEY = "lt-monster-illustration-completion-v1";
  const TITLE_PROGRESS_KEY = "lt-title-progress-v1";
  const MI = window.LT_MONSTER_ILLUSTRATIONS || { dungeons: {} };
  const UL = window.LT_DUNGEON_UNIQUE_LOOT || { dungeons: {} };

  function loadTitleProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem(TITLE_PROGRESS_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function titleRecordsForDungeon(dungeonName) {
    const wanted = normalize(dungeonName);
    return (D.titles || []).filter((title) => normalize(title.dungeon) === wanted);
  }

  function loadCompletion() {
    try {
      const raw = JSON.parse(localStorage.getItem(COMPLETION_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  const completionState = loadCompletion();

  function loadMonsterCompletion() {
    try {
      const raw = JSON.parse(localStorage.getItem(MONSTER_COMPLETION_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  const monsterCompletionState = loadMonsterCompletion();

  function monsterCompletionKey(dungeonName, monsterName) {
    return `${normalize(dungeonName)}::${normalize(monsterName)}`;
  }

  function saveMonsterCompletion() {
    localStorage.setItem(MONSTER_COMPLETION_KEY, JSON.stringify(monsterCompletionState));
  }

  function monsterIllustrationsFor(dungeonName) {
    const direct = MI.dungeons?.[dungeonName];
    if (Array.isArray(direct)) return direct;
    const wanted = normalize(dungeonName);
    const match = Object.entries(MI.dungeons || {}).find(([name]) => normalize(name) === wanted);
    return match ? match[1] : [];
  }

  function uniqueLootFor(dungeonName) {
    const direct = UL.dungeons?.[dungeonName];
    if (Array.isArray(direct)) return direct;
    const wanted = normalize(dungeonName);
    const match = Object.entries(UL.dungeons || {}).find(([name]) => normalize(name) === wanted);
    return match ? match[1] : [];
  }

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

  function itemType(item) {
    const name = String(item?.name || "");
    if (/\(Equipment\)\s*$/i.test(name)) return "equipment";
    if (/\(Event\)\s*$/i.test(name)) return "event";
    if (/\(ETC\)\s*$/i.test(name)) return "etc";
    return "other";
  }

  function cleanItemName(name) {
    return String(name || "").replace(/\s*\((?:Equipment|Event|ETC)\)\s*$/i, "").trim();
  }

  function isPlaceholderItem(item) {
    return normalize(cleanItemName(item?.name)) === "not yet";
  }

  function isTrackable(item) {
    return Boolean(item?.codex) && !isPlaceholderItem(item);
  }

  function updateProgressSummary() {
    const tbody = $("progress-summary-body");
    if (!tbody) return;

    const labels = { equipment: "Equipment", event: "Event", etc: "ETC", other: "Other" };
    const counts = {
      equipment: { total: 0, done: 0 },
      event: { total: 0, done: 0 },
      etc: { total: 0, done: 0 },
      other: { total: 0, done: 0 }
    };

    for (const dungeon of dungeons) {
      for (const item of dungeon.items || []) {
        if (!isTrackable(item)) continue;
        const type = itemType(item);
        counts[type].total += 1;
        if (completionState[itemCompletionKey(dungeon.name, item.name)] === true) counts[type].done += 1;
      }
    }

    if (tbody) {
      tbody.innerHTML = Object.entries(counts).map(([key, value]) => {
        const left = Math.max(0, value.total - value.done);
        return `<tr>
          <th scope="row">${labels[key]}</th>
          <td>${value.total}</td>
          <td>${value.done}</td>
          <td class="progress-left${left === 0 && value.total > 0 ? " complete" : ""}">${left === 0 && value.total > 0 ? "✓" : left}</td>
        </tr>`;
      }).join("");
    }

    const total = Object.values(counts).reduce((sum, value) => sum + value.total, 0);
    const done = Object.values(counts).reduce((sum, value) => sum + value.done, 0);
    const totalEl = $("progress-total");
    if (totalEl) totalEl.textContent = total ? `${done}/${total} complete · ${total - done} left` : "No Codexable items";

    // Monster Illustration progress is tracked independently from Item Codex progress.
    let monsterTotal = 0;
    let monsterDone = 0;
    for (const dungeon of dungeons) {
      const monsters = monsterIllustrationsFor(dungeon.name);
      monsterTotal += monsters.length;
      monsterDone += monsters.filter((monster) => monsterCompletionState[monsterCompletionKey(dungeon.name, monster)] === true).length;
    }
    const monsterLeft = Math.max(0, monsterTotal - monsterDone);
    const monsterTotalEl = $("monster-progress-total");
    if (monsterTotalEl) monsterTotalEl.textContent = monsterTotal ? `${monsterDone}/${monsterTotal} complete · ${monsterLeft} left` : "No illustrations listed";
  }

  function updateExpandAllButton() {
    const button = $("expand-all");
    const cards = [...document.querySelectorAll("#dungeon-grid .dungeon-card.expandable")];
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
        ...monsterIllustrationsFor(dungeon.name),
        ...uniqueLootFor(dungeon.name),
        ...(dungeon.titleNames || [])
      ].join(" "));
      return haystack.includes(query);
    });

    $("dungeon-grid").innerHTML = visible.map((dungeon) => {
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
        item.codex ? '<span class="flag codex" title="Can be registered in Codex">Codex</span>' : "",
        item.titleMaterial ? '<span class="flag title" title="Used for a title">Title</span>' : "",
        item.badge5Material ? '<span class="flag badge5" title="Material used for Badge 5">Badge 5</span>' : ""
      ].join("");

      const renderGroup = (key, label) => {
        const items = grouped[key];
        const rows = items.length ? items.map((item) => {
          const flags = renderFlags(item);
          const trackable = isTrackable(item);
          const completionKey = itemCompletionKey(dungeon.name, item.name);
          const completed = trackable && completionState[completionKey] === true;
          const checkboxHtml = trackable
            ? `<input class="item-check" type="checkbox" ${completed ? "checked" : ""} aria-label="Mark ${esc(cleanItemName(item.name))} as completed">`
            : `<span class="item-check-spacer" aria-hidden="true"></span>`;
          return `<li class="item-row${completed ? " completed" : ""}${trackable ? " trackable" : ""}" ${trackable ? `data-completion-key="${esc(completionKey)}"` : ""}>
            <span class="item-main">
              ${checkboxHtml}
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

      const illustrations = monsterIllustrationsFor(dungeon.name);
      const monsterDone = illustrations.filter((monster) => monsterCompletionState[monsterCompletionKey(dungeon.name, monster)] === true).length;
      const monsterRows = illustrations.map((monster) => {
        const key = monsterCompletionKey(dungeon.name, monster);
        const checked = monsterCompletionState[key] === true;
        return `<label class="monster-illustration-row${checked ? " completed" : ""}" data-monster-key="${esc(key)}">
          <input class="monster-check" type="checkbox" ${checked ? "checked" : ""} aria-label="Mark ${esc(monster)} illustration as completed">
          <span>${esc(monster)}</span>
        </label>`;
      }).join("");
      const monsterSectionHtml = illustrations.length ? `<section class="monster-illustration-section">
        <div class="monster-illustration-head"><strong>Monster Illustration</strong><span class="monster-progress">Done ${monsterDone}/${illustrations.length}</span></div>
        <div class="monster-illustration-list">${monsterRows}</div>
      </section>` : "";

      const uniqueLoot = uniqueLootFor(dungeon.name);
      const uniqueLootSectionHtml = uniqueLoot.length ? `<section class="unique-loot-section">
        <div class="unique-loot-head"><strong>Unique Loot</strong><span class="unique-loot-items">${uniqueLoot.map(esc).join(" · ")}</span></div>
      </section>` : "";

      const hasAnyItems = (dungeon.items || []).length > 0;
      const columnsHtml = hasAnyItems ? `
        <div class="item-columns">
          ${renderGroup("equipment", "Equipment")}
          ${renderGroup("event", "Event")}
          ${renderGroup("etc", "ETC")}
          ${renderGroup("other", "Other")}
        </div>` : "";

      const meta = dungeon.entriesPerDay ? `${esc(dungeon.entriesPerDay)} ${Number(dungeon.entriesPerDay) === 1 ? "entry" : "entries"}/day${dungeon.entryScope === "account" ? "/account" : ""}` : "";
      const titleText = dungeon.titleNames?.length ? dungeon.titleNames.map(esc).join(" · ") : "";
      const titleCount = dungeon.titleNames?.length || 0;
      const titleNote = `<div class="title-summary-row"><span><strong class="title-summary-label" title="Track title completion in the Title Tracker">Title</strong> ${titleCount}</span><span class="title-summary-names">${titleText}</span></div>`;

      const dungeonKey = normalize(dungeon.name);
      const hasDrops = hasAnyItems;
      const isExpandable = hasDrops || illustrations.length > 0 || uniqueLoot.length > 0 || Boolean(titleText);
      const isExpanded = isExpandable && (expandedState.get(dungeonKey) === true);
      const trackableItems = (dungeon.items || []).filter(isTrackable);
      const completedCount = trackableItems.filter((item) => completionState[itemCompletionKey(dungeon.name, item.name)] === true).length;
      const titleRecords = titleRecordsForDungeon(dungeon.name);
      const titleProgressState = loadTitleProgress();
      const completedTitles = titleRecords.filter((title) => titleProgressState?.[title.id]?.complete === true).length;
      const overallTotal = illustrations.length + trackableItems.length + titleRecords.length;
      const overallDone = monsterDone + completedCount + completedTitles;
      const overallPct = overallTotal ? Math.round((overallDone / overallTotal) * 100) : 100;
      const overallHtml = `<div class="dungeon-overall-progress" data-overall-progress>
        <span><strong>Overall Progress</strong></span>
        <span class="overall-progress-track" aria-hidden="true"><i style="width:${overallPct}%"></i></span>
        <span class="overall-progress-count"><strong>Done</strong> ${overallDone}/${overallTotal}</span>
      </div>`;
      const monsterSummaryHtml = `<div class="monster-summary" aria-hidden="${isExpanded ? "true" : "false"}">
        <span><strong>Monster Illustration</strong> ${illustrations.length}</span>
        <span class="summary-progress"><strong>Done</strong> ${monsterDone}/${illustrations.length}</span>
      </div>`;
      const summaryHtml = `<div class="dungeon-summary" aria-hidden="${isExpanded ? "true" : "false"}">
        <span><strong>Equipment</strong> ${grouped.equipment.length}</span>
        <span><strong>Event</strong> ${grouped.event.length}</span>
        <span><strong>ETC</strong> ${grouped.etc.length}</span>
        <span><strong>Other</strong> ${grouped.other.length}</span>
        <span class="summary-progress"><strong>Done</strong> ${completedCount}/${trackableItems.length}</span>
      </div>`;

      const headerHtml = isExpandable ? `<button class="dungeon-toggle" type="button" aria-expanded="${isExpanded ? "true" : "false"}" title="${isExpanded ? "Return to summary" : "Show full list"} ${esc(dungeon.name)}">
        <div class="dungeon-title-wrap">
          <div class="dungeon-name-row">
            <div class="dungeon-name">${esc(dungeon.name)}</div>
            ${meta ? `<span class="dungeon-meta-inline">${meta}</span>` : ""}
          </div>
          <div class="dungeon-card-submeta">${illustrations.length} illustrations · ${trackableItems.length} codex · ${titleCount} ${titleCount === 1 ? "title" : "titles"}</div>
        </div>
        <span class="dungeon-head-right">
          <span class="level-badge">${esc(displayLevel(dungeon.level))}</span>
          <span class="collapse-chevron" aria-hidden="true">▼</span>
        </span>
      </button>` : `<div class="dungeon-static-head">
        <div class="dungeon-title-wrap">
          <div class="dungeon-name-row">
            <div class="dungeon-name">${esc(dungeon.name)}</div>
            ${meta ? `<span class="dungeon-meta-inline">${meta}</span>` : ""}
          </div>
          <div class="dungeon-card-submeta">${illustrations.length} illustrations · ${trackableItems.length} codex · ${titleCount} ${titleCount === 1 ? "title" : "titles"}</div>
        </div>
        <span class="level-badge">${esc(displayLevel(dungeon.level))}</span>
      </div>`;

      const cardContentHtml = `
        ${overallHtml}
        ${monsterSummaryHtml}
        ${summaryHtml}
        ${isExpandable ? `<div class="dungeon-body">${monsterSectionHtml}${uniqueLootSectionHtml}${columnsHtml}<section class="dungeon-conquest-placeholder"><div class="dungeon-conquest-placeholder-head"><strong>Dungeon Conquest</strong><span class="coming-soon-badge">Coming Soon</span></div></section></div>` : ""}
        ${titleNote}
      `;

      return `<article class="dungeon-card${isExpanded ? " expanded" : ""}${isExpandable ? " expandable" : ""}${hasDrops ? " has-drops" : " no-drops"}" data-category="${categoryFor(dungeon.level)}" data-dungeon-key="${esc(dungeonKey)}">
        <header class="dungeon-head">${headerHtml}</header>
        ${cardContentHtml}
      </article>`;
    }).join("");
    $("result-count").textContent = `${visible.length} dungeon${visible.length === 1 ? "" : "s"}`;
    $("empty-state").classList.toggle("hidden", visible.length > 0);
    updateExpandAllButton();
    updateProgressSummary();
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
    const cards = [...document.querySelectorAll("#dungeon-grid .dungeon-card.expandable")];
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


  function updateDungeonOverall(card, dungeon) {
    if (!card || !dungeon) return;
    const illustrations = monsterIllustrationsFor(dungeon.name);
    const monsterDone = illustrations.filter((monster) => monsterCompletionState[monsterCompletionKey(dungeon.name, monster)] === true).length;
    const trackableItems = (dungeon.items || []).filter(isTrackable);
    const codexDone = trackableItems.filter((item) => completionState[itemCompletionKey(dungeon.name, item.name)] === true).length;
    const titleProgressState = loadTitleProgress();
    const titles = titleRecordsForDungeon(dungeon.name);
    const titleDone = titles.filter((title) => titleProgressState?.[title.id]?.complete === true).length;
    const total = illustrations.length + trackableItems.length + titles.length;
    const done = monsterDone + codexDone + titleDone;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const row = card.querySelector("[data-overall-progress]");
    if (!row) return;
    const count = row.querySelector(".overall-progress-count");
    const bar = row.querySelector(".overall-progress-track i");
    if (count) count.innerHTML = `<strong>Done</strong> ${done}/${total}`;
    if (bar) bar.style.width = `${pct}%`;
  }

  $("dungeon-grid").addEventListener("change", (event) => {
    const monsterCheckbox = event.target.closest(".monster-check");
    if (monsterCheckbox) {
      const row = monsterCheckbox.closest(".monster-illustration-row");
      const key = row?.dataset.monsterKey;
      if (!key) return;
      if (monsterCheckbox.checked) monsterCompletionState[key] = true;
      else delete monsterCompletionState[key];
      saveMonsterCompletion();
      row.classList.toggle("completed", monsterCheckbox.checked);

      const card = monsterCheckbox.closest(".dungeon-card");
      const dungeonKey = card?.dataset.dungeonKey;
      const dungeon = dungeons.find((entry) => normalize(entry.name) === dungeonKey);
      if (dungeon) {
        const monsters = monsterIllustrationsFor(dungeon.name);
        const done = monsters.filter((monster) => monsterCompletionState[monsterCompletionKey(dungeon.name, monster)] === true).length;
        const summary = card.querySelector(".monster-summary-progress");
        const detail = card.querySelector(".monster-progress");
        if (summary) summary.textContent = `Done ${done}/${monsters.length}`;
        if (detail) detail.textContent = `Done ${done}/${monsters.length}`;
        updateDungeonOverall(card, dungeon);
      }
      // Keep Illustration Book Progress live while the popup is open.
      updateProgressSummary();
      return;
    }

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
      const trackableItems = dungeon.items.filter(isTrackable);
      const done = trackableItems.filter((item) => completionState[itemCompletionKey(dungeon.name, item.name)] === true).length;
      progress.innerHTML = `<strong>Done</strong> ${done}/${trackableItems.length}`;
      updateDungeonOverall(card, dungeon);
    }

    // Keep the Codex Progress popup live while it is open.
    updateProgressSummary();
  });

  const progressToggle = $("progress-toggle");
  const progressPanel = $("progress-panel");
  const clearProgress = $("clear-progress");
  const clearMonsterProgress = $("clear-monster-progress");

  function syncCodexToggleVisual() {
    if (!progressToggle || !progressPanel) return;
    const isOpen = !progressPanel.classList.contains("hidden");
    progressToggle.hidden = false;
    progressToggle.style.removeProperty("display");
    progressToggle.setAttribute("aria-expanded", String(isOpen));
    progressToggle.setAttribute("aria-label", isOpen ? "Close Codex Progress" : "Open Codex Progress");
    const toggleImage = $("codex-toggle-image");
    if (toggleImage) {
      progressToggle.classList.remove("image-failed");
      toggleImage.onerror = () => progressToggle.classList.add("image-failed");
      toggleImage.onload = () => progressToggle.classList.remove("image-failed");
      toggleImage.src = isOpen ? toggleImage.dataset.openSrc : toggleImage.dataset.closedSrc;
    }
  }

  progressToggle.addEventListener("click", () => {
    const willOpen = progressPanel.classList.contains("hidden");
    progressPanel.classList.toggle("hidden", !willOpen);
    progressToggle.setAttribute("aria-expanded", String(willOpen));
    progressToggle.setAttribute("aria-label", willOpen ? "Close Codex Progress" : "Open Codex Progress");
    syncCodexToggleVisual();
    if (willOpen) updateProgressSummary();
  });

  clearProgress.addEventListener("click", () => {
    if (!confirm("Clear all saved Codex progress for the Dungeons tab?")) return;
    for (const key of Object.keys(completionState)) delete completionState[key];
    saveCompletion();
    render();
    updateProgressSummary();
  });

  if (clearMonsterProgress) clearMonsterProgress.addEventListener("click", () => {
    if (!confirm("Clear all saved Monster Illustration progress for the Dungeons tab?")) return;
    for (const key of Object.keys(monsterCompletionState)) delete monsterCompletionState[key];
    saveMonsterCompletion();
    render();
    updateProgressSummary();
  });


  window.addEventListener("pageshow", () => {
    syncCodexToggleVisual();
    render();
    updateProgressSummary();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === TITLE_PROGRESS_KEY) render();
  });
  syncCodexToggleVisual();


  // Welcome / help popup. Show once per browser session, and reopen from the ? button.
  const WELCOME_SESSION_KEY = "lt-welcome-seen-v1";
  const welcomeOverlay = $("welcome-overlay");
  const helpToggle = $("help-toggle");
  const welcomeClose = $("welcome-close");

  function openWelcomePopup() {
    if (!welcomeOverlay) return;
    welcomeOverlay.classList.remove("hidden");
    welcomeOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("welcome-open");
    requestAnimationFrame(() => welcomeClose?.focus());
  }

  function closeWelcomePopup() {
    if (!welcomeOverlay) return;
    welcomeOverlay.classList.add("hidden");
    welcomeOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("welcome-open");
    try { sessionStorage.setItem(WELCOME_SESSION_KEY, "1"); } catch {}
    helpToggle?.focus();
  }

  helpToggle?.addEventListener("click", openWelcomePopup);
  welcomeClose?.addEventListener("click", closeWelcomePopup);
  welcomeOverlay?.addEventListener("click", (event) => {
    if (event.target === welcomeOverlay) closeWelcomePopup();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && welcomeOverlay && !welcomeOverlay.classList.contains("hidden")) closeWelcomePopup();
  });

  let welcomeSeen = false;
  try { welcomeSeen = sessionStorage.getItem(WELCOME_SESSION_KEY) === "1"; } catch {}
  if (!welcomeSeen) openWelcomePopup();

  $("theme-toggle").addEventListener("click", cycleTheme);
  const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  if (media) media.addEventListener("change", () => {
    if (savedThemeMode() === "system") applyTheme("system");
  });
  applyTheme(savedThemeMode());
  renderLastSync();
  render();
})();
