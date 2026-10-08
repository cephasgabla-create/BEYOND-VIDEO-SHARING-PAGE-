const KEY="beyondCreatorBranding";
let dbClient=null;
const defaults={displayName:"Beyond Creator",username:"BeyondCreator",bio:"Welcome to my Beyond profile 🚀",avatarUrl:"",bannerUrl:"",accent:"#ff2d55"};
const $=id=>document.getElementById(id);

function getClient(){
  try{return typeof initBeyondDatabase==="function"?initBeyondDatabase():(window.beyondDB||null)}
  catch(error){console.warn("Beyond database unavailable:",error);return null}
}

async function load(){
  let data={...defaults};
  try{data={...data,...JSON.parse(localStorage.getItem(KEY)||"{}")}catch{}
  dbClient=getClient();
  try{
    if(dbClient){
      const {data:u}=await dbClient.auth.getUser();
      if(u?.user){
        const {data:p}=await dbClient.from("profiles").select("username,display_name,bio,avatar_url,banner_url,accent_color").eq("id",u.user.id).maybeSingle();
        if(p){
          data={...data,username:p.username||data.username,displayName:p.display_name||data.displayName,bio:p.bio??data.bio,avatarUrl:p.avatar_url||data.avatarUrl,bannerUrl:p.banner_url||data.bannerUrl,accent:p.accent_color||data.accent};
          localStorage.setItem(KEY,JSON.stringify(data));
        }
      }
    }
  }catch(error){console.warn("Beyond branding sync unavailable:",error)}
  $("displayName").value=data.displayName;
  $("username").value=data.username;
  $("bio").value=data.bio;
  $("avatarUrl").value=data.avatarUrl;
  $("bannerUrl").value=data.bannerUrl;
  $("accent").value=data.accent;
  updatePreview();
  $("bioCount").textContent=data.bio.length+"/80";
}

function updatePreview(){
  const name=$("displayName").value.trim()||defaults.displayName;
  const username=$("username").value.trim()||defaults.username;
  const bio=$("bio").value;
  const avatar=$("avatarUrl").value.trim();
  const banner=$("bannerUrl").value.trim();
  const accent=$("accent").value||defaults.accent;
  $("previewName").textContent=name;
  $("previewHandle").textContent="@"+username;
  $("previewBio").textContent=bio||"Welcome to my Beyond profile 🚀";
  document.documentElement.style.setProperty("--brand-accent",accent);
  const avatarEl=$("previewAvatar");
  avatarEl.style.backgroundImage=avatar?"url(\"" + avatar.replace(/"/g,"%22") + "\")":"";
  avatarEl.textContent=avatar?"":(name[0]||"B").toUpperCase();
  $("previewBanner").style.backgroundImage=banner?"url(\"" + banner.replace(/"/g,"%22") + "\")":"";
}

["displayName","username","bio","avatarUrl","bannerUrl","accent"].forEach(id=>{
  $(id).addEventListener("input",()=>{
    if(id==="bio")$("bioCount").textContent=$("bio").value.length+"/80";
    updatePreview();
  });
});

$("brandingForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const data={
    displayName:$("displayName").value.trim(),
    username:$("username").value.trim().replace(/^@/,""),
    bio:$("bio").value.trim(),
    avatarUrl:$("avatarUrl").value.trim(),
    bannerUrl:$("bannerUrl").value.trim(),
    accent:$("accent").value
  };
  if(!data.displayName||!data.username){
    $("status").textContent="Display name and username are required.";
    return;
  }
  localStorage.setItem(KEY,JSON.stringify(data));
  localStorage.setItem("beyondUsername",data.username);
  localStorage.setItem("beyondBio",data.bio);
  localStorage.setItem("beyondProfileDisplayName",data.displayName);
  localStorage.setItem("beyondProfileAvatar",data.avatarUrl);
  localStorage.setItem("beyondProfileBanner",data.bannerUrl);
  localStorage.setItem("beyondProfileAccent",data.accent);
  $("status").textContent="Branding saved locally.";
  try{
    dbClient=getClient();
    const {data:u}=dbClient?await dbClient.auth.getUser():{data:{user:null}};
    if(u?.user){
      const {error}=await dbClient.from("profiles").upsert({id:u.user.id,username:data.username,display_name:data.displayName,bio:data.bio,avatar_url:data.avatarUrl||null,banner_url:data.bannerUrl||null,accent_color:data.accent},{onConflict:"id"});
      if(error)throw error;
      $("status").textContent="Branding saved to Beyond and Supabase.";
    }
  }catch(error){console.warn("Beyond Supabase branding save failed:",error)}
});

$("reset").addEventListener("click",()=>{
  localStorage.removeItem(KEY);
  load();
  $("status").textContent="Branding reset to the default.";
});

$("clearBanner").addEventListener("click",()=>{
  $("bannerUrl").value="";
  updatePreview();
});

load();