let currentPostId=null;

document.addEventListener("DOMContentLoaded",()=>{loadBeyondVideos();loadSocialPosts();activateVideoObserver();updateAllFollowButtons();const u=localStorage.getItem("beyondUsername");if(u)document.getElementById("composerAvatar").textContent=u.charAt(0).toUpperCase();if(localStorage.getItem("beyondTheme")==="light")document.body.classList.add("light-theme")});

function openDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open("BeyondDatabase",4);request.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains("videos"))db.createObjectStore("videos",{keyPath:"id",autoIncrement:true});if(!db.objectStoreNames.contains("comments"))db.createObjectStore("comments",{keyPath:"id",autoIncrement:true});if(!db.objectStoreNames.contains("likes"))db.createObjectStore("likes",{keyPath:"key"});if(!db.objectStoreNames.contains("notifications"))db.createObjectStore("notifications",{keyPath:"id",autoIncrement:true});if(!db.objectStoreNames.contains("socialPosts"))db.createObjectStore("socialPosts",{keyPath:"id",autoIncrement:true})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}

let beyondActiveFeed="for-you";
let beyondForYouChannel=null;
let beyondFeedRefreshTimer=null;

async function loadBeyondVideos(){
  return loadForYouFeed();
}

function normalizeRecommendedVideo(row){
  return {
    id:row.id,
    user_id:row.user_id,
    video_url:row.video_url,
    caption:row.caption||"",
    hashtags:row.hashtags||"",
    status:"published",
    views_count:Number(row.views_count||0),
    likes_count:Number(row.likes_count||0),
    created_at:row.created_at,
    profiles:{
      username:row.username||"BeyondCreator",
      display_name:row.display_name||"",
      avatar_url:row.avatar_url||null
    },
    recommendation_score:Number(row.recommendation_score||0)
  };
}

async function loadForYouFeed(){
  const feed=document.getElementById("feed");
  if(!feed)return;
  beyondActiveFeed="for-you";
  const staticCards=Array.from(feed.querySelectorAll(".video-card"));
  const loading=document.getElementById("feedLoading");
  const db=typeof initBeyondDatabase==="function"?initBeyondDatabase():null;
  if(!db){
    staticCards.forEach(card=>card.style.display="flex");
    if(loading)loading.remove();
    return;
  }
  try{
    let rows=null;
    const rpc=await db.rpc("get_beyond_for_you_feed",{p_limit:50});
    if(!rpc.error)rows=(rpc.data||[]).map(normalizeRecommendedVideo);
    else rows=await buildClientForYouFeed(db,50);

    staticCards.forEach(card=>card.remove());
    feed.querySelectorAll(".feed-empty").forEach(x=>x.remove());
    (rows||[]).forEach(video=>createRemoteVideoCard(video));
    activateVideoObserver();
    await updateAllFollowButtons();
    if(!(rows||[]).length){
      const empty=document.createElement("div");
      empty.className="feed-empty";
      empty.textContent="No published videos yet. Upload the first Beyond video.";
      feed.appendChild(empty);
    }
    if(loading)loading.remove();
    enableBeyondRecommendationRealtime();
  }catch(error){
    console.warn("Beyond For You feed unavailable:",error);
    if(loading)loading.remove();
  }
}

async function buildClientForYouFeed(db,limit){
  const user=await getCurrentBeyondUser();
  const [{data:videos,error:ve},{data:follows,error:fe}]=await Promise.all([
    db.from("videos").select("id,user_id,video_url,caption,hashtags,status,views_count,likes_count,created_at,profiles(username,display_name,avatar_url)").eq("status","published").order("created_at",{ascending:false}).limit(100),
    user?db.from("follows").select("following_id").eq("follower_id",user.id):Promise.resolve({data:[],error:null})
  ]);
  if(ve)throw ve;if(fe)throw fe;
  const followed=new Set((follows||[]).map(x=>x.following_id));
  const ids=(videos||[]).map(v=>v.id);
  const [{data:comments},{data:likes}]=await Promise.all([
    ids.length?db.from("comments").select("video_id,user_id"):Promise.resolve({data:[]}),
    ids.length?db.from("likes").select("video_id,user_id"):Promise.resolve({data:[]})
  ]);
  const tagInterest=new Map();
  const interacted=new Set();
  (likes||[]).filter(x=>user&&x.user_id===user.id).forEach(x=>interacted.add(x.video_id));
  (comments||[]).filter(x=>user&&x.user_id===user.id).forEach(x=>interacted.add(x.video_id));
  (videos||[]).filter(v=>interacted.has(v.id)).forEach(v=>{
    String(v.hashtags||"").toLowerCase().split(/\s+/).filter(Boolean).forEach(tag=>tagInterest.set(tag,(tagInterest.get(tag)||0)+1));
  });
  const commentCounts=new Map();
  (comments||[]).forEach(x=>commentCounts.set(x.video_id,(commentCounts.get(x.video_id)||0)+1));
  const likeCounts=new Map();
  (likes||[]).forEach(x=>likeCounts.set(x.video_id,(likeCounts.get(x.video_id)||0)+1));
  const creatorActivity=new Map();
  const week=Date.now()-7*86400000;
  (videos||[]).forEach(v=>{if(new Date(v.created_at).getTime()>=week)creatorActivity.set(v.user_id,(creatorActivity.get(v.user_id)||0)+1)});
  return (videos||[]).map(v=>{
    const age=Math.max(0,(Date.now()-new Date(v.created_at).getTime())/86400000);
    const tags=String(v.hashtags||"").toLowerCase().split(/\s+/).filter(Boolean);
    const tagScore=Math.min(30,tags.reduce((sum,t)=>sum+(tagInterest.get(t)||0),0)*8);
    const score=(followed.has(v.user_id)?55:0)+tagScore+
      Math.min(25,Math.log1p(Number(v.views_count||0))*3)+
      Math.min(24,Math.log1p(likeCounts.get(v.id)||Number(v.likes_count||0))*5)+
      Math.min(24,Math.log1p(commentCounts.get(v.id)||0)*6)+
      Math.min(18,(creatorActivity.get(v.user_id)||0)*4)+
      Math.max(0,28-age*2)+(Math.random()*3);
    return {...v,recommendation_score:score};
  }).sort((a,b)=>b.recommendation_score-a.recommendation_score).slice(0,limit);
}

function enableBeyondRecommendationRealtime(){
  const db=window.beyondDB||initBeyondDatabase();
  if(!db||beyondForYouChannel)return;
  beyondForYouChannel=db.channel("beyond-for-you-feed")
    .on("postgres_changes",{event:"*",schema:"public",table:"videos"},scheduleForYouRefresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"likes"},scheduleForYouRefresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"comments"},scheduleForYouRefresh)
    .on("postgres_changes",{event:"*",schema:"public",table:"follows"},scheduleForYouRefresh)
    .subscribe(status=>{
      if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"){beyondForYouChannel=null}
    });
}

function scheduleForYouRefresh(){
  if(beyondActiveFeed!=="for-you")return;
  clearTimeout(beyondFeedRefreshTimer);
  beyondFeedRefreshTimer=setTimeout(()=>loadForYouFeed(),900);
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

async function likeVideo(button,videoId){
 const db=initBeyondDatabase();const user=await getCurrentBeyondUser();
 if(!db||!user){location.href="login.html";return}
 try{
  const {data:existing,error}=await db.from("likes").select("video_id").eq("user_id",user.id).eq("video_id",videoId).maybeSingle();
  if(error)throw error;
  if(existing)await db.from("likes").delete().eq("user_id",user.id).eq("video_id",videoId);
  else await db.from("likes").insert({user_id:user.id,video_id:videoId});
  await loadLikeState(videoId,button);
 }catch(error){console.error(error);alert("Could not update the like.")}
}
async function loadLikeState(videoId,button){
 const db=initBeyondDatabase();if(!db||!button)return;
 try{
  const user=await getCurrentBeyondUser();
  const {data,count,error}=await db.from("likes").select("user_id",{count:"exact"}).eq("video_id",videoId);
  if(error)throw error;
  button.querySelector("span").textContent=String(count||0);
  const liked=!!user&&(data||[]).some(x=>x.user_id===user.id);
  button.classList.toggle("liked",liked);button.style.color=liked?"#ff2d55":"white";
 }catch(error){console.warn("Like state failed",error)}
}
async function loadCommentCount(videoId,button){
 const db=initBeyondDatabase();if(!db||!button)return;
 const {count,error}=await db.from("comments").select("id",{count:"exact",head:true}).eq("video_id",videoId);
 if(!error)button.querySelector("span").textContent=String(count||0);
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
async function getFollowing(){
 const db=initBeyondDatabase();const user=await getCurrentBeyondUser();
 if(!db||!user)return [];
 const {data:follows,error}=await db.from("follows").select("following_id").eq("follower_id",user.id);
 if(error){console.warn("Following load failed",error);return []}
 const ids=(follows||[]).map(x=>x.following_id);
 if(!ids.length)return [];
 const {data:profiles,error:profileError}=await db.from("profiles").select("id,username").in("id",ids);
 if(profileError){console.warn("Following profiles load failed",profileError);return []}
 return (profiles||[]).map(x=>x.username).filter(Boolean);
}
async function toggleFollow(username,button){
 const db=initBeyondDatabase();const user=await getCurrentBeyondUser();
 if(!db||!user){location.href="login.html";return}
 if(button)button.disabled=true;
 try{
  const target=await getBeyondProfileByUsername(username);
  if(!target)throw new Error("Creator profile not found.");
  const following=await getBeyondFollowState(target.id);
  await setBeyondFollow(target.id,!following);
  await updateAllFollowButtons();
 }catch(error){console.error(error);alert(error.message||"Could not update following.")}
 finally{if(button)button.disabled=false}
}
async function updateFollowButton(username,button){
 if(!button)return;
 const db=initBeyondDatabase();const user=await getCurrentBeyondUser();
 if(!db||!user){button.textContent="Follow";return}
 try{
  const target=await getBeyondProfileByUsername(username);
  const following=target?await getBeyondFollowState(target.id):false;
  button.textContent=following?"Following":"Follow";
  button.classList.toggle("following",following);
 }catch(error){button.textContent="Follow"}
}
async function updateAllFollowButtons(){
 const buttons=[...document.querySelectorAll(".follow-button")];
 await Promise.all(buttons.map(b=>{const row=b.closest(".creator-row");return row?updateFollowButton(row.querySelector("h3")?.textContent.replace(/^@/,""),b):null}));
}
async function showFollowing(){
 const db=initBeyondDatabase();const user=await getCurrentBeyondUser();
 if(!db||!user){location.href="login.html";return}
 beyondActiveFeed="following";
 const {data:follows,error:followError}=await db.from("follows").select("following_id").eq("follower_id",user.id);
 if(followError){alert("Could not load your Following feed.");return}
 const ids=(follows||[]).map(x=>x.following_id);
 document.querySelectorAll(".video-card").forEach(card=>card.remove());
 if(!ids.length){
   const feed=document.getElementById("feed");if(feed){const empty=document.createElement("div");empty.className="feed-empty";empty.textContent="You are not following anyone yet. Follow a creator to build your Following feed.";feed.appendChild(empty)}
   return;
 }
 const {data:videos,error}=await db.from("videos").select("id,user_id,video_url,caption,hashtags,status,views_count,likes_count,created_at,profiles(username,display_name,avatar_url)").eq("status","published").in("user_id",ids).order("created_at",{ascending:false});
 if(error){alert("Could not load your Following feed.");return}
 (videos||[]).forEach(createRemoteVideoCard);
 activateVideoObserver();
 await updateAllFollowButtons();
}
async function showFeed(){
 await loadForYouFeed();
 document.getElementById("feed")?.scrollTo({top:0,behavior:"smooth"});
}

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
 const input=document.getElementById("commentInput");const text=input?.value.trim();
 if(!text||currentPostId===null)return;
 const db=initBeyondDatabase();const user=await getCurrentBeyondUser();
 if(!db||!user){location.href="login.html";return}
 if(typeof currentPostId!=="number"){alert("Comments are unavailable for this video.");return}
 try{
  const {error}=await db.from("comments").insert({video_id:currentPostId,user_id:user.id,content:text});
  if(error)throw error;
  input.value="";await loadComments(currentPostId);
  const card=document.querySelector('[data-post-id="'+currentPostId+'"]');
  const button=card?.querySelector(".comment-button");
  if(button)await loadRemoteCommentCount(currentPostId,button);
 }catch(error){console.error(error);alert("Could not post your comment.")}
}
async function loadComments(postId){
 const list=document.getElementById("commentsList");if(!list)return;
 list.innerHTML="<p style='color:#777'>Loading...</p>";
 const db=initBeyondDatabase();const user=await getCurrentBeyondUser();
 if(!db||!user){location.href="login.html";return}
 if(typeof postId!=="number"){list.innerHTML="<p style='color:#777;text-align:center;padding:30px'>Comments are unavailable for this video.</p>";return}
 try{
  const {data,error}=await db.from("comments").select("id,user_id,content,created_at,profiles(username,display_name,avatar_url)").eq("video_id",postId).order("created_at",{ascending:true});
  if(error)throw error;
  list.innerHTML="";
  if(!data?.length){list.innerHTML="<p style='color:#777;text-align:center;padding:30px'>No comments yet. Be the first!</p>";return}
  data.forEach(createRemoteComment);
 }catch(error){console.error(error);list.innerHTML="<p style='color:#777;text-align:center;padding:30px'>Could not load comments.</p>"}
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
let beyondDiscoverChannel=null;
let beyondDiscoverTimer=null;
let beyondDiscoverCategory="all";

async function openDiscover(){
 const p=document.getElementById("discoverPanel");if(p)p.classList.add("open");
 await loadBeyondDiscover();
}

function closeDiscover(){const p=document.getElementById("discoverPanel");if(p)p.classList.remove("open")}

async function loadBeyondDiscover(){
 const grid=document.getElementById("discoverGrid");
 if(!grid)return;
 const db=typeof initBeyondDatabase==="function"?initBeyondDatabase():null;
 if(!db){renderDiscoverFallback(grid);return}
 grid.innerHTML="<p>Loading Beyond trends…</p>";
 try{
  const {data,error}=await db.rpc("get_beyond_discover",{p_limit:30});
  if(error)throw error;
  const payload=data||{};
  const videos=Array.isArray(payload.videos)?payload.videos:[];
  const hashtags=Array.isArray(payload.hashtags)?payload.hashtags:[];
  const creators=Array.isArray(payload.creators)?payload.creators:[];
  renderDiscover(grid,videos,hashtags,creators);
  enableDiscoverRealtime();
 }catch(error){
  console.error("Discover load failed:",error);
  grid.innerHTML="<p>Could not load Discover right now.</p>";
 }
}

function countBy(rows,key){
 const out={};rows.forEach(row=>{const value=row[key];if(value!==undefined&&value!==null)out[value]=(out[value]||0)+1});return out;
}

function renderDiscover(grid,videos,hashtags,creators){
 const q=(document.getElementById("discoverInput")?.value||"").trim().toLowerCase();
 const filtered=videos.filter(v=>{
   if(beyondDiscoverCategory!=="all"){
     const hay=(String(v.hashtags||"")+" "+String(v.caption||"")).toLowerCase();
     if(!hay.includes(beyondDiscoverCategory.toLowerCase()))return false;
   }
   if(!q)return true;
   return (String(v.caption||"")+" "+String(v.hashtags||"")+" "+String(v.username||"")).toLowerCase().includes(q);
 });
 grid.innerHTML="";
 const tagSection=document.createElement("div");tagSection.className="trend-card";
 tagSection.innerHTML="<span>🔥</span><h3>Trending Hashtags</h3>";
 hashtags.slice(0,12).forEach(t=>{
   const b=document.createElement("button");
   b.textContent="#"+t.tag+" • "+Number(t.videos||0)+" videos";
   b.onclick=()=>{const i=document.getElementById("discoverInput");if(i)i.value="#"+t.tag;filterDiscover()};
   tagSection.appendChild(b);
 });
 if(!hashtags.length){const p=document.createElement("p");p.textContent="No trending hashtags yet.";tagSection.appendChild(p)}
 grid.appendChild(tagSection);
 const creatorSection=document.createElement("div");creatorSection.className="trend-card";
 creatorSection.innerHTML="<span>👑</span><h3>Active Creators</h3>";
 creators.slice(0,8).forEach(c=>{
   const p=document.createElement("p");
   p.textContent="@"+(c.username||"Beyond creator")+" • "+Number(c.followers||0)+" followers • "+Number(c.videos||0)+" videos";
   creatorSection.appendChild(p);
 });
 if(!creators.length){const p=document.createElement("p");p.textContent="No active creators yet.";creatorSection.appendChild(p)}
 grid.appendChild(creatorSection);
 const videoSection=document.createElement("div");videoSection.className="trend-card discover-videos";
 videoSection.innerHTML="<span>▶</span><h3>Trending Videos</h3>";
 if(!filtered.length){const p=document.createElement("p");p.textContent="No matching trending videos.";videoSection.appendChild(p)}
 filtered.slice(0,20).forEach(v=>{
   const row=document.createElement("div");row.className="discover-video-row";
   const title=document.createElement("strong");title.textContent="@"+(v.username||"BeyondCreator");
   const meta=document.createElement("span");meta.textContent=" "+Number(v.views_count||0)+" views • "+Number(v.likes_count||0)+" likes • "+Number(v.comments_count||0)+" comments";
   const cap=document.createElement("p");cap.textContent=v.caption||v.hashtags||"Beyond video";
   row.append(title,meta,cap);videoSection.appendChild(row);
 });
 grid.appendChild(videoSection);
}

function filterDiscover(){
 const grid=document.getElementById("discoverGrid");
 if(!grid)return;
 clearTimeout(beyondDiscoverTimer);
 beyondDiscoverTimer=setTimeout(()=>loadBeyondDiscover(),250);
}

function renderDiscoverFallback(grid){
 grid.innerHTML="<article class='trend-card'><span>01</span><h3>Discover</h3><p>Connect Supabase to see live Beyond trends, creators and hashtags.</p></article>";
}

function enableDiscoverRealtime(){
 const db=window.beyondDB||initBeyondDatabase();
 if(!db||beyondDiscoverChannel)return;
 beyondDiscoverChannel=db.channel("beyond-discover")
   .on("postgres_changes",{event:"*",schema:"public",table:"videos"},scheduleDiscoverRefresh)
   .on("postgres_changes",{event:"*",schema:"public",table:"likes"},scheduleDiscoverRefresh)
   .on("postgres_changes",{event:"*",schema:"public",table:"comments"},scheduleDiscoverRefresh)
   .on("postgres_changes",{event:"*",schema:"public",table:"follows"},scheduleDiscoverRefresh)
   .subscribe(status=>{if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")beyondDiscoverChannel=null});
}
function scheduleDiscoverRefresh(){
 clearTimeout(beyondDiscoverTimer);
 beyondDiscoverTimer=setTimeout(()=>{if(document.getElementById("discoverPanel")?.classList.contains("open"))loadBeyondDiscover()},1200);
}

document.addEventListener("DOMContentLoaded",()=>{
 document.querySelectorAll(".category-row button").forEach(button=>{
   button.addEventListener("click",()=>{
     document.querySelectorAll(".category-row button").forEach(b=>b.classList.remove("active"));
     button.classList.add("active");
     const label=button.textContent.replace(/^\S+\s*/,"").trim().toLowerCase();
     beyondDiscoverCategory=label==="trending"?"all":label;
     loadBeyondDiscover();
   });
 });
});

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
