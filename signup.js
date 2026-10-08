const form = document.getElementById("signupForm");
const message = document.getElementById("signupMessage");

function goHome() { window.location.assign("index.html"); }

function hasSupabaseConfig() {
  return typeof BEYOND_SUPABASE_URL === "string" &&
    typeof BEYOND_SUPABASE_ANON_KEY === "string" &&
    !BEYOND_SUPABASE_URL.startsWith("YOUR_") &&
    !BEYOND_SUPABASE_ANON_KEY.startsWith("YOUR_");
}

function saveBeyondSession(user, username, email) {
  localStorage.setItem("beyondLoggedIn", "true");
  localStorage.setItem("beyondEmail", user?.email || email || "");
  localStorage.setItem("beyondUsername", username);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document.getElementById("username").value.trim().replace(/^@/, "");
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  message.textContent = "";

  if (username.length < 3) { message.textContent = "Username must be at least 3 characters."; return; }
  if (password !== confirmPassword) { message.textContent = "Passwords do not match."; return; }

  try {
    if (hasSupabaseConfig()) {
      message.textContent = "Creating your Beyond account...";
      const db = window.beyondDB || initBeyondDatabase();
      if (!db) throw new Error("Database connection is not available.");

      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { data: { username } }
      });
      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await db.from("profiles").upsert({
          id: data.user.id,
          username,
          display_name: username
        });
        if (profileError) console.warn("Beyond profile setup warning:", profileError.message);
      }

      if (!data.session) {
        message.textContent = "Account created. Check your email to confirm your account, then log in.";
        return;
      }

      saveBeyondSession(data.user, username, email);
      goHome();
      return;
    }

    const users = JSON.parse(localStorage.getItem("beyondUsers") || "[]");
    if (users.some((item) => item.username.toLowerCase() === username.toLowerCase())) {
      message.textContent = "That username is already taken."; return;
    }
    if (users.some((item) => item.email === email)) {
      message.textContent = "An account with that email already exists."; return;
    }

    users.push({ username, email, password });
    localStorage.setItem("beyondUsers", JSON.stringify(users));
    saveBeyondSession({ email }, username, email);
    goHome();
  } catch (error) {
    console.error("Beyond signup error:", error);
    message.textContent = error?.message || "Could not create the account. Please try again.";
  }
});
