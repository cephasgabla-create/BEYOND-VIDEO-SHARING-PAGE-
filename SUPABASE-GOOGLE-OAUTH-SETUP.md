# Beyond: Enable Google Sign-In (Supabase)

The Beyond website code can start Google OAuth, but the Google provider must also be enabled in the same Supabase project configured in `supabase.js`. This dashboard configuration cannot be completed by changing website code alone.

## 1. Enable Google in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select the project used by Beyond.
2. Open **Authentication → Sign In / Providers** (the label may appear as **Auth → Providers**).
3. Select **Google** and enable it.
4. Copy the callback URL shown by Supabase.

## 2. Configure Google OAuth credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project and open Google Auth Platform / OAuth clients.
3. Create or select an OAuth client of type **Web application**.
4. Under **Authorized redirect URIs**, add the exact callback URL shown by Supabase. It normally resembles:

   `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`

5. Copy the Google **Client ID** and **Client Secret** into the Google provider settings in Supabase, then save.

**Keep the Google Client Secret private.** Enter it only in the Supabase Dashboard. Never put it in `login.js`, `signup.js`, `supabase.js`, or a public GitHub file.

## 3. Configure Beyond redirect URLs in Supabase

Open **Authentication → URL Configuration** in the same Supabase project.

For the current Render deployment, set **Site URL** to:

`https://beyond-video-sharing-page-1nyn.onrender.com/`

Add these exact entries to **Redirect URLs**:

- `https://beyond-video-sharing-page-1nyn.onrender.com/`
- `https://beyond-video-sharing-page-1nyn.onrender.com/index.html`
- `https://beyond-video-sharing-page-1nyn.onrender.com/reset-password.html`
- `https://beyond-video-sharing-page-1nyn.onrender.com/login.html`
- `https://beyond-video-sharing-page-1nyn.onrender.com/signup.html`

If you intentionally continue using GitHub Pages as a second deployment, add its exact URLs separately. Do not remove other redirect destinations unless you know they are no longer used.

## 4. Test

1. Open the [Beyond login page on Render](https://beyond-video-sharing-page-1nyn.onrender.com/login.html).
2. Click **Continue with Google**.
3. Choose your account and follow Google's sign-in steps.
4. Confirm that Google returns you to Beyond and the page recognizes your session.

A successful website deployment does **not** confirm that Google OAuth is enabled or that credentials are valid. The Supabase settings and live sign-in must still be tested.

## Troubleshooting

- **Unsupported provider / provider is not enabled** — Google is disabled in the Supabase project Beyond is contacting, or the wrong project is configured.
- **Redirect URL not allowed** — add the exact Beyond destination to Supabase's Redirect URLs.
- **Google `redirect_uri_mismatch`** — add the exact Supabase callback URL shown in the provider settings to Google Cloud's Authorized redirect URIs.
- **Invalid client / OAuth error** — check the Google Client ID and Client Secret saved in the same Supabase project's Google provider settings.

Official guide: [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google).
