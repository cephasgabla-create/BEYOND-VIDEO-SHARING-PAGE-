const KEY="beyondCreatorSettings";
const defaults={privateAccount:false,activityStatus:true,recommendations:true,commentAccess:"everyone",commentFilter:true,allowReplies:true,notifyLikes:true,notifyComments:true,notifyFollowers:true,notifyLive:true,defaultVisibility:"public",defaultComments:"everyone",captionLanguage:"auto",theme:"dark",compactMode:false,saveLiveHistory:true,liveAudience:"public"};
const ids=Object.keys(defaults),$=id=>document.getElementById(id);
let supabaseSettings=false;
function applyTheme(theme,compact){document.body.classList.toggle("compact",!!compact);document.body.classList.toggle("light",theme==="light");if(theme==="system")document.body.classList.toggle("light",matchMedia("(prefers-color-scheme:light)").matches)}
function readLocal(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")}catch{return {}}}
function loadLocal(){const data={...defaults,...readLocal()};ids.forEach(id=>{const el=$(id);if(!el)return;el.type==="checkbox"?el.checked=!!data[id]:el.value=data[id]});applyTheme(data.theme,data.compactMode);return data}
async function load(){
  const local=loadLocal();
  try{
    const db=window.beyondDB||(typeof initBeyondDatabase==="function"?initBeyondDatabase():null);
    const user=db?await getCurrentBeyondUser():null;
    if(!db||!user)return;
    const {data,error}=await db.from("creator_settings").select("settings").eq("user_id",user.id).maybeSingle();
    if(error)throw error;
    if(data?.settings&&typeof data.settings==="object"){
      const merged={...defaults,...data.settings};
      ids.forEach(id=>{const el=$(id);if(el)el.type==="checkbox"?el.checked=!!merged[id]:el.value=merged[id]});
      applyTheme(merged.theme,merged.compactMode);
      localStorage.setItem(KEY,JSON.stringify(merged));
    }
    supabaseSettings=true;
  }catch(e){console.warn("Beyond Creator Settings database load unavailable:",e)}
}
function collect(){const data={};ids.forEach(id=>{const el=$(id);if(el)data[id]=el.type==="checkbox"?el.checked:el.value});return data}
async function save(){
  const data=collect();localStorage.setItem(KEY,JSON.stringify(data));applyTheme(data.theme,data.compactMode);
  try{
    const db=window.beyondDB||(typeof initBeyondDatabase==="function"?initBeyondDatabase():null);
    const user=db?await getCurrentBeyondUser():null;
    if(db&&user){
      const {error}=await db.from("creator_settings").upsert({user_id:user.id,settings:data,updated_at:new Date().toISOString()},{onConflict:"user_id"});
      if(error)throw error;
      supabaseSettings=true;
    }
    $("status").textContent=supabaseSettings?"Settings saved to Supabase.":"Settings saved locally. Connect Supabase to sync them across devices.";
  }catch(e){
    console.warn("Beyond Creator Settings database save unavailable:",e);
    $("status").textContent="Settings saved locally. Database sync is unavailable.";
  }
  setTimeout(()=>$("status").textContent="",3000);
}
$("settingsForm").addEventListener("submit",e=>{e.preventDefault();save()});
$("saveTop").addEventListener("click",save);
$("resetBtn").addEventListener("click",async()=>{ids.forEach(id=>{const el=$(id);el.type==="checkbox"?el.checked=!!defaults[id]:el.value=defaults[id]});await save()});
load();