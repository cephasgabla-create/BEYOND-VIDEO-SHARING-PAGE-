/* Beyond database client
   1. Create a Supabase project.
   2. Put your project URL and anon key below.
   3. Load this file before pages that use database features.
*/
const BEYOND_SUPABASE_URL = "YOUR_SUPABASE_URL";
const BEYOND_SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

let beyondDB = null;

function initBeyondDatabase(){
  if(!window.supabase){
    console.warn("Supabase library is not loaded yet.");
    return null;
  }
  if(BEYOND_SUPABASE_URL.startsWith("YOUR_")) {
    console.warn("Add your Supabase URL and anon key in supabase.js.");
    return null;
  }
  beyondDB = window.supabase.createClient(BEYOND_SUPABASE_URL, BEYOND_SUPABASE_ANON_KEY);
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
