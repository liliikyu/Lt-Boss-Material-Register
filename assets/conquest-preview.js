(()=>{
  const $=(id)=>document.getElementById(id);
  const THEME_KEY="lt-theme", WELCOME_SESSION_KEY="lt-welcome-seen-v1";
  const preferredTheme=()=>matchMedia?.("(prefers-color-scheme: light)")?.matches?"light":"dark";
  const savedThemeMode=()=>localStorage.getItem(THEME_KEY)||"system";
  function applyTheme(mode){const resolved=mode==="system"?preferredTheme():mode;document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved;const b=$("theme-toggle");if(!b)return;b.textContent=mode==="light"?"☀":mode==="dark"?"☾":"◐";const l=mode[0].toUpperCase()+mode.slice(1);b.title=`Theme: ${l}`;b.setAttribute("aria-label",`Theme: ${l}. Click to switch theme.`)}
  applyTheme(savedThemeMode());
  $("theme-toggle")?.addEventListener("click",()=>{const c=savedThemeMode(),n=c==="system"?"light":c==="light"?"dark":"system";localStorage.setItem(THEME_KEY,n);applyTheme(n)});
  matchMedia?.("(prefers-color-scheme: light)")?.addEventListener?.("change",()=>{if(savedThemeMode()==="system")applyTheme("system")});
  const overlay=$("welcome-overlay"),help=$("help-toggle"),close=$("welcome-close");
  function openWelcome(){overlay?.classList.remove("hidden");overlay?.setAttribute("aria-hidden","false");document.body.classList.add("welcome-open");requestAnimationFrame(()=>close?.focus());try{sessionStorage.setItem(WELCOME_SESSION_KEY,"1")}catch{}}
  function closeWelcome(){overlay?.classList.add("hidden");overlay?.setAttribute("aria-hidden","true");document.body.classList.remove("welcome-open");help?.focus()}
  help?.addEventListener("click",openWelcome);close?.addEventListener("click",closeWelcome);overlay?.addEventListener("click",e=>{if(e.target===overlay)closeWelcome()});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!overlay?.classList.contains("hidden"))closeWelcome()});
})();