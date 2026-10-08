const form=document.getElementById("loginForm");
const message=document.getElementById("loginMessage");
const button=document.getElementById("loginButton");

function configured(){return typeof beyondDatabaseConfigured==="function"&&beyondDatabaseConfigured()}

function saveSession(user,profile,remember){
  if(remember){
    localStorage.setItem("beyondLoggedIn","true");
    sessionStorage.removeItem("beyondLoggedIn");
  }else{
    sessionStorage.setItem("beyondLoggedIn","true");
    localStorage.removeItem("beyondLoggedIn");
  }
  const username=profile?.username||user?.user_metadata?.username||user?.email?.split("@")[0]||"Beyond User";
  localStorage.setItem("beyondEmail",user?.email||"");
  localStorage.setItem("beyondUsername",username);
}

async function login(){
  const email=document.getElementById("email").value.trim().toLowerCase();
  const password=document.getElementById("password").value;
  const remember=document.getElementById("remember").checked;
  message.textContent="";button.disabled=true;button.textContent="Logging in…";
  try{
    if(!configured()) throw new Error("Beyond Supabase is not configured yet. Add your Supabase URL and anon key in supabase.js.");
    const db=window.beyondDB||initBeyondDatabase();
    if(!db) throw new Error("Beyond database is unavailable.");
    const {data,error}=await db.auth.signInWithPassword({email,password});
    if(error)throw error;
    const {data:profile,error:profileError}=await db.from("profiles")
      .select("id,username,display_name,bio,avatar_url,banner_url,accent_color")
      .eq("id",data.user.id).maybeSingle();
    if(profileError) console.warn("Profile load:",profileError.message);
    saveSession(data.user,profile,remember);
    location.replace("index.html");
  }catch(error){
    console.error(error);
    message.textContent=error?.message||"Login failed. Please try again.";
    button.disabled=false;button.textContent="Log in";
  }
}
form.addEventListener("submit",e=>{e.preventDefault();login()});