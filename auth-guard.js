/* Beyond authentication guard. Supabase Auth is the only source of truth. */
(function(){
  const PUBLIC_PAGES=new Set(["index.html","login.html","signup.html","reset-password.html","404.html"]);
  const page=(location.pathname.split("/").pop()||"index.html").toLowerCase();
  const isPublic=PUBLIC_PAGES.has(page);
  let authReadyResolve;
  const authReady=new Promise(resolve=>{authReadyResolve=resolve;});
  let initialSessionSeen=false;
  const profileSyncInFlight = new Map();
  const profileSyncedUsers = new Set();

  // OAuth can return a valid Supabase session without creating a public.profiles row.
  // Keep profile creation in the shared auth guard so Google, email, and phone sign-ins
  // all get the same repair attempt. A profile error must never sign the user out.
  async function ensureProfileForSession(session){
    const userId=session?.user?.id;
    if(!userId || profileSyncedUsers.has(userId)) return;
    if(profileSyncInFlight.has(userId)) return profileSyncInFlight.get(userId);
    const db=window.beyondDB||initBeyondDatabase();
    if(!db) return;
    const task=(async()=>{
      try{
        const {error}=await db.rpc("ensure_beyond_profile");
        if(error){
          // Keep Google sign-in usable even if the optional profile RPC has not
          // been installed yet. The profiles RLS policy permits users to create
          // only their own row (id must equal auth.uid()).
          console.warn("Beyond profile RPC unavailable; trying direct profile creation:",error.message);
          const user=session.user;
          const metadata=user.user_metadata||{};
          const emailName=(user.email||"beyond_user").split("@")[0];
          const base=String(metadata.username||emailName||"beyond_user")
            .toLowerCase().replace(/[^a-z0-9._-]/g,"").slice(0,21)||"beyond_user";
          const suffix=String(userId).replace(/-/g,"").slice(0,8);
          const username=(base+"_"+suffix).slice(0,30);
          const displayName=String(metadata.full_name||metadata.name||metadata.display_name||base).trim().slice(0,80)||username;
          const {error:insertError}=await db.from("profiles").upsert(
            {id:userId,username,display_name:displayName},
            {onConflict:"id",ignoreDuplicates:true}
          );
          if(insertError){
            console.warn("Beyond direct profile creation failed. Check profiles table grants and RLS policies:",insertError.message);
            return false;
          }
        }
        profileSyncedUsers.add(userId);
        window.beyondProfileReadyUserId=userId;
        return true;
      }catch(error){
        console.warn("Beyond profile sync failed:",error?.message||error);
        return false;
      }finally{
        profileSyncInFlight.delete(userId);
      }
    })();
    profileSyncInFlight.set(userId,task);
    return task;
  }

  function clearLegacyAuth(){["beyondLoggedIn","beyondEmail","beyondUsername"].forEach(k=>localStorage.removeItem(k));sessionStorage.removeItem("beyondLoggedIn")}
  function loginUrl(){const target=location.pathname.split("/").pop()||"index.html";const q=location.search||"";return "login.html?redirect="+encodeURIComponent(target+q)}
  window.beyondLogout=async function(){
    try{const db=window.beyondDB||initBeyondDatabase();if(db)await db.auth.signOut()}catch(e){console.warn("Beyond sign out:",e)}
    clearLegacyAuth();
    if(page!=="login.html")location.replace("login.html");
  };
  window.beyondRequireAuth=async function(){
    const db=window.beyondDB||initBeyondDatabase();
    if(!db){if(!isPublic)location.replace(loginUrl());return null}
    // Wait for Supabase to finish restoring the saved session from this browser.
    if(!initialSessionSeen) await Promise.race([authReady,new Promise(resolve=>setTimeout(resolve,3000))]);
    const {data,error}=await db.auth.getSession();
    if(error||!data.session){clearLegacyAuth();if(!isPublic)location.replace(loginUrl());return null}
    window.beyondAuthSession=data.session;
    window.beyondAuthUser=data.session.user;
    return data.session.user;
  };
  function start(){
    const db=window.beyondDB||initBeyondDatabase();
    if(!db){authReadyResolve();if(!isPublic)location.replace(loginUrl());return}
    db.auth.onAuthStateChange((event,session)=>{
      if(event==="INITIAL_SESSION"&&!initialSessionSeen){initialSessionSeen=true;authReadyResolve();}
      if(session){
        window.beyondAuthSession=session;
        window.beyondAuthUser=session.user;
        // Run after the auth callback returns to avoid blocking Supabase's auth event lock.
        Promise.resolve().then(()=>ensureProfileForSession(session));
        return;
      }
      if(event==="SIGNED_OUT"){
        clearLegacyAuth();
        if(!isPublic)location.replace(loginUrl());
      }
    });
    if(!isPublic)window.beyondRequireAuth();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();