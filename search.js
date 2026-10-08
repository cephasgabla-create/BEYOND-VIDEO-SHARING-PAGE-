const input=document.getElementById("searchInput");
const results=document.getElementById("results");
const status=document.getElementById("searchStatus");
let objectUrls=[];

if(input){
  input.addEventListener("keydown",e=>{if(e.key==="Enter")performSearch()});
}

function configuredSupabase(){
  try{return window.beyondDB||(typeof initBeyondDatabase==="function"?initBeyondDatabase():null)}catch{return null}
}

async function performSearch(){
  const q=input?.value.trim().toLowerCase()||"";
  if(!q){status.textContent="Type something to search.";clearResults();return}
  clearResults();status.textContent="Searching Beyond…";
  try{
    const db=configuredSupabase();
    if(db){
      const [{data:videos,error:videoError},{data:profiles,error:profileError}]=await Promise.all([
        db.from("videos").select("id,user_id,video_url,caption,hashtags,created_at,status").eq("status","published").or("caption.ilike.%"+escapeFilter(q)+"%,hashtags.ilike.%"+escapeFilter(q)+"%").order("created_at",{ascending:false}).limit(100),
        db.from("profiles").select("id,username,display_name,avatar_url").ilike("username","%"+q+"%").limit(50)
      ]);
      if(videoError)throw videoError;
      if(profileError)throw profileError;
      const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));
      let matches=(videos||[]).map(v=>({...v,username:profileMap.get(v.user_id)?.username||"Beyond creator",display_name:profileMap.get(v.user_id)?.display_name||""}));
      const creatorIds=(profiles||[]).map(p=>p.id);
      if(creatorIds.length){
        const {data:creatorVideos,error:creatorError}=await db.from("videos").select("id,user_id,video_url,caption,hashtags,created_at,status").eq("status","published").in("user_id",creatorIds).order("created_at",{ascending:false}).limit(100);
        if(creatorError)throw creatorError;
        const byId=new Map(matches.map(v=>[String(v.id),v]));
        (creatorVideos||[]).forEach(v=>{if(!byId.has(String(v.id)))matches.push({...v,...profileMap.get(v.user_id),username:profileMap.get(v.user_id)?.username||"Beyond creator"})});
      }
      matches.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
      renderResults(matches.slice(0,100));
      return;
    }
    const local=await loadLocalVideos();
    renderResults(local.filter(p=>(p.username||"").toLowerCase().includes(q)||(p.caption||"").toLowerCase().includes(q)||(p.hashtags||"").toLowerCase().includes(q)).reverse());
  }catch(error){
    console.error("Beyond search error:",error);
    status.textContent="Search is temporarily unavailable."; 
  }
}

function escapeFilter(value){return value.replace(/[,%()]/g," ").trim()}
function clearResults(){objectUrls.forEach(url=>URL.revokeObjectURL(url));objectUrls=[];if(results)results.innerHTML=""}

function renderResults(matches){
  results.innerHTML="";
  status.textContent=matches.length?matches.length+" result"+(matches.length===1?"":"s")+" found":"No results found.";
  matches.forEach(p=>{
    const card=document.createElement("article");card.className="result-card";
    const video=document.createElement("video");video.className="result-video";video.muted=true;video.loop=true;video.controls=true;video.playsInline=true;
    if(p.video instanceof Blob){const url=URL.createObjectURL(p.video);objectUrls.push(url);video.src=url}else if(p.video_url)video.src=p.video_url;else if(p.videoUrl)video.src=p.videoUrl;
    const info=document.createElement("div");info.className="result-info";
    const user=document.createElement("h3");user.textContent="@"+(p.username||"Beyond creator");
    const caption=document.createElement("p");caption.textContent=p.caption||"";
    const tags=document.createElement("p");tags.className="hashtags";tags.textContent=p.hashtags||"";
    info.append(user,caption,tags);card.append(video,info);results.appendChild(card);
  });
}

function loadLocalVideos(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open("BeyondDatabase",4);
    r.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains("videos"))db.createObjectStore("videos",{keyPath:"id",autoIncrement:true});if(!db.objectStoreNames.contains("comments"))db.createObjectStore("comments",{keyPath:"id",autoIncrement:true});if(!db.objectStoreNames.contains("likes"))db.createObjectStore("likes",{keyPath:"key"})};
    r.onsuccess=()=>{const db=r.result;const req=db.transaction("videos","readonly").objectStore("videos").getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)};
    r.onerror=()=>reject(r.error);
  });
}

function goHome(){location.href="index.html"}
function openUpload(){location.href="upload.html"}
function openProfile(){location.href="profile.html"}
