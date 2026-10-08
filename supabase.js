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
  const {data,error}=await db.from("profiles").select("id,username,display_name,bio,avatar_url").eq("id",user.id).maybeSingle();
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
    avatar_url:fields.avatar_url ?? null
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
