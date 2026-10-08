let followerHistory=[];let followingActivity=[];

document.addEventListener("DOMContentLoaded",initAudience);

function readArray(key){
  try{
    const value=JSON.parse(localStorage.getItem(key)||"[]");
    return Array.isArray(value)?value:[];
  }catch(error){return []}
}
function number(value){return Number(value)||0}
function format(value){
  const n=number(value);
  if(n>=1000000)return (n/1000000).toFixed(1)+"M";
  if(n>=1000)return (n/1000).toFixed(1)+"K";
  return Math.round(n).toLocaleString();
}
function safe(value){
  return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
}
function dateLabel(value){
  if(!value)return "Recorded period";
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value).slice(0,18);
  return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
}

async function initAudience(){
  try{
    const client=window.beyondDB||(typeof initBeyondDatabase==="function"?initBeyondDatabase():null);
    if(!client){location.href="login.html";return;}
    const {data:{user}}=await client.auth.getUser();
    if(!user){location.href="login.html";return;}

    const [followersResult,followingResult,eventsResult]=await Promise.all([
      client.from("follows").select("follower_id,created_at").eq("following_id",user.id).order("created_at",{ascending:true}),
      client.from("follows").select("following_id,created_at,profiles(username,display_name)").eq("follower_id",user.id).order("created_at",{ascending:false}).limit(20),
      client.from("follower_events").select("follower_id,event_type,created_at").eq("creator_id",user.id).order("created_at",{ascending:true}).limit(5000)
    ]);
    if(followersResult.error)throw followersResult.error;
    if(followingResult.error)throw followingResult.error;
    if(eventsResult.error)throw eventsResult.error;

    const followers=followersResult.data||[];
    const following=followingResult.data||[];
    const events=eventsResult.data||[];
    const currentFollowers=followers.length;
    const currentFollowing=following.length;

    const dayMap=new Map();
    events.forEach(row=>{
      const day=String(row.created_at||"").slice(0,10);
      if(!day)return;
      const item=dayMap.get(day)||{newFollowers:0,lostFollowers:0};
      if(row.event_type==="follow")item.newFollowers++;
      if(row.event_type==="unfollow")item.lostFollowers++;
      dayMap.set(day,item);
    });

    let running=0;
    const growthRows=[...dayMap.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,item])=>{
      running+=item.newFollowers-item.lostFollowers;
      return {date,followers:Math.max(0,running),newFollowers:item.newFollowers,lostFollowers:item.lostFollowers};
    });

    // If historical events were added after the current follows already existed,
    // anchor the recorded series to today's real follower total.
    if(growthRows.length){
      const offset=currentFollowers-growthRows[growthRows.length-1].followers;
      growthRows.forEach(row=>row.followers=Math.max(0,row.followers+offset));
    }
    followerHistory=growthRows.slice(-90);

    followingActivity=following.map(row=>({
      username:row.profiles?.username||row.profiles?.display_name||"Creator",
      action:"Following",
      createdAt:row.created_at
    }));

    const latest=growthRows[growthRows.length-1]||{newFollowers:0,lostFollowers:0};
    const previous=growthRows[growthRows.length-2];
    const newFollowers=latest.newFollowers||0;
    const lostFollowers=latest.lostFollowers||0;
    const net=newFollowers-lostFollowers;
    const previousFollowers=previous?previous.followers:Math.max(currentFollowers-net,0);
    const growthRate=previousFollowers?((net/previousFollowers)*100):0;

    document.getElementById("followers").textContent=format(currentFollowers);
    document.getElementById("following").textContent=format(currentFollowing);
    document.getElementById("newFollowers").textContent=format(newFollowers);
    document.getElementById("netGrowth").textContent=(net>0?"+":"")+format(net);
    document.getElementById("followerChange").textContent="Live Supabase follower data";

    const activeUsers=new Set(events.slice(-100).map(item=>item.follower_id)).size;
    const ratio=currentFollowing?currentFollowers/currentFollowing:0;
    document.getElementById("activeAudience").textContent=format(activeUsers);
    document.getElementById("growthRate").textContent=growthRate.toFixed(1)+"%";
    document.getElementById("ratio").textContent=currentFollowing?ratio.toFixed(1):"0";
    document.getElementById("source").textContent=activeUsers?"Supabase follower events":"No activity yet";

    renderActivity();
    renderHistory();
    drawGrowthChart();
    subscribeAudienceRealtime(client,user.id);
  }catch(error){
    console.error("Beyond Audience Supabase error:",error);
    const box=document.getElementById("history");
    if(box)box.innerHTML='<p class="empty">Audience data could not be loaded. Apply the latest Supabase schema, then refresh.</p>';
    const activity=document.getElementById("activity");
    if(activity)activity.innerHTML='<p class="empty">Supabase follower activity is unavailable.</p>';
  }
}
function renderActivity(){
  const box=document.getElementById("activity");
  const rows=followingActivity.slice(-7).reverse();
  if(!rows.length){
    box.innerHTML='<p class="empty">No following activity has been recorded yet.</p>';
    return;
  }
  box.innerHTML=rows.map(item=>{
    const name=item.username||item.user||"Creator";
    const action=item.action||"Following activity";
    const date=item.date||item.createdAt||item.timestamp;
    return '<div class="activity-row"><div><strong>'+safe(name)+'</strong><span>'+safe(action)+'</span></div><span class="activity-date">'+safe(dateLabel(date))+'</span></div>';
  }).join("");
}

function renderHistory(){
  const box=document.getElementById("history");
  const rows=followerHistory.slice(-10).reverse();
  if(!rows.length){
    box.innerHTML='<p class="empty">Follower history will appear here once Beyond records growth events.</p>';
    return;
  }
  box.innerHTML=rows.map(item=>{
    const gained=number(item.newFollowers??item.gained);
    const lost=number(item.lostFollowers??item.lost);
    return '<div class="history-row"><strong>'+safe(dateLabel(item.date||item.createdAt||item.timestamp))+'</strong><span class="gain">+'+format(gained)+' new</span><span class="loss">-'+format(lost)+' lost</span></div>';
  }).join("");
}

function drawGrowthChart(){
  const canvas=document.getElementById("growthChart");
  const status=document.getElementById("chartStatus");
  const rows=followerHistory.slice(-7);
  const rect=canvas.getBoundingClientRect();
  const width=Math.max(rect.width,300);
  const height=Math.max(rect.height,220);
  const ratio=window.devicePixelRatio||1;
  canvas.width=Math.round(width*ratio);
  canvas.height=Math.round(height*ratio);
  const ctx=canvas.getContext("2d");
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.clearRect(0,0,width,height);

  if(!rows.length){
    ctx.fillStyle="#9299a8";
    ctx.font="13px Arial";
    ctx.fillText("No follower growth data recorded yet.",24,height/2);
    status.textContent="Waiting for recorded growth data";
    document.getElementById("range").textContent="No records";
    return;
  }

  const values=rows.map(item=>number(item.followers??item.totalFollowers));
  const max=Math.max(...values,1);
  const min=Math.min(...values);
  const left=38,right=18,top=18,bottom=38;
  const plotW=width-left-right,plotH=height-top-bottom;

  ctx.strokeStyle="rgba(255,255,255,.08)";
  ctx.lineWidth=1;
  for(let i=0;i<4;i++){
    const y=top+(plotH*i/3);
    ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();
  }

  ctx.fillStyle="#9299a8";
  ctx.font="10px Arial";
  ctx.fillText(format(max),4,top+4);
  ctx.fillText(format(min),4,top+plotH);

  ctx.strokeStyle="#ff3158";
  ctx.lineWidth=3;
  ctx.lineJoin="round";
  ctx.lineCap="round";
  ctx.beginPath();

  rows.forEach((item,index)=>{
    const x=left+(plotW*(index/(rows.length-1||1)));
    const y=top+plotH-((number(item.followers??item.totalFollowers)-min)/Math.max(max-min,1))*plotH;
    if(index===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  });
  ctx.stroke();

  rows.forEach((item,index)=>{
    const x=left+(plotW*(index/(rows.length-1||1)));
    const y=top+plotH-((number(item.followers??item.totalFollowers)-min)/Math.max(max-min,1))*plotH;
    ctx.fillStyle="#ff3158";
    ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#9299a8";
    ctx.font="10px Arial";
    const label=String(item.date||item.createdAt||"").slice(0,10);
    ctx.fillText(label,x-16,height-10);
  });

  status.textContent=rows.length+" growth record"+(rows.length===1?"":"s")+" available";
  document.getElementById("range").textContent="Last "+rows.length+" record"+(rows.length===1?"":"s");
}

window.addEventListener("resize",drawGrowthChart);

function subscribeAudienceRealtime(client,userId){
  if(!client||!userId)return;
  if(window.beyondAudienceChannel){try{client.removeChannel(window.beyondAudienceChannel)}catch(e){console.warn("Beyond audience realtime cleanup:",e)}window.beyondAudienceChannel=null;}
  const channel=client.channel("beyond-audience-"+userId)
    .on("postgres_changes",{event:"*",schema:"public",table:"follows",filter:"following_id=eq."+userId},()=>initAudience());
  channel.subscribe(status=>{
    if(status==="SUBSCRIBED"){window.beyondAudienceChannel=channel;return;}
    if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
      if(window.beyondAudienceChannel===channel)window.beyondAudienceChannel=null;
      try{client.removeChannel(channel)}catch(e){console.warn("Beyond audience realtime cleanup:",e)}
      if(document.visibilityState!=="hidden")setTimeout(()=>subscribeAudienceRealtime(client,userId),5000);
    }
  });
}
