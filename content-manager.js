let contentItems=[];let currentEditId=null;let currentFilter="all";let usingSupabase=false;
const selectedIds=new Set();
let currentPage=1;
const PAGE_SIZE=8;
let realtimeChannel=null;

document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{
    document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); currentFilter=b.dataset.filter; render();
  });
  document.getElementById("searchContent").oninput=render;
  document.getElementById("sortContent").onchange=render;
  document.getElementById("refreshContent")?.addEventListener("click",loadContent);
  document.getElementById("selectAll")?.addEventListener("change",togglePageSelection);
  document.getElementById("bulkPublish")?.addEventListener("click",()=>bulkSetStatus("published"));
  document.getElementById("bulkDraft")?.addEventListener("click",()=>bulkSetStatus("draft"));
  document.getElementById("bulkDelete")?.addEventListener("click",bulkDelete);
  document.getElementById("prevPage")?.addEventListener("click",()=>{currentPage=Math.max(1,currentPage-1);render()});
  document.getElementById("nextPage")?.addEventListener("click",()=>{currentPage++;render()});
  loadContent();
});

function getSupabase(){
  try{
    return window.beyondDB || (typeof initBeyondDatabase==="function" ? initBeyondDatabase() : null);
  }catch(e){return null}
}

async function loadContent(){
  try{
    const db=getSupabase();
    if(db){
      const {data:{user}}=await db.auth.getUser();
      if(user){
        usingSupabase=true;
        const [{data:videos,error:vError},{data:likes,error:lError},{data:comments,error:cError}]=await Promise.all([
          db.from("videos").select("*").eq("user_id",user.id).order("created_at",{ascending:false}),
          db.from("likes").select("video_id"),
          db.from("comments").select("video_id")
        ]);
        if(vError) throw vError;
        if(lError) throw lError;
        if(cError) throw cError;
        const likeMap={},commentMap={};
        (likes||[]).forEach(x=>likeMap[x.video_id]=(likeMap[x.video_id]||0)+1);
        (comments||[]).forEach(x=>commentMap[x.video_id]=(commentMap[x.video_id]||0)+1);
        contentItems=(videos||[]).map(v=>({
          id:v.id,caption:v.caption||"",hashtags:v.hashtags||"",status:v.status||"published",
          views:Number(v.views_count||0),likeCount:likeMap[v.id]||Number(v.likes_count||0),
          commentCount:commentMap[v.id]||0,createdAt:v.created_at,videoUrl:v.video_url
        }));
        updateStats();
        render();
        return;
      }
    }
    usingSupabase=false;
    await loadLocalContent();
  }catch(e){
    console.error("Supabase Content Manager:",e);
    usingSupabase=false;
    await loadLocalContent();
  }
}

async function loadLocalContent(){
  try{
    const db=await openDB();
    const user=localStorage.getItem("beyondUsername");
    const videos=await getAll(db,"videos");
    contentItems=videos.filter(v=>!user||v.username===user);
    const likes=await getAll(db,"likes").catch(()=>[]);
    const comments=await getAll(db,"comments").catch(()=>[]);
    contentItems.forEach(v=>{
      v.likeCount=likes.filter(l=>l.postId===v.id).length;
      v.commentCount=comments.filter(c=>c.postId===v.id).length;
      v.views=Number(localStorage.getItem("beyondViews_"+v.id)||0);
      v.status=v.status||"published";
    });
    updateStats(); render();
  }catch(e){console.error(e)}
}

function updateStats(){
  document.getElementById("totalVideos").textContent=contentItems.length;
  document.getElementById("totalViews").textContent=compact(contentItems.reduce((n,v)=>n+v.views,0));
  document.getElementById("totalLikes").textContent=compact(contentItems.reduce((n,v)=>n+v.likeCount,0));
  document.getElementById("totalComments").textContent=compact(contentItems.reduce((n,v)=>n+v.commentCount,0));
}

function openDB(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open("BeyondDatabase",4);
    r.onupgradeneeded=e=>{
      const d=e.target.result;
      if(!d.objectStoreNames.contains("videos"))d.createObjectStore("videos",{keyPath:"id",autoIncrement:true});
      if(!d.objectStoreNames.contains("comments"))d.createObjectStore("comments",{keyPath:"id",autoIncrement:true});
      if(!d.objectStoreNames.contains("likes"))d.createObjectStore("likes",{keyPath:"key"});
    };
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
}
function getAll(db,name){
  return new Promise((resolve,reject)=>{
    if(!db.objectStoreNames.contains(name)){resolve([]);return}
    const r=db.transaction(name,"readonly").objectStore(name).getAll();
    r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);
  });
}
function compact(n){return n>999?((n/1000).toFixed(n>9999?0:1)+"K"):String(n)}

function filteredItems(){
  const q=document.getElementById("searchContent").value.trim().toLowerCase(),sort=document.getElementById("sortContent").value;
  const items=contentItems.filter(v=>(currentFilter==="all"||v.status===currentFilter)&&((v.caption||"").toLowerCase().includes(q)||(v.hashtags||"").toLowerCase().includes(q)));
  items.sort((a,b)=>sort==="oldest"?new Date(a.createdAt)-new Date(b.createdAt):sort==="likes"?b.likeCount-a.likeCount:new Date(b.createdAt)-new Date(a.createdAt));
  return items;
}
function render(){
  const list=document.getElementById("contentList"),empty=document.getElementById("emptyState");
  const items=filteredItems(),pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE));
  currentPage=Math.min(currentPage,pages);
  const visible=items.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  list.innerHTML="";
  empty.style.display=items.length?"none":"block";
  visible.forEach(v=>{
    const row=document.createElement("article");row.className="content-row"+(selectedIds.has(String(v.id))?" selected":"");
    const check=document.createElement("input");check.type="checkbox";check.className="row-select";check.checked=selectedIds.has(String(v.id));check.setAttribute("aria-label","Select video");
    check.onchange=()=>{check.checked?selectedIds.add(String(v.id)):selectedIds.delete(String(v.id));row.classList.toggle("selected",check.checked);updateBulkControls()};
    const thumb=document.createElement("video");thumb.className="thumb";thumb.muted=true;thumb.preload="metadata";thumb.playsInline=true;
    if(v.videoUrl)thumb.src=v.videoUrl;else if(v.video)thumb.src=URL.createObjectURL(v.video);
    const info=document.createElement("div");info.className="content-info";
    const h=document.createElement("h3");h.textContent=v.caption||"Untitled Beyond video";
    const badge=document.createElement("span");badge.className="status "+(v.status==="draft"?"draft":"published");badge.textContent=v.status;h.appendChild(badge);
    const p=document.createElement("p");p.textContent=v.hashtags||"No hashtags";
    const meta=document.createElement("div");meta.className="meta";meta.textContent="👁 "+v.views+"   ❤️ "+v.likeCount+"   💬 "+v.commentCount+"   • "+new Date(v.createdAt).toLocaleDateString();
    info.append(h,p,meta);
    const actions=document.createElement("div");actions.className="actions";actions.innerHTML='<button>Edit</button><button></button><button class="delete">Delete</button>';
    actions.children[1].textContent=v.status==="draft"?"Publish":"Hide";
    actions.children[0].onclick=()=>openEditor(v.id);actions.children[1].onclick=()=>toggleStatus(v.id);actions.children[2].onclick=()=>deleteVideo(v.id);
    row.append(check,thumb,info,actions);list.append(row);
  });
  document.getElementById("pageInfo").textContent="Page "+currentPage+" of "+pages+" · "+items.length+" videos";
  document.getElementById("prevPage").disabled=currentPage<=1;
  document.getElementById("nextPage").disabled=currentPage>=pages;
  const pageIds=visible.map(v=>String(v.id));
  document.getElementById("selectAll").checked=pageIds.length>0&&pageIds.every(id=>selectedIds.has(id));
  updateBulkControls();
}
function updateBulkControls(){
  const count=selectedIds.size;
  document.getElementById("selectedCount").textContent=count+" selected";
  ["bulkPublish","bulkDraft","bulkDelete"].forEach(id=>document.getElementById(id).disabled=count===0);
}
function togglePageSelection(){
  const visible=filteredItems().slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  if(document.getElementById("selectAll").checked)visible.forEach(v=>selectedIds.add(String(v.id)));
  else visible.forEach(v=>selectedIds.delete(String(v.id)));
  render();
}
async function bulkSetStatus(status){
  const ids=[...selectedIds];if(!ids.length)return;
  try{
    if(usingSupabase){
      const db=getSupabase();const {error}=await db.from("videos").update({status}).in("id",ids);
      if(error)throw error;
    }else{
      const db=await openDB();
      await Promise.all(ids.map(id=>{const v=contentItems.find(x=>String(x.id)===id);if(!v)return Promise.resolve();v.status=status;return new Promise((resolve,reject)=>{const tx=db.transaction("videos","readwrite");tx.objectStore("videos").put(v);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}));
    }
    selectedIds.clear();await loadContent();
  }catch(e){alert("Bulk update failed: "+e.message)}
}
async function bulkDelete(){
  const ids=[...selectedIds];if(!ids.length)return;
  if(!confirm("Delete "+ids.length+" selected video(s)? This cannot be undone."))return;
  try{
    if(usingSupabase){
      const db=getSupabase();
      const targets=contentItems.filter(v=>ids.includes(String(v.id)));
      const {error}=await db.from("videos").delete().in("id",ids);if(error)throw error;
      for(const v of targets){if(v.videoUrl){const marker="/storage/v1/object/public/videos/",i=v.videoUrl.indexOf(marker);if(i>=0){const path=decodeURIComponent(v.videoUrl.slice(i+marker.length));await db.storage.from("videos").remove([path])}}}
    }else{
      const db=await openDB();
      await Promise.all(ids.map(id=>new Promise((resolve,reject)=>{const tx=db.transaction("videos","readwrite");tx.objectStore("videos").delete(Number(id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})));
    }
    selectedIds.clear();await loadContent();
  }catch(e){alert("Bulk delete failed: "+e.message)}
}
function setupRealtime(db,userId){
  if(realtimeChannel)return;
  realtimeChannel=db.channel("beyond-content-manager-"+userId)
    .on("postgres_changes",{event:"*",schema:"public",table:"videos",filter:"user_id=eq."+userId},()=>loadContent())
    .on("postgres_changes",{event:"*",schema:"public",table:"likes"},()=>loadContent())
    .on("postgres_changes",{event:"*",schema:"public",table:"comments"},()=>loadContent())
    .subscribe();
}}