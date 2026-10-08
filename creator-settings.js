const KEY="beyondCreatorSettings";
const defaults={privateAccount:false,activityStatus:true,recommendations:true,commentAccess:"everyone",commentFilter:true,allowReplies:true,notifyLikes:true,notifyComments:true,notifyFollowers:true,notifyLive:true,defaultVisibility:"public",defaultComments:"everyone",captionLanguage:"auto",theme:"dark",compactMode:false,saveLiveHistory:true,liveAudience:"public"};
const ids=Object.keys(defaults),$=id=>document.getElementById(id);
function applyTheme(theme,compact){document.body.classList.toggle("compact",!!compact);document.body.classList.toggle("light",theme==="light");if(theme==="system")document.body.classList.toggle("light",matchMedia("(prefers-color-scheme:light)").matches)}
function load(){let data={...defaults};try{data={...data,...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{}ids.forEach(id=>{const el=$(id);if(!el)return;el.type==="checkbox"?el.checked=!!data[id]:el.value=data[id]});applyTheme(data.theme,data.compactMode)}
function collect(){const data={};ids.forEach(id=>{const el=$(id);if(el)data[id]=el.type==="checkbox"?el.checked:el.value});return data}
function save(){const data=collect();localStorage.setItem(KEY,JSON.stringify(data));applyTheme(data.theme,data.compactMode);$("status").textContent="Settings saved successfully.";setTimeout(()=>$("status").textContent="",2500)}
$("settingsForm").addEventListener("submit",e=>{e.preventDefault();save()});
$("saveTop").addEventListener("click",save);
$("resetBtn").addEventListener("click",()=>{ids.forEach(id=>{const el=$(id);el.type==="checkbox"?el.checked=!!defaults[id]:el.value=defaults[id]});save()});
load();