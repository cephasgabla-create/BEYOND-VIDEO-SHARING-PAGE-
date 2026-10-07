const input=document.getElementById("videoInput");
const preview=document.getElementById("preview");
let file=null;

if(localStorage.getItem("beyondLoggedIn")!=="true"){
  alert("Please log in to upload a video.");
  location.href="login.html";
}

input.onchange=function(){
  file=input.files[0];
  if(file) preview.src=URL.createObjectURL(file);
};

function db(){
  return new Promise((ok,no)=>{
    const r=indexedDB.open("BeyondDatabase",2);
    r.onupgradeneeded=e=>{
      const d=e.target.result;
      if(!d.objectStoreNames.contains("videos")) d.createObjectStore("videos",{keyPath:"id",autoIncrement:true});
      if(!d.objectStoreNames.contains("comments")) d.createObjectStore("comments",{keyPath:"id",autoIncrement:true});
    };
    r.onsuccess=()=>ok(r.result);
    r.onerror=()=>no(r.error);
  });
}

async function publishVideo(){
  if(localStorage.getItem("beyondLoggedIn")!=="true"){
    location.href="login.html";
    return;
  }
  if(!file){
    alert("Choose a video first");
    return;
  }

  const username=localStorage.getItem("beyondUsername");
  if(!username){
    alert("Your Beyond account could not be found. Please log in again.");
    location.href="login.html";
    return;
  }

  const caption=document.getElementById("caption").value.trim();
  const hashtags=document.getElementById("hashtags").value.trim();
  const d=await db();
  const t=d.transaction("videos","readwrite");

  t.objectStore("videos").add({
    username,
    caption,
    hashtags,
    video:file,
    createdAt:new Date().toISOString()
  });

  t.oncomplete=()=>location.href="index.html";
  t.onerror=()=>alert("Could not publish the video. Please try again.");
}
function openGoLive(){document.getElementById("goLiveModal")?.classList.add("show")}
function closeGoLive(){document.getElementById("goLiveModal")?.classList.remove("show")}
function startConfiguredLive(){const title=document.getElementById("liveTitleInput").value.trim()||"Beyond Live";const category=document.getElementById("liveCategory").value;const chat=document.getElementById("liveChatEnabled").checked;localStorage.setItem("beyondLiveConfig",JSON.stringify({title,category,chat,startedAt:new Date().toISOString(),active:true}));closeGoLive();window.location.href="index.html?live=1"}

async function uploadVideoToSupabase(file,caption=""){
 const db=window.beyondDB||initBeyondDatabase();
 if(!db)throw new Error("Configure Supabase in supabase.js first.");
 const {data:{user}}=await db.auth.getUser();
 if(!user)throw new Error("Please log in before uploading.");
 if(!file.type.startsWith("video/"))throw new Error("Please choose a video file.");
 const ext=(file.name.split(".").pop()||"mp4").toLowerCase();
 const path=user.id+"/"+crypto.randomUUID()+"."+ext;
 const {error:storageError}=await db.storage.from("videos").upload(path,file,{contentType:file.type,upsert:false});
 if(storageError)throw storageError;
 const {data:publicData}=db.storage.from("videos").getPublicUrl(path);
 const videoUrl=publicData.publicUrl;
 const {data:row,error:dbError}=await db.from("videos").insert({user_id:user.id,video_url:videoUrl,caption}).select().single();
 if(dbError){await db.storage.from("videos").remove([path]);throw dbError;}
 return row;
}

async function uploadBeyondVideoWithDatabase(file,caption=""){
 const result=await uploadVideoToSupabase(file,caption);
 localStorage.setItem("beyondLastUploadedVideo",JSON.stringify(result));
 return result;
}
