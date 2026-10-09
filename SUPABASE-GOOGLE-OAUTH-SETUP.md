# Beyond: Enable Google Sign-In (Supabase)

The Beyond website code can start Google OAuth, but the Google provider must also be enabled in the **same Supabase project** configured in `supabase.js`. This is a dashboard configuration; it cannot safely be enabled by changing website code alone.

## 1. Enable Google in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select the project used by Beyond.
2. Open **Authentication → Sign In / Providers** (the label may appear as **Auth → Providers**).
3. Select **Google** and enable it.
4. Keep this page open so you can copy the callback URL shown by Supabase.

## 2. Create Google OAuth credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a project.
3. Configure the OAuth consent screen / Google Auth Platform details requested by Google.
4. Create an **OAuth client ID** of type **Web application**.
5. Under **Authorized redirect URIs**, add the exact callback URL shown on the Google provider page in Supabase. It normally has this form:

   `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`

   Use the exact value Supabase displays, not the GitHub Pages website URL.
6. Copy the Google **Client ID** and **Client Secret** into the Google provider settings in Supabase, then save.

**Keep the Google Client Secret private.** Enter it only in the Supabase Dashboard. Never put it in `login.js`, `signup.js`, `supabase.js`, or a public GitHub file.

## 3. Configure Beyond redirect URLs in Supabase

Open **Authentication → URL Configuration** in the same Supabase project.

Set **Site URL** to:

`https://cephasgabla-create.github.io/BEYOND-VIDEO-SHARING-PAGE/`

Add these entries to **Redirect URLs**:

- `https://cephasgabla-create.github.io/BEYOND-VIDEO-SHARING-PAGE/`
- `https://cephasgabla-create.github.io/BEYOND-VIDEO-SHARING-PAGE/index.html`
- `https://cephasgabla-create.github.io/BEYOND-VIDEO-SHARING-PAGE/reset-password.html`

Save the settings. If you later use a custom domain or another redirect destination, add that exact destination to this allow list too.

## 4. Test

1. Open the deployed [Beyond login page](https://cephasgabla-create.github.io/BEYOND-VIDEO-SHARING-PAGE/login.html).
2. Click **Continue with Google**.
3. Choose a Google account and approve the consent screen if prompted.
4. Confirm that Google returns you to Beyond.

The website now displays a clearer message when Supabase reports that the provider is disabled. A successful GitHub Pages deployment does **not** confirm that Google OAuth is enabled or that credentials are valid; the dashboard configuration and live sign-in must still be tested.

## Troubleshooting

- **`Unsupported provider: provider is not enabled`** — Google is disabled in the Supabase project that Beyond is contacting, or the wrong Supabase project is configured.
- **Redirect URL not allowed** — add the exact Beyond destination to Supabase's Redirect URLs.
- **Google `redirect_uri_mismatch`** — add the exact Supabase callback URL shown in the provider settings to Google Cloud's Authorized redirect URIs.
- **Invalid client / OAuth error** — check the Google Client ID and Client Secret saved in the same Supabase project's Google provider settings.

Official guide: [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google).
