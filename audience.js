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

function initAudience(){
  followerHistory=readArray("beyondFollowerHistory");
  followingActivity=readArray("beyondFollowingActivity");

  const followers=number(localStorage.getItem("beyondFollowers"));
  const following=number(localStorage.getItem("beyondFollowing"));
  const latest=followerHistory[followerHistory.length-1]||{};
  const newFollowers=number(latest.newFollowers??latest.gained);
  const lostFollowers=number(latest.lostFollowers??latest.lost);
  const net=newFollowers-lostFollowers;

  document.getElementById("followers").textContent=format(followers);
  document.getElementById("following").textContent=format(following);
  document.getElementById("newFollowers").textContent=format(newFollowers);
  document.getElementById("netGrowth").textContent=(net>0?"+":"")+format(net);
  document.getElementById("followerChange").textContent=followerHistory.length?"Growth data recorded":"No growth data yet";

  const activeUsers=new Set(
    followingActivity.map(item=>item.username||item.user||item.userId).filter(Boolean)
  ).size;
  const previousFollowers=Math.max(followers-net,0);
  const growthRate=previousFollowers?((net/previousFollowers)*100):0;
  const ratio=following?followers/following:0;

  document.getElementById("activeAudience").textContent=format(activeUsers);
  document.getElementById("growthRate").textContent=growthRate.toFixed(1)+"%";
  document.getElementById("ratio").textContent=following?ratio.toFixed(1):"0";
  document.getElementById("source").textContent=activeUsers?"Following activity":"Not available";

  renderActivity();
  renderHistory();
  drawGrowthChart();
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