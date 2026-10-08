let videos=[];let likes=[];let comments=[];const CUSTOM_KEY="beyondDashboardCustomization";const CUSTOM_DEFAULTS={density:"comfortable",columns:"2",insights:true,recent:true,remember:true,latest:false,tools:{content:true,analytics:true,live:true,audience:true,monetization:true,notifications:true,upload:true,comments:true,settings:true}};document.addEventListener("DOMContentLoaded",load);async function db(){return new Promise((ok,no)=>{const r=indexedDB.open("BeyondDatabase",4);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains("videos"))d.createObjectStore("videos",{keyPath:"id",autoIncrement:true});if(!d.objectStoreNames.contains("comments"))d.createObjectStore("comments",{keyPath:"id",autoIncrement:true});if(!d.objectStoreNames.contains("likes"))d.createObjectStore("likes",{keyPath:"key"});};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}function all(d,n){return new Promise((ok,no)=>{const r=d.transaction(n,"readonly").objectStore(n).getAll();r.onsuccess=()=>ok(r.result||[]);r.onerror=()=>no(r.error)})}async function load(){
 try{
  const client=window.beyondDB||(typeof initBeyondDatabase==="function"?initBeyondDatabase():null);
  if(client){
   const {data:{user}}=await client.auth.getUser();
   if(user){
    const {data:rows,error}=await client.from("videos").select("*").eq("user_id",user.id).order("created_at",{ascending:false});
    if(error)throw error;
    const videoIds=(rows||[]).map(v=>v.id);
    let likeRows=[],commentRows=[];
    if(videoIds.length){
      const [lr,cr]=await Promise.all([
        client.from("likes").select("video_id").in("video_id",videoIds),
        client.from("comments").select("video_id").in("video_id",videoIds)
      ]);
      if(lr.error)throw lr.error;
      if(cr.error)throw cr.error;
      likeRows=lr.data||[];
      commentRows=cr.data||[];
    }
    videos=(rows||[]).map(v=>({...v,id:v.id,caption:v.caption||"",createdAt:v.created_at,views:Number(v.views_count||0),likes:likeRows.filter(x=>x.video_id===v.id).length,comments:commentRows.filter(x=>x.video_id===v.id).length,status:v.status||"published"}));
    likes=[];comments=[];
    const followResult=await client.from("follows").select("follower_id",{count:"exact",head:true}).eq("following_id",user.id);
    if(followResult.error)throw followResult.error;
    window.beyondCreatorFollowerCount=followResult.count||0;
    render();
    subscribeCreatorRealtime(client,user.id,videoIds);
    return;
   }
  }
  const d=await db(),u=localStorage.getItem("beyondUsername");
  videos=(await all(d,"videos")).filter(v=>!u||v.username===u);
  likes=await all(d,"likes");comments=await all(d,"comments");
  videos.forEach(v=>{v.likes=likes.filter(x=>x.postId===v.id).length;v.comments=comments.filter(x=>x.postId===v.id).length;v.views=Number(localStorage.getItem("beyondViews_"+v.id)||0)});
  render();
 }catch(e){console.error("Beyond Creator Studio:",e);render()}
}
async function getCustomization(){const base={...CUSTOM_DEFAULTS,tools:{...CUSTOM_DEFAULTS.tools}};let merged=base;try{const saved=JSON.parse(localStorage.getItem(CUSTOM_KEY)||"null");if(saved)merged={...base,...saved,tools:{...base.tools,...(saved.tools||{})}}}catch(e){console.warn("Beyond dashboard preferences:",e)}try{const client=window.beyondDB||(typeof initBeyondDatabase==="function"?initBeyondDatabase():null);const user=client?await getCurrentBeyondUser():null;if(client&&user){const {data,error}=await client.from("dashboard_customizations").select("settings").eq("user_id",user.id).maybeSingle();if(!error&&data?.settings&&typeof data.settings==="object"){merged={...base,...data.settings,tools:{...base.tools,...(data.settings.tools||{})}};localStorage.setItem(CUSTOM_KEY,JSON.stringify(merged))}}}catch(e){console.warn("Beyond dashboard customization sync unavailable:",e)}return merged}async function applyCustomization(){const c=await getCustomization();document.body.dataset.dashboardDensity=c.density==="compact"?"compact":"comfortable";const tools=document.querySelector(".tools");if(tools)tools.style.gridTemplateColumns=c.columns==="1"?"1fr":"";document.querySelectorAll("[data-studio-tool]").forEach(el=>{const k=el.dataset.studioTool;el.style.display=k==="customization"||c.tools[k]!==false?"flex":"none"});const recentPanel=document.getElementById("recentPanel"),insightsPanel=document.getElementById("insightsPanel");if(recentPanel)recentPanel.style.display=c.recent?"block":"none";if(insightsPanel)insightsPanel.style.display=c.insights?"block":"none";const grid=document.querySelector("main");grid.classList.toggle("dashboard-single-column",c.columns==="1");if(c.latest){const recent=document.getElementById("recent");recent.dataset.order="latest"}}function fmt(v){v=Number(v)||0;return v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e3?(v/1e3).toFixed(1)+"K":String(Math.round(v))}function render(){const tv=videos.reduce((a,v)=>a+v.views,0),tl=videos.reduce((a,v)=>a+v.likes,0),tc=videos.reduce((a,v)=>a+v.comments,0);document.getElementById("creatorName").textContent=localStorage.getItem("beyondUsername")||"Creator";document.getElementById("videos").textContent=fmt(videos.length);document.getElementById("views").textContent=fmt(tv);document.getElementById("likes").textContent=fmt(tl);document.getElementById("comments").textContent=fmt(tc);document.getElementById("avgViews").textContent=fmt(videos.length?tv/videos.length:0);document.getElementById("engagement").textContent=(tv?((tl+tc)/tv*100).toFixed(1):"0")+"%";const creatorUser=localStorage.getItem("beyondUsername")||"";
  const followerMap=(()=>{try{return JSON.parse(localStorage.getItem("beyondFollowers")||"{}")}catch{return {}}})();
  const localFollowerCount=Array.isArray(followerMap[creatorUser])?followerMap[creatorUser].length:0;
  const followerCount=Number.isFinite(window.beyondCreatorFollowerCount)?window.beyondCreatorFollowerCount:localFollowerCount;
  document.getElementById("followers").textContent=fmt(followerCount);document.getElementById("published").textContent=videos.filter(v=>(v.status||"published")==="published").length;const recent=[...videos].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,5);document.getElementById("recent").innerHTML=recent.length?recent.map(v=>'<div class="video"><div><h3>'+esc(v.caption||"Untitled video")+'</h3><p>❤️ '+fmt(v.likes)+' · 💬 '+fmt(v.comments)+'</p></div><strong>👁 '+fmt(v.views)+'</strong></div>').join(""):'<p style="color:#9299a6;font-size:12px">No videos yet. Upload your first Beyond video.</p>';applyCustomization()}function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}

function subscribeCreatorRealtime(client,userId,videoIds){
  if(!client||!userId)return;
  if(window.beyondCreatorRealtimeChannel)client.removeChannel(window.beyondCreatorRealtimeChannel);
  const channel=client.channel("beyond-creator-studio-"+userId)
    .on("postgres_changes",{event:"*",schema:"public",table:"videos",filter:"user_id=eq."+userId},()=>load())
    .on("postgres_changes",{event:"*",schema:"public",table:"follows",filter:"following_id=eq."+userId},()=>load())
    .on("postgres_changes",{event:"*",schema:"public",table:"likes"},payload=>{
      const id=payload.new?.video_id||payload.old?.video_id;
      if(videoIds.includes(id))load();
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"comments"},payload=>{
      const id=payload.new?.video_id||payload.old?.video_id;
      if(videoIds.includes(id))load();
    });
  channel.subscribe(status=>{
    if(status==="SUBSCRIBED"){window.beyondCreatorRealtimeChannel=channel;return;}
    if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
      if(window.beyondCreatorRealtimeChannel===channel)window.beyondCreatorRealtimeChannel=null;
      try{client.removeChannel(channel)}catch(e){console.warn("Beyond Creator Studio realtime cleanup:",e)}
      if(document.visibilityState!=="hidden")setTimeout(()=>subscribeCreatorRealtime(client,userId,videoIds),5000);
    }
  });
}
