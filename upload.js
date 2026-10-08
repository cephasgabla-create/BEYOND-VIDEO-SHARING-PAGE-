const input=document.getElementById("videoInput");
const preview=document.getElementById("preview");
let file=null;

async function requireBeyondUploadUser(){
  try{
    const client=window.beyondDB||initBeyondDatabase();
    if(client){
      const user=await getCurrentBeyondUser();
      if(user)return user;
    }
  }catch(error){
    console.warn("Supabase auth check unavailable:",error);
  }
  if(localStorage.getItem("beyondLoggedIn")==="true")return null;
  alert("Please log in to upload a video.");
  location.href="login.html";
  return null;
}

requireBeyondUploadUser();

input.onchange=function(){
  file=input.files[0];
  if(file) preview.src=URL.createObjectURL(file);
};

function db(){
  return new Promise((ok,no)=>{
    const r=indexedDB.open("BeyondDatabase",4);
    r.onupgradeneeded=e=>{
      const d=e.target.result;
      if(!d.objectStoreNames.contains("videos")) d.createObjectStore("videos",{keyPath:"id",autoIncrement:true});
      if(!d.objectStoreNames.contains("comments")) d.createObjectStore("comments",{keyPath:"id",autoIncrement:true});
      if(!d.objectStoreNames.contains("likes")) d.createObjectStore("likes",{keyPath:"key"});
    };
    r.onsuccess=()=>ok(r.result);
    r.onerror=()=>no(r.error);
  });
}

async function publishVideo(){
  const authUser=await requireBeyondUploadUser();
  if(!authUser && localStorage.getItem("beyondLoggedIn")!=="true")return;
  if(!file){alert("Choose a video first");return;}

  const caption=document.getElementById("caption").value.trim();
  const hashtags=document.getElementById("hashtags").value.trim();

  // Use the real Supabase upload whenever the project is configured
  // and the user has a Supabase Auth session.
  try{
    const supabaseDB=window.beyondDB||initBeyondDatabase();
    if(supabaseDB){
      const {data:{user}}=await supabaseDB.auth.getUser();
      if(user){
        const result=await uploadVideoToSupabase(file,caption,hashtags);
        localStorage.setItem("beyondLastUploadedVideo",JSON.stringify(result));
        alert("Video published to Beyond.");
        location.href="index.html";
        return;
      }
    }
  }catch(error){
    console.error("Supabase upload failed:",error);
    alert("Supabase upload failed: "+error.message);
    return;
  }

  // Local fallback keeps the project usable before Supabase Auth is configured.
  const username=localStorage.getItem("beyondUsername");
  if(!username){
    alert("Your Beyond account could not be found. Please log in again.");
    location.href="login.html"; return;
  }
  try{
    const d=await db();
    const t=d.transaction("videos","readwrite");
    t.objectStore("videos").add({
      username,caption,hashtags,video:file,status:"published",
      createdAt:new Date().toISOString()
    });
    t.oncomplete=()=>location.href="index.html";
    t.onerror=()=>alert("Could not publish the video. Please try again.");
  }catch(error){alert("Could not publish the video: "+error.message)}
}

async function uploadVideoToSupabase(file,caption="",hashtags=""){
  const dbClient=window.beyondDB||initBeyondDatabase();
  if(!dbClient)throw new Error("Configure Supabase in supabase.js first.");
  const {data:{user}}=await dbClient.auth.getUser();
  if(!user)throw new Error("Please log in with Beyond Supabase Auth before uploading.");
  if(!file.type.startsWith("video/"))throw new Error("Please choose a video file.");

  const ext=(file.name.split(".").pop()||"mp4").toLowerCase();
  const path=user.id+"/"+crypto.randomUUID()+"."+ext;

  const {error:storageError}=await dbClient.storage.from("videos").upload(path,file,{
    contentType:file.type,upsert:false
  });
  if(storageError)throw storageError;

  const {data:publicData}=dbClient.storage.from("videos").getPublicUrl(path);
  const videoUrl=publicData.publicUrl;

  const {data:row,error:dbError}=await dbClient.from("videos").insert({
    user_id:user.id,
    video_url:videoUrl,
    caption,
    hashtags,
    status:"published",
    views_count:0,
    likes_count:0
  }).select().single();

  if(dbError){
    await dbClient.storage.from("videos").remove([path]);
    throw dbError;
  }
  return row;
}

async function uploadBeyondVideoWithDatabase(file,caption="",hashtags=""){
  const result=await uploadVideoToSupabase(file,caption,hashtags);
  localStorage.setItem("beyondLastUploadedVideo",JSON.stringify(result));
  return result;
}

function openGoLive(){document.getElementById("goLiveModal")?.classList.add("show")}
function closeGoLive(){document.getElementById("goLiveModal")?.classList.remove("show")}
async function startConfiguredLive(){
  const title=document.getElementById("liveTitleInput").value.trim()||"Beyond Live";
  const category=document.getElementById("liveCategory").value;
  const chat=document.getElementById("liveChatEnabled").checked;
  try{
    const client=window.beyondDB||initBeyondDatabase();
    const user=client?await getCurrentBeyondUser():null;
    if(client&&user){
      const room=await createLiveRoom(title,category);
      localStorage.setItem("beyondLiveConfig",JSON.stringify({title,category,chat,startedAt:new Date().toISOString(),active:true,roomId:room.id}));
    }else{
      localStorage.setItem("beyondLiveConfig",JSON.stringify({title,category,chat,startedAt:new Date().toISOString(),active:true}));
    }
  }catch(error){
    console.error("Beyond Live room creation failed:",error);
    alert("Could not create the live room: "+error.message);
    return;
  }
  closeGoLive();
  window.location.href="index.html?live=1";
}