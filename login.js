const form=document.getElementById("loginForm");
const message=document.getElementById("loginMessage");
const button=document.getElementById("loginButton");

function configured(){return typeof BEYOND_SUPABASE_URL==="string"&&typeof BEYOND_SUPABASE_ANON_KEY==="string"&&!BEYOND_SUPABASE_URL.startsWith("YOUR_")&&!BEYOND_SUPABASE_ANON_KEY.startsWith("YOUR_")}
function saveSession(user,username,remember){if(remember)localStorage.setItem("beyondLoggedIn","true");else sessionStorage.setItem("beyondLoggedIn","true");localStorage.setItem("beyondEmail",user?.email||"");localStorage.setItem("beyondUsername",username||user?.user_metadata?.username||user?.email?.split("@")[0]||"Beyond User")}
async function login(){
const email=document.getElementById("email").value.trim().toLowerCase(),password=document.getElementById("password").value,remember=document.getElementById("remember").checked;
message.textContent="";button.disabled=true;button.textContent="Logging in…";
try{
if(configured()){
const db=window.beyondDB||initBeyondDatabase();if(!db)throw new Error("Beyond database is unavailable.");
const {data,error}=await db.auth.signInWithPassword({email,password});if(error)throw error;
saveSession(data.user,data.user?.user_metadata?.username,remember);location.replace("index.html");return;
}
const users=JSON.parse(localStorage.getItem("beyondUsers")||"[]");
const user=users.find(u=>u.email===email&&u.password===password);
if(!user)throw new Error("Email or password is incorrect.");
saveSession({email:user.email},user.username,remember);location.replace("index.html");
}catch(error){console.error(error);message.textContent=error?.message||"Login failed. Please try again.";button.disabled=false;button.textContent="Log in"}}
form.addEventListener("submit",e=>{e.preventDefault();login()});