const input=document.getElementById("searchInput");

if(input){
  input.addEventListener("keydown",e=>{
    if(e.key==="Enter") performSearch();
  });
}

async function performSearch(){
  const q=input.value.trim().toLowerCase();
  const results=document.getElementById("results");
  const status=document.getElementById("searchStatus");

  if(!q){
    status.textContent="Type something to search.";
    results.innerHTML="";
    return;
  }

  results.innerHTML="";
  status.textContent="Searching Beyond…";

  try{
    const db=await openDB();
    const req=db.transaction("videos","readonly").objectStore("videos").getAll();

    req.onsuccess=()=>{
      const matches=req.result.filter(p=>
        (p.username||"").toLowerCase().includes(q) ||
        (p.caption||"").toLowerCase().includes(q) ||
        (p.hashtags||"").toLowerCase().includes(q)
      );

      renderResults(matches);
    };

    req.onerror=()=>{
      status.textContent="Search could not load your videos.";
    };
  }catch(error){
    console.error("Beyond search error:",error);
    status.textContent="Search is temporarily unavailable.";
  }

  function renderResults(matches){
    results.innerHTML="";
    status.textContent=matches.length
      ? matches.length+" result"+(matches.length===1?"":"s")+" found"
      : "No results found.";

    matches.reverse().forEach(p=>{
      const card=document.createElement("div");
      card.className="result-card";

      const video=document.createElement("video");
      video.className="result-video";
      video.muted=true;
      video.loop=true;
      video.controls=true;

      if(p.video instanceof Blob){
        video.src=URL.createObjectURL(p.video);
      }else if(p.video_url){
        video.src=p.video_url;
      }else if(p.videoUrl){
        video.src=p.videoUrl;
      }

      const info=document.createElement("div");
      info.className="result-info";

      const user=document.createElement("h3");
      user.textContent="@"+(p.username||"Beyond creator");

      const caption=document.createElement("p");
      caption.textContent=p.caption||"";

      const tags=document.createElement("p");
      tags.className="hashtags";
      tags.textContent=p.hashtags||"";

      info.append(user,caption,tags);
      card.append(video,info);
      results.appendChild(card);
    });
  }
}

function openDB(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open("BeyondDatabase",4);

    r.onupgradeneeded=e=>{
      const db=e.target.result;

      if(!db.objectStoreNames.contains("videos")){
        db.createObjectStore("videos",{keyPath:"id",autoIncrement:true});
      }
      if(!db.objectStoreNames.contains("comments")){
        db.createObjectStore("comments",{keyPath:"id",autoIncrement:true});
      }
      if(!db.objectStoreNames.contains("likes")){
        db.createObjectStore("likes",{keyPath:"key"});
      }
    };

    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}

function goHome(){
  location.href="index.html";
}

function openUpload(){
  location.href="upload.html";
}

function openProfile(){
  location.href="profile.html";
}
