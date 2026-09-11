(() => {
  const KEY="lt-theme", b=document.getElementById("theme-toggle");
  const pref=()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";
  const saved=()=>["system","light","dark"].includes(localStorage.getItem(KEY))?localStorage.getItem(KEY):"system";
  function apply(mode){const resolved=mode==="system"?pref():mode;document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved;if(b){const icon=mode==="light"?"☀":mode==="dark"?"☾":"◐",label=mode[0].toUpperCase()+mode.slice(1);b.textContent=icon;b.title=`Theme: ${label}`;b.setAttribute("aria-label",`Theme: ${label}. Click to switch theme.`);}}
  b?.addEventListener("click",()=>{const c=saved(),n=c==="system"?"light":c==="light"?"dark":"system";localStorage.setItem(KEY,n);apply(n);});
  const media=window.matchMedia?.("(prefers-color-scheme: light)");media?.addEventListener("change",()=>{if(saved()==="system")apply("system")});apply(saved());
})();
