let videos=[];let likes=[];let comments=[];let range=7;let analyticsChannel=null;
document.addEventListener("DOMContentLoaded",loadAnalytics);
async function db(){return new Promise((ok,no)=>{const r=indexedDB.open("BeyondDatabase",4);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains("videos"))d.createObjectStore("videos",{keyPath:"id",autoIncrement:true});if(!d.objectStoreNames.contains("comments"))d.createObjectStore("comments",{keyPath:"id",autoIncrement:true});if(!d.objectStoreNames.contains("likes"))d.createObjectStore("likes",{keyPath:"key"});};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
function all(d,n){return new Promise((ok,no)=>{const r=d.transaction(n,"readonly").objectStore(n).getAll();r.onsuccess=()=>ok(r.result||[]);r.onerror=()=>no(r.error)})}
async function loadAnalytics(){
  try{
    const client=window.beyondDB||(typeof initBeyondDatabase==="function"?initBeyondDatabase():null);
    if(client){
      const {data:{user}}=await client.auth.getUser();
      if(user){
        const {data:rows,error}=await client.from("videos").select("*").eq("user_id",user.id).order("created_at",{ascending:false});
        if(error)throw error;
        const ids=(rows||[]).map(v=>v.id);
        let likeRows=[],commentRows=[];
        if(ids.length){
          const [lr,cr]=await Promise.all([
            client.from("likes").select("video_id").in("video_id",ids),
            client.from("comments").select("video_id").in("video_id",ids)
          ]);
          if(lr.error)throw lr.error;
          if(cr.error)throw cr.error;
          likeRows=lr.data||[];
          commentRows=cr.data||[];
        }
        videos=(rows||[]).map(v=>({
          ...v,
          likeCount:likeRows.filter(x=>x.video_id===v.id).length,
          commentCount:commentRows.filter(x=>x.video_id===v.id).length,
          views:Number(v.views_count||0),
          createdAt:v.created_at
        }));
        const followerResult=await client.from("follows").select("follower_id",{count:"exact",head:true}).eq("following_id",user.id);
        if(followerResult.error)throw followerResult.error;
        window.beyondAnalyticsFollowers=followerResult.count||0;
        render();
        if(analyticsChannel) client.removeChannel(analyticsChannel);
        analyticsChannel=client.channel("beyond-analytics-"+user.id)
          .on("postgres_changes",{event:"*",schema:"public",table:"videos",filter:"user_id=eq."+user.id},()=>loadAnalytics())
          .on("postgres_changes",{event:"*",schema:"public",table:"follows",filter:"following_id=eq."+user.id},()=>loadAnalytics())
          .on("postgres_changes",{event:"*",schema:"public",table:"likes"},()=>loadAnalytics())
          .on("postgres_changes",{event:"*",schema:"public",table:"comments"},()=>loadAnalytics())
          .subscribe();
        return;
      }
    }
  }catch(error){console.warn("Beyond Supabase analytics unavailable:",error)}
  const d=await db();const u=localStorage.getItem("beyondUsername");const allVideos=await all(d,"videos");videos=allVideos.filter(v=>!u||v.username===u);likes=await all(d,"likes");comments=await all(d,"comments");videos.forEach(v=>{v.likeCount=likes.filter(x=>x.postId===v.id).length;v.commentCount=comments.filter(x=>x.postId===v.id).length;v.views=Number(localStorage.getItem("beyondViews_"+v.id)||0)});render();
}
function compact(n){return n>=1000000?(n/1000000).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"K":String(n)}
function render(){const totalViews=videos.reduce((n,v)=>n+v.views,0),totalLikes=videos.reduce((n,v)=>n+v.likeCount,0),totalComments=videos.reduce((n,v)=>n+v.commentCount,0);const followers=Number.isFinite(window.beyondAnalyticsFollowers)?window.beyondAnalyticsFollowers:Number(localStorage.getItem("beyondFollowers")||0);views.textContent=compact(totalViews);likes.textContent=compact(totalLikes);comments.textContent=compact(totalComments);document.getElementById("followers").textContent=compact(followers);document.getElementById("viewsChange").textContent="Based on your videos";document.getElementById("likesChange").textContent="Total engagement";document.getElementById("commentsChange").textContent="Community activity";document.getElementById("followersChange").textContent="Current followers";avgViews.textContent=compact(videos.length?Math.round(totalViews/videos.length):0);avgLikes.textContent=compact(videos.length?Math.round(totalLikes/videos.length):0);engagementRate.textContent=(totalViews?((totalLikes+totalComments)/totalViews*100).toFixed(1):"0")+"%";published.textContent=videos.filter(v=>(v.status||"published")==="published").length;drawViews();drawEngagement();renderTop();}
function dates(){const a=[];for(let i=range-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);a.push(d)}return a}
function viewsForDay(d){const key=d.toISOString().slice(0,10);return videos.reduce((n,v)=>{const created=(v.createdAt||"").slice(0,10);return created===key?n+v.views:n},0)}
function drawViews(){const c=document.getElementById("viewsChart"),ctx=c.getContext("2d"),w=c.clientWidth,h=c.clientHeight,d=devicePixel(c,ctx);ctx.clearRect(0,0,w*d,h*d);ctx.scale(d,d);const ds=dates(),vals=ds.map(viewsForDay),max=Math.max(...vals,1),pad=28;ctx.strokeStyle="rgba(255,255,255,.09)";ctx.lineWidth=1;for(let i=0;i<4;i++){const y=pad+(h-pad*1.5)*i/3;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke()}ctx.strokeStyle="#ff3158";ctx.lineWidth=3;ctx.beginPath();vals.forEach((v,i)=>{const x=pad+(w-pad*2)*(i/(vals.length-1||1)),y=h-pad-(h-pad*1.7)*(v/max);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.fillStyle="#9299a6";ctx.font="11px Arial";ds.forEach((x,i)=>{if(i%Math.ceil(ds.length/5)===0)ctx.fillText((x.getMonth()+1)+"/"+x.getDate(),pad+(w-pad*2)*(i/(ds.length-1||1)),h-8)})}
function drawEngagement(){const c=document.getElementById("engagementChart"),ctx=c.getContext("2d"),w=c.clientWidth,h=c.clientHeight,d=devicePixel(c,ctx);ctx.clearRect(0,0,w*d,h*d);ctx.scale(d,d);const top=[...videos].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)).slice(-7),max=Math.max(...top.map(v=>Math.max(v.likeCount,v.commentCount)),1),bw=Math.max(12,(w-50)/(top.length*2+1));top.forEach((v,i)=>{const x=28+i*bw*2;const lh=(v.likeCount/max)*(h-45),ch=(v.commentCount/max)*(h-45);ctx.fillStyle="#ff3158";ctx.fillRect(x,h-25-lh,bw,lh);ctx.fillStyle="#777d8a";ctx.fillRect(x+bw+3,h-25-ch,bw,ch)});ctx.fillStyle="#9299a6";ctx.font="10px Arial";ctx.fillText("Likes",10,14);ctx.fillText("Comments",55,14)}
function devicePixel(c,ctx){const d=window.devicePixelRatio||1;c.width=c.clientWidth*d;c.height=c.clientHeight*d;return d}
function renderTop(){const box=document.getElementById("topVideos");const top=[...videos].sort((a,b)=>b.views-a.views).slice(0,5);box.innerHTML=top.length?top.map((v,i)=>'<div class="top-row"><span class="rank">#'+(i+1)+'</span><div><h3>'+escapeHTML(v.caption||"Untitled video")+'</h3><p>❤️ '+v.likeCount+' · 💬 '+v.commentCount+'</p></div><strong>👁 '+compact(v.views)+'</strong></div>').join(""):'<p style="color:#9097a5">Upload videos to see performance data.</p>'}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
window.addEventListener("resize",()=>{if(videos.length) {drawViews();drawEngagement()}});