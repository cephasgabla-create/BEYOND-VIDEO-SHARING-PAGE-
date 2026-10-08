let data=[],term="",db=null,currentUser=null;
const arr=v=>{try{const x=JSON.parse(v||"[]");return Array.isArray(x)?x:[]}catch{return[]}};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const dt=x=>x.createdAt||x.timestamp||x.date||x.created_at;
const today=x=>{const d=new Date(dt(x));return !isNaN(d)&&d.toDateString()===new Date().toDateString()};
function save(){localStorage.setItem("beyondComments",JSON.stringify(data))}
function type(x){const t=String(x.type||"").toLowerCase();return t.includes("reply")||x.parentId?"replies":t.includes("like")?"liked":"comment"}
function render(){
 const f=document.getElementById("filter").value;
 const list=data.filter(x=>!x.hidden).filter(x=>{const txt=((x.text||x.comment||x.content||"")+" "+(x.username||x.user||"")).toLowerCase();return(!term||txt.includes(term))&&(f==="all"||(f==="unread"&&!x.read)||(f==="liked"&&(x.liked||x.isLiked))||(f==="replies"&&type(x)==="replies"))}).slice().reverse();
 document.getElementById("count").textContent=data.length;document.getElementById("total").textContent=data.length;document.getElementById("unread").textContent=data.filter(x=>!x.read&&!x.hidden).length;document.getElementById("today").textContent=data.filter(today).length;document.getElementById("videoCount").textContent=new Set(data.map(x=>x.videoId||x.videoTitle).filter(Boolean)).size;
 const box=document.getElementById("comments");
 if(!list.length){box.innerHTML='<div class="empty">No comments match your filters.</div>';return}
 box.innerHTML=list.map(x=>{const i=data.indexOf(x),u=x.username||x.user||"Beyond user",txt=x.text||x.comment||x.content||"",v=x.videoTitle||x.videoName||x.videoId||"Beyond video",liked=!!(x.liked||x.isLiked);return '<article class="comment '+(x.read?"":"unread")+'"><div class="avatar">'+esc(u[0]||"B").toUpperCase()+'</div><div class="body"><strong>'+esc(u)+'</strong><small> · '+esc(dt(x)||"Recorded")+'</small><p>'+esc(txt)+'</p><small>Video: '+esc(v)+'</small><div class="actions"><button onclick="readIt('+i+')">'+(x.read?"Mark unread":"Mark read")+'</button><button onclick="likeIt('+i+')">'+(liked?"♥ Liked":"♡ Like")+'</button><button onclick="hideIt('+i+')">Hide</button><button class="danger" onclick="delIt('+i+')">Delete</button></div></div><div class="meta">'+(x.read?"":"● Unread")+'</div></article>'}).join("")
}
async function load(){
 data=arr(localStorage.getItem("beyondComments"));
 try{
  db=window.beyondDB||(typeof initBeyondDatabase==="function"?initBeyondDatabase():null);
  currentUser=db?await getCurrentBeyondUser():null;
  if(!db||!currentUser){render();return}
  const {data:videos,error:ve}=await db.from("videos").select("id,caption").eq("user_id",currentUser.id);
  if(ve)throw ve;
  const ids=(videos||[]).map(v=>v.id);if(!ids.length){data=[];render();return}
  const {data:comments,error:ce}=await db.from("comments").select("id,user_id,video_id,content,created_at,hidden_by_creator").in("video_id",ids).order("created_at",{ascending:false});
  if(ce)throw ce;
  const userIds=[...new Set((comments||[]).map(c=>c.user_id).filter(Boolean))];
  let profiles=[];
  if(userIds.length){const p=await db.from("profiles").select("id,username,display_name,avatar_url").in("id",userIds);if(p.error)throw p.error;profiles=p.data||[]}
  const pm=new Map(profiles.map(p=>[p.id,p])),vm=new Map((videos||[]).map(v=>[v.id,v]));
  data=(comments||[]).map(c=>{const p=pm.get(c.user_id),v=vm.get(c.video_id);return {id:c.id,userId:c.user_id,videoId:c.video_id,content:c.content,text:c.content,username:p?.username||p?.display_name||"Beyond user",videoTitle:v?.caption||"Beyond video",createdAt:c.created_at,hidden:!!c.hidden_by_creator,read:localStorage.getItem("beyondCommentRead:"+c.id)==="1",liked:localStorage.getItem("beyondCommentLiked:"+c.id)==="1"}});
  render();
  db.channel("beyond-comments-manager-"+currentUser.id).on("postgres_changes",{event:"*",schema:"public",table:"comments"},()=>load()).subscribe();
 }catch(e){console.warn("Beyond Comments Manager Supabase unavailable:",e);render()}
}
async function readIt(i){if(!data[i])return;data[i].read=!data[i].read;localStorage.setItem("beyondCommentRead:"+data[i].id,data[i].read?"1":"0");save();render()}
async function likeIt(i){if(!data[i])return;data[i].liked=!data[i].liked;localStorage.setItem("beyondCommentLiked:"+data[i].id,data[i].liked?"1":"0");save();render()}
async function hideIt(i){if(!data[i]||!db)return;if(!confirm("Hide this comment from your video?"))return;try{const {error}=await db.from("comments").update({hidden_by_creator:true}).eq("id",data[i].id);if(error)throw error;await load()}catch(e){alert("Could not hide this comment.");console.error(e)}}
async function delIt(i){if(!data[i]||!db)return;if(!confirm("Delete this comment?"))return;try{const {error}=await db.from("comments").delete().eq("id",data[i].id);if(error)throw error;await load()}catch(e){alert("Could not delete this comment.");console.error(e)}}
document.addEventListener("DOMContentLoaded",()=>{document.getElementById("search").oninput=e=>{term=e.target.value.toLowerCase();render()};document.getElementById("filter").onchange=render;document.getElementById("clear").onclick=()=>{data=data.filter(x=>!x.hidden);save();render()};load()});
