# Challengers — Feature & Discovery Log

> Every new feature, bug fix, architectural decision, and non-obvious problem solved goes here.
> This is the single source of truth for blog posts, documentation, and onboarding.

---

## How to use this file

- **New feature added?** → Add an entry under the relevant section.
- **Bug fixed in a non-obvious way?** → Add a "Discovery" entry with the root cause + solution.
- **Architecture decision made?** → Add a "Decision" entry with the trade-offs considered.

---

## Features

### Push Notifications (FCM)
**Added:** 2026-03-19
**Stack:** Firebase Cloud Messaging (client) + Firebase Admin SDK (server) + Service Worker

- FCM tokens stored in `users/{uid}.fcmTokens` (array, max 5, deduped)
- `NotificationSender.ts` handles single token, single user, multi-user, and broadcast sends
- Service worker (`/firebase-messaging-sw.js`) handles background notifications and click-to-navigate
- `useNotification` context auto-restores token on app load if permission was already granted
- Invalid tokens are automatically cleaned up from Firestore after a failed send
- URL handling: relative paths auto-converted to absolute for click actions

### Daily Check-In System
**Added:** Initial build
**Stack:** Firestore (`daily_logs` collection) + Supabase Storage (images)

- Users submit photo proof + optional location for each challenge day
- Images uploaded as base64 to Supabase Storage bucket `challengers`
- Check-in writes to `daily_logs/{id}` with fields: `challenge_id`, `user_id`, `date` (YYYY-MM-DD), `status`, `proof_url`, `lat`, `lng`, `verified`, `note`
- Gamification: +100 points, streak increment, +100 streak bonus every 3 days

### Gamification System
**Added:** Initial build
**Stack:** Firestore (`profiles` + `challenge_participants` collections)

- Global profile: `current_points`, `total_earned`, `total_lost`, `points_history[]`
- Per-challenge: `current_points`, `streak_current`, `streak_best`, `points_history[]`
- Starting balance: 500 points
- +100 per completed check-in, -100 per missed day (streak reset to 0)
- Streak bonus: +100 every 3 consecutive days

### Missed Day Detection (Cron)
**Added:** Initial build, fixed 2026-03-19
**Stack:** Next.js API route + Vercel Cron + pg_cron (Supabase)

- Route: `GET /api/cron/check-missed`
- Runs daily at 01:00 UTC
- Checks all active participants for yesterday's check-in
- On miss: creates `daily_logs` entry with `status: "missed"`, deducts 100 points, resets streak, sends push notification
- Idempotency: checks `points_history` before acting — safe to re-run
- Security: `Authorization: Bearer {CRON_SECRET}` header required

### 15-Minute Reminder Notifications (Cron)
**Added:** 2026-03-19
**Stack:** Next.js API route + Vercel Cron (every minute) + pg_cron (Supabase, every minute)

- Route: `GET /api/cron/send-reminders`
- Fires every minute; finds challenges whose `time_window_start` falls in the next 14–16 minutes
- Sends push notification to every active participant who hasn't checked in yet today
- Idempotency: `reminder_sent_dates[]` array on each `challenge_participants` doc — max one reminder per user per challenge per day
- Notification is sticky (`requireInteraction: true`) so it stays until dismissed

### AI Avatar Generation
**Added:** Initial build
**Stack:** OpenAI gpt-image-1 + Supabase Storage

- User describes their avatar → OpenAI generates a 3D Memoji-style render
- "Let AI make it" button generates a prompt from the user's bio + name via a separate OpenAI call
- Generated image saved to `avatars/{uid}-{random}.png` in Supabase Storage

### Challenge Management
**Added:** Initial build

- Create challenges with title, description, start/end dates, time windows, rest days, location radius
- Join via 6-character alphanumeric code
- `challenges` collection stores all metadata; `challenge_participants` tracks per-user state

### Chat (Per-Challenge Group Messaging)
**Added:** Initial build
**Stack:** Firestore `conversations` + `messages` subcollection + FCM notifications

- Each challenge has one group conversation
- Unread counts tracked per user in `conversations/{id}.unreadCounts`
- New message triggers FCM push to all other participants

### Shared Content / Stories
**Added:** Before 2026-03-19
**Stack:** Firestore + Supabase Storage

- Users can share achievements or daily proof as "stories"
- Visible on `/shared` page

### PWA Support
**Added:** Initial build
**Stack:** @ducanh2912/next-pwa + Workbox

- Installable on iOS/Android/Desktop
- Service worker caches assets for offline use
- Install prompt tracked in Firestore to avoid repeated prompts

---

## Discoveries & Non-Obvious Solutions

### D-001 — FCM Token Storage Mismatch (2026-03-19)
**Problem:** Push notifications silently failed for all users.
**Root cause (3 layers):**
1. `profile/page.tsx` "Enable Notifications" button was saving the token to `profiles/{uid}.fcm_tokens` (wrong collection, underscore field name)
2. `notifications.ts` was saving `fcmToken` as a **singular string** — the server reads `fcmTokens` as an **array**
3. Only `useNotification` context was saving correctly (`users/{uid}.fcmTokens` array)

**Fix:** Removed the duplicate token-save in `profile/page.tsx` (now delegates fully to `requestNotificationPermission()`). Fixed `notifications.ts` to use `arrayUnion`-style logic with the correct field name `fcmTokens`.
**Lesson:** One place saves tokens. The server reads from exactly one path. Never split this logic.

### D-002 — Calendar Shows No Missed Days (2026-03-19)
**Problem:** The memory/calendar view never showed missed days — it looked like users only had gaps, not explicit misses.
**Root cause:** The `check-missed` cron had the `daily_logs.add()` call commented out — only points were deducted, no log was written.
**Fix:** Uncommented the missed log creation. Now the calendar can differentiate "missed" (red) from "not yet" (grey).

### D-003 — No Backend for Cron Scheduling (2026-03-19)
**Problem:** The app has no persistent server (runs on Vercel Edge/Serverless). Vercel crons only run on Pro+ plans for sub-minute schedules.
**Solution:** Used **Supabase pg_cron + pg_net** to make HTTP POST calls to the Next.js API endpoints on a schedule. This gives us reliable cron without any additional infrastructure.
- pg_cron handles the schedule
- pg_net makes the async HTTP request to Vercel
- The CRON_SECRET header authenticates the call
**How to add a new cron:** Add a `cron.schedule(...)` call in a Supabase migration + add the route to `vercel.json` as a fallback.

### D-004 — Race Condition in Missed Day Point Deductions (2026-03-19)
**Problem:** Original code read `profile.current_points` at snapshot time and subtracted — if two processes ran concurrently, points could be double-deducted.
**Fix:** Switched to `FieldValue.increment(-penalty)` style for `total_lost` and computed `profile_points` from the live document. Added idempotency check (`points_history` already has entry for date) as a safety net.

---

## Architecture Decisions

### AD-001 — Firestore as Primary DB, Supabase for Storage Only
Firestore is used for all app data (challenges, users, logs, chat). Supabase's Postgres is used only as a platform host for pg_cron jobs (no app data lives there). Supabase Storage holds images/proofs.
**Trade-off:** Two separate services to manage, but avoids migrating existing Firestore data and lets us use Supabase's free pg_cron tier.

### AD-002 — Token Array with Max-5 Cap
FCM tokens can change when a user reinstalls or clears the browser. Storing an array (max 5, oldest pruned first) means the user gets notifications on their latest devices without stale tokens accumulating forever. Invalid tokens are cleaned up after every failed send.

### AD-003 — Cron Idempotency via points_history Array
Rather than a separate `cron_runs` table, we check whether a given date already exists in the participant's `points_history` array before deducting. This is O(n) on history length but keeps the data model simple and avoids cross-collection transactions.

---

## Environment Variables

| Variable | Where used |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Client-side Firebase init |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Admin SDK (server) |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | FCM token generation |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Storage |
| `OPENAI_API_KEY` | AI avatar generation |
| `CRON_SECRET` | Authenticates cron endpoint calls |

---

## Setup Checklist for New Devs

- [ ] Add all env vars to Vercel (see table above)
- [ ] Set `CRON_SECRET` in Vercel, then run in Supabase SQL editor: `ALTER DATABASE postgres SET "app.cron_secret" = 'your-secret-here';`
- [ ] Ensure `icon-192x192.png` exists in `/public` (used as notification icon)
- [ ] Firebase project must have Cloud Messaging enabled and VAPID key generated
- [ ] Supabase Storage bucket `challengers` must be public
