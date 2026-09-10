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
  function numericRequired(title){ const n=Number(title.amountRequired); return Number.isFinite(n) && n >= 0 ? n : 0; }
  function currentValue(state,index){ const n=Number(state.current?.[index]); return Number.isFinite(n) && n >= 0 ? n : 0; }

  function updateStats(){
    const total=(D.titles||[]).length; const done=(D.titles||[]).filter(t=>rowState(t.id).complete).length;
    $("title-complete-count").textContent=done; $("title-total-count").textContent=total;
    $("title-progress-bar").style.width=total ? `${(done/total)*100}%` : "0%";
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
      const state=rowState(title.id); const req=numericRequired(title); const mats=[...(title.materials||[])].slice(0,3); while(mats.length<3)mats.push("");
      const materialCells=mats.map((mat,i)=>{
        if(!mat) return '<td class="material-cell empty-cell">—</td><td class="number-cell empty-cell">—</td><td class="number-cell empty-cell">—</td>';
        const cur=currentValue(state,i); const rem=Math.max(req-cur,0);
        return `<td class="material-cell">${esc(materialName(mat))}</td><td class="number-cell"><input class="current-input" type="number" min="0" step="1" inputmode="numeric" value="${esc(cur)}" data-title-id="${esc(title.id)}" data-index="${i}" aria-label="Current amount for ${esc(materialName(mat))}"></td><td class="number-cell remaining-cell" data-remaining-for="${esc(title.id)}:${i}">${esc(rem)}</td>`;
      }).join("");
      return `<tr class="${state.complete ? "title-complete-row" : ""}" data-title-row="${esc(title.id)}">
        <td class="complete-cell"><input class="title-complete-check" type="checkbox" ${state.complete ? "checked" : ""} data-title-id="${esc(title.id)}" aria-label="Mark ${esc(title.title)} complete"></td>
        <td class="title-name-cell">${esc(title.title)}</td><td>${esc(title.dungeon)}</td><td class="level-cell">${esc(title.dungeonLevel || "—")}</td>
        <td class="number-cell required-cell">${req || "—"}</td>${materialCells}<td class="title-set-cell">${esc(title.titleSet || "—")}</td>
      </tr>`;
    }).join("");
    $("result-count").textContent=`${visible.length} title${visible.length===1?"":"s"}`;
    $("title-empty-state").classList.toggle("hidden",visible.length>0); updateStats();
  }

  $("title-table-body").addEventListener("input",(event)=>{
    const input=event.target.closest(".current-input"); if(!input)return;
    const id=input.dataset.titleId; const index=Number(input.dataset.index); const state=rowState(id); const value=Math.max(0,Number(input.value)||0);
    state.current=Array.isArray(state.current)?state.current:[0,0,0]; state.current[index]=value; saveProgress();
    const title=(D.titles||[]).find(t=>t.id===id); const rem=Math.max(numericRequired(title)-value,0); const target=document.querySelector(`[data-remaining-for="${CSS.escape(id+":"+index)}"]`); if(target)target.textContent=rem;
  });
  $("title-table-body").addEventListener("change",(event)=>{
    const check=event.target.closest(".title-complete-check"); if(!check)return;
    const state=rowState(check.dataset.titleId); state.complete=check.checked; saveProgress();
    check.closest("tr")?.classList.toggle("title-complete-row",check.checked); updateStats();
    if($("title-status").value !== "all") render();
  });
  $("title-search").addEventListener("input",render); $("title-status").addEventListener("change",render);
  $("reset-title-progress").addEventListener("click",()=>{
    if(!confirm("Clear all saved Title Tracker progress in this browser?"))return;
    localStorage.removeItem(TITLE_PROGRESS_KEY); Object.keys(progress).forEach(k=>delete progress[k]); render();
  });
  renderLastSync(); render();
})();
