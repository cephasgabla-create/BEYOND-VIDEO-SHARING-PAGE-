(()=>{
const defaults={privateAccount:false,activityStatus:true,commentFilter:true,tagReview:true,recommendations:true,personalizedNotifications:true};
const ids=Object.keys(defaults);
async function loadBlocked(){const box=document.getElementById("blockedUsers");if(!box)return;try{const d=window.beyondDB||initBeyondDatabase();if(!d)throw new Error("Supabase is not configured.");const {data,error}=await d.rpc("get_beyond_blocked_users");if(error)throw error;if(!data?.length){box.innerHTML="<p>No blocked users.</p>";return}box.innerHTML="";data.forEach(u=>{const row=document.createElement("div");row.className="blocked-row";const name=document.createElement("span");name.textContent="@"+(u.username||u.display_name||"user");const b=document.createElement("button");b.textContent="Unblock";b.onclick=async()=>{try{const {error}=await d.rpc("set_beyond_block_user",{target_user_id:u.blocked_id,should_block:false});if(error)throw error;loadBlocked()}catch(e){setMessage(e.message||"Could not unblock user.")}};row.append(name,b);box.append(row)})}catch(e){console.error(e);box.innerHTML="<p>Could not load blocked users.</p>"}}
let state={...defaults};
const message=document.getElementById("message");
function render(){ids.forEach(id=>{const el=document.getElementById(id);if(el)el.checked=!!state[id]})}
function setMessage(t){if(message)message.textContent=t}
async function db(){const d=window.beyondDB||initBeyondDatabase();if(!d)throw new Error("Supabase is not configured.");const u=await getCurrentBeyondUser();if(!u)throw new Error("Please sign in first.");return d}
async function load(){try{const d=await db();const {data,error}=await d.rpc("get_beyond_privacy_settings");if(error)throw error;if(data)state={...defaults,...data};render();setMessage("Privacy settings loaded from Supabase.")}catch(e){console.error(e);render();setMessage("Could not load privacy settings. Run the latest Supabase SQL migration.")}}
async function save(){try{const d=await db();const {data,error}=await d.rpc("update_beyond_privacy_settings",{p_private_account:state.privateAccount,p_activity_status:state.activityStatus,p_comment_filter:state.commentFilter,p_tag_review:state.tagReview,p_recommendations:state.recommendations,p_personalized_notifications:state.personalizedNotifications});if(error)throw error;if(data)state={...defaults,...data};render();setMessage("Privacy preference saved to your Beyond account.")}catch(e){console.error(e);setMessage(e.message||"Could not save privacy preference.")}}
ids.forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener("change",()=>{state[id]=el.checked;save()})});
const clear=document.getElementById("clearPrefs");if(clear)clear.onclick=()=>{state={...defaults};render();save()};
load();loadBlocked();
})();