const usernameEl=document.getElementById("username");
const avatarEl=document.getElementById("avatar");
const bioEl=document.getElementById("bio");
const followingEl=document.getElementById("following"),likesEl=document.getElementById("likes");

function currentUser(){
  return localStorage.getItem("beyondUsername")||"BeyondCreator";
}

function loadProfile(){
  const u=currentUser();
  usernameEl.textContent="@"+u;
  avatarEl.textContent=u.charAt(0).toUpperCase();
  bioEl.textContent=localStorage.getItem("beyondBio")||"Welcome to my Beyond profile 🚀";
  loadFollowingCount();
  loadVideos();
}

async function loadLikeCount(){
  const db=await openDB();
  const videoReq=db.transaction("videos","readonly").objectStore("videos").getAll();
  videoReq.onsuccess=()=>{
    const ids=videoReq.result.filter(v=>v.username===currentUser()).map(v=>v.id);
    const likeReq=db.transaction("likes","readonly").objectStore("likes").getAll();
    likeReq.onsuccess=()=>likesEl.textContent=likeReq.result.filter(l=>ids.includes(l.postId)).length;
  };
}\n\nfunction loadFollowingCount(){
  try{
    followingEl.textContent=JSON.parse(localStorage.getItem("beyondFollowing")||"[]").length;
  }catch{
    followingEl.textContent="0";
  }
}

async function loadVideos(){
  const db=await openDB();
  const req=db.transaction("videos","readonly").objectStore("videos").getAll();

  req.onsuccess=()=>{
    const posts=req.result.filter(p=>p.username===currentUser()).reverse();
    const container=document.getElementById("profileVideos");
    container.innerHTML="";
    document.getElementById("noVideos").style.display=posts.length?"none":"block";

    posts.forEach(p=>{
      const item=document.createElement("div");
      item.className="video-item";

      const v=document.createElement("video");
      v.src=URL.createObjectURL(p.video);
      v.muted=true;
      v.loop=true;
      v.playsInline=true;
      v.controls=true;

      const o=document.createElement("div");
      o.className="video-overlay";
      o.textContent=p.caption||"";

      item.append(v,o);
      container.appendChild(item);
    });
  };
}

function openDB(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open("BeyondDatabase",2);
    r.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains("videos")) db.createObjectStore("videos",{keyPath:"id",autoIncrement:true});
      if(!db.objectStoreNames.contains("comments")) db.createObjectStore("comments",{keyPath:"id",autoIncrement:true});
    };
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}

function editProfile(){
  const old=localStorage.getItem("beyondBio")||"";
  const value=prompt("Enter your new bio:",old);
  if(value!==null){
    if(value.length>80){
      alert("Your bio must be 80 characters or less.");
      return;
    }
    localStorage.setItem("beyondBio",value);
    bioEl.textContent=value;
  }
}

function showLikedVideos(){
  alert("Liked videos will be added next.");
}

function goHome(){location.href="index.html"}
function openUpload(){location.href="upload.html"}
function openSearch(){location.href="search.html"}

function logout(){
  if(confirm("Log out of Beyond?")){
    localStorage.removeItem("beyondLoggedIn");
    localStorage.removeItem("beyondUsername");
    localStorage.removeItem("beyondEmail");
    location.href="index.html";
  }
}

loadProfile();