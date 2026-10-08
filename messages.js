let currentUser=null,currentOtherId=null,profiles=new Map(),messagesChannel=null,chatPresenceChannel=null,typingTimer=null;
const $=id=>document.getElementById(id);
function esc(v){const d=document.createElement("div");d.textContent=v??"";return d.innerHTML}
function avatar(p){return p?.avatar_url||"data:image/svg+xml;charset=UTF-8,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='100%' height='100%' fill='#ddd'/><text x='50%' y='55%' text-anchor='middle' font-size='30' fill='#777'>B</text></svg>")}
function profileName(p){return p?.display_name||p?.username||"Beyond user"}
function setStatus(s){$("messageStatus").textContent=s||""}
function setChatPresence(online){
  const el=$("chatPresence");
  if(el)el.textContent=online?"● Online":"○ Offline";
}
function setTyping(text){
  const el=$("chatTyping");
  if(el)el.textContent=text||"";
}
async function closeChatPresence(){
  if(chatPresenceChannel){
    await leaveBeyondChatPresence(chatPresenceChannel);
    chatPresenceChannel=null;
  }
  setChatPresence(false);setTyping("");
}
async function openChatPresence(){
  await closeChatPresence();
  if(!currentOtherId||!currentUser)return;
  chatPresenceChannel=subscribeBeyondChatPresence(currentUser.id,currentOtherId,{
    onPresence:state=>setChatPresence(Object.keys(state||{}).some(k=>k!==currentUser.id)),
    onTyping:data=>{
      if(data.userId===currentOtherId&&data.typing){
        setTyping("Typing…");
        clearTimeout(typingTimer);
        typingTimer=setTimeout(()=>setTyping(""),1800);
      }else if(data.userId===currentOtherId){setTyping("")}
    }
  });
}
function sendTyping(typing){
  if(!chatPresenceChannel||!currentUser)return;
  chatPresenceChannel.send({type:"broadcast",event:"typing",payload:{userId:currentUser.id,typing:Boolean(typing)}}).catch(()=>{});
}

async function loadProfileForUser(id){
  if(!id||profiles.has(id))return profiles.get(id)||null;
  const db=initBeyondDatabase();
  const {data,error}=await db.from("profiles").select("id,username,display_name,avatar_url").eq("id",id).maybeSingle();
  if(error)throw error;
  if(data)profiles.set(id,data);
  return data||null;
}
async function loadConversations(){
  try{
    const rows=await getBeyondConversations(),list=$("conversationList");
    if(!rows.length){list.innerHTML="<div class='empty-state'>No conversations yet.</div>";return}
    rows.forEach(x=>profiles.set(x.user_id,x.profile));
    list.innerHTML=rows.map(x=>"<button class='conversation "+(x.user_id===currentOtherId?"active":"")+"' data-user='"+x.user_id+"'><img class='avatar' src='"+avatar(x.profile)+"'><span class='conversation-main'><span class='conversation-name'>"+esc(profileName(x.profile))+"</span><span class='conversation-preview'>"+esc(x.last_message?.content||"")+"</span></span>"+(x.unread_count?"<span class='unread'>"+x.unread_count+"</span>":"")+"</button>").join("");
    list.querySelectorAll("[data-user]").forEach(b=>b.onclick=()=>openConversation(b.dataset.user));
  }catch(e){$("conversationList").innerHTML="<div class='empty-state'>Could not load messages. Check your Supabase configuration.</div>";setStatus(e.message)}
}
async function openConversation(id){
  if(!id||id===currentUser.id)return;
  currentOtherId=id;
  const p=await loadProfileForUser(id);
  $("chatHeader").innerHTML="<div><strong>"+esc(profileName(p))+"</strong><span id="chatPresence">○ Offline</span><span id="chatTyping"></span></div>";
  await openChatPresence();
  $("messageInput").disabled=false;$("sendBtn").disabled=false;setStatus("");
  await renderConversation();await markBeyondConversationRead(id);await loadConversations();
}
async function renderConversation(){
  try{
    const rows=await getBeyondConversation(currentOtherId),box=$("messageList");
    box.innerHTML=rows.length?rows.map(m=>"<div class='bubble "+(m.sender_id===currentUser.id?"mine":"")+"'>"+esc(m.content)+"<time>"+new Date(m.created_at).toLocaleString()+"</time></div>").join(""):"<div class='empty-state'>Start the conversation.</div>";
    box.scrollTop=box.scrollHeight;
  }catch(e){setStatus(e.message)}
}
$("messageForm").addEventListener("submit",async e=>{
  e.preventDefault();const input=$("messageInput"),content=input.value.trim();
  if(!content||!currentOtherId)return;
  input.disabled=true;sendTyping(false);setStatus("Sending…");
  try{await sendBeyondMessage(currentOtherId,content);input.value="";await renderConversation();await loadConversations();setStatus("")}
  catch(err){setStatus(err.message)}
  finally{input.disabled=false;input.focus()}
});
$("refreshBtn").onclick=loadConversations;
$("messageInput").addEventListener("input",()=>{
  sendTyping(true);
  clearTimeout(typingTimer);
  typingTimer=setTimeout(()=>sendTyping(false),1200);
});
window.addEventListener("beforeunload",()=>{if(chatPresenceChannel)chatPresenceChannel.unsubscribe()});

(async function init(){
  try{
    currentUser=await getCurrentBeyondUser();
    if(!currentUser){location.href="login.html?redirect="+encodeURIComponent("messages.html"+location.search);return}
    await loadConversations();
    const requested=new URLSearchParams(location.search).get("user");
    if(requested&&requested!==currentUser.id)await openConversation(requested);
    messagesChannel=subscribeBeyondMessages(currentUser.id,async m=>{
      await loadConversations();
      if(currentOtherId&&(m.sender_id===currentOtherId||m.receiver_id===currentOtherId)){
        await renderConversation();
        if(m.sender_id===currentOtherId)await markBeyondConversationRead(currentOtherId);
      }
    });
  }catch(e){setStatus(e.message);$("conversationList").innerHTML="<div class='empty-state'>Please configure Supabase and sign in.</div>"}
})();