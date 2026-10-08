const usernameEl=document.getElementById("username");
const avatarEl=document.getElementById("avatar");
const bioEl=document.getElementById("bio");
const followingEl=document.getElementById("following");
const followersEl=document.getElementById("followers");
const likesEl=document.getElementById("likes");
let beyondProfile=null;

async function requireProfileAuth(){
  const db=initBeyondDatabase();
  if(!db){location.href="login.html";return null}
  const user=await getCurrentBeyondUser();
  if(!user){location.href="login.html";return null}
  return {db,user};
}
function applyProfileBranding(profile){
  const avatarUrl=profile?.avatar_url||"";
  const bannerUrl=profile?.banner_url||"";
  const accent=profile?.accent_color||"#ff2d55";
  document.documentElement.style.setProperty("--brand-accent",accent);
  const info=document.querySelector(".profile-info");
  if(info)info.style.setProperty("--profile-banner",bannerUrl?'url("'+bannerUrl.replace(/"/g,"%22")+'")':"none");
  const name=profile?.username||"B";
  avatarEl.textContent=avatarUrl?"":name.charAt(0).toUpperCase();
  avatarEl.style.backgroundImage=avatarUrl?'url("'+avatarUrl.replace(/"/g,"%22")+'")':"";
  avatarEl.style.backgroundSize="cover";
  avatarEl.style.backgroundPosition="center";
}
async function loadProfile(){
  const auth=await requireProfileAuth();
  if(!auth)return;
  try{
    const {data:profile,error}=await auth.db.from("profiles").select("id,username,display_name,bio,avatar_url,banner_url,accent_color").eq("id",auth.user.id).single();
    if(error)throw error;
    beyondProfile=profile;
    const name=profile.username||profile.display_name||auth.user.email?.split("@")[0]||"Beyond User";
    usernameEl.textContent="@"+name;const verification=document.getElementById("emailVerification");if(verification)verification.textContent=auth.user.email_confirmed_at?"Email verified":"Email not verified";
    bioEl.textContent=profile.bio||"Welcome to my Beyond profile 🚀";
    applyProfileBranding(profile);
    await Promise.all([loadFollowStats(auth.db,auth.user.id),loadLikeCount(auth.db,auth.user.id),loadVideos(auth.db,auth.user.id)]);
    toggleOwnFollowInfo();
  }catch(error){console.error("Beyond profile load failed:",error);bioEl.textContent="Could not load your profile. Please try again."}
}
async function loadLikeCount(db,userId){
  const {data:videos,error:videoError}=await db.from("videos").select("id").eq("user_id",userId);
  if(videoError)throw videoError;
  const ids=(videos||[]).map(v=>v.id);
  if(!ids.length){likesEl.textContent="0";return}
  const {count,error}=await db.from("likes").select("video_id",{count:"exact",head:true}).in("video_id",ids);
  if(error)throw error;
  likesEl.textContent=String(count||0);
}
async function loadFollowStats(db,userId){
  const stats=await getBeyondFollowStatsByUserId(userId);
  followingEl.textContent=String(stats.following);
  followersEl.textContent=String(stats.followers);
}
async function loadVideos(db,userId){
  const {data,error}=await db.from("videos").select("id,video_url,caption,created_at").eq("user_id",userId).eq("status","published").order("created_at",{ascending:false});
  if(error)throw error;
  renderProfileVideos(data||[]);
}
function renderProfileVideos(posts){
  const container=document.getElementById("profileVideos");if(!container)return;
  container.innerHTML="";
  if(!posts.length){container.innerHTML="<p id='noVideos'>You haven't posted any videos yet.</p>";return}
  posts.forEach(p=>{const item=document.createElement("div");item.className="video-item";const v=document.createElement("video");v.muted=true;v.loop=true;v.playsInline=true;v.controls=true;v.src=p.video_url||"";const o=document.createElement("div");o.className="video-overlay";o.textContent=p.caption||"";item.append(v,o);container.appendChild(item)})
}
async function editProfile(){
  const auth=await requireProfileAuth();if(!auth)return;
  const value=prompt("Enter your new bio:",beyondProfile?.bio||"");if(value===null)return;
  if(value.length>80){alert("Your bio must be 80 characters or less.");return}
  try{
    beyondProfile=await updateBeyondOwnProfile({username:beyondProfile.username,display_name:beyondProfile.display_name||beyondProfile.username,bio:value,avatar_url:beyondProfile.avatar_url,banner_url:beyondProfile.banner_url,accent_color:beyondProfile.accent_color});
    bioEl.textContent=beyondProfile.bio||"";
  }catch(error){console.error(error);alert("Could not save your profile to Supabase.")}
}
function toggleOwnFollowInfo(){const summary=document.getElementById("followSummary");if(summary)summary.textContent=followingEl.textContent+" following • "+followersEl.textContent+" followers"}
function openNotifications(){location.href="notifications.html"}
function openMessages(){location.href="messages.html"}
function goHome(){location.href="index.html"}
function openUpload(){location.href="upload.html"}
function openSearch(){location.href="search.html"}
async function showLikedVideos(){
  const auth=await requireProfileAuth();if(!auth)return;
  const {data:likes,error}=await auth.db.from("likes").select("video_id").eq("user_id",auth.user.id);
  if(error){alert("Could not load liked videos.");return}
  const ids=(likes||[]).map(x=>x.video_id);const container=document.getElementById("profileVideos");if(!container)return;
  if(!ids.length){container.innerHTML="<p id='noVideos'>You haven't liked any videos yet.</p>";return}
  const {data:videos,error:videoError}=await auth.db.from("videos").select("id,video_url,caption,created_at").in("id",ids).order("created_at",{ascending:false});
  if(videoError){alert("Could not load liked videos.");return}
  renderProfileVideos(videos||[]);
}
async function logout(){if(typeof beyondLogout==="function"){await beyondLogout();return}location.href="login.html"}
loadProfile();