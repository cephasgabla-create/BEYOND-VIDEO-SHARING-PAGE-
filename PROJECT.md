# Loop Short Videos

## Purpose & users
A mobile-first short-video community for viewers, creators, and moderators. Viewers browse and react to clips; creators publish selected videos; moderators review reported clips.

## Scope
The current shareable prototype includes a swipeable video feed, discovery search, creator profiles, comments, activity, saved clips, local clip selection/publishing, and report review. All interactions use sample data in this first layer; account sign-in and persistent records are planned but not yet built. Out of scope: live streaming, in-app recording/editing, direct messages, monetization, push notifications, recommendation ranking.

## Tech stack
Vue 3, Vue Router 4, Fliplet V3, Lucide icons. Video and creator imagery are remotely hosted demo media. Planned later: Fliplet.Media upload, Fliplet.DataSources and app-scoped email/password login.

## Architecture
Routes come from the Fliplet route manifest, resolved through Fliplet.Router; web history and native hash history are selected by platform. The prototype uses `window.AppUtils.mockLoopData`, with local-only mutations. No authentication or data sources have been added yet. Future credentials require server-side hashing and read exclusion; moderator rights require server-enforced role gates.

## Screens
| Screen | Route | Purpose | Current data |
|---|---|---|---|
| Feed | `/` | Swipe between clips and react | Fixture |
| Discover | `/discover` | Find clips and creators | Fixture |
| Creator profile | `/creator/:handle` | View creator and clips | Fixture |
| Comments | `/comments/:videoId` | Read and locally post comments | Fixture |
| Activity | `/activity` | Review activity | Fixture |
| Saved | `/saved` | Browse locally saved clips | Fixture |
| Upload | `/upload` | Select a local video and draft a clip | Fixture/local file |
| Moderation queue | `/moderation` | Review and locally resolve reports | Fixture |

## Code organization
`src/App.js` registers shared assets and mounts the Vue shell; `src/styles/theme.css` carries the dark theme; `src/components/` contains navigation, video card, and creator badge; `src/utils/mockLoopData.js` holds fixture collections; `src/screens/` contains one Vue SFC per screen. Screen styles are namespaced under each screen root.

## Design language
Immersive near-black video stage, white overlays, coral accent, Barlow Condensed display headings, Inter body text. Mobile bottom navigation becomes a top navigation on tablet/desktop. Real demo video and portrait imagery are core content.

## Data sources
None in the current prototype. Future Users, Videos, Follows, Likes, Comments, SavedVideos, Reports, and ActivityEvents sources use the exact field names and ownership rules in the feature plan; public profile reads must exclude Email and Password.

## Decisions log
- 2026-10-07 — Chose Vue 3 and Vue Router for a reactive multi-screen feed in V3's no-build runtime.
- 2026-10-07 — Chose app-scoped email/password accounts with creator and moderator roles; signup must never grant moderator privileges.
- 2026-10-07 — Clips will be selected existing video files rather than in-app recordings.
- 2026-10-07 — Kept the first layer fixture-backed; authentication and persistent data follow only after the user tries the prototype.
- 2026-10-07 — Activity is an in-app recipient-scoped history, not push delivery.
- 2026-10-07 — The feed accepts a selected clip ID in the URL so discovery and saved clips can open the intended clip.

## Known gaps
Prototype interactions do not persist across sessions. Video URLs are third-party demo footage and may need replacing with licensed owned footage before launch. User accounts, real uploads, and server-enforced access controls are pending later layers.

