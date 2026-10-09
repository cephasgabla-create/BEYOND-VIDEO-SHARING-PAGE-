# Beyond — Project Notes

## Purpose
Beyond is a static, mobile-friendly short-video sharing site with home feed, creator profiles, login/sign-up, uploads, search, Following, comments, likes, and Creator Studio pages.

## Stack
- HTML, CSS and browser JavaScript
- GitHub Pages deployment
- Supabase Auth, Postgres and Storage for configured backend features
- Browser IndexedDB/local storage only for explicitly local prototype/fallback behavior

## Architecture
The root HTML pages load their matching CSS/JavaScript files. `supabase.js` initializes the shared Supabase client. `supabase-setup.sql` is the canonical baseline SQL setup file. OAuth providers must also be configured in the Supabase Dashboard; secrets must never be embedded in browser code.

## Verification limits
GitHub Actions checks JavaScript syntax and local file references before deployment. These checks do not execute the browser app against a real Supabase project. Database-dependent features require the matching tables, columns, RLS policies, storage rules and RPCs. Optional features such as messaging, live rooms, notifications, blocking, and recommendation scoring may need additional SQL beyond the baseline.

## Maintenance rule
When changing a database table or RPC used by browser code, update the canonical SQL setup and the client together. Keep documentation and duplicate schema files from describing conflicting database structures.
