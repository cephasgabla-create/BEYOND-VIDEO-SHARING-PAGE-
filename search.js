const input=document.getElementById("searchInput");
const results=document.getElementById("results");
const status=document.getElementById("searchStatus");

input?.addEventListener("keydown",e=>{if(e.key==="Enter")performSearch()});

function db(){return window.beyondDB||initBeyondDatabase()}

async function performSearch(){
 const q=input?.value.trim()||"";
 if(!q){status.textContent="Type something to search.";results.innerHTML="";return}
 status.textContent="Searching Beyond…";results.innerHTML="";
 const client=db();
 if(!client){status.textContent="Supabase is not configured yet.";return}
 try{
  const term=q.replace(/[,%()]/g," ").trim();
  const blocked=await getBeyondBlockedUserIds();
  const [{data:profiles,error:pe},{data:videos,error:ve}]=await Promise.all([
   client.from("profiles").select("id,username,display_name,avatar_url,bio").or("username.ilike.%"+term+"%,display_name.ilike.%"+term+"%").limit(50),
   client.from("videos").select("id,user_id,video_url,caption,hashtags,created_at,profiles(username,display_name,avatar_url)").eq("status","published").or("caption.ilike.%"+term+"%,hashtags.ilike.%"+term+"%").order("created_at",{ascending:false}).limit(100)
  ]);
  if(pe)throw pe;if(ve)throw ve;
  renderResults((profiles||[]).filter(p=>!blocked.has(p.id)),(videos||[]).filter(v=>!blocked.has(v.user_id)),q);
 }catch(error){console.error(error);status.textContent="Search is temporarily unavailable."}
}

function renderResults(profiles,videos,q){
 results.innerHTML="";
 const heading=document.createElement("h3");heading.textContent="Creators";results.appendChild(heading);
 if(!profiles.length){const p=document.createElement("p");p.textContent="No creators found.";results.appendChild(p)}
 profiles.forEach(profile=>{
  const card=document.createElement("article");card.className="result-card";
  const name=document.createElement("h3");name.textContent="@"+(profile.username||"Beyond creator");
  const bio=document.createElement("p");bio.textContent=profile.bio||profile.display_name||"";
  const actions=document.createElement("div");actions.className="creator-actions";
  const follow=document.createElement("button");follow.textContent="Follow";follow.className="follow-button";
  follow.onclick=async()=>{try{const user=await getCurrentBeyondUser();if(!user){location.href="login.html";return}const following=await getBeyondFollowState(profile.id);await setBeyondFollow(profile.id,!following);await updateSearchFollowButton(follow,profile.id)}catch(e){alert(e.message||"Could not update follow.")}};
  const block=document.createElement("button");block.className="block-button";
  const refreshBlockButton=async()=>{try{block.textContent=await isBeyondUserBlocked(profile.id)?"Unblock":"Block"}catch{block.textContent="Block"}};
  block.onclick=async()=>{try{const blocked=await isBeyondUserBlocked(profile.id);if(blocked){await setBeyondUserBlocked(profile.id,false)}else if(confirm("Block this account? Their content and interactions with you will be hidden.")){await setBeyondUserBlocked(profile.id,true)}await performSearch()}catch(e){alert(e.message||"Could not update block setting.")}};
  updateSearchFollowButton(follow,profile.id);refreshBlockButton();
  actions.append(follow,block);card.append(name,bio,actions);results.appendChild(card);
 });
 const vh=document.createElement("h3");vh.textContent="Videos";results.appendChild(vh);
 if(!videos.length){const p=document.createElement("p");p.textContent="No videos found.";results.appendChild(p)}
 videos.forEach(video=>{
  const card=document.createElement("article");card.className="result-card";
  const media=document.createElement("video");media.className="result-video";media.src=video.video_url;media.controls=true;media.playsInline=true;media.muted=true;
  const info=document.createElement("div");info.className="result-info";
  const creator=video.profiles?.username||"Beyond creator";
  const name=document.createElement("h3");name.textContent="@"+creator;
  const caption=document.createElement("p");caption.textContent=video.caption||"";
  const tags=document.createElement("p");tags.className="hashtags";tags.textContent=video.hashtags||"";
  info.append(name,caption,tags);card.append(media,info);results.appendChild(card);
 });
 status.textContent=(profiles.length+videos.length)+" result"+((profiles.length+videos.length)===1?"":"s")+" found";
}

async function updateSearchFollowButton(button,targetId){
 try{
  const user=await getCurrentBeyondUser();
  if(!user){button.textContent="Follow";return}
  button.textContent=await getBeyondFollowState(targetId)?"Following":"Follow";
 }catch{button.textContent="Follow"}
}

function goHome(){location.href="index.html"}
function openUpload(){location.href="upload.html"}
function openProfile(){location.href="profile.html"}
