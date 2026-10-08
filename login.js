const form = document.getElementById("loginForm");
const message = document.getElementById("loginMessage") || (() => {
  const p = document.createElement("p");
  p.id = "loginMessage";
  p.setAttribute("aria-live", "polite");
  form.insertBefore(p, form.querySelector("button"));
  return p;
})();

function goHome() { window.location.assign("index.html"); }

function hasSupabaseConfig() {
  return typeof BEYOND_SUPABASE_URL === "string" &&
    typeof BEYOND_SUPABASE_ANON_KEY === "string" &&
    !BEYOND_SUPABASE_URL.startsWith("YOUR_") &&
    !BEYOND_SUPABASE_ANON_KEY.startsWith("YOUR_");
}

function saveBeyondSession(user, fallbackUsername) {
  const username = user?.user_metadata?.username || fallbackUsername ||
    user?.email?.split("@")[0] || "Beyond User";
  localStorage.setItem("beyondLoggedIn", "true");
  localStorage.setItem("beyondEmail", user?.email || "");
  localStorage.setItem("beyondUsername", username);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "Signing in...";

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  try {
    if (hasSupabaseConfig()) {
      const db = window.beyondDB || initBeyondDatabase();
      if (!db) throw new Error("Database connection is not available.");
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      saveBeyondSession(data.user);
      goHome();
      return;
    }

    const users = JSON.parse(localStorage.getItem("beyondUsers") || "[]");
    const user = users.find((item) => item.email === email && item.password === password);
    if (!user) {
      message.textContent = "Email or password is incorrect.";
      return;
    }
    saveBeyondSession({ email: user.email, user_metadata: { username: user.username } }, user.username);
    goHome();
  } catch (error) {
    console.error("Beyond login error:", error);
    message.textContent = error?.message || "Could not complete login. Please try again.";
  }
});
