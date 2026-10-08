const form=document.getElementById("loginForm");
const message=document.getElementById("loginMessage");
const button=document.getElementById("loginButton");
const password=document.getElementById("password");

function configured(){return typeof beyondDatabaseConfigured==="function"&&beyondDatabaseConfigured()}
function getRedirect(){const value=new URLSearchParams(location.search).get("redirect")||"index.html";if(!/^[A-Za-z0-9._/?=&%-]+$/.test(value)||value.startsWith("//")||value.includes("://"))return "index.html";return value}
function friendlyError(error){const m=String(error?.message||"Login failed. Please try again.");if(/invalid login credentials/i.test(m))return "Incorrect email or password.";if(/email not confirmed/i.test(m))return "Please confirm your email before logging in.";return m}
async function login(){
  const email=document.getElementById("email").value.trim().toLowerCase();const pass=password.value;const remember=document.getElementById("remember").checked;
  message.textContent="";button.disabled=true;button.textContent="Logging in…";
  try{
    if(!email||!pass){throw new Error("Enter your email and password.")}
    if(!configured())throw new Error("Beyond Supabase is not configured yet. Add your Supabase URL and anon key in supabase.js.");
    const db=window.beyondDB||initBeyondDatabase();if(!db)throw new Error("Beyond database is unavailable.");
    const {data,error}=await db.auth.signInWithPassword({email,password:pass});if(error)throw error;
    const {data:profile,error:profileError}=await db.rpc("ensure_beyond_profile");if(profileError)throw profileError;
    const username=profile?.username||data.user?.user_metadata?.username||email.split("@")[0]||"Beyond User";
    ["beyondLoggedIn","beyondEmail","beyondUsername"].forEach(k=>localStorage.removeItem(k));sessionStorage.removeItem("beyondLoggedIn");
    if(!remember){try{sessionStorage.setItem("beyondSessionPreference","session-only")}catch{}}else{try{sessionStorage.removeItem("beyondSessionPreference")}catch{}}
    location.replace(getRedirect());
  }catch(error){console.error(error);message.textContent=friendlyError(error);button.disabled=false;button.textContent="Log in"}
}
form.addEventListener("submit",e=>{e.preventDefault();login()});
document.getElementById("showPassword")?.addEventListener("change",e=>{password.type=e.target.checked?"text":"password"});
document.getElementById("forgotPassword")?.addEventListener("click",async e=>{e.preventDefault();const email=document.getElementById("email").value.trim().toLowerCase();if(!email){message.textContent="Enter your email first, then choose Forgot password.";return}try{if(!configured())throw new Error("Beyond Supabase is not configured yet.");const db=window.beyondDB||initBeyondDatabase();const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:new URL("reset-password.html",location.href).href});if(error)throw error;message.textContent="Password reset email sent. Check your inbox."}catch(error){message.textContent=error?.message||"Could not send the reset email."}});