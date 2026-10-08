let items=[],currentFilter="all",usingSupabase=false,realtimeChannel=null;
document.addEventListener("DOMContentLoaded",init);
function safe(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function read(){try{const a=JSON.parse(localStorage.getItem("beyondNotifications")||"[]");return Array.isArray(a)?a:[]}catch(e){return[]}}
function save(){localStorage.setItem("beyondNotifications",JSON.stringify(items))}
function typeOf(x){const t=String(x.type||x.kind||"activity").toLowerCase();if(t.includes("like"))return"like";if(t.includes("comment"))return"comment";if(t.includes("follow"))return"follow";if(t.includes("live"))return"live";return"activity"}
function icon(type){return type==="like"?"❤️":type==="comment"?"💬":type==="follow"?"👤":type==="live"?"🔴":"🔔"}
function label(type){return type==="like"?"Like":type==="comment"?"Comment":type==="follow"?"Follow":type==="live"?"Live":"Activity"}
function dateText(v){if(!v)return"Recorded activity";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}
function isToday(v){if(!v)return false;const d=new Date(v),n=new Date();return !Number.isNaN(d.getTime())&&d.toDateString()===n.toDateString()}
function init(){
  items=read();
  document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentFilter=b.dataset.filter;render()}));
  loadNotifications();
}
function getSupabase(){try{return window.beyondDB||(typeof initBeyondDatabase==="function"?initBeyondDatabase():null)}catch(e){return null}}
async function loadNotifications(){
  const db=getSupabase();
  if(db){
    try{
      const {data:{user}}=await db.auth.getUser();
      if(user){
        usingSupabase=true;
        const {data:videos,error:vError}=await db.from("videos").select("id,caption,created_at").eq("user_id",user.id).order("created_at",{ascending:false});
        if(vError)throw vError;
        const ids=(videos||[]).map(v=>v.id);
        const [followResult,likeResult,commentResult]=await Promise.all([
          db.from("follows").select("follower_id,following_id,created_at,profiles!follows_follower_id_fkey(username,display_name)").eq("following_id",user.id).order("created_at",{ascending:false}).limit(100),
          ids.length?db.from("likes").select("user_id,video_id,created_at,profiles!likes_user_id_fkey(username,display_name)").in("video_id",ids).order("created_at",{ascending:false}).limit(100):Promise.resolve({data:[],error:null}),
          ids.length?db.from("comments").select("user_id,video_id,content,created_at,profiles!comments_user_id_fkey(username,display_name)").in("video_id",ids).order("created_at",{ascending:false}).limit(100):Promise.resolve({data:[],error:null})
        ]);
        if(followResult.error)throw followResult.error;
        if(likeResult.error)throw likeResult.error;
        if(commentResult.error)throw commentResult.error;

        const oldRead=new Set(read().filter(x=>x.read).map(x=>x.id));
        const events=[];
        (followResult.data||[]).forEach(x=>{
          const actor=x.profiles?.username||x.profiles?.display_name||"Someone";
          events.push({id:"follow:"+x.follower_id+":"+x.created_at,type:"follow",title:actor,message:"started following you.",createdAt:x.created_at,read:oldRead.has("follow:"+x.follower_id+":"+x.created_at)});
        });
        const videoMap=new Map((videos||[]).map(v=>[v.id,v]));
        (likeResult.data||[]).forEach(x=>{
          const actor=x.profiles?.username||x.profiles?.display_name||"Someone",v=videoMap.get(x.video_id);
          events.push({id:"like:"+x.user_id+":"+x.video_id+":"+x.created_at,type:"like",title:actor,message:"liked your video"+(v?.caption?' "'+v.caption+'"':"."),createdAt:x.created_at,read:oldRead.has("like:"+x.user_id+":"+x.video_id+":"+x.created_at)});
        });
        (commentResult.data||[]).forEach(x=>{
          const actor=x.profiles?.username||x.profiles?.display_name||"Someone",v=videoMap.get(x.video_id);
          events.push({id:"comment:"+x.id,type:"comment",title:actor,message:"commented on your video"+(v?.caption?' "'+v.caption+'"':": "+x.content),createdAt:x.created_at,read:oldRead.has("comment:"+x.id)});
        });
        (videos||[]).forEach(v=>{
          events.push({id:"video:"+v.id,type:"activity",title:"Video published",message:v.caption||"You uploaded a Beyond video.",createdAt:v.created_at,read:oldRead.has("video:"+v.id)});
        });
        items=events.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        save();render();subscribeRealtime(db,user.id);return;
      }
    }catch(e){console.warn("Beyond Supabase notifications unavailable:",e)}
  }
  usingSupabase=false;render();
}
function subscribeRealtime(db,userId){
  if(realtimeChannel)db.removeChannel(realtimeChannel);
  realtimeChannel=db.channel("beyond-notifications-"+userId)
    .on("postgres_changes",{event:"*",schema:"public",table:"follows",filter:"following_id=eq."+userId},()=>loadNotifications())
    .on("postgres_changes",{event:"*",schema:"public",table:"videos",filter:"user_id=eq."+userId},()=>loadNotifications())
    .on("postgres_changes",{event:"*",schema:"public",table:"likes"},()=>loadNotifications())
    .on("postgres_changes",{event:"*",schema:"public",table:"comments"},()=>loadNotifications())
    .subscribe();
}
function filtered(){return items.filter(x=>currentFilter==="all"||(currentFilter==="unread"&&!x.read)||typeOf(x)===currentFilter)}
function render(){
  const unread=items.filter(x=>!x.read).length;
  document.getElementById("unreadCount").textContent=unread;document.getElementById("unreadStat").textContent=unread;
  document.getElementById("totalCount").textContent=items.length;
  document.getElementById("todayCount").textContent=items.filter(x=>isToday(x.createdAt||x.timestamp||x.date)).length;
  document.getElementById("followCount").textContent=items.filter(x=>typeOf(x)==="follow").length;
  const box=document.getElementById("activity"),list=filtered().slice();
  if(!list.length){box.innerHTML='<div class="empty">No recorded activity matches this filter.</div>';return}
  box.innerHTML=list.map(x=>{
    const type=typeOf(x),read=!!x.read,title=x.title||x.actor||x.username||label(type),message=x.message||x.text||x.action||("New "+label(type).toLowerCase()+" activity."),index=items.indexOf(x);
    return '<article class="activity '+(read?"":"unread")+'"><div class="activity-icon">'+icon(type)+'</div><div class="activity-body"><strong>'+safe(title)+'</strong><p>'+safe(message)+'</p><time>'+safe(dateText(x.createdAt||x.timestamp||x.date))+'</time></div>'+(!read?'<span class="dot" title="Unread"></span>':"")+'<button class="read-btn" onclick="toggleRead('+index+')">'+(read?"Unread":"Read")+'</button></article>'
  }).join("");
}
function toggleRead(i){if(!items[i])return;items[i].read=!items[i].read;save();render()}
function markAllRead(){items=items.map(x=>({...x,read:true}));save();render()}
function clearNotifications(){if(!items.length)return;if(!confirm("Clear all recorded activity?"))return;items=[];save();render()}
