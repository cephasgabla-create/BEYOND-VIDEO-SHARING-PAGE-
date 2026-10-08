const form=document.getElementById("signupForm");
const message=document.getElementById("signupMessage");
const button=document.getElementById("signupButton");

function configured(){return typeof beyondDatabaseConfigured==="function"&&beyondDatabaseConfigured()}

function saveSession(user,profile,remember=true){
  localStorage.setItem("beyondLoggedIn","true");
  sessionStorage.removeItem("beyondLoggedIn");
  localStorage.setItem("beyondEmail",user?.email||"");
  localStorage.setItem("beyondUsername",profile?.username||user?.user_metadata?.username||"Beyond User");
}

form.addEventListener("submit",async e=>{
  e.preventDefault();
  message.textContent="";
  const username=document.getElementById("username").value.trim().replace(/^@/,"");
  const email=document.getElementById("email").value.trim().toLowerCase();
  const password=document.getElementById("password").value;
  const confirm=document.getElementById("confirmPassword").value;
  if(username.length<3){message.textContent="Username must be at least 3 characters.";return}
  if(!/^[a-zA-Z0-9._-]+$/.test(username)){message.textContent="Use only letters, numbers, dots, underscores or hyphens.";return}
  if(password.length<6){message.textContent="Password must be at least 6 characters.";return}
  if(password!==confirm){message.textContent="Passwords do not match.";return}
  button.disabled=true;button.textContent="Creating account…";
  try{
    if(!configured()) throw new Error("Beyond Supabase is not configured yet. Add your Supabase URL and anon key in supabase.js.");
    const db=window.beyondDB||initBeyondDatabase();
    if(!db)throw new Error("Beyond database is unavailable.");

    const {data:existing,error:existingError}=await db.from("profiles").select("id").ilike("username",username).maybeSingle();
    if(existingError)throw existingError;
    if(existing)throw new Error("That username is already taken.");

    const {data,error}=await db.auth.signUp({
      email,password,
      options:{data:{username,display_name:username}}
    });
    if(error)throw error;
    if(!data.user)throw new Error("Supabase did not create the account.");

    let profile=null;

    if(!data.session){
      message.textContent="Account created. Check your email to confirm it, then log in.";
      button.disabled=false;button.textContent="Create account";
      return;
    }

    const {data:ensuredProfile,error:ensureError}=await db.rpc("ensure_beyond_profile");
    if(ensureError)throw ensureError;
    profile=ensuredProfile;
    saveSession(data.user,profile,true);
    location.replace("index.html");
  }catch(error){
    console.error(error);
    message.textContent=error?.message||"Could not create your account.";
    button.disabled=false;button.textContent="Create account";
  }
});