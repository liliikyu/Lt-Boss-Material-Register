(() => {
  const D = window.LT_DATA || { titles: [] };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const THEME_KEY = "lt-theme";
  const TITLE_PROGRESS_KEY = "lt-title-progress-v1";

  function loadProgress(){
    try { const value = JSON.parse(localStorage.getItem(TITLE_PROGRESS_KEY) || "{}"); return value && typeof value === "object" ? value : {}; }
    catch { return {}; }
  }
  const progress = loadProgress();
  function saveProgress(){ localStorage.setItem(TITLE_PROGRESS_KEY, JSON.stringify(progress)); }
  function rowState(id){ return progress[id] || (progress[id] = { complete:false, current:[0,0,0] }); }

  function preferredTheme(){ return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"; }
  function savedThemeMode(){ const x=localStorage.getItem(THEME_KEY); return ["system","light","dark"].includes(x) ? x : "system"; }
  function applyTheme(mode){
    const resolved=mode === "system" ? preferredTheme() : mode;
    document.documentElement.dataset.theme=resolved; document.documentElement.style.colorScheme=resolved;
    const button=$("theme-toggle"); if(!button) return;
    button.textContent=mode === "light" ? "☀" : mode === "dark" ? "☾" : "◐";
    const label=mode.charAt(0).toUpperCase()+mode.slice(1); button.title=`Theme: ${label}`; button.setAttribute("aria-label",`Theme: ${label}. Click to switch theme.`);
  }
  function cycleTheme(){ const c=savedThemeMode(); const n=c === "system" ? "light" : c === "light" ? "dark" : "system"; localStorage.setItem(THEME_KEY,n); applyTheme(n); }
  applyTheme(savedThemeMode()); $("theme-toggle")?.addEventListener("click",cycleTheme);
  window.matchMedia?.("(prefers-color-scheme: light)")?.addEventListener?.("change",()=>{ if(savedThemeMode()==="system") applyTheme("system"); });

  function renderLastSync(){
    const el=$("last-sync"); if(!el) return; const raw=D.lastSyncedAt;
    if(!raw){el.textContent="Not available";return;} const date=new Date(raw);
    if(Number.isNaN(date.getTime())){el.textContent=String(raw);return;}
    el.dateTime=date.toISOString(); el.textContent=date.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"});
  }

  function materialName(name){ return String(name || "").trim(); }
  function parseMaterial(name){
    const raw=materialName(name);
    const match=raw.match(/\s*\((Event|ETC|Equipment|Consume)\)\s*$/i);
    if(!match) return { name:raw, type:"" };
    const type=match[1].toLowerCase();
    return { name:raw.slice(0,match.index).trim(), type };
  }
  function materialTypeBadge(type){
    if(type === "event") return '<span class="material-type-badge event">Event</span>';
    if(type === "etc") return '<span class="material-type-badge etc">ETC</span>';
    if(type === "equipment") return '<span class="material-type-badge equipment">Equipment</span>';
    if(type === "consume") return '<span class="material-type-text">(Consume)</span>';
    return "";
  }
  function numericRequired(title){ const n=Number(title.amountRequired); return Number.isFinite(n) && n >= 0 ? n : 0; }
  function currentValue(state,index){ const n=Number(state.current?.[index]); return Number.isFinite(n) && n >= 0 ? n : 0; }

  function updateStats(){
    const total=(D.titles||[]).length; const done=(D.titles||[]).filter(t=>rowState(t.id).complete).length;
    $("title-complete-count").textContent=done; $("title-total-count").textContent=total;
    $("title-progress-bar").style.width=total ? `${(done/total)*100}%` : "0%";
  }

  function displayDungeonLevel(raw){
    const text=String(raw || "").trim();
    if(!text) return "";
    if(/^UL/i.test(text)) return text.replace(/^UL(?:v)?\.?\s*/i,"ULv. ");
    if(/^SL/i.test(text)) return text.replace(/^SL(?:v)?\.?\s*/i,"SLv. ");
    if(/^Lv/i.test(text)) return text.replace(/^Lv\.?\s*/i,"Lv. ");
    return `Lv. ${text}`;
  }

  function hasCouponII(title){
    const value=String(title?.coupon || "").trim().toLowerCase();
    return Boolean(value) && !["no","false","0","-","n/a","na"].includes(value);
  }

  const COUPON_ICON_DATA = "data:image/png;base64,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";

  function couponIconHtml(title){
    if(!hasCouponII(title)) return "";
    return `<img class="title-coupon-icon" src="${COUPON_ICON_DATA}" alt="Coupon II" title="Available from Instance Dungeon Guaranteed Titlebook Coupon II">`;
  }

  function titleSetHtml(value){
    const parts=String(value || "").split(/\r?\n|\s*\|\s*/).map(v=>v.trim()).filter(Boolean);
    return parts.length ? parts.map(v=>`<span class="title-set-line">${esc(v)}</span>`).join("") : '<span class="empty-cell">—</span>';
  }

  function render(){
    const query=normalize($("title-search").value); const status=$("title-status").value;
    const visible=(D.titles||[]).filter((title)=>{
      const state=rowState(title.id);
      if(status === "complete" && !state.complete) return false;
      if(status === "incomplete" && state.complete) return false;
      if(!query) return true;
      return normalize([title.title,title.dungeon,title.dungeonLevel,title.titleSet,...(title.materials||[])].join(" ")).includes(query);
    });
    $("title-table-body").innerHTML=visible.map((title)=>{
      const state=rowState(title.id); const req=numericRequired(title); const mats=[...(title.materials||[])].slice(0,3);
      const materialRows=mats.length ? mats.map((mat,i)=>{
        const parsed=parseMaterial(mat); const cur=currentValue(state,i); const rem=Math.max(req-cur,0);
        const ready=req > 0 && rem === 0;
        const completed = state.complete || ready;
        return `<div class="material-progress-row">
          <div class="material-info"><span class="material-name">${esc(parsed.name || mat)}</span>${materialTypeBadge(parsed.type)}</div>
          <div class="material-progress-inline">
            <input class="current-input" type="number" min="0" step="1" inputmode="numeric" value="${state.complete ? "" : esc(cur)}" ${state.complete ? "disabled" : ""} data-title-id="${esc(title.id)}" data-index="${i}" aria-label="Current amount for ${esc(parsed.name || mat)}">
            <span class="progress-slash">/</span>
            <span class="material-remaining ${completed ? "ready" : ""}" data-remaining-for="${esc(title.id)}:${i}"><strong${completed ? ' style="color:#ff4f8b"' : ""}>${completed ? "✓" : `${esc(rem)} remaining`}</strong></span>
          </div>
        </div>`;
      }).join("") : '<div class="no-title-materials">No material tracking required.</div>';
      return `<tr class="${state.complete ? "title-complete-row" : ""}" data-title-row="${esc(title.id)}">
        <td class="complete-cell"><input class="title-complete-check" type="checkbox" ${state.complete ? "checked" : ""} data-title-id="${esc(title.id)}" aria-label="Mark ${esc(title.title)} complete"></td>
        <td class="title-name-cell"><span class="title-name-line"><strong>${esc(title.title)}</strong>${couponIconHtml(title)}</span><span class="title-dungeon-name">${esc(title.dungeon || "—")}${title.dungeonLevel ? ` (${esc(displayDungeonLevel(title.dungeonLevel))})` : ""}</span></td>
        <td class="materials-stack-cell">${materialRows}</td>
        <td class="title-set-cell">${titleSetHtml(title.titleSet)}</td>
      </tr>`;
    }).join("");
    $("result-count").textContent=`${visible.length} title${visible.length===1?"":"s"}`;
    $("title-empty-state").classList.toggle("hidden",visible.length>0); updateStats();
  }

  $("title-table-body").addEventListener("input",(event)=>{
    const input=event.target.closest(".current-input"); if(!input)return;
    const id=input.dataset.titleId; const index=Number(input.dataset.index); const state=rowState(id); const value=Math.max(0,Number(input.value)||0);
    state.current=Array.isArray(state.current)?state.current:[0,0,0]; state.current[index]=value; saveProgress();
    const title=(D.titles||[]).find(t=>t.id===id); const req=numericRequired(title); const rem=Math.max(req-value,0); const target=document.querySelector(`[data-remaining-for="${CSS.escape(id+":"+index)}"]`); if(target){ const strong=target.querySelector("strong"); const completed=state.complete || (req>0 && rem===0); if(strong){ strong.textContent=completed?"✓":`${rem} remaining`; strong.style.color=completed?"#ff4f8b":""; } target.classList.toggle("ready",completed); }
  });
  $("title-table-body").addEventListener("change",(event)=>{
    const check=event.target.closest(".title-complete-check"); if(!check)return;
    const state=rowState(check.dataset.titleId); state.complete=check.checked; saveProgress();
    check.closest("tr")?.classList.toggle("title-complete-row",check.checked); updateStats();
    render();
  });
  $("title-search").addEventListener("input",render); $("title-status").addEventListener("change",render);
  $("reset-title-progress").addEventListener("click",()=>{
    if(!confirm("Clear all saved Title Tracker progress in this browser?"))return;
    localStorage.removeItem(TITLE_PROGRESS_KEY); Object.keys(progress).forEach(k=>delete progress[k]); render();
  });
  renderLastSync(); render();
})();
