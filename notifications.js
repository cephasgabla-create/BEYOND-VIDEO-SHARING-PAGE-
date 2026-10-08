let items=[],currentFilter="all",realtimeChannel=null,realtimeTimer=null,loading=false,db=null,userId=null;
document.addEventListener("DOMContentLoaded",init);

function safe(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function typeOf(x){return String(x.type||"activity").toLowerCase()}
function icon(type){return type==="like"?"❤️":type==="comment"?"💬":type==="follow"?"👤":type==="live"?"🔴":type==="message"?"✉️":"🔔"}
function label(type){return type==="like"?"Like":type==="comment"?"Comment":type==="follow"?"Follow":type==="live"?"Live":type==="message"?"Message":"Activity"}
function dateText(v){if(!v)return"Recorded activity";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}
function isToday(v){if(!v)return false;const d=new Date(v),n=new Date();return !Number.isNaN(d.getTime())&&d.toDateString()===n.toDateString()}
function getSupabase(){try{return window.beyondDB||(typeof initBeyondDatabase==="function"?initBeyondDatabase():null)}catch(e){return null}}

function init(){
 document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentFilter=b.dataset.filter;render()}));
 loadNotifications();
}

async function loadNotifications(){
 if(loading)return; loading=true;
 try{
  db=getSupabase();
  if(!db)throw new Error("Supabase is not configured.");
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError)throw authError;
  if(!user){location.href="login.html?redirect=notifications.html";return}
  userId=user.id;
  const {data,error}=await db.from("notifications")
    .select("id,type,message,read,created_at,actor_id,video_id,comment_id")
    .eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);
  if(error)throw error;
  const actorIds=[...new Set((data||[]).map(x=>x.actor_id).filter(Boolean))];
  let profiles=new Map();
  if(actorIds.length){
   const {data:p,error:pError}=await db.from("profiles").select("id,username,display_name,avatar_url").in("id",actorIds);
   if(pError)throw pError;
   profiles=new Map((p||[]).map(x=>[x.id,x]));
  }
  items=(data||[]).map(x=>{
   const p=profiles.get(x.actor_id),actor=p?.username||p?.display_name||"Someone";
   return {...x,actor,avatar_url:p?.avatar_url||"",title:actor};
  });
  render(); subscribeRealtime();
 }catch(e){
  console.error("Beyond Notifications:",e);
  items=[];
  renderError(e.message||"Could not load notifications.");
 }finally{loading=false}
}

function renderError(message){
 const box=document.getElementById("activity");
 box.innerHTML='<div class="empty"><strong>Notifications unavailable</strong><br><br>'+safe(message)+'<br><br><button class="outline" onclick="loadNotifications()">Try again</button></div>';
 document.getElementById("unreadCount").textContent="0";document.getElementById("unreadStat").textContent="0";document.getElementById("totalCount").textContent="0";document.getElementById("todayCount").textContent="0";document.getElementById("followCount").textContent="0";
}

function scheduleNotificationReload(){clearTimeout(realtimeTimer);realtimeTimer=setTimeout(()=>loadNotifications(),500)}
function subscribeRealtime(){
 if(!db||!userId)return;
 if(realtimeChannel)db.removeChannel(realtimeChannel);
 realtimeChannel=db.channel("beyond-notifications-"+userId)
  .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:"user_id=eq."+userId},scheduleNotificationReload)
  .subscribe(status=>{if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")setTimeout(subscribeRealtime,5000)});
}
function filtered(){return items.filter(x=>currentFilter==="all"||(currentFilter==="unread"&&!x.read)||typeOf(x)===currentFilter)}
function render(){
 const unread=items.filter(x=>!x.read).length;
 document.getElementById("unreadCount").textContent=unread;document.getElementById("unreadStat").textContent=unread;
 document.getElementById("totalCount").textContent=items.length;
 document.getElementById("todayCount").textContent=items.filter(x=>isToday(x.created_at)).length;
 document.getElementById("followCount").textContent=items.filter(x=>typeOf(x)==="follow").length;
 const box=document.getElementById("activity"),list=filtered();
 if(!list.length){box.innerHTML='<div class="empty">No recorded activity matches this filter.</div>';return}
 box.innerHTML=list.map(x=>{
  const type=typeOf(x),message=x.message||("New "+label(type).toLowerCase()+" activity.");
  return '<article class="activity '+(x.read?"":"unread")+'"><div class="activity-icon">'+icon(type)+'</div><div class="activity-body"><strong>'+safe(x.title||label(type))+'</strong><p>'+safe(message)+'</p><time>'+safe(dateText(x.created_at))+'</time></div>'+(!x.read?'<span class="dot" title="Unread"></span>':"")+'<button class="read-btn" onclick="toggleRead('+Number(x.id)+')">'+(x.read?"Unread":"Read")+'</button></article>'
 }).join("");
}
async function toggleRead(id){
 const item=items.find(x=>Number(x.id)===Number(id));if(!item||!db)return;
 try{
  const {error}=await db.from("notifications").update({read:!item.read}).eq("id",id).eq("user_id",userId);
  if(error)throw error; await loadNotifications();
 }catch(e){alert("Could not update notification: "+e.message)}
}
async function markAllRead(){
 if(!db||!userId)return;
 try{
  const {error}=await db.from("notifications").update({read:true}).eq("user_id",userId).eq("read",false);
  if(error)throw error; await loadNotifications();
 }catch(e){alert("Could not mark notifications read: "+e.message)}
}
async function clearNotifications(){
 if(!items.length)return;
 if(!confirm("Delete all your notifications?"))return;
 try{
  const {error}=await db.from("notifications").delete().eq("user_id",userId);
  if(error)throw error; await loadNotifications();
 }catch(e){alert("Could not clear notifications: "+e.message)}
}
window.addEventListener("beforeunload",()=>{if(realtimeTimer)clearTimeout(realtimeTimer);if(realtimeChannel&&db)db.removeChannel(realtimeChannel)});
