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

  const WELCOME_SESSION_KEY = "lt-welcome-seen-v1";
  const welcomeOverlay = $("welcome-overlay");
  const helpToggle = $("help-toggle");
  const welcomeClose = $("welcome-close");
  function openWelcomePopup(){
    if(!welcomeOverlay) return;
    welcomeOverlay.classList.remove("hidden");
    welcomeOverlay.setAttribute("aria-hidden","false");
    document.body.classList.add("welcome-open");
    requestAnimationFrame(()=>welcomeClose?.focus());
    try{ sessionStorage.setItem(WELCOME_SESSION_KEY,"1"); }catch{}
  }
  function closeWelcomePopup(){
    if(!welcomeOverlay) return;
    welcomeOverlay.classList.add("hidden");
    welcomeOverlay.setAttribute("aria-hidden","true");
    document.body.classList.remove("welcome-open");
    helpToggle?.focus();
  }
  helpToggle?.addEventListener("click",openWelcomePopup);
  welcomeClose?.addEventListener("click",closeWelcomePopup);
  welcomeOverlay?.addEventListener("click",(event)=>{ if(event.target===welcomeOverlay) closeWelcomePopup(); });
  document.addEventListener("keydown",(event)=>{ if(event.key==="Escape" && welcomeOverlay && !welcomeOverlay.classList.contains("hidden")) closeWelcomePopup(); });
  let welcomeSeen=false;
  try{ welcomeSeen=sessionStorage.getItem(WELCOME_SESSION_KEY)==="1"; }catch{}
  if(!welcomeSeen) openWelcomePopup();
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
  function numericRequired(title){ const n=Number(title.amountRequired); return Number.isFinite(n) && n >= 0 ? n : null; }
  function specialRequirement(title){ const raw=String(title?.amountRequired ?? "").trim(); return raw && numericRequired(title) === null ? raw : ""; }
  function elyRequirement(title){
    let raw=title?.elyRequired;
    if(raw === null || raw === undefined || String(raw).trim() === ""){
      const legacy=(title?.materials||[]).find((m)=>/^\s*[\d,]+\s+ely\s*$/i.test(String(m||"")));
      raw=legacy || "";
    }
    if(raw === null || raw === undefined || String(raw).trim() === "") return "";
    const text=String(raw).trim();
    const n=Number(text.replace(/\s*ely\s*$/i,"").replace(/,/g,""));
    return Number.isFinite(n) ? `${n.toLocaleString()} Ely` : text;
  }
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

  function couponIconHtml(title){
    if(!hasCouponII(title)) return "";
    return `<img class="title-coupon-icon" src="assets/title-coupon.png?v=13.5.2" alt="Coupon II" title="Available from Instance Dungeon Guaranteed Titlebook Coupon II" style="display:inline-block;width:22px;height:22px;object-fit:contain;vertical-align:middle;margin-left:4px;flex:0 0 22px;">`;
  }

  function titleSetHtml(value){
    const parts=String(value || "").split(/\r?\n|\s*\|\s*/).map(v=>v.trim()).filter(Boolean);
    if(!parts.length) return '<span class="empty-cell">—</span>';
    return `<span class="title-set-inline">${parts.map(esc).join(' <span class="title-set-separator">|</span> ')}</span>`;
  }

  function render(){
    const query=normalize($("title-search").value); const status=$("title-status").value;
    const visible=(D.titles||[]).filter((title)=>{
      const state=rowState(title.id);
      if(status === "complete" && !state.complete) return false;
      if(status === "incomplete" && state.complete) return false;
      if(!query) return true;
      return normalize([title.title,title.dungeon,title.dungeonLevel,title.titleSet,title.elyRequired,...(title.materials||[])].join(" ")).includes(query);
    });
    $("title-table-body").innerHTML=visible.map((title)=>{
      const state=rowState(title.id); const req=numericRequired(title); const specialReq=specialRequirement(title); const elyReq=elyRequirement(title);
      const rawMats=[...(title.materials||[])].filter((mat)=>!/^\s*[\d,]+\s+ely\s*$/i.test(String(mat||"")));
      // If a non-material requirement is supplied in Amount Required, suppress stale
      // untyped requirement notes from older snapshots but keep real typed items.
      const mats=(specialReq ? rawMats.filter((mat)=>Boolean(parseMaterial(mat).type)) : rawMats).slice(0,3);
      const trackedRows=mats.length ? mats.map((mat,i)=>{
        const parsed=parseMaterial(mat);
        if(req === null){
          return `<div class="material-progress-row requirement-only-row"><div class="material-info"><span class="material-name">${esc(parsed.name || mat)}</span>${materialTypeBadge(parsed.type)}</div></div>`;
        }
        const cur=currentValue(state,i); const rem=Math.max(req-cur,0);
        const ready=req > 0 && rem === 0;
        const completed = state.complete || ready;
        return `<div class="material-progress-row">
          <div class="material-info"><span class="material-name">${esc(parsed.name || mat)}</span>${materialTypeBadge(parsed.type)}</div>
          <div class="material-progress-inline">
            <input class="current-input" type="number" min="0" step="1" inputmode="numeric" value="${state.complete ? "" : esc(cur)}" ${state.complete ? "disabled" : ""} data-title-id="${esc(title.id)}" data-index="${i}" aria-label="Current amount for ${esc(parsed.name || mat)}">
            <span class="progress-slash">/</span>
            <span class="material-remaining ${completed ? "ready" : ""}" data-remaining-for="${esc(title.id)}:${i}"><strong${completed ? ' class="material-complete-mark"' : ""}>${completed ? "✓" : `${esc(rem)} remaining`}</strong></span>
          </div>
        </div>`;
      }).join("") : "";
      const specialRow = specialReq ? `<div class="material-progress-row requirement-only-row"><div class="material-info"><span class="material-name">${esc(specialReq)}</span></div></div>` : "";
      const elyRow = elyReq ? `<div class="material-progress-row requirement-only-row ely-requirement"><div class="material-info"><span class="material-name">${esc(elyReq)}</span></div></div>` : "";
      const materialRows = (trackedRows || specialRow || elyRow) ? `${trackedRows}${specialRow}${elyRow}` : '<div class="no-title-materials">No material tracking required.</div>';
      const extraRequirement = "";
      return `<tr class="${state.complete ? "title-complete-row" : ""}" data-title-row="${esc(title.id)}">
        <td class="complete-cell"><input class="title-complete-check" type="checkbox" ${state.complete ? "checked" : ""} data-title-id="${esc(title.id)}" aria-label="Mark ${esc(title.title)} complete"></td>
        <td class="title-name-cell"><span class="title-name-line"><strong>${esc(title.title)}</strong>${couponIconHtml(title)}</span><span class="title-dungeon-name">${esc(title.dungeon || "—")}${title.dungeonLevel ? ` (${esc(displayDungeonLevel(title.dungeonLevel))})` : ""}</span></td>
        <td class="materials-stack-cell">${materialRows}${extraRequirement}</td>
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
    const title=(D.titles||[]).find(t=>t.id===id); const req=numericRequired(title); if(req === null) return; const rem=Math.max(req-value,0); const target=document.querySelector(`[data-remaining-for="${CSS.escape(id+":"+index)}"]`); if(target){ const strong=target.querySelector("strong"); const completed=state.complete || (req>0 && rem===0); if(strong){ strong.textContent=completed?"✓":`${rem} remaining`; strong.style.color=""; strong.classList.toggle("material-complete-mark",completed); } target.classList.toggle("ready",completed); }
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
