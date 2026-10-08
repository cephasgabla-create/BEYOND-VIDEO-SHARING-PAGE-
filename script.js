let currentPostId=null;

document.addEventListener("DOMContentLoaded",()=>{loadBeyondVideos();loadSocialPosts();activateVideoObserver();updateAllFollowButtons();const u=localStorage.getItem("beyondUsername");if(u)document.getElementById("composerAvatar").textContent=u.charAt(0).toUpperCase();if(localStorage.getItem("beyondTheme")==="light")document.body.classList.add("light-theme")});

function openDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open("BeyondDatabase",4);request.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains("videos"))db.createObjectStore("videos",{keyPath:"id",autoIncrement:true});if(!db.objectStoreNames.contains("comments"))db.createObjectStore("comments",{keyPath:"id",autoIncrement:true});if(!db.objectStoreNames.contains("likes"))db.createObjectStore("likes",{keyPath:"key"});if(!db.objectStoreNames.contains("notifications"))db.createObjectStore("notifications",{keyPath:"id",autoIncrement:true});if(!db.objectStoreNames.contains("socialPosts"))db.createObjectStore("socialPosts",{keyPath:"id",autoIncrement:true})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}

async function loadBeyondVideos(){
  const feed=document.getElementById("feed");
  if(!feed)return;

  const staticCards=Array.from(feed.querySelectorAll(".video-card"));
  const loading=document.getElementById("feedLoading");
  try{
    const db=typeof initBeyondDatabase==="function" ? initBeyondDatabase() : null;
    if(db){
      const {data:remoteVideos,error}=await db
        .from("videos")
        .select("id,user_id,video_url,caption,hashtags,status,views_count,likes_count,created_at,profiles(username,display_name,avatar_url)")
        .eq("status","published")
        .order("created_at",{ascending:false});

      if(error)throw error;

      staticCards.forEach(card=>card.remove());
      remoteVideos.forEach(video=>createRemoteVideoCard(video));
      activateVideoObserver();
      updateAllFollowButtons();

      if(!remoteVideos.length){
        const empty=document.createElement("div");
        empty.className="feed-empty";
        empty.textContent="No published videos yet. Upload the first Beyond video.";
        feed.appendChild(empty);
      }
      if(loading)loading.remove();
      return;
    }
  }catch(e){
    console.warn("Beyond Supabase feed unavailable; using local videos:",e);
  }

  // Safe fallback for development when Supabase credentials are not configured.
  try{
    const db=await openDatabase();
    const req=db.transaction("videos","readonly").objectStore("videos").getAll();
    req.onsuccess=()=>{
      req.result.reverse().forEach(createVideoCard);
      activateVideoObserver();
      updateAllFollowButtons();
      if(loading)loading.remove();
    };
  }catch(e){
    console.error("Beyond local feed unavailable:",e);
    if(loading)loading.remove();
  }
}
function createRemoteVideoCard(post){
  const username=post.profiles?.username||"BeyondCreator";
  const feed=document.getElementById("feed");
  if(!feed)return;
  const section=document.createElement("section");
  section.className="video-card";
  section.dataset.creator=username;
  section.dataset.postId=post.id;

  const video=document.createElement("video");
  video.className="video";
  video.src=post.video_url;
  video.loop=true;
  video.muted=true;
  video.playsInline=true;
  video.preload="metadata";

  const info=document.createElement("div");
  info.className="video-info";
  const row=document.createElement("div");
  row.className="creator-row";
  const name=document.createElement("h3");
  name.textContent="@"+username;
  const follow=document.createElement("button");
  follow.className="follow-button";
  follow.onclick=()=>toggleFollow(username,follow);
  row.append(name,follow);
  updateFollowButton(username,follow);

  const caption=document.createElement("p");
  caption.textContent=post.caption||"";
  const tags=document.createElement("p");
  tags.textContent=post.hashtags||"";
  info.append(row,caption,tags);

  const actions=document.createElement("div");
  actions.className="video-actions";
  actions.innerHTML='<button class="like-button">❤️ <span>0</span></button><button class="comment-button">💬 <span>0</span></button><button onclick="shareVideo()">↗️ <span>Share</span></button><button onclick="openProfile()">👤 <span>Profile</span></button>';
  actions.children[0].onclick=()=>likeRemoteVideo(actions.children[0],post.id);
  actions.children[1].onclick=()=>commentVideo(post.id);

  section.append(video,info,actions);
  feed.appendChild(section);
  loadRemoteLikeState(post.id,actions.children[0]);
  loadRemoteCommentCount(post.id,actions.children[1]);
  subscribeToRemoteVideo(post.id,section);
  video.addEventListener("play",()=>recordRemoteVideoView(post.id),{once:true});
}

async function likeRemoteVideo(button,videoId){
  const db=initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user){alert("Please log in to like videos.");return;}
  try{
    const {data:existing}=await db.from("likes").select("video_id").eq("video_id",videoId).eq("user_id",user.id).maybeSingle();
    if(existing){
      await db.from("likes").delete().eq("video_id",videoId).eq("user_id",user.id);
    }else{
      await db.from("likes").insert({video_id:videoId,user_id:user.id});
    }
    await loadRemoteLikeState(videoId,button);
  }catch(error){console.error(error);alert("Could not update the like right now.")}
}

async function loadRemoteLikeState(videoId,button){
  try{
    const db=initBeyondDatabase();
    if(!db)return;
    const user=await getCurrentBeyondUser();
    const {data,count,error}=await db.from("likes").select("user_id",{count:"exact"}).eq("video_id",videoId);
    if(error)throw error;
    button.querySelector("span").textContent=count||0;
    const liked=!!user&&data.some(row=>row.user_id===user.id);
    button.classList.toggle("liked",liked);
    button.style.color=liked?"#ff2d55":"white";
  }catch(error){console.warn("Beyond remote like state unavailable:",error)}
}

async function loadRemoteCommentCount(videoId,button){
  try{
    const db=initBeyondDatabase();
    if(!db)return;
    const {count,error}=await db.from("comments").select("id",{count:"exact",head:true}).eq("video_id",videoId);
    if(error)throw error;
    button.querySelector("span").textContent=count||0;
  }catch(error){console.warn("Beyond remote comment count unavailable:",error)}
}

async function recordRemoteVideoView(videoId){
  const db=initBeyondDatabase();
  if(!db||!videoId)return;
  const key="beyondViewed_"+videoId;
  if(sessionStorage.getItem(key))return;
  try{
    const {error}=await db.rpc("increment_video_view",{video_id:videoId});
    if(error)throw error;
    sessionStorage.setItem(key,"1");
  }catch(error){
    console.warn("Beyond remote view could not be recorded:",error);
  }
}

function subscribeToRemoteVideo(videoId,section){
  const db=initBeyondDatabase();
  if(!db||!videoId||!section)return;
  const channel=db.channel("beyond-video-"+videoId)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"comments",filter:"video_id=eq."+videoId},payload=>{
      const button=section.querySelector(".comment-button");
      if(button)loadRemoteCommentCount(videoId,button);
      if(currentPostId===videoId)loadComments(videoId);
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"likes",filter:"video_id=eq."+videoId},()=>{
      const button=section.querySelector(".like-button");
      if(button)loadRemoteLikeState(videoId,button);
    })
    .subscribe();
  section._beyondRealtimeChannel=channel;
}

function createVideoCard(post){
 const feed=document.getElementById("feed"),section=document.createElement("section");
 section.className="video-card";section.dataset.creator=post.username;section.dataset.postId=post.id;
 const video=document.createElement("video");video.className="video";video.src=URL.createObjectURL(post.video);video.loop=true;video.muted=true;video.playsInline=true;
 const info=document.createElement("div");info.className="video-info";const row=document.createElement("div");row.className="creator-row";
 const name=document.createElement("h3");name.textContent="@"+post.username;const follow=document.createElement("button");follow.className="follow-button";follow.onclick=()=>toggleFollow(post.username,follow);row.append(name,follow);updateFollowButton(post.username,follow);
 const caption=document.createElement("p");caption.textContent=post.caption||"";const tags=document.createElement("p");tags.textContent=post.hashtags||"";info.append(row,caption,tags);
 const actions=document.createElement("div");actions.className="video-actions";
 actions.innerHTML='<button class="like-button">❤️ <span>0</span></button><button class="comment-button">💬 <span>0</span></button><button onclick="shareVideo()">↗️ <span>Share</span></button><button onclick="openProfile()">👤 <span>Profile</span></button>';
 actions.children[0].onclick=()=>likeVideo(actions.children[0],post.id);
 actions.children[1].onclick=()=>commentVideo(post.id);
 section.append(video,info,actions);feed.appendChild(section);
 loadLikeState(post.id,actions.children[0]);loadCommentCount(post.id,actions.children[1]);
}

async function likeVideo(button,postId){
 const user=localStorage.getItem("beyondUsername");
 if(!user){alert("Please log in to like videos.");location.href="login.html";return}
 const db=await openDatabase(),key=postId+"_"+user,store=db.transaction("likes","readwrite").objectStore("likes");
 const existing=await new Promise(resolve=>{const r=store.get(key);r.onsuccess=()=>resolve(r.result)});
 if(existing) store.delete(key); else {store.put({key,postId,username:user}); const videoReq=db.transaction("videos","readonly").objectStore("videos").get(postId); videoReq.onsuccess=()=>{const video=videoReq.result;if(video&&video.username!==user){const nt=db.transaction("notifications","readwrite");nt.objectStore("notifications").add({username:video.username,type:"like",actor:user,postId,text:"@"+user+" liked your video",createdAt:new Date().toISOString(),read:false});}}}
 store.transaction.oncomplete=()=>loadLikeState(postId,button);
}

async function loadLikeState(postId,button){
 const db=await openDatabase(),req=db.transaction("likes","readonly").objectStore("likes").getAll();
 req.onsuccess=()=>{const likes=req.result.filter(l=>l.postId===postId),user=localStorage.getItem("beyondUsername"),liked=likes.some(l=>l.username===user);button.querySelector("span").textContent=likes.length;button.classList.toggle("liked",liked);button.style.color=liked?"#ff2d55":"white"};
}

async function loadCommentCount(postId,button){
 const db=await openDatabase(),req=db.transaction("comments","readonly").objectStore("comments").getAll();
 req.onsuccess=()=>button.querySelector("span").textContent=req.result.filter(c=>c.postId===postId).length;
}

async function createSocialPost(){const user=localStorage.getItem("beyondUsername");const input=document.getElementById("postText");const text=input.value.trim();if(!user){location.href="login.html";return}if(!text)return;const db=await openDatabase();const tx=db.transaction("socialPosts","readwrite");tx.objectStore("socialPosts").add({username:user,text,createdAt:new Date().toISOString()});tx.oncomplete=()=>{input.value="";loadSocialPosts()}}
async function loadSocialPosts(){const feed=document.getElementById("feed");if(!feed)return;feed.querySelectorAll(".social-post").forEach(el=>el.remove());const db=await openDatabase();const req=db.transaction("socialPosts","readonly").objectStore("socialPosts").getAll();req.onsuccess=()=>{req.result.reverse().forEach(p=>{const el=document.createElement("article");el.className="social-post";const head=document.createElement("div");head.className="social-post-head";const av=document.createElement("div");av.className="social-post-avatar";av.textContent=p.username.charAt(0).toUpperCase();const name=document.createElement("strong");name.textContent="@"+p.username;head.append(av,name);const body=document.createElement("div");body.className="social-post-text";body.textContent=p.text;const actions=document.createElement("div");actions.className="social-post-actions";actions.innerHTML='<button>💬 Reply</button><button>🔁 Repost</button><button>🔖 Save</button><button>↗️ Share</button>';actions.children[1].onclick=()=>repostSocialPost(p.id);actions.children[2].onclick=()=>saveSocialPost(p.id);actions.children[3].onclick=()=>shareVideo();el.append(head,body,actions);feed.prepend(el)})}}
async function repostSocialPost(id){const user=localStorage.getItem("beyondUsername");if(!user){location.href="login.html";return}const db=await openDatabase();const r=db.transaction("socialPosts","readonly").objectStore("socialPosts").get(id);r.onsuccess=()=>{const p=r.result;if(!p)return;const tx=db.transaction("socialPosts","readwrite");tx.objectStore("socialPosts").add({username:user,text:"🔁 Reposted @"+p.username+": "+p.text,createdAt:new Date().toISOString()});tx.oncomplete=()=>loadSocialPosts()}}
function saveSocialPost(id){let saved=JSON.parse(localStorage.getItem("beyondSavedPosts")||"[]");if(!saved.includes(id))saved.push(id);localStorage.setItem("beyondSavedPosts",JSON.stringify(saved));alert("Saved to your Beyond bookmarks.")}
function saveVideo(button){const card=button.closest(".video-card");if(!card)return;let saved=JSON.parse(localStorage.getItem("beyondSavedVideos")||"[]");const id=card.dataset.postId||card.dataset.creator;if(saved.includes(id)){saved=saved.filter(x=>x!==id);button.classList.remove("saved");button.querySelector("span").textContent="Save"}else{saved.push(id);button.classList.add("saved");button.querySelector("span").textContent="Saved"}localStorage.setItem("beyondSavedVideos",JSON.stringify(saved))}
function toggleTheme(){const light=document.body.classList.toggle("light-theme");localStorage.setItem("beyondTheme",light?"light":"dark")}
function openMore(){document.getElementById("moreOverlay").style.display="block";document.getElementById("morePanel").classList.add("open")}
function closeMore(){document.getElementById("moreOverlay").style.display="none";document.getElementById("morePanel").classList.remove("open")}
function showSaved(){const posts=JSON.parse(localStorage.getItem("beyondSavedPosts")||"[]");alert(posts.length+" saved social post(s).")}
function showHistory(){const history=JSON.parse(localStorage.getItem("beyondWatchHistory")||"[]");alert(history.length+" video(s) in your watch history.")}
function openSettings(){alert("Settings: Theme, autoplay, privacy and account controls are coming to Beyond Settings.")}


async function shareVideo(){if(navigator.share){try{await navigator.share({title:"Beyond",text:"Check out this video on Beyond!"})}catch{}}else alert("Sharing is not supported by this browser yet.")}

function openLogin(){location.href="login.html"}function openUpload(){location.href="upload.html"}function openProfile(){location.href="profile.html"}function openSearch(){location.href="search.html"}
function getFollowing(){
  try{return JSON.parse(localStorage.getItem("beyondFollowing")||"[]")}
  catch{return []}
}
function saveFollowing(list){
  localStorage.setItem("beyondFollowing",JSON.stringify([...new Set(list)]));
}
function getFollowersMap(){
  try{return JSON.parse(localStorage.getItem("beyondFollowers")||"{}")}
  catch{return {}}
}
function saveFollowersMap(map){
  localStorage.setItem("beyondFollowers",JSON.stringify(map));
}
function updateFollowerRecord(username,currentUser,following){
  const map=getFollowersMap();
  const followers=Array.isArray(map[username])?map[username]:[];
  const index=followers.indexOf(currentUser);
  if(following && index===-1) followers.push(currentUser);
  if(!following && index!==-1) followers.splice(index,1);
  map[username]=followers;
  saveFollowersMap(map);
  return followers.length;
}
async function toggleFollow(username,button){
  const currentUser=localStorage.getItem("beyondUsername");
  if(!currentUser){
    alert("Please log in before following creators.");
    location.href="login.html";
    return;
  }
  if(currentUser===username){
    alert("You cannot follow yourself.");
    return;
  }

  const previousFollowing=getFollowing().includes(username);
  const nowFollowing=!previousFollowing;

  if(button){
    button.disabled=true;
    button.dataset.followingBusy="true";
  }

  try{
    let supabaseUpdated=false;

    if(typeof initBeyondDatabase==="function" &&
       typeof getCurrentBeyondUser==="function" &&
       typeof getBeyondProfileByUsername==="function" &&
       typeof getBeyondFollowState==="function" &&
       typeof setBeyondFollow==="function"){
      const db=initBeyondDatabase();
      if(db){
        const authUser=await getCurrentBeyondUser();
        if(authUser){
          const target=await getBeyondProfileByUsername(username);
          if(target){
            const currentState=await getBeyondFollowState(target.id);
            if(currentState!==nowFollowing){
              await setBeyondFollow(target.id,nowFollowing);
            }
            supabaseUpdated=true;
          }
        }
      }
    }

    // Keep the local state synchronized for offline/demo fallback and UI filtering.
    let following=getFollowing();
    if(nowFollowing && !following.includes(username)) following.push(username);
    if(!nowFollowing) following=following.filter(name=>name!==username);
    saveFollowing(following);

    if(!supabaseUpdated){
      updateFollowerRecord(username,currentUser,nowFollowing);
    }

    updateFollowButton(username,button);
    document.querySelectorAll(".video-card").forEach(card=>{
      if(card.dataset.creator===username){
        card.querySelectorAll(".follow-button").forEach(b=>updateFollowButton(username,b));
      }
    });

    if(nowFollowing){
      openDatabase().then(db=>{
        const tx=db.transaction("notifications","readwrite");
        tx.objectStore("notifications").add({
          username,
          type:"follow",
          actor:currentUser,
          text:"@"+currentUser+" followed you",
          createdAt:new Date().toISOString(),
          read:false
        });
      }).catch(()=>{});
    }
  }catch(error){
    console.error("Beyond follow/unfollow failed:",error);
    alert("Beyond could not update this follow right now. Please try again.");
    updateFollowButton(username,button);
  }finally{
    if(button){
      button.disabled=false;
      delete button.dataset.followingBusy;
    }
  }
}
function updateFollowButton(username,button){
  if(!button)return;
  const following=getFollowing().includes(username);
  button.textContent=following?"Following":"Follow";
  button.classList.toggle("following",following);
}
function updateAllFollowButtons(){document.querySelectorAll(".follow-button").forEach(button=>{const row=button.closest(".creator-row");if(row)updateFollowButton(row.querySelector("h3").textContent.replace("@",""),button)})}
function showFollowing(){const following=getFollowing();document.querySelectorAll(".video-card").forEach(card=>card.style.display=following.includes(card.dataset.creator)?"flex":"none");if(!following.length)alert("You are not following anyone yet. Follow a creator first!")}
function showFeed(){document.querySelectorAll(".video-card").forEach(card=>card.style.display="flex");document.getElementById("feed").scrollTo({top:0,behavior:"smooth"})}

function commentVideo(postId){
  currentPostId=postId;
  document.getElementById("commentsPanel").style.display="flex";
  document.getElementById("commentsOverlay").style.display="block";
  loadComments(postId);
}

function closeComments(){
  document.getElementById("commentsPanel").style.display="none";
  document.getElementById("commentsOverlay").style.display="none";
  currentPostId=null;
}

async function addComment(){
  const input=document.getElementById("commentInput");
  const text=input.value.trim();
  if(!text||currentPostId===null)return;

  const username=localStorage.getItem("beyondUsername");
  if(!username){alert("Please log in to comment.");location.href="login.html";return}

  try{
    const db=initBeyondDatabase();
    const user=await getCurrentBeyondUser();

    if(db&&user&&typeof currentPostId==="number"){
      const {error}=await db.from("comments").insert({
        video_id:currentPostId,
        user_id:user.id,
        content:text
      });
      if(error)throw error;
      input.value="";
      await loadComments(currentPostId);
      const card=document.querySelector('[data-post-id="'+currentPostId+'"]');
      if(card){
        const button=card.querySelector(".comment-button");
        if(button)await loadRemoteCommentCount(currentPostId,button);
      }
      return;
    }
  }catch(error){
    console.error("Beyond Supabase comment failed:",error);
    alert("Beyond could not post your comment right now.");
    return;
  }

  const db=await openDatabase();
  const tx=db.transaction("comments","readwrite");
  tx.objectStore("comments").add({postId:currentPostId,username,text,createdAt:new Date().toISOString()});
  tx.oncomplete=async()=>{
    input.value="";
    loadComments(currentPostId);
    const card=document.querySelector('[data-post-id="'+currentPostId+'"]');
    if(card){
      const b=card.querySelector(".comment-button");
      loadCommentCount(currentPostId,b);
    }
  };
}

async function loadComments(postId){
  const list=document.getElementById("commentsList");
  list.innerHTML="<p style='color:#777'>Loading...</p>";

  try{
    const db=initBeyondDatabase();
    const user=await getCurrentBeyondUser();
    if(db&&user&&typeof postId==="number"){
      const {data,error}=await db.from("comments")
        .select("id,user_id,content,created_at,profiles(username,display_name,avatar_url)")
        .eq("video_id",postId)
        .order("created_at",{ascending:true});
      if(error)throw error;
      list.innerHTML="";
      if(!data.length){
        list.innerHTML="<p style='color:#777;text-align:center;padding:30px'>No comments yet. Be the first!</p>";
        return;
      }
      data.forEach(comment=>createRemoteComment(comment));
      return;
    }
  }catch(error){
    console.warn("Beyond remote comments unavailable:",error);
  }

  const localDb=await openDatabase();
  const req=localDb.transaction("comments","readonly").objectStore("comments").getAll();
  req.onsuccess=()=>{
    const comments=req.result.filter(c=>c.postId===postId).reverse();
    list.innerHTML="";
    if(!comments.length){
      list.innerHTML="<p style='color:#777;text-align:center;padding:30px'>No comments yet. Be the first!</p>";
      return;
    }
    comments.forEach(createComment);
  };
}

function createRemoteComment(comment){
  const profile=comment.profiles||{};
  const username=profile.username||"BeyondUser";
  const item=document.createElement("div");
  item.className="comment";
  const avatar=document.createElement("div");
  avatar.className="comment-avatar";
  avatar.textContent=username.charAt(0).toUpperCase();
  if(profile.avatar_url){
    avatar.textContent="";
    avatar.style.backgroundImage="url('"+profile.avatar_url.replace(/'/g,"\\'")+"')";
    avatar.style.backgroundSize="cover";
    avatar.style.backgroundPosition="center";
  }
  const content=document.createElement("div");
  content.className="comment-content";
  const name=document.createElement("div");
  name.className="comment-username";
  name.textContent="@"+username;
  const text=document.createElement("div");
  text.className="comment-text";
  text.textContent=comment.content||"";
  content.append(name,text);
  item.append(avatar,content);
  document.getElementById("commentsList").appendChild(item);
}

let beyondVideoObserver=null;function activateVideoObserver(){if(!("IntersectionObserver" in window))return;if(!beyondVideoObserver){beyondVideoObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{const video=entry.target;if(entry.isIntersecting){video.play().catch(()=>{});const id=video.closest(".video-card")?.dataset.postId||video.closest(".video-card")?.dataset.creator;if(id){let history=JSON.parse(localStorage.getItem("beyondWatchHistory")||"[]");history=[id,...history.filter(x=>x!==id)].slice(0,50);localStorage.setItem("beyondWatchHistory",JSON.stringify(history))}}else video.pause()}),{threshold:.7})}document.querySelectorAll(".video").forEach(v=>{if(!v.dataset.beyondObserved){beyondVideoObserver.observe(v);v.dataset.beyondObserved="true"}})}
function openDiscover(){const p=document.getElementById("discoverPanel");if(p)p.classList.add("open")}
function closeDiscover(){const p=document.getElementById("discoverPanel");if(p)p.classList.remove("open")}
function filterDiscover(){const q=(document.getElementById("discoverInput")?.value||"").toLowerCase();document.querySelectorAll(".trend-card").forEach(c=>c.style.display=c.textContent.toLowerCase().includes(q)?"block":"none")}

function openMessages(){const p=document.getElementById("messagesPanel");if(!p)return;p.classList.add("open");const o=document.getElementById("messagesOverlay");if(o)o.style.display="block"}
function closeMessages(){const p=document.getElementById("messagesPanel");if(p)p.classList.remove("open");const o=document.getElementById("messagesOverlay");if(o)o.style.display="none";const c=document.getElementById("chatView");if(c)c.classList.remove("active")}
function filterPeople(){const input=document.getElementById("messageSearch");const q=(input?.value||"").toLowerCase();document.querySelectorAll(".person-row").forEach(r=>r.style.display=(r.dataset.name||"").toLowerCase().includes(q)?"flex":"none")}
function openChat(name){const people=document.getElementById("peopleList"),search=document.querySelector(".message-search"),tabs=document.querySelector(".message-tabs"),c=document.getElementById("chatView"),chatName=document.getElementById("chatName"),avatar=document.getElementById("chatAvatar");if(!c||!chatName)return;if(people)people.style.display="none";if(search)search.style.display="none";if(tabs)tabs.style.display="none";c.classList.add("active");chatName.textContent="@"+name; if(avatar)avatar.textContent=name.charAt(0).toUpperCase();loadChatMessages(name)}
function backToPeople(){const c=document.getElementById("chatView"),people=document.getElementById("peopleList"),search=document.querySelector(".message-search"),tabs=document.querySelector(".message-tabs");if(c)c.classList.remove("active");if(people)people.style.display="block";if(search)search.style.display="block";if(tabs)tabs.style.display="flex"}
function chatKey(name){return "beyondChat_"+String(name).trim().toLowerCase()}
function loadChatMessages(name){const box=document.getElementById("chatMessages");if(!box)return;let msgs=[];try{msgs=JSON.parse(localStorage.getItem(chatKey(name))||"[]");if(!Array.isArray(msgs))msgs=[]}catch(e){msgs=[]}box.innerHTML='<div class="chat-bubble received">Welcome to Beyond! 👋</div>';const current=localStorage.getItem("beyondUsername");msgs.forEach(m=>{const d=document.createElement("div");d.className="chat-bubble "+(m.user===current?"sent":"received");d.textContent=String(m.text||"");box.appendChild(d)});box.scrollTop=box.scrollHeight}
function sendMessage(){const input=document.getElementById("chatInput"),chatName=document.getElementById("chatName");if(!input||!chatName)return;const text=input.value.trim(),name=chatName.textContent.replace(/^@/,"").trim();if(!text)return;if(!localStorage.getItem("beyondUsername")){location.href="login.html";return}let msgs=[];try{msgs=JSON.parse(localStorage.getItem(chatKey(name))||"[]");if(!Array.isArray(msgs))msgs=[]}catch(e){msgs=[]}msgs.push({user:localStorage.getItem("beyondUsername"),text,createdAt:new Date().toISOString()});localStorage.setItem(chatKey(name),JSON.stringify(msgs));input.value="";loadChatMessages(name)}

let liveTimer=null;
let beyondLiveChannel=null;
async function openLive(){
  const p=document.getElementById("livePanel");if(!p)return;
  p.classList.add("open");const o=document.getElementById("liveOverlay");if(o)o.style.display="block";
  const cfg=(()=>{try{return JSON.parse(localStorage.getItem("beyondLiveConfig")||"{}")}catch{return {}}})();
  if(cfg.roomId){
    window.beyondLiveRoomId=cfg.roomId;
    const title=document.getElementById("liveTitle");if(title)title.textContent=cfg.title||"Beyond Live";
    subscribeBeyondLiveRoom(cfg.roomId);
    if(!window.beyondLiveViewerJoined&&typeof updateLiveViewerCount==="function"){
      try{await updateLiveViewerCount(cfg.roomId,1);window.beyondLiveViewerJoined=true}catch(error){console.warn("Beyond Live viewer count unavailable:",error)}
    }
  }
}
async function closeLive(){
  const roomId=window.beyondLiveRoomId;
  if(roomId&&window.beyondLiveViewerJoined&&typeof updateLiveViewerCount==="function"){
    try{await updateLiveViewerCount(roomId,-1)}catch(error){console.warn("Beyond Live viewer leave could not be recorded:",error)}
    window.beyondLiveViewerJoined=false;
  }
  document.getElementById("livePanel")?.classList.remove("open");const o=document.getElementById("liveOverlay");if(o)o.style.display="none";stopLiveSimulation();if(beyondLiveChannel&&window.beyondDB){window.beyondDB.removeChannel(beyondLiveChannel);beyondLiveChannel=null}
}
function startLiveSimulation(){stopLiveSimulation()}
function stopLiveSimulation(){if(liveTimer!==null){clearInterval(liveTimer);liveTimer=null}}
function subscribeBeyondLiveRoom(roomId){
  const db=window.beyondDB||initBeyondDatabase();if(!db||!roomId)return;
  if(beyondLiveChannel)db.removeChannel(beyondLiveChannel);
  beyondLiveChannel=db.channel("beyond-live-room-"+roomId)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"live_messages",filter:"room_id=eq."+roomId},payload=>{
      const row=payload.new||{};const box=document.getElementById("liveChat");if(!box)return;
      const item=document.createElement("div");item.className="live-msg";const name=document.createElement("b");name.textContent="@"+(row.user_id||"Guest").slice(0,8);const msg=document.createElement("span");msg.textContent=row.content||"";item.append(name,msg);box.appendChild(item);box.scrollTop=box.scrollHeight;
    })
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"live_reactions",filter:"room_id=eq."+roomId},payload=>{
      const emoji=payload.new?.reaction;if(emoji){const f=document.createElement("span");f.className="reaction-floater";f.textContent=emoji;document.getElementById("reactionFloaters")?.appendChild(f);setTimeout(()=>f.remove(),1800)}
    })
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"live_rooms",filter:"id=eq."+roomId},payload=>{
      const room=payload.new||{};const count=document.getElementById("liveViewers");if(count)count.textContent=String(room.viewer_count??0);
      const status=document.getElementById("liveStatus");if(status&&!room.active)status.textContent="Live ended by the creator.";
    })
    .subscribe();
}
async function sendReaction(emoji){const f=document.createElement("span");f.className="reaction-floater";f.textContent=emoji;document.getElementById("reactionFloaters")?.appendChild(f);setTimeout(()=>f.remove(),1800);const roomId=window.beyondLiveRoomId;if(roomId&&typeof sendDatabaseReaction==="function"){try{const result=await sendDatabaseReaction(roomId,emoji);if(result?.error)throw result.error}catch(error){console.warn("Beyond Live reaction database unavailable:",error)}}}
async function sendLiveMessage(){const input=document.getElementById("liveChatInput"),text=input?.value.trim();if(!text)return;const roomId=window.beyondLiveRoomId;if(roomId&&typeof sendDatabaseLiveMessage==="function"){try{const result=await sendDatabaseLiveMessage(roomId,text);if(result?.error)throw result.error;input.value="";return}catch(error){console.warn("Beyond Live database chat unavailable:",error)}}const user=localStorage.getItem("beyondUsername")||"Guest";const row=document.createElement("div");row.className="live-msg";const name=document.createElement("b");name.textContent="@"+user;const message=document.createElement("span");message.textContent=text;row.append(name,message);document.getElementById("liveChat")?.appendChild(row);input.value="";const box=document.getElementById("liveChat");if(box)box.scrollTop=box.scrollHeight}
function followLiveCreator(btn){btn.textContent=btn.textContent.includes("Follow")?"✓ Following":" + Follow"}
function toggleLiveMic(btn){btn.textContent=btn.textContent.includes("On")?"🔇 Mic Off":"🎙 Mic On"}
function toggleLiveCamera(btn){btn.textContent=btn.textContent.includes("On")?"📵 Camera Off":"📹 Camera On"}
function muteLiveChat(btn){btn.textContent=btn.textContent.includes("On")?"🚫 Chat Off":"💬 Chat On";document.getElementById("liveChatInput").disabled=btn.textContent.includes("Off")}
function shareLive(){if(navigator.share)navigator.share({title:"Beyond Live",text:"Join my Beyond live room!"}).catch(()=>{});else alert("Live link copied!")}
async function endLive(){
  const roomId=window.beyondLiveRoomId;
  const status=document.getElementById("liveStatus");if(status)status.textContent="Live ended by the creator.";
  if(roomId&&typeof endDatabaseLive==="function"){
    try{await endDatabaseLive(roomId)}catch(error){console.warn("Beyond Live could not end the database room:",error)}
  }
  stopLiveSimulation();await closeLive();
  const cfg=(()=>{try{return JSON.parse(localStorage.getItem("beyondLiveConfig")||"{}")}catch{return {}}})();
  if(cfg.roomId===roomId){cfg.active=false;localStorage.setItem("beyondLiveConfig",JSON.stringify(cfg))}
}

async function loadDatabaseFeed(){
 const db=window.beyondDB||initBeyondDatabase();
 if(!db)return;
 const feed=document.getElementById("feed");
 if(!feed)return;
 const {data,error}=await db.from("videos").select("id,user_id,video_url,caption,likes_count,created_at,profiles(username,display_name,avatar_url)").order("created_at",{ascending:false}).limit(30);
 if(error){console.error("Beyond feed database error:",error);return;}
 const existing=new Set([...feed.querySelectorAll(".video-card")].map(x=>x.dataset.dbVideoId).filter(Boolean));
 (data||[]).reverse().forEach(v=>{
   if(existing.has(String(v.id)))return;
   const card=document.createElement("section");
   card.className="video-card";
   card.dataset.dbVideoId=String(v.id);
   card.dataset.postId="db-"+v.id;
   const creator=v.profiles?.username||"Beyond Creator";
   const caption=v.caption||"";
   card.innerHTML=`
    <div class="video-wrap">
      <video class="video" src="${escapeBeyondAttribute(v.video_url)}" loop playsinline preload="metadata"></video>
      <div class="video-gradient"></div>
      <div class="video-meta">
        <div class="creator-row"><div class="creator-avatar">${escapeBeyondText(creator.charAt(0).toUpperCase())}</div><div><strong>@${escapeBeyondText(creator)}</strong><p>${escapeBeyondText(caption)}</p></div></div>
      </div>
      <div class="video-actions">
        <button class="like-button" onclick="likeDatabaseVideo(this,${v.id})">❤️ <span>${Number(v.likes_count||0)}</span></button>
        <button onclick="commentVideo('db-'+${v.id})">💬 <span>Comment</span></button>
        <button onclick="shareVideo()">↗️ <span>Share</span></button>
        <button onclick="saveVideo(this)">🔖 <span>Save</span></button>
      </div>
    </div>`;
   feed.prepend(card);
 });
 activateVideoObserver();
}
function escapeBeyondText(v){const d=document.createElement("div");d.textContent=String(v??"");return d.innerHTML}
function escapeBeyondAttribute(v){return String(v??"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
async function likeDatabaseVideo(button,videoId){
 const db=window.beyondDB||initBeyondDatabase();
 if(!db)return;
 const {data:{user}}=await db.auth.getUser();
 if(!user){location.href="login.html";return}
 const {data:existing}=await db.from("likes").select("video_id").eq("user_id",user.id).eq("video_id",videoId).maybeSingle();
 const count=button.querySelector("span");
 if(existing){
   await db.from("likes").delete().eq("user_id",user.id).eq("video_id",videoId);
   const n=Math.max(0,Number(count.textContent||0)-1);count.textContent=n;
   await db.from("videos").update({likes_count:n}).eq("id",videoId);
   button.classList.remove("liked");
 }else{
   await db.from("likes").insert({user_id:user.id,video_id:videoId});
   const n=Number(count.textContent||0)+1;count.textContent=n;
   await db.from("videos").update({likes_count:n}).eq("id",videoId);
   button.classList.add("liked");
 }
}
document.addEventListener("DOMContentLoaded",()=>{setTimeout(loadDatabaseFeed,250)});

let beyondRealtimeChannel=null;
async function enableBeyondRealtime(){
 const db=window.beyondDB||initBeyondDatabase();
 if(!db||beyondRealtimeChannel)return;
 beyondRealtimeChannel=db.channel("beyond-live-feed")
 .on("postgres_changes",{event:"INSERT",schema:"public",table:"videos"},()=>{
   loadDatabaseFeed();
 })
 .on("postgres_changes",{event:"UPDATE",schema:"public",table:"videos"},payload=>{
   const card=document.querySelector('[data-db-video-id="'+payload.new.id+'"]');
   const like=card?.querySelector(".like-button span");
   if(like)like.textContent=payload.new.likes_count||0;
 })
 .subscribe((status)=>{
   if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){
     beyondRealtimeChannel=null;
   }
 })}
function showFeedLoading(){
 const feed=document.getElementById("feed"); if(!feed||document.getElementById("feedLoading"))return;
 const el=document.createElement("div");el.id="feedLoading";el.className="feed-loading";
 el.innerHTML="<div class='loading-spinner'></div><span>Loading Beyond...</span>";
 feed.prepend(el);
 setTimeout(()=>el.remove(),1500);
}
document.addEventListener("DOMContentLoaded",()=>{
 showFeedLoading();
 setTimeout(enableBeyondRealtime,700);
});
