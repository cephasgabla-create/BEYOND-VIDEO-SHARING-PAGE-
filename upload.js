
/* ==========================================
   BEYOND VIDEO SHARING PAGE
   Video uploads, photo uploads and Beyond Live
========================================== */

const input = document.getElementById("videoInput");
const preview = document.getElementById("preview");

let file = null;

window.beyondSelectedVideo = null;
window.beyondSelectedPhotos = [];


/* ==========================================
   1. AUTHENTICATION
========================================== */

async function requireBeyondUploadUser() {
  const client = window.beyondDB || initBeyondDatabase();

  if (!client) {
    alert("Beyond cannot connect to Supabase. Please refresh the page.");
    return null;
  }

  try {
    // Wait for the existing authentication guard if available.
    if (typeof window.beyondRequireAuth === "function") {
      const user = await window.beyondRequireAuth();
      if (user) return user;
    }

    // Check the saved Supabase login session.
    const { data, error } = await client.auth.getSession();

    if (error) throw error;

    if (data.session?.user) {
      return data.session.user;
    }

    alert("Please sign in to Beyond before uploading.");
    location.href = "login.html?redirect=upload.html";
    return null;

  } catch (error) {
    console.error("Beyond authentication error:", error);
    alert("Could not verify your login. Please sign in again.");
    location.href = "login.html?redirect=upload.html";
    return null;
  }
}


/* ==========================================
   2. SELECT A VIDEO
========================================== */

if (input) {
  input.addEventListener("change", function () {
    file = input.files?.[0] || null;
    window.beyondSelectedVideo = file;

    if (file && preview) {
      if (preview.dataset.objectUrl) {
        URL.revokeObjectURL(preview.dataset.objectUrl);
      }

      const objectUrl = URL.createObjectURL(file);
      preview.dataset.objectUrl = objectUrl;
      preview.src = objectUrl;
      preview.load();
    }
  });
}


/* ==========================================
   3. UPLOAD VIDEO TO SUPABASE
========================================== */

async function uploadVideoToSupabase(videoFile, caption = "", hashtags = "") {
  const client = window.beyondDB || initBeyondDatabase();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { user },
    error: authError
  } = await client.auth.getUser();

  if (authError) throw authError;

  if (!user) {
    throw new Error("Please sign in to Beyond before uploading.");
  }

  if (!videoFile || !videoFile.type.startsWith("video/")) {
    throw new Error("Please choose a valid video file.");
  }

  const extension = (
    videoFile.name.split(".").pop() || "mp4"
  ).toLowerCase();

  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error: storageError } = await client.storage
    .from("videos")
    .upload(path, videoFile, {
      contentType: videoFile.type,
      upsert: false
    });

  if (storageError) throw storageError;

  const { data: publicData } = client.storage
    .from("videos")
    .getPublicUrl(path);

  const videoUrl = publicData.publicUrl;

  const { data: row, error: databaseError } = await client
    .from("videos")
    .insert({
      user_id: user.id,
      video_url: videoUrl,
      caption,
      hashtags,
      status: "published",
      views_count: 0,
      likes_count: 0
    })
    .select()
    .single();

  if (databaseError) {
    await client.storage.from("videos").remove([path]);
    throw databaseError;
  }

  return row;
}


/* ==========================================
   4. PUBLISH VIDEO
========================================== */

async function publishVideo() {
  const authUser = await requireBeyondUploadUser();
  if (!authUser) return;

  file = window.beyondSelectedVideo || file;

  if (!file) {
    alert("Please choose a video first.");
    return;
  }

  const caption =
    document.getElementById("caption")?.value.trim() || "";

  const hashtags =
    document.getElementById("hashtags")?.value.trim() || "";

  try {
    const result = await uploadVideoToSupabase(
      file,
      caption,
      hashtags
    );

    localStorage.setItem(
      "beyondLastUploadedVideo",
      JSON.stringify(result)
    );

    alert("Your video has been published to Beyond!");
    location.href = "index.html";

  } catch (error) {
    console.error("Beyond video upload failed:", error);

    alert(
      "Video upload failed: " +
      (error.message || "Please try again.")
    );
  }
}


/* ==========================================
   5. UPLOAD PHOTO TO SUPABASE
========================================== */

async function uploadPhotoToSupabase(photoFile, caption = "", hashtags = "") {
  const client = window.beyondDB || initBeyondDatabase();

  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { user },
    error: authError
  } = await client.auth.getUser();

  if (authError) throw authError;

  if (!user) {
    throw new Error("Please sign in before uploading photos.");
  }

  if (!photoFile || !photoFile.type.startsWith("image/")) {
    throw new Error("Please choose a valid image file.");
  }

  const extension = (
    photoFile.name.split(".").pop() || "jpg"
  ).toLowerCase();

  const path =
    `${user.id}/photos/${crypto.randomUUID()}.${extension}`;

  const { error: storageError } = await client.storage
    .from("videos")
    .upload(path, photoFile, {
      contentType: photoFile.type,
      upsert: false
    });

  if (storageError) throw storageError;

  const { data: publicData } = client.storage
    .from("videos")
    .getPublicUrl(path);

  const photoUrl = publicData.publicUrl;

  const { data: row, error: databaseError } = await client
    .from("videos")
    .insert({
      user_id: user.id,
      video_url: photoUrl,
      caption,
      hashtags,
      status: "published",
      views_count: 0,
      likes_count: 0
    })
    .select()
    .single();

  if (databaseError) {
    await client.storage.from("videos").remove([path]);
    throw databaseError;
  }

  return {
    ...row,
    media_type: "photo",
    photo_url: photoUrl
  };
}


/* ==========================================
   6. PUBLISH PHOTOS
========================================== */

async function publishPhotos() {
  const authUser = await requireBeyondUploadUser();
  if (!authUser) return;

  const photos = Array.from(window.beyondSelectedPhotos || []);

  if (!photos.length) {
    alert("Please choose at least one photo.");
    return;
  }

  const caption =
    document.getElementById("caption")?.value.trim() || "";

  const hashtags =
    document.getElementById("hashtags")?.value.trim() || "";

  try {
    const rows = [];

    for (const photo of photos) {
      const row = await uploadPhotoToSupabase(
        photo,
        caption,
        hashtags
      );

      rows.push(row);
    }

    localStorage.setItem(
      "beyondLastUploadedPhotos",
      JSON.stringify(rows)
    );

    alert(
      rows.length === 1
        ? "Your photo has been published to Beyond!"
        : `${rows.length} photos have been published to Beyond!`
    );

    location.href = "index.html";

  } catch (error) {
    console.error("Beyond photo upload failed:", error);

    alert(
      "Photo upload failed: " +
      (error.message || "Please try again.")
    );
  }
}


/* ==========================================
   7. SELECT WHAT TO PUBLISH
========================================== */

async function publishContent() {
  if (window.beyondUploadMode === "photo") {
    return publishPhotos();
  }

  return publishVideo();
}


/* ==========================================
   8. OTHER VIDEO UPLOAD FEATURES
========================================== */

async function uploadBeyondVideoWithDatabase(
  videoFile,
  caption = "",
  hashtags = ""
) {
  const result = await uploadVideoToSupabase(
    videoFile,
    caption,
    hashtags
  );

  localStorage.setItem(
    "beyondLastUploadedVideo",
    JSON.stringify(result)
  );

  return result;
}


/* ==========================================
   9. BEYOND LIVE MODAL
========================================== */

function openGoLive() {
  document.getElementById("goLiveModal")
    ?.classList.add("show");
}

function closeGoLive() {
  document.getElementById("goLiveModal")
    ?.classList.remove("show");
}


/* ==========================================
   10. START BEYOND LIVE
========================================== */

async function startConfiguredLive() {
  const title =
    document.getElementById("liveTitleInput")
      ?.value.trim() || "Beyond Live";

  const category =
    document.getElementById("liveCategory")?.value || "General";

  const chat = Boolean(
    document.getElementById("liveChatEnabled")?.checked
  );

  try {
    const authUser = await requireBeyondUploadUser();
    if (!authUser) return;

    const client = window.beyondDB || initBeyondDatabase();

    if (!client) {
      throw new Error("Cannot connect to Supabase.");
    }

    if (typeof createLiveRoom !== "function") {
      throw new Error(
        "The Beyond Live room service is not configured yet."
      );
    }

    const room = await createLiveRoom(title, category);

    localStorage.setItem(
      "beyondLiveConfig",
      JSON.stringify({
        title,
        category,
        chat,
        startedAt: new Date().toISOString(),
        active: true,
        roomId: room.id
      })
    );

    closeGoLive();
    location.href = "index.html?live=1";

  } catch (error) {
    console.error("Beyond Live error:", error);

    alert(
      "Could not start Beyond Live: " +
      (error.message || "Please try again.")
    );
  }
}

}
