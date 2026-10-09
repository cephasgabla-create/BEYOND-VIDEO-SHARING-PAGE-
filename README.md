# Beyond — Video Sharing Page

Beyond is a mobile-friendly short-video sharing web app hosted with GitHub Pages.

## Main pages
- Home feed and Discover
- Login and sign-up
- Upload and profile
- Search and Following feed
- Creator Studio, Content Manager and analytics

## Development
This is a static HTML/CSS/JavaScript project. Open the repository in VS Code and run it with a local static server, or use the deployed GitHub Pages site.

## Backend
The browser app uses Supabase Auth, Postgres and Storage. Review `supabase.js` to confirm it points to your own intended Supabase project. The browser must only use a public publishable/anon key—never a database password or service-role/secret key.

For a new or existing Beyond database, review and run `supabase-setup.sql` in the matching Supabase project's SQL Editor. Do not mix this with the older `supabase-schema.sql` or `database/supabase-setup.sql` schemas. Read SQL Editor errors and verify the tables and policies in Supabase before testing uploads.

Google login also requires enabling Google in Supabase Authentication and setting up OAuth credentials and redirect URLs. See [SUPABASE-GOOGLE-OAUTH-SETUP.md](SUPABASE-GOOGLE-OAUTH-SETUP.md).

## Automated checks
GitHub Actions checks required pages, JavaScript syntax, local HTML references, and CSS asset references before deploying. A successful static deployment does not prove that Supabase credentials, RLS policies, OAuth providers, storage permissions, or live features are configured correctly.
