let contentItems=[];let currentEditId=null;let currentFilter="all";let usingSupabase=false;
const selectedIds=new Set();
let currentPage=1;
const PAGE_SIZE=8;
let realtimeChannel=null;
let realtimeUserId=null;
let realtimeDb=null;
let realtimeReloadTimer=null;
let contentLoadInProgress=false;
const localObjectUrls=new Map();

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
  document.getElementById("closePreview")?.addEventListener("click",closePreview);
  document.getElementById("previewModal")?.addEventListener("click",e=>{if(e.target.id==="previewModal")closePreview()});
  loadContent();
});

function getSupabase(){
  try{
    return window.beyondDB || (typeof initBeyondDatabase==="function" ? initBeyondDatabase() : null);
  }catch(e){return null}
}

async function loadContent(){
  if(contentLoadInProgress)return;
  contentLoadInProgress=true;
  try{
    const db=getSupabase();
    if(!db) throw new Error("Beyond Supabase is not configured.");
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError) throw authError;
    if(!user){
      window.location.href="login.html?redirect=content-manager.html";
      return;
    }
    usingSupabase=true;
    const {data:videos,error:vError}=await db.from("videos").select("*").eq("user_id",user.id).order("created_at",{ascending:false});
    if(vError) throw vError;
    const ids=(videos||[]).map(v=>v.id);
    let likes=[],comments=[];
    if(ids.length){
      const [lr,cr]=await Promise.all([
        db.from("likes").select("video_id").in("video_id",ids),
        db.from("comments").select("video_id").in("video_id",ids)
      ]);
      if(lr.error)throw lr.error;
      if(cr.error)throw cr.error;
      likes=lr.data||[];
      comments=cr.data||[];
    }
    const likeMap={},commentMap={};
    likes.forEach(x=>likeMap[x.video_id]=(likeMap[x.video_id]||0)+1);
    comments.forEach(x=>commentMap[x.video_id]=(commentMap[x.video_id]||0)+1);
    contentItems=(videos||[]).map(v=>({
      id:v.id,caption:v.caption||"",hashtags:v.hashtags||"",status:v.status||"published",
      views:Number(v.views_count||0),likeCount:likeMap[v.id]??Number(v.likes_count||0),
      commentCount:commentMap[v.id]??0,createdAt:v.created_at,videoUrl:v.video_url,
      visibility:v.visibility||"public",commentsEnabled:v.comments_enabled!==false
    }));
    updateStats(); render(); setupRealtime(db,user.id); clearContentError();
  }catch(e){
    console.error("Supabase Content Manager:",e);
    usingSupabase=false;
    contentItems=[]; updateStats(); render(); showContentError(e.message||"Could not load your Beyond content.");
  }finally{
    contentLoadInProgress=false;
  }
}

function showContentError(message){
  const empty=document.getElementById("emptyState");
  if(!empty)return;
  empty.style.display="block";
  empty.innerHTML="<div>⚠️</div><h2>Content Manager unavailable</h2><p>"+escapeHtml(message)+"</p><button onclick="reloadContent()">Try again</button>";
}
function clearContentError(){
  const empty=document.getElementById("emptyState");
  if(!empty)return;
  empty.innerHTML='<div>🎬</div><h2>No content yet</h2><p>Upload your first Beyond video and manage it here.</p><button onclick="location.href="upload.html"">Upload video</button>';
}
function reloadContent(){loadContent()}
function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

function updateStats(){
  document.getElementById("totalVideos").textContent=contentItems.length;
  document.getElementById("totalViews").textContent=compact(contentItems.reduce((n,v)=>n+v.views,0));
  document.getElementById("totalLikes").textContent=compact(contentItems.reduce((n,v)=>n+v.likeCount,0));
  document.getElementById("totalComments").textContent=compact(contentItems.reduce((n,v)=>n+v.commentCount,0));
}


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
    const thumbSrc=getVideoSource(v);
    if(thumbSrc) thumb.src=thumbSrc;
    const info=document.createElement("div");info.className="content-info";
    const h=document.createElement("h3");h.textContent=v.caption||"Untitled Beyond video";
    const badge=document.createElement("span");badge.className="status "+(v.status==="draft"?"draft":"published");badge.textContent=v.status;h.appendChild(badge);
    const p=document.createElement("p");p.textContent=v.hashtags||"No hashtags";
    const meta=document.createElement("div");meta.className="meta";meta.textContent="👁 "+v.views+"   ❤️ "+v.likeCount+"   💬 "+v.commentCount+"   • "+new Date(v.createdAt).toLocaleDateString();
    info.append(h,p,meta);
    const actions=document.createElement("div");actions.className="actions";actions.innerHTML='<button class="preview-btn">Preview</button><button>Edit</button><button></button><button class="delete">Delete</button>';
    actions.children[2].textContent=v.status==="draft"?"Publish":"Hide";
    actions.children[0].onclick=()=>openPreview(v.id);actions.children[1].onclick=()=>openEditor(v.id);actions.children[2].onclick=()=>toggleStatus(v.id);actions.children[3].onclick=()=>deleteVideo(v.id);
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
    const db=getSupabase();if(!db)throw new Error("Supabase is unavailable.");
    const {error}=await db.from("videos").update({status}).in("id",ids);
    if(error)throw error;
    selectedIds.clear();await loadContent();
  }catch(e){alert("Bulk update failed: "+e.message)}
}
async function bulkDelete(){
  const ids=[...selectedIds];if(!ids.length)return;
  if(!confirm("Delete "+ids.length+" selected video(s)? This cannot be undone."))return;
  try{
    const db=getSupabase();if(!db)throw new Error("Supabase is unavailable.");
    const targets=contentItems.filter(v=>ids.includes(String(v.id)));
    const {error}=await db.from("videos").delete().in("id",ids);
    if(error)throw error;
    for(const v of targets){
      const path=extractStoragePath(v.videoUrl);
      if(path){
        const {error:storageError}=await db.storage.from("videos").remove([path]);
        if(storageError)console.warn("Video record deleted, but storage cleanup failed:",storageError);
      }
    }
    selectedIds.clear();await loadContent();
  }catch(e){alert("Bulk delete failed: "+e.message)}
}
function scheduleRealtimeReload(){
  if(realtimeReloadTimer)return;
  realtimeReloadTimer=setTimeout(()=>{
    realtimeReloadTimer=null;
    loadContent();
  },350);
}
function setupRealtime(db,userId){
  if(!db||!userId)return;
  if(realtimeChannel&&realtimeDb===db&&realtimeUserId===userId)return;
  if(realtimeChannel){
    try{realtimeDb?.removeChannel(realtimeChannel)}catch(e){console.warn("Beyond realtime cleanup:",e)}
    realtimeChannel=null;
  }
  realtimeDb=db;
  realtimeUserId=userId;
  const channel=db.channel("beyond-content-manager-"+userId)
    .on("postgres_changes",{event:"*",schema:"public",table:"videos",filter:"user_id=eq."+userId},scheduleRealtimeReload)
    .on("postgres_changes",{event:"*",schema:"public",table:"likes"},payload=>{
      const id=payload.new?.video_id||payload.old?.video_id;
      if(!id||contentItems.some(v=>String(v.id)===String(id)))scheduleRealtimeReload();
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"comments"},payload=>{
      const id=payload.new?.video_id||payload.old?.video_id;
      if(!id||contentItems.some(v=>String(v.id)===String(id)))scheduleRealtimeReload();
    });
  channel.subscribe(status=>{
    if(status==="SUBSCRIBED"){
      realtimeChannel=channel;
      return;
    }
    if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
      if(realtimeChannel===channel)realtimeChannel=null;
      try{db.removeChannel(channel)}catch(e){console.warn("Beyond realtime channel cleanup:",e)}
      if(document.visibilityState!=="hidden")setTimeout(()=>setupRealtime(db,userId),5000);
    }
  });
}
function extractStoragePath(videoUrl){
  if(!videoUrl)return null;
  const marker="/storage/v1/object/public/videos/";
  const index=videoUrl.indexOf(marker);
  return index>=0?decodeURIComponent(videoUrl.slice(index+marker.length)):null;
}
function getVideoSource(v){
  if(v.videoUrl)return v.videoUrl;
  if(!v.video)return "";
  const key=String(v.id);
  if(!localObjectUrls.has(key))localObjectUrls.set(key,URL.createObjectURL(v.video));
  return localObjectUrls.get(key);
}
async async function toggleStatus(id){
  const v=findContentItem(id);if(!v)return;
  const status=v.status==="draft"?"published":"draft";
  try{
    const db=getSupabase();if(!db)throw new Error("Supabase is unavailable.");
    const {error}=await db.from("videos").update({status}).eq("id",id);
    if(error)throw error;
    await loadContent();
  }catch(e){alert("Could not change video status: "+e.message)}
}
async function deleteVideo(id){
  const v=findContentItem(id);if(!v)return;
  if(!confirm("Delete this video? This cannot be undone."))return;
  try{
    const db=getSupabase();if(!db)throw new Error("Supabase is unavailable.");
    const {error}=await db.from("videos").delete().eq("id",id);
    if(error)throw error;
    const path=extractStoragePath(v.videoUrl);
    if(path){
      const {error:storageError}=await db.storage.from("videos").remove([path]);
      if(storageError)console.warn("Video record deleted, but storage cleanup failed:",storageError);
    }
    selectedIds.delete(String(id));await loadContent();
  }catch(e){alert("Could not delete video: "+e.message)}
}

function findContentItem(id){return contentItems.find(v=>String(v.id)===String(id))}
function openEditor(id){
  const v=findContentItem(id);if(!v)return;
  currentEditId=id;
  document.getElementById("editCaption").value=v.caption||"";
  document.getElementById("editHashtags").value=v.hashtags||"";
  document.getElementById("editVisibility").value=v.visibility||"public";
  document.getElementById("editCommentsEnabled").checked=v.commentsEnabled!==false;
  document.getElementById("editStatus").value=v.status||"published";
  const video=document.getElementById("editVideoPreview");
  video.src=getVideoSource(v);video.load();
  updateCaptionCount();document.getElementById("editModal").classList.add("show");
}
function closeEditor(){
  document.getElementById("editModal").classList.remove("show");
  const video=document.getElementById("editVideoPreview");video.pause();video.removeAttribute("src");video.load();currentEditId=null;
}
function updateCaptionCount(){const el=document.getElementById("editCaption"),count=document.getElementById("captionCount");if(el&&count)count.textContent=el.value.length+" / 150"}
async function saveEditor(forcedStatus){
  const v=findContentItem(currentEditId);if(!v)return;
  const caption=document.getElementById("editCaption").value.trim(),hashtags=document.getElementById("editHashtags").value.trim(),visibility=document.getElementById("editVisibility").value,commentsEnabled=document.getElementById("editCommentsEnabled").checked,status=forcedStatus||document.getElementById("editStatus").value;
  try{
    const db=getSupabase();if(!db)throw new Error("Supabase is unavailable.");
    const {error}=await db.from("videos").update({caption,hashtags,visibility,comments_enabled:commentsEnabled,status}).eq("id",currentEditId);
    if(error)throw error;
    closeEditor();await loadContent();
  }catch(e){alert("Could not save video: "+e.message)}
}
document.getElementById("editCaption")?.addEventListener("input",updateCaptionCount);
document.getElementById("editModal")?.addEventListener("click",e=>{if(e.target.id==="editModal")closeEditor()});

function openPreview(id){
  const v=findContentItem(id);if(!v)return;
  const m=document.getElementById("previewModal"),x=document.getElementById("previewVideo");
  document.getElementById("previewTitle").textContent=v.caption||"Untitled Beyond video";
  document.getElementById("previewTags").textContent=v.hashtags||"No hashtags";
  document.getElementById("previewStats").textContent="Views "+v.views+" • Likes "+v.likeCount+" • Comments "+v.commentCount+" • "+(v.visibility||"public");
  x.src=getVideoSource(v);x.load();m.classList.add("show");
}
function closePreview(){
  const m=document.getElementById("previewModal"),x=document.getElementById("previewVideo");
  m.classList.remove("show");x.pause();x.removeAttribute("src");x.load();
}
window.addEventListener("beforeunload",()=>{
  if(realtimeReloadTimer)clearTimeout(realtimeReloadTimer);
  if(realtimeChannel&&realtimeDb){try{realtimeDb.removeChannel(realtimeChannel)}catch(e){}}
  localObjectUrls.forEach(url=>URL.revokeObjectURL(url));
});
