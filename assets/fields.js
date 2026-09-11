(() => {
  const DATA = window.LT_FIELD_DATA || { fields:{} };
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const THEME_KEY="lt-theme", WELCOME_SESSION_KEY="lt-welcome-seen-v1";
  const MONSTER_KEY="lt-field-monster-illustration-completion-v1", CODEX_KEY="lt-field-codex-completion-v1";
  const REGION_FIELDS = {
    "Jiendia": [
      "Forest Area","Ancient Forest","Temple of Pluton","Field Area","Underground Cave","Mountain Area","Arcadia",
      "Dark Forest","Pyramid","Dark Moon Castle","Owl Castle","Red Crop Field","Cherry Lake","Twilight Cornfield",
      "Desert Area","Orca Beach","Rheinmetz Stomach","Phantom Ship","Jungle Area","Ant Cave","Ktuka Underworld",
      "Ktuka Ruins","Fairy Forest","Xenadia Aqua Garden","Xenadia Earth Garden","Snowfield","Cloud Villa","Saurus Field",
      "The Tallest Tree","Savannah","Jiendia Park","Baker's Street","Nightmare Village","Spooky Village","Toad Hill",
      "City of Lilliput","Abyss Ruins","Empyrean","Underworld Canal","City of Iron","Bongo Train","D-Labo","Hangar",
      "Mossy Temple","Webfoot Octopus Temple","Coral City","Aquarium","Bifrost","Solar Farm","Botanical Garden"
    ],
    "Freios": [
      "Pheuma","Floating City","Eidos, the Sanctuary","Knossos","West El Anoir Plains","North El Anoir Plains",
      "South El Anoir Plains","East El Anoir Plains","Aircraft Crash Site","Treasure Beach","Aki City","Marin Island",
      "Devil's Mountain","Aurora Forest","Coral Forest","Wailing Coast","Vanaheimr","Forgotten Fields","Sunset Plains",
      "Phantom Genesis","Military Garrison","Temple Courtyard","Temple Interior","Velfa Library","Mushroom Forest",
      "Quartz Cave","Jade Forest","Storm Weather Ruins","Monster Tree Hill","Sky Coliseum Lobby","Magical Forest"
    ],
    "Western Freios": [
      "Invernel Ruins","Glaston Admin Area","LaChouette Slums","Oscar Road","Linlos, Sacred place","Ygdir","Salar Coast",
      "Crystal Moon Forest","Laran Road","Whispering Hill","Vayuna Canyon","Oracrium","Air Island"
    ],
    "Eastland": [
      "Deborah Snowfield","Avalon","Old Belos","Burning City","Zisk Plains","White Cole Canyon","Waterlily Forest",
      "Moros","Phobos","Jude Capital","Amarune Desert","Adrica","Under City Construction"
    ]
  };
  const REGION_ORDER = ["Jiendia","Freios","Western Freios","Eastland","Other / Unmapped"];
  const normRegionName=(v)=>String(v??"").toLowerCase().replace(/&/g,"and").replace(/[’']/g,"'").replace(/[^a-z0-9]+/g," ").trim();
  const REGION_LOOKUP = new Map();
  Object.entries(REGION_FIELDS).forEach(([region,names])=>names.forEach(name=>REGION_LOOKUP.set(normRegionName(name),region)));
  function regionFor(name){
    const raw=normRegionName(name);
    if(REGION_LOOKUP.has(raw)) return REGION_LOOKUP.get(raw);

    // Canonicalise wiki spelling/punctuation/numbered variants to the map name.
    // Field and Dungeon progress remain separate; this only affects region grouping.
    const explicitAliases={
      "aie island":"Western Freios",
      "air island":"Western Freios",
      "amalrune desert":"Eastland",
      "amarune desert":"Eastland",
      "aqua garden":"Jiendia",
      "base snowfield":"Jiendia",
      "behemoth's stomach":"Jiendia",
      "collapsed tower":"Freios",
      "cookie garden":"Jiendia",
      "doll street":"Jiendia",
      "dragon lair":"Jiendia",
      "egg castle":"Jiendia",
      "factory":"Jiendia",
      "flower valley":"Jiendia",
      "monster tower":"Jiendia",
      "mountain cave":"Jiendia",
      "scrap valley":"Jiendia",
      "scrap valley entrance":"Jiendia",
      "scrap valley exit":"Jiendia",
      "silver ivy mansion":"Freios",
      "star dwarf warehouse":"Freios",
      "stardust plains":"Freios",
      "tiger temple":"Jiendia",
      "valhalla":"Jiendia",
      "white chapel":"Jiendia",
      "white chapel alley":"Jiendia",
      "xenadia aqua garden":"Jiendia",
      "bongolle train":"Jiendia",
      "bongo train":"Jiendia",
      "botanical garden jiendia":"Jiendia",
      "chunsik castle":"Jiendia",
      "chunsik land":"Jiendia",
      "chunsik tunnel":"Jiendia",
      "d labo bay asgard":"Jiendia",
      "d labo":"Jiendia",
      "eidos the sanctuary":"Freios",
      "el anoir mountains":"Freios",
      "elysia":"Western Freios",
      "foe mansion":"Jiendia",
      "invernell ruins":"Western Freios",
      "invernel ruins":"Western Freios",
      "jungle area ktuka ruins":"Jiendia",
      "knossos field":"Freios",
      "la chouette slums":"Western Freios",
      "lachouette slums":"Western Freios",
      "liliput":"Jiendia",
      "city of lilliput":"Jiendia",
      "lindos sacred place":"Western Freios",
      "linlos sacred place":"Western Freios",
      "orcarium":"Western Freios",
      "oracrium":"Western Freios",
      "xenadia earth garden central area":"Jiendia",
      "xenadia earth garden ruins":"Jiendia",
      "zerenis hill":"Freios",
      "pneumia":"Western Freios",
      "pheuma":"Freios",
      "royal dragon palace":"Jiendia",
      "royal dragon place":"Jiendia",
      "savannah jiendia":"Jiendia",
      "sunsent plains":"Freios",
      "sunset plains":"Freios",
      "taid empyrean":"Jiendia",
      "taid flower valley":"Jiendia",
      "temple pluton":"Jiendia",
      "temple of pluton":"Jiendia",
      "toad seashore":"Jiendia",
      "undercity construction":"Eastland",
      "under city construction":"Eastland",
      "under city construction site":"Eastland",
      "vanaheimr wailing coast":"Freios",
      "vigrid":"Western Freios"
    };
    if(explicitAliases[raw]) return explicitAliases[raw];

    // Numbered wiki variants (e.g. Aurora Forest 3, D-Labo 6) inherit
    // the region of the base field when the base exists on the map.
    const withoutNumber=raw.replace(/\s+\d+$/,'').trim();
    if(REGION_LOOKUP.has(withoutNumber)) return REGION_LOOKUP.get(withoutNumber);
    if(explicitAliases[withoutNumber]) return explicitAliases[withoutNumber];

    // Taid variants inherit the base field region.
    const withoutTaid=raw.replace(/^taid\s+/,'').trim();
    if(REGION_LOOKUP.has(withoutTaid)) return REGION_LOOKUP.get(withoutTaid);
    if(explicitAliases[withoutTaid]) return explicitAliases[withoutTaid];

    // Minor one-word spelling variants seen in wiki sources.
    const spellingFixed=raw
      .replace(/\bvaley\b/g,'valley')
      .replace(/\bsunsent\b/g,'sunset')
      .replace(/\bamalrune\b/g,'amarune')
      .replace(/\binvernell\b/g,'invernel')
      .replace(/\blindos\b/g,'linlos')
      .replace(/\bbongolle\b/g,'bongo');
    if(REGION_LOOKUP.has(spellingFixed)) return REGION_LOOKUP.get(spellingFixed);
    if(explicitAliases[spellingFixed]) return explicitAliases[spellingFixed];

    return "Other / Unmapped";
  }
  const load=(key)=>{try{const x=JSON.parse(localStorage.getItem(key)||"{}");return x&&typeof x==="object"?x:{}}catch{return {}}};
  const monsters=load(MONSTER_KEY), codex=load(CODEX_KEY);
  const save=()=>{localStorage.setItem(MONSTER_KEY,JSON.stringify(monsters));localStorage.setItem(CODEX_KEY,JSON.stringify(codex));};
  const key=(field,name)=>`${field}::${name}`;
  function preferredTheme(){return matchMedia?.("(prefers-color-scheme: light)")?.matches?"light":"dark"}
  function savedThemeMode(){const x=localStorage.getItem(THEME_KEY);return ["system","light","dark"].includes(x)?x:"system"}
  function applyTheme(mode){const r=mode==="system"?preferredTheme():mode;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r;const b=$("theme-toggle");if(!b)return;b.textContent=mode==="light"?"☀":mode==="dark"?"☾":"◐";const l=mode[0].toUpperCase()+mode.slice(1);b.title=`Theme: ${l}`;b.setAttribute("aria-label",`Theme: ${l}. Click to switch theme.`)}
  applyTheme(savedThemeMode()); $("theme-toggle")?.addEventListener("click",()=>{const c=savedThemeMode(),n=c==="system"?"light":c==="light"?"dark":"system";localStorage.setItem(THEME_KEY,n);applyTheme(n)}); matchMedia?.("(prefers-color-scheme: light)")?.addEventListener?.("change",()=>{if(savedThemeMode()==="system")applyTheme("system")});
  const overlay=$("welcome-overlay"), help=$("help-toggle"), close=$("welcome-close");
  function openWelcome(){overlay?.classList.remove("hidden");overlay?.setAttribute("aria-hidden","false");document.body.classList.add("welcome-open");requestAnimationFrame(()=>close?.focus());try{sessionStorage.setItem(WELCOME_SESSION_KEY,"1")}catch{}}
  function closeWelcome(){overlay?.classList.add("hidden");overlay?.setAttribute("aria-hidden","true");document.body.classList.remove("welcome-open");help?.focus()}
  help?.addEventListener("click",openWelcome);close?.addEventListener("click",closeWelcome);overlay?.addEventListener("click",e=>{if(e.target===overlay)closeWelcome()});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay?.classList.contains("hidden"))closeWelcome()});try{if(sessionStorage.getItem(WELCOME_SESSION_KEY)!=="1")openWelcome()}catch{openWelcome()}
  const codexName=(entry)=>typeof entry==="string"?entry:String(entry?.name??"");
  const codexCategory=(entry)=>{const raw=typeof entry==="object"?String(entry?.category??"Other"):"Other";const n=raw.toLowerCase();if(n.includes("equip"))return "Equipment";if(n.includes("event"))return "Event";if(n==="etc"||n.includes("etc"))return "ETC";return "Other";};
  const entries=Object.entries(DATA.fields||{}).map(([name,value])=>({
    name,
    illustrations:[...new Set(value.illustrations||[])],
    codex:(value.codex||[]).map(x=>typeof x==="string"?x:{name:codexName(x),category:codexCategory(x)}).filter(x=>codexName(x))
  })).sort((a,b)=>a.name.localeCompare(b.name));
  const expanded=new Set();
  const collapsedRegions=new Set();
  function stats(field){const mt=field.illustrations.length,ct=field.codex.length,md=field.illustrations.filter(n=>monsters[key(field.name,n)]).length,cd=field.codex.filter(n=>codex[key(field.name,codexName(n))]).length;return{mt,ct,md,cd,total:mt+ct,done:md+cd}}
  function renderMonsterSection(field){
    const done=field.illustrations.filter(n=>monsters[key(field.name,n)]).length;
    if(!field.illustrations.length)return "";
    const rows=field.illustrations.map(n=>{const k=key(field.name,n),checked=!!monsters[k];return `<label class="monster-illustration-row${checked?" completed":""}"><input class="monster-check" type="checkbox" data-type="monsters" data-field="${esc(field.name)}" data-name="${esc(n)}" ${checked?"checked":""} aria-label="Mark ${esc(n)} illustration as completed"><span>${esc(n)}</span></label>`}).join("");
    return `<section class="monster-illustration-section"><div class="monster-illustration-head"><strong>Monster Illustration</strong><span class="monster-progress">Done ${done}/${field.illustrations.length}</span></div><div class="monster-illustration-list">${rows}</div></section>`;
  }
  function renderCodexColumns(field){
    const groups={Equipment:[],Event:[],ETC:[],Other:[]};
    field.codex.forEach(entry=>groups[codexCategory(entry)].push(entry));
    const renderGroup=(label)=>{
      const list=groups[label];
      const rows=list.length?list.map(entry=>{const n=codexName(entry),k=key(field.name,n),checked=!!codex[k];return `<li class="item-row${checked?" completed":""}"><span class="item-main"><input class="item-check" type="checkbox" data-type="codex" data-field="${esc(field.name)}" data-name="${esc(n)}" ${checked?"checked":""} aria-label="Mark ${esc(n)} as completed"><span class="item-name">${esc(n)}</span></span><span class="item-flags"><span class="flag codex">Codex</span></span></li>`}).join(""):'<li class="column-empty">—</li>';
      return `<section class="item-column"><div class="item-column-head">${label}</div><ul class="item-list">${rows}</ul></section>`;
    };
    return `<div class="item-columns">${renderGroup("Equipment")}${renderGroup("Event")}${renderGroup("ETC")}${renderGroup("Other")}</div>`;
  }
  function render(){
    const q=$("field-search").value.toLowerCase().trim();
    const visible=entries.filter(f=>!q||[f.name,...f.illustrations,...f.codex.map(codexName)].join(" ").toLowerCase().includes(q));
    $("result-count").textContent=`${visible.length} field${visible.length===1?"":"s"}`;
    const grouped=new Map(REGION_ORDER.map(r=>[r,[]]));
    visible.forEach(f=>grouped.get(regionFor(f.name)).push(f));
    $("field-grid").innerHTML=REGION_ORDER.map(region=>{
      const fields=grouped.get(region)||[];
      if(!fields.length)return "";
      const regionTotal=fields.reduce((a,f)=>a+stats(f).total,0), regionDone=fields.reduce((a,f)=>a+stats(f).done,0);
      const isCollapsed=!q&&collapsedRegions.has(region);
      const cards=fields.map(f=>{
        const s=stats(f),pct=s.total?Math.round(s.done/s.total*100):100,is=expanded.has(f.name);
        const groups={Equipment:0,Event:0,ETC:0,Other:0};f.codex.forEach(entry=>groups[codexCategory(entry)]++);
        const overall=`<div class="dungeon-overall-progress"><span><strong>Overall Progress</strong></span><span class="overall-progress-track" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="overall-progress-count"><strong>Done</strong> ${s.done}/${s.total}</span></div>`;
        const details=`<div class="field-card-body">${renderMonsterSection(f)}${renderCodexColumns(f)}</div>`;
        return `<article class="field-card ${is?"expanded":""}" data-field-card="${esc(f.name)}"><button class="field-card-head" type="button" data-toggle-field="${esc(f.name)}" aria-expanded="${is}"><span class="field-card-title-wrap"><span class="field-card-title">${esc(f.name)}</span><span class="field-card-submeta">${s.mt} illustration${s.mt===1?"":"s"} · ${s.ct} codex</span></span><span class="collapse-chevron" aria-hidden="true">▼</span></button>${overall}${details}</article>`;
      }).join("");
      return `<section class="field-region ${isCollapsed?"collapsed":""}" data-region="${esc(region)}"><button class="field-region-head" type="button" data-toggle-region="${esc(region)}" aria-expanded="${!isCollapsed}"><span><strong>${esc(region)}</strong><small>${fields.length} field${fields.length===1?"":"s"}</small></span><span class="field-region-progress">${regionDone}/${regionTotal} done <b>${isCollapsed?"▸":"▾"}</b></span></button><div class="field-region-grid">${cards}</div></section>`;
    }).join("");
    $("field-empty-state").classList.toggle("hidden",visible.length>0);
    $("field-sync-note").classList.toggle("hidden",entries.length>0);
    updateProgress();
  }
  $("field-grid").addEventListener("click",e=>{const r=e.target.closest("[data-toggle-region]");if(r){const n=r.dataset.toggleRegion;collapsedRegions.has(n)?collapsedRegions.delete(n):collapsedRegions.add(n);render();return;}const b=e.target.closest("[data-toggle-field]");if(!b)return;const n=b.dataset.toggleField;expanded.has(n)?expanded.delete(n):expanded.add(n);render()});
  $("field-grid").addEventListener("change",e=>{const i=e.target.closest('input[type="checkbox"][data-field]');if(!i)return;const state=i.dataset.type==="monsters"?monsters:codex;state[key(i.dataset.field,i.dataset.name)]=i.checked;if(!i.checked)delete state[key(i.dataset.field,i.dataset.name)];save();render()});
  $("field-search").addEventListener("input",render);$("reset-field-filter").addEventListener("click",()=>{$("field-search").value="";render()});$("expand-all-fields").addEventListener("click",()=>{const all=expanded.size===entries.length;expanded.clear();if(!all)entries.forEach(f=>expanded.add(f.name));render()});
  function updateProgress(){
    const allM=entries.flatMap(f=>f.illustrations.map(n=>key(f.name,n)));
    const codexEntries=entries.flatMap(f=>f.codex.map(entry=>({field:f.name,name:codexName(entry),category:codexCategory(entry)})));
    const allC=codexEntries.map(x=>key(x.field,x.name));
    const md=allM.filter(k=>monsters[k]).length,cd=allC.filter(k=>codex[k]).length;
    $("field-monster-total").textContent=`${md}/${allM.length} complete · ${allM.length-md} left`;
    $("field-codex-total").textContent=`${cd}/${allC.length} complete · ${allC.length-cd} left`;
    const body=$("field-progress-summary-body");
    if(body){
      const categories=["Equipment","Event","ETC","Other"];
      body.innerHTML=categories.map(category=>{const list=codexEntries.filter(x=>x.category===category),done=list.filter(x=>codex[key(x.field,x.name)]).length,left=list.length-done;return `<tr><th scope="row">${category}</th><td>${list.length}</td><td>${done}</td><td class="progress-left${left===0?" complete":""}">${left}</td></tr>`}).join("");
    }
  }
  const panel=$("field-progress-panel"),toggle=$("field-progress-toggle"),img=$("field-progress-toggle-image");toggle?.addEventListener("click",()=>{const open=panel.classList.toggle("hidden")===false;toggle.setAttribute("aria-expanded",String(open));if(img)img.src=open?img.dataset.openSrc:img.dataset.closedSrc;updateProgress()});
  $("clear-field-monsters")?.addEventListener("click",()=>{if(!confirm("Clear all saved Field Monster Illustration progress in this browser?"))return;localStorage.removeItem(MONSTER_KEY);Object.keys(monsters).forEach(k=>delete monsters[k]);render()});
  $("clear-field-codex")?.addEventListener("click",()=>{if(!confirm("Clear all saved Field Item Codex progress in this browser?"))return;localStorage.removeItem(CODEX_KEY);Object.keys(codex).forEach(k=>delete codex[k]);render()});
  render();
})();