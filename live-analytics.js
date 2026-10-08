let sessions=[],liveChannel=null,db=null;document.addEventListener("DOMContentLoaded",loadLiveAnalytics);
const n=v=>Number(v)||0,fmt=v=>{v=n(v);return v>=1000000?(v/1000000).toFixed(1)+"M":v>=1000?(v/1000).toFixed(1)+"K":String(Math.round(v))},mins=v=>Math.max(0,Math.round(n(v)/60));
function getLocal(){try{const x=JSON.parse(localStorage.getItem("beyondLiveSessions")||"[]");return Array.isArray(x)?x:[]}catch{return[]}}
async function loadLiveAnalytics(){
 sessions=getLocal();
 try{
  db=window.beyondDB||(typeof initBeyondDatabase==="function"?initBeyondDatabase():null);
  const user=db?await getCurrentBeyondUser():null;
  if(db&&user){
   const {data:rooms,error}=await db.from("live_rooms").select("id,title,started_at,ended_at,viewer_count,active").eq("host_id",user.id).order("started_at",{ascending:false});
   if(error)throw error;
   const rows=rooms||[],ids=rows.map(r=>r.id);
   let messages=[],reactions=[];
   if(ids.length){
    const [m,r]=await Promise.all([
     db.from("live_messages").select("room_id").in("room_id",ids),
     db.from("live_reactions").select("room_id").in("room_id",ids)
    ]);
    if(m.error)throw m.error;if(r.error)throw r.error;messages=m.data||[];reactions=r.data||[];
   }
   sessions=rows.map(r=>{const start=new Date(r.started_at||0),end=r.ended_at?new Date(r.ended_at):null;const duration=end&&!isNaN(start)&&!isNaN(end)?Math.max(0,(end-start)/1000):0;return {id:r.id,title:r.title||"Beyond Live session",createdAt:r.started_at,viewers:n(r.viewer_count),peakViewers:n(r.viewer_count),duration,durationSeconds:duration,messages:messages.filter(x=>x.room_id===r.id).length,reactions:reactions.filter(x=>x.room_id===r.id).length,active:!!r.active}}); 
   render();draw();subscribeLive(db,user.id);return;
  }
 }catch(e){console.warn("Beyond Supabase live analytics unavailable:",e)}
 render();draw();
}
function render(){
 const total=sessions.reduce((a,s)=>a+n(s.viewers||s.totalViewers),0),peak=sessions.reduce((a,s)=>Math.max(a,n(s.peakViewers||s.peak||s.viewers)),0),reactions=sessions.reduce((a,s)=>a+n(s.reactions||s.reactionCount),0),messages=sessions.reduce((a,s)=>a+n(s.messages||s.messageCount||s.chatMessages),0),seconds=sessions.reduce((a,s)=>a+n(s.duration||s.durationSeconds),0);
 document.getElementById("sessions").textContent=fmt(sessions.length);document.getElementById("viewers").textContent=fmt(total);document.getElementById("peak").textContent=fmt(peak);document.getElementById("reactions").textContent=fmt(reactions);document.getElementById("messages").textContent=fmt(messages);document.getElementById("duration").textContent=mins(seconds)+"m";document.getElementById("reactionRate").textContent=(total?(reactions/total).toFixed(2):"0");document.getElementById("chatRate").textContent=(total?(messages/total).toFixed(2):"0");document.getElementById("avgDuration").textContent=mins(sessions.length?seconds/sessions.length:0)+"m";
 const box=document.getElementById("history");box.innerHTML=sessions.length?[...sessions].slice(0,8).map(s=>'<div class="stream"><div><h3>'+escapeHTML(s.title||"Beyond Live session")+'</h3><p>'+escapeHTML(s.createdAt||"Recorded session")+' · '+mins(s.duration||s.durationSeconds)+'m'+(s.active?" · Live now":"")+'</p></div><strong>👁 '+fmt(s.viewers||s.totalViewers)+' · ❤️ '+fmt(s.reactions||s.reactionCount)+'</strong></div>').join(""):'<p style="color:#9299a6;font-size:12px">No live sessions have been recorded yet.</p>';
}
function subscribeLive(client,userId){if(liveChannel)client.removeChannel(liveChannel);liveChannel=client.channel("beyond-live-analytics-"+userId).on("postgres_changes",{event:"*",schema:"public",table:"live_rooms",filter:"host_id=eq."+userId},()=>loadLiveAnalytics()).on("postgres_changes",{event:"*",schema:"public",table:"live_messages"},()=>loadLiveAnalytics()).on("postgres_changes",{event:"*",schema:"public",table:"live_reactions"},()=>loadLiveAnalytics()).subscribe()}
function draw(){const c=document.getElementById("viewerChart"),ctx=c.getContext("2d"),w=c.clientWidth,h=c.clientHeight,d=window.devicePixelRatio||1;c.width=w*d;c.height=h*d;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);const data=sessions.slice(-10),vals=data.map(s=>n(s.peakViewers||s.peak||s.viewers)),max=Math.max(...vals,1),pad=30;ctx.strokeStyle="rgba(255,255,255,.09)";for(let i=0;i<4;i++){const y=pad+(h-55)*i/3;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke()}ctx.strokeStyle="#ff3158";ctx.lineWidth=3;ctx.beginPath();vals.forEach((v,i)=>{const x=pad+(w-pad*2)*(i/(vals.length-1||1)),y=h-30-(h-65)*(v/max);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
function escapeHTML(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}window.addEventListener("resize",draw);