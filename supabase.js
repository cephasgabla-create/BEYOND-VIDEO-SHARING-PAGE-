/* Beyond database client
   1. Create a Supabase project.
   2. Put your project URL and anon key below.
   3. Load this file before pages that use database features.
*/
const BEYOND_SUPABASE_URL = "YOUR_SUPABASE_URL";
const BEYOND_SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

let beyondDB = null;

function initBeyondDatabase(){
  if(!window.supabase || typeof window.supabase.createClient !== "function"){
    console.warn("Supabase library is not loaded yet.");
    return null;
  }
  if(!BEYOND_SUPABASE_URL || BEYOND_SUPABASE_URL.startsWith("YOUR_") || !BEYOND_SUPABASE_ANON_KEY || BEYOND_SUPABASE_ANON_KEY.startsWith("YOUR_")) {
    console.warn("Add your Supabase URL and anon key in supabase.js.");
    return null;
  }
  beyondDB = window.supabase.createClient(BEYOND_SUPABASE_URL, BEYOND_SUPABASE_ANON_KEY);
  window.beyondDB = beyondDB;
  return beyondDB;
}

async function getCurrentBeyondUser(){
  const db = beyondDB || initBeyondDatabase();
  if(!db) return null;
  const {data:{user}} = await db.auth.getUser();
  return user || null;
}

async function createLiveRoom(title, category){
  const db = beyondDB || initBeyondDatabase();
  const user = await getCurrentBeyondUser();
  if(!db || !user) throw new Error("Please sign in first.");
  const {data,error}=await db.from("live_rooms").insert({
    host_id:user.id,title,category,active:true,viewer_count:1
  }).select().single();
  if(error) throw error;
  return data;
}

async function sendDatabaseLiveMessage(roomId, content){
  const db = beyondDB || initBeyondDatabase();
  const user = await getCurrentBeyondUser();
  if(!db || !user) throw new Error("Please sign in first.");
  return db.from("live_messages").insert({room_id:roomId,user_id:user.id,content});
}

async function sendDatabaseReaction(roomId, reaction){
  const db = beyondDB || initBeyondDatabase();
  const user = await getCurrentBeyondUser();
  if(!db || !user) throw new Error("Please sign in first.");
  return db.from("live_reactions").insert({room_id:roomId,user_id:user.id,reaction});
}

async function endDatabaseLive(roomId){
  const db = beyondDB || initBeyondDatabase();
  if(!db) return;
  return db.from("live_rooms").update({active:false,ended_at:new Date().toISOString()}).eq("id",roomId);
}


async function getBeyondFollowStatsByUserId(userId){
  const db=beyondDB||initBeyondDatabase();
  if(!db||!userId)return {following:0,followers:0};
  const [followingResult,followersResult]=await Promise.all([
    db.from("follows").select("following_id",{count:"exact",head:true}).eq("follower_id",userId),
    db.from("follows").select("follower_id",{count:"exact",head:true}).eq("following_id",userId)
  ]);
  if(followingResult.error) throw followingResult.error;
  if(followersResult.error) throw followersResult.error;
  return {following:followingResult.count||0,followers:followersResult.count||0};
}

async function getBeyondProfileByUsername(username){
  const db=beyondDB||initBeyondDatabase();
  if(!db||!username)return null;
  const {data,error}=await db.from("profiles").select("id,username,display_name,bio,avatar_url").eq("username",username).maybeSingle();
  if(error) throw error;
  return data;
}

async function getBeyondFollowState(targetUserId){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user||!targetUserId||user.id===targetUserId)return false;
  const {data,error}=await db.from("follows").select("follower_id").eq("follower_id",user.id).eq("following_id",targetUserId).maybeSingle();
  if(error) throw error;
  return !!data;
}

async function setBeyondFollow(targetUserId,shouldFollow){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user) throw new Error("Supabase authentication is required for database follows.");
  if(user.id===targetUserId) throw new Error("You cannot follow yourself.");
  if(shouldFollow){
    const {error}=await db.from("follows").upsert({follower_id:user.id,following_id:targetUserId},{onConflict:"follower_id,following_id"});
    if(error) throw error;
  }else{
    const {error}=await db.from("follows").delete().eq("follower_id",user.id).eq("following_id",targetUserId);
    if(error) throw error;
  }
  return getBeyondFollowStatsByUserId(targetUserId);
}


async function getBeyondOwnProfile(){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user)return null;
  const {data,error}=await db.from("profiles").select("id,username,display_name,bio,avatar_url,banner_url,accent_color").eq("id",user.id).maybeSingle();
  if(error) throw error;
  return data;
}

async function updateBeyondOwnProfile(fields){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user) throw new Error("Supabase authentication is required.");
  const payload={
    id:user.id,
    username:fields.username,
    display_name:fields.display_name ?? fields.username,
    bio:fields.bio ?? "",
    avatar_url:fields.avatar_url ?? null,
    banner_url:fields.banner_url ?? null,
    accent_color:fields.accent_color ?? "#ff2d55"
  };
  const {data,error}=await db.from("profiles").upsert(payload,{onConflict:"id"}).select().single();
  if(error) throw error;
  return data;
}


async function updateLiveViewerCount(roomId,delta){
  const db=beyondDB||initBeyondDatabase();
  if(!db||!roomId)return null;
  const {data,error}=await db.rpc("change_live_viewer_count",{room_id:roomId,delta});
  if(error)throw error;
  return data;
}


// Database connection diagnostics used by Beyond setup pages.
function beyondDatabaseConfigured(){
  return Boolean(
    BEYOND_SUPABASE_URL &&
    !BEYOND_SUPABASE_URL.startsWith("YOUR_") &&
    BEYOND_SUPABASE_ANON_KEY &&
    !BEYOND_SUPABASE_ANON_KEY.startsWith("YOUR_")
  );
}

async function getBeyondDatabaseStatus(){
  const db=beyondDB||initBeyondDatabase();
  if(!db) return {configured:false,connected:false};
  const {data,error}=await db.from("profiles").select("id").limit(1);
  return {configured:true,connected:!error,error:error||null,data};
}

async function getBeyondVideos(options={}){
  const db=beyondDB||initBeyondDatabase();
  if(!db) return [];
  const limit=Number(options.limit)||30;
  let query=db.from("videos")
    .select("id,user_id,video_url,caption,hashtags,status,views_count,likes_count,created_at,profiles(username,display_name,avatar_url)")
    .eq("status","published")
    .order("created_at",{ascending:false})
    .limit(limit);
  if(options.userId) query=query.eq("user_id",options.userId);
  const {data,error}=await query;
  if(error) throw error;
  return data||[];
}

async function createBeyondPost(content){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user) throw new Error("Please sign in first.");
  if(!String(content||"").trim()) throw new Error("Post content is required.");
  const {data,error}=await db.from("posts")
    .insert({user_id:user.id,content:String(content).trim()})
    .select().single();
  if(error) throw error;
  return data;
}

async function sendBeyondMessage(receiverId,content){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user) throw new Error("Please sign in first.");
  if(!receiverId) throw new Error("A receiver is required.");
  if(!String(content||"").trim()) throw new Error("Message content is required.");
  const {data,error}=await db.from("messages")
    .insert({sender_id:user.id,receiver_id:receiverId,content:String(content).trim()})
    .select().single();
  if(error) throw error;
  return data;
}

async function markBeyondMessageRead(messageId){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user) throw new Error("Please sign in first.");
  const {data,error}=await db.from("messages")
    .update({read:true})
    .eq("id",messageId)
    .eq("receiver_id",user.id)
    .select().single();
  if(error) throw error;
  return data;
}


async function getBeyondNotifications(limit=30){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user) throw new Error("Please sign in first.");
  const {data,error}=await db.from("notifications")
    .select("id,type,message,read,created_at,actor_id,video_id,comment_id")
    .eq("user_id",user.id)
    .order("created_at",{ascending:false})
    .limit(Math.min(Math.max(Number(limit)||30,1),100));
  if(error) throw error;
  return data||[];
}

async function getBeyondUnreadNotificationCount(){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user) return 0;
  const {data,error}=await db.rpc("get_beyond_unread_notification_count");
  if(error) throw error;
  return Number(data||0);
}

async function markBeyondNotificationsRead(ids=[]){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user) throw new Error("Please sign in first.");
  let query=db.from("notifications").update({read:true}).eq("user_id",user.id);
  if(Array.isArray(ids)&&ids.length) query=query.in("id",ids);
  const {error}=await query;
  if(error) throw error;
  return true;
}


async function getBeyondConversations(){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user) throw new Error("Please sign in first.");
  const {data,error}=await db.from("messages")
    .select("id,sender_id,receiver_id,content,created_at,read")
    .or("sender_id.eq."+user.id+",receiver_id.eq."+user.id)
    .order("created_at",{ascending:false})
    .limit(500);
  if(error) throw error;
  const rows=data||[];
  const ids=[...new Set(rows.map(m=>m.sender_id===user.id?m.receiver_id:m.sender_id))];
  let profiles=[];
  if(ids.length){
    const result=await db.from("profiles").select("id,username,display_name,avatar_url").in("id",ids);
    if(result.error) throw result.error;
    profiles=result.data||[];
  }
  const map=new Map(profiles.map(p=>[p.id,p]));
  const conversations=new Map();
  for(const m of rows){
    const other=m.sender_id===user.id?m.receiver_id:m.sender_id;
    if(!conversations.has(other)){
      conversations.set(other,{user_id:other,profile:map.get(other)||null,last_message:m,unread_count:0});
    }
    if(m.receiver_id===user.id&&!m.read) conversations.get(other).unread_count++;
  }
  return [...conversations.values()].sort((a,b)=>new Date(b.last_message.created_at)-new Date(a.last_message.created_at));
}

async function getBeyondConversation(otherUserId,limit=100){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user) throw new Error("Please sign in first.");
  if(!otherUserId) throw new Error("A conversation user is required.");
  const safeLimit=Math.min(Math.max(Number(limit)||100,1),200);
  const {data,error}=await db.from("messages")
    .select("id,sender_id,receiver_id,content,created_at,read")
    .or("and(sender_id.eq."+user.id+",receiver_id.eq."+otherUserId+"),and(sender_id.eq."+otherUserId+",receiver_id.eq."+user.id+")")
    .order("created_at",{ascending:true})
    .limit(safeLimit);
  if(error) throw error;
  return data||[];
}

async function getBeyondUnreadMessageCount(){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||!user) return 0;
  const {count,error}=await db.from("messages").select("id",{count:"exact",head:true}).eq("receiver_id",user.id).eq("read",false);
  if(error) throw error;
  return count||0;
}

async function markBeyondConversationRead(otherUserId){
  const db=beyondDB||initBeyondDatabase();
  const user=await getCurrentBeyondUser();
  if(!db||user===null) throw new Error("Please sign in first.");
  const {error}=await db.from("messages").update({read:true})
    .eq("receiver_id",user.id).eq("sender_id",otherUserId).eq("read",false);
  if(error) throw error;
  return true;
}

function subscribeBeyondMessages(callback){
  const db=beyondDB||initBeyondDatabase();
  if(!db) throw new Error("Supabase is not configured.");
  return db.channel("beyond-direct-messages")
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},payload=>{
      const m=payload.new||{};
      if(m.sender_id===window.__beyondCurrentUserId||m.receiver_id===window.__beyondCurrentUserId) callback(m);
    }).subscribe();
}
