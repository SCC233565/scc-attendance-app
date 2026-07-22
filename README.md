# SCC Attendance Register — Web App

This is the full multi-user version of your attendance app. It's already wired up to your
live Supabase database (project `jpevyhcxcivlrznaebmk`), with roles: **admin** (pastor) vs
**usher** (limited access).

## What's already done for you
- Supabase database created and schema applied (members, attendance_records, profiles)
- Row-level security so ushers can only mark attendance, not edit/delete members
- Full React app with login, attendance, members, bulk import, and reports
- PWA config so it can be installed on a phone home screen

## What you need to do

### 1. Install dependencies
Open a terminal in this folder and run:
```
npm install
```

### 2. Try it locally (optional but recommended)
```
npm run dev
```
This opens the app at `http://localhost:5173`. Sign-up is disabled (invite-only), so you'll
need to create your first user before you can log in — see step 3.

### 3. Create your first login (yourself, as pastor/admin)
1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/jpevyhcxcivlrznaebmk
2. In the left sidebar, click **Authentication → Users → Add user**
3. Enter your email and a password, then click **Create user**
4. Go to **Table Editor → profiles**, find your new row, and change `role` from `usher` to `admin`
5. You can now log in with that email/password in the app

### 4. Add ushers the same way
Repeat step 3 for each usher, but leave their `role` as `usher` (the default) — they'll be
able to take attendance but not add/edit/delete members.

### 5. Deploy to Vercel (get a real URL)
1. Go to https://vercel.com and sign up (free)
2. Click **Add New → Project**
3. Choose **"Deploy without Git"** if you don't have GitHub set up, or drag this whole
   `scc-app` folder in when prompted — Vercel will detect it's a Vite project automatically
4. Click **Deploy**. In a minute you'll get a live URL like `scc-attendance.vercel.app`
5. Share that URL with your pastor and ushers

### 6. Install on phone
Once the app is live at its URL:
- **iPhone (Safari):** open the link → tap Share → "Add to Home Screen"
- **Android (Chrome):** open the link → tap the menu (⋮) → "Add to Home Screen" / "Install app"

It will then behave like a regular app icon, no App Store needed.

## Notes
- Your Supabase URL and public API key are already filled in in `src/supabaseClient.js`.
  This key is safe to be public — protection comes from the Row Level Security rules, not
  from hiding the key.
- If you ever want to add more roles or change what ushers can/can't do, that's controlled
  in the SQL policies in `schema.sql` (already applied to your live database).
