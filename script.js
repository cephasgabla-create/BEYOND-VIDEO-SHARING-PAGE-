let currentPostId=null;

document.addEventListener("DOMContentLoaded",()=>{loadBeyondVideos();activateVideoObserver();updateAllFollowButtons()});

function openDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open("BeyondDatabase",3);request.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains("videos"))db.createObjectStore("videos",{keyPath:"id",autoIncrement:true});if(!db.objectStoreNames.contains("comments"))db.createObjectStore("comments",{keyPath:"id",autoIncrement:true});if(!db.objectStoreNames.contains("likes"))db.createObjectStore("likes",{keyPath:"key"});if(!db.objectStoreNames.contains("notifications"))db.createObjectStore("notifications",{keyPath:"id",autoIncrement:true})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}

async function loadBeyondVideos(){try{const db=await openDatabase();const req=db.transaction("videos","readonly").objectStore("videos").getAll();req.onsuccess=()=>{req.result.reverse().forEach(createVideoCard);activateVideoObserver();updateAllFollowButtons()}}catch(e){console.error(e)}}

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

async function shareVideo(){if(navigator.share){try{await navigator.share({title:"Beyond",text:"Check out this video on Beyond!"})}catch{}}else alert("Sharing is not supported by this browser yet.")}

function openLogin(){location.href="login.html"}function openUpload(){location.href="upload.html"}function openProfile(){location.href="profile.html"}function openSearch(){location.href="search.html"}
function getFollowing(){try{return JSON.parse(localStorage.getItem("beyondFollowing")||"[]")}catch{return[]}}
function saveFollowing(list){localStorage.setItem("beyondFollowing",JSON.stringify(list))}
function toggleFollow(username,button){const currentUser=localStorage.getItem("beyondUsername");if(!currentUser){alert("Please create a Beyond account before following creators.");location.href="login.html";return}if(currentUser===username){alert("You cannot follow yourself.");return}let following=getFollowing();const index=following.indexOf(username);if(index===-1)following.push(username);else following.splice(index,1);saveFollowing(following);updateFollowButton(username,button);if(index===-1){openDatabase().then(db=>{const tx=db.transaction("notifications","readwrite");tx.objectStore("notifications").add({username,type:"follow",actor:currentUser,text:"@"+currentUser+" followed you",createdAt:new Date().toISOString(),read:false})})}}
function updateFollowButton(username,button){const following=getFollowing(),isFollowing=following.includes(username);button.textContent=isFollowing?"Following":"Follow";button.classList.toggle("following",isFollowing)}
function updateAllFollowButtons(){document.querySelectorAll(".follow-button").forEach(button=>{const row=button.closest(".creator-row");if(row)updateFollowButton(row.querySelector("h3").textContent.replace("@",""),button)})}
function showFollowing(){const following=getFollowing();document.querySelectorAll(".video-card").forEach(card=>card.style.display=following.includes(card.dataset.creator)?"flex":"none");if(!following.length)alert("You are not following anyone yet. Follow a creator first!")}
function showFeed(){document.querySelectorAll(".video-card").forEach(card=>card.style.display="flex");document.getElementById("feed").scrollTo({top:0,behavior:"smooth"})}

function commentVideo(postId){currentPostId=postId;document.getElementById("commentsPanel").style.display="flex";document.getElementById("commentsOverlay").style.display="block";loadComments(postId)}
function closeComments(){document.getElementById("commentsPanel").style.display="none";document.getElementById("commentsOverlay").style.display="none";currentPostId=null}
async function addComment(){const input=document.getElementById("commentInput"),text=input.value.trim();if(!text||currentPostId===null)return;const username=localStorage.getItem("beyondUsername");if(!username){alert("Please log in to comment.");location.href="login.html";return}const db=await openDatabase(),tx=db.transaction("comments","readwrite");tx.objectStore("comments").add({postId:currentPostId,username,text,createdAt:new Date().toISOString()});tx.oncomplete=async()=>{input.value="";loadComments(currentPostId);const db2=await openDatabase();const vr=db2.transaction("videos","readonly").objectStore("videos").get(currentPostId);vr.onsuccess=()=>{const video=vr.result;if(video&&video.username!==username){const nt=db2.transaction("notifications","readwrite");nt.objectStore("notifications").add({username:video.username,type:"comment",actor:username,postId:currentPostId,text:"@"+username+" commented on your video",createdAt:new Date().toISOString(),read:false});}};const card=document.querySelector('[data-post-id="'+currentPostId+'"]');if(card){const b=card.querySelector(".comment-button");loadCommentCount(currentPostId,b)}}}
async function loadComments(postId){const list=document.getElementById("commentsList");list.innerHTML="<p style='color:#777'>Loading...</p>";const db=await openDatabase(),req=db.transaction("comments","readonly").objectStore("comments").getAll();req.onsuccess=()=>{const comments=req.result.filter(c=>c.postId===postId).reverse();list.innerHTML="";if(!comments.length){list.innerHTML="<p style='color:#777;text-align:center;padding:30px'>No comments yet. Be the first!</p>";return}comments.forEach(createComment)}}
function createComment(comment){const item=document.createElement("div");item.className="comment";const avatar=document.createElement("div");avatar.className="comment-avatar";avatar.textContent=comment.username.charAt(0).toUpperCase();const content=document.createElement("div");content.className="comment-content";const username=document.createElement("div");username.className="comment-username";username.textContent="@"+comment.username;const text=document.createElement("div");text.className="comment-text";text.textContent=comment.text;content.append(username,text);item.append(avatar,content);document.getElementById("commentsList").appendChild(item)}
function activateVideoObserver(){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{const video=entry.target;if(entry.isIntersecting)video.play().catch(()=>{});else video.pause()}),{threshold:.7});document.querySelectorAll(".video").forEach(v=>observer.observe(v))}