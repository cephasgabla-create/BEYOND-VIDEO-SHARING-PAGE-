const usernameEl=document.getElementById("username");
const avatarEl=document.getElementById("avatar");
const bioEl=document.getElementById("bio");
const followingEl=document.getElementById("following"),followersEl=document.getElementById("followers"),likesEl=document.getElementById("likes");

function currentUser(){
  return localStorage.getItem("beyondUsername")||"BeyondCreator";
}

async function loadProfile(){
  const u=currentUser();
  usernameEl.textContent="@"+u;
  avatarEl.textContent=u.charAt(0).toUpperCase();
  bioEl.textContent=localStorage.getItem("beyondBio")||"Welcome to my Beyond profile 🚀";

  try{
    if(typeof initBeyondDatabase==="function" && typeof getBeyondOwnProfile==="function"){
      const db=initBeyondDatabase();
      if(db){
        const authUser=await getCurrentBeyondUser();
        if(authUser){
          const profile=await getBeyondOwnProfile();
          if(profile){
            const name=profile.username||profile.display_name||u;
            usernameEl.textContent="@"+name;
            avatarEl.textContent=(name.charAt(0)||"B").toUpperCase();
            bioEl.textContent=profile.bio||"Welcome to my Beyond profile 🚀";
            localStorage.setItem("beyondUsername",name);
            localStorage.setItem("beyondBio",profile.bio||"");
            if(profile.avatar_url){
              avatarEl.textContent="";
              avatarEl.style.backgroundImage="url('"+profile.avatar_url.replace(/'/g,"\\'")+"')";
              avatarEl.style.backgroundSize="cover";
              avatarEl.style.backgroundPosition="center";
            }
          }
        }
      }
    }
  }catch(error){
    console.warn("Beyond Supabase profile unavailable:",error);
  }

  await loadFollowStats();
  loadLikeCount();
  loadNotifications();
  loadVideos();
  toggleOwnFollowInfo();
}

async function loadLikeCount(){
  const db=await openDB();
  const videoReq=db.transaction("videos","readonly").objectStore("videos").getAll();
  videoReq.onsuccess=()=>{
    const ids=videoReq.result.filter(v=>v.username===currentUser()).map(v=>v.id);
    const likeReq=db.transaction("likes","readonly").objectStore("likes").getAll();
    likeReq.onsuccess=()=>likesEl.textContent=likeReq.result.filter(l=>ids.includes(l.postId)).length;
  };
}

function getFollowingList(){
  try{return JSON.parse(localStorage.getItem("beyondFollowing")||"[]");}
  catch{return [];}
}

function getFollowersMap(){
  try{return JSON.parse(localStorage.getItem("beyondFollowers")||"{}");}
  catch{return {};}
}

function saveFollowersMap(map){
  localStorage.setItem("beyondFollowers",JSON.stringify(map));
}

function getFollowersFor(username){
  const map=getFollowersMap();
  return Array.isArray(map[username])?map[username]:[];
}

async function loadFollowStats(){
  const user=currentUser();
  followingEl.textContent=getFollowingList().length;
  followersEl.textContent=getFollowersFor(user).length;

  try{
    if(typeof initBeyondDatabase==="function" && typeof getCurrentBeyondUser==="function" && typeof getBeyondFollowStatsByUserId==="function"){
      const db=initBeyondDatabase();
      if(db){
        const authUser=await getCurrentBeyondUser();
        if(authUser){
          const stats=await getBeyondFollowStatsByUserId(authUser.id);
          followingEl.textContent=stats.following;
          followersEl.textContent=stats.followers;
          toggleOwnFollowInfo();
        }
      }
    }
  }catch(error){
    console.warn("Beyond Supabase follower stats unavailable:",error);
  }
}

async function loadVideos(){
  const db=await openDB();
  const req=db.transaction("videos","readonly").objectStore("videos").getAll();

  req.onsuccess=()=>{
    const posts=req.result.filter(p=>p.username===currentUser()).reverse();
    const container=document.getElementById("profileVideos");
    if(!container)return;
    container.innerHTML="";

    if(!posts.length){
      const empty=document.createElement("p");
      empty.id="noVideos";
      empty.textContent="You haven't posted any videos yet.";
      container.appendChild(empty);
    }

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
    const r=indexedDB.open("BeyondDatabase",4);
    r.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains("videos")) db.createObjectStore("videos",{keyPath:"id",autoIncrement:true});
      if(!db.objectStoreNames.contains("comments")) db.createObjectStore("comments",{keyPath:"id",autoIncrement:true});
      if(!db.objectStoreNames.contains("likes")) db.createObjectStore("likes",{keyPath:"key"});
      if(!db.objectStoreNames.contains("notifications")) db.createObjectStore("notifications",{keyPath:"id",autoIncrement:true});
    };
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}

async function editProfile(){
  const old=localStorage.getItem("beyondBio")||"";
  const value=prompt("Enter your new bio:",old);
  if(value===null)return;
  if(value.length>80){
    alert("Your bio must be 80 characters or less.");
    return;
  }

  localStorage.setItem("beyondBio",value);
  bioEl.textContent=value;

  try{
    if(typeof updateBeyondOwnProfile==="function"){
      const db=initBeyondDatabase();
      const authUser=await getCurrentBeyondUser();
      if(db&&authUser){
        await updateBeyondOwnProfile({
          username:currentUser(),
          display_name:currentUser(),
          bio:value
        });
      }
    }
  }catch(error){
    console.warn("Beyond profile save warning:",error);
    alert("Your bio was saved locally, but Supabase could not save it.");
  }
}

async function loadNotifications(){const db=await openDB();const req=db.transaction("notifications","readonly").objectStore("notifications").getAll();req.onsuccess=()=>{const count=req.result.filter(n=>n.username===currentUser()&&!n.read).length;const b=document.getElementById("notificationButton");if(b)b.textContent=count?"🔔 "+count:"🔔 Notifications"};}

function toggleOwnFollowInfo(){
  const summary=document.getElementById("followSummary");
  if(!summary)return;
  summary.textContent=followingEl.textContent+" following • "+followersEl.textContent+" followers";
}

function openNotifications(){location.href="notifications.html";}

async function showLikedVideos(){
  const db=await openDB();
  const tx=db.transaction(["likes","videos"],"readonly");
  const likesStore=tx.objectStore("likes");
  const videosStore=tx.objectStore("videos");
  const likesReq=likesStore.getAll();
  const videosReq=videosStore.getAll();

  likesReq.onsuccess=()=>{
    videosReq.onsuccess=()=>{
      const current=localStorage.getItem("beyondUsername");
      const likedIds=new Set(likesReq.result.filter(l=>l.username===current).map(l=>l.postId));
      const likedVideos=videosReq.result.filter(v=>likedIds.has(v.id)).reverse();
      const container=document.getElementById("profileVideos");
      if(!container)return;
      container.innerHTML="";

      if(!likedVideos.length){
        const empty=document.createElement("p");
        empty.id="noVideos";
        empty.textContent="You haven't liked any videos yet.";
        container.appendChild(empty);
        return;
      }

      likedVideos.forEach(p=>{
        const item=document.createElement("div");
        item.className="video-item";

        const v=document.createElement("video");
        v.muted=true;
        v.loop=true;
        v.playsInline=true;
        v.controls=true;
        if(p.video instanceof Blob){
          v.src=URL.createObjectURL(p.video);
        }else if(p.video_url){
          v.src=p.video_url;
        }

        const o=document.createElement("div");
        o.className="video-overlay";
        o.textContent=p.caption||"";

        item.append(v,o);
        container.appendChild(item);
      });
    };
  };
}

function goHome(){location.href="index.html"}
function openUpload(){location.href="upload.html"}
function openSearch(){location.href="search.html"}

async function logout(){
  if(!confirm("Log out of Beyond?")) return;

  try{
    if(typeof initBeyondDatabase==="function"){
      const db=initBeyondDatabase();
      if(db) await db.auth.signOut();
    }
  }catch(error){
    console.warn("Beyond Supabase sign-out warning:",error);
  }finally{
    localStorage.removeItem("beyondLoggedIn");
    localStorage.removeItem("beyondUsername");
    localStorage.removeItem("beyondEmail");
    location.href="index.html";
  }
}

loadProfile();