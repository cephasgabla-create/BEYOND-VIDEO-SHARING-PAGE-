(() => {
const key="beyondConnectedApps";
const saved=JSON.parse(localStorage.getItem(key)||"{}");
const remember=document.getElementById("rememberToggle");
const confirmOut=document.getElementById("confirmToggle");
remember.checked=saved.remember!==false;
confirmOut.checked=saved.confirmOut!==false;
function save(){localStorage.setItem(key,JSON.stringify({remember:remember.checked,confirmOut:confirmOut.checked}));}
remember.onchange=save;confirmOut.onchange=save;
const ua=navigator.userAgent;
document.getElementById("browserName").textContent=/Edg\//.test(ua)?"Microsoft Edge":/Chrome\//.test(ua)?"Google Chrome":/Firefox\//.test(ua)?"Mozilla Firefox":/Safari\//.test(ua)?"Safari":"Browser";
document.getElementById("deviceName").textContent=/Mobi|Android|iPhone|iPad/i.test(ua)?"Mobile device":"Desktop device";
document.getElementById("services").innerHTML='<div class="service"><strong>Beyond account</strong><p>Authentication session used by this site.</p><span id="accountStatus">Checking…</span></div>';
async function getUser(){
try{
if(typeof getCurrentBeyondUser==="function") return await getCurrentBeyondUser();
if(window.supabaseClient&&window.supabaseClient.auth){const r=await window.supabaseClient.auth.getUser();return r.data&&r.data.user?r.data.user:null;}
}catch(e){console.warn(e);}
return null;
}
getUser().then(user=>{
document.getElementById("sessionInfo").innerHTML=user?"<strong>Signed in</strong><p>"+(user.email||"Beyond account")+"</p>":"<strong>No active Beyond session</strong><p>Sign in to manage your account.</p>";
document.getElementById("accountStatus").textContent=user?"Connected":"Not connected";
document.getElementById("accountStatus").className=user?"ok":"";
});
document.getElementById("clearLocalBtn").onclick=()=>{localStorage.removeItem(key);document.getElementById("actionMessage").textContent="Local preferences cleared.";};
document.getElementById("signOutBtn").onclick=async()=>{
if(confirmOut.checked&&!window.confirm("Sign out of this browser?"))return;
try{
if(typeof initBeyondDatabase==="function")await initBeyondDatabase();
if(window.supabaseClient&&window.supabaseClient.auth)await window.supabaseClient.auth.signOut();
localStorage.removeItem("beyondLoggedIn");
document.getElementById("actionMessage").textContent="Signed out. Opening Login…";
setTimeout(()=>{window.location.href="login.html";},500);
}catch(e){console.error(e);document.getElementById("actionMessage").textContent="Sign out could not be completed. Please try again.";}
};
})();