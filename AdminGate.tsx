# Admin Login Fix — What To Do With These Files

This package contains 3 files that lock down your `/admin` page so it
requires a real login instead of being open to anyone.

## Files in this zip

```
src/pages/AdminLogin.tsx       <- NEW file, add it
src/components/AdminGate.tsx   <- NEW file, add it
src/App.tsx                    <- REPLACES your existing src/App.tsx
```

## Steps on GitHub

1. Open your repo on GitHub (the one synced to your Lovable project).
2. Go into `src/pages/` → **Add file → Create new file** → name it
   `AdminLogin.tsx` → paste in the contents of `src/pages/AdminLogin.tsx`
   from this zip → commit.
3. Go into `src/components/` → **Add file → Create new file** → name it
   `AdminGate.tsx` → paste in the contents of `src/components/AdminGate.tsx`
   from this zip → commit.
4. Open your existing `src/App.tsx` in GitHub → click the pencil/edit icon
   → select all, delete, and paste in the full contents of `src/App.tsx`
   from this zip → commit.
5. Open your `package.json` in GitHub → check whether
   `"@supabase/supabase-js"` is listed under `"dependencies"`. If it's
   missing, add this line in that section:
   ```json
   "@supabase/supabase-js": "^2.45.0",
   ```
   (If it's already there — likely, since Lovable already wired up a
   Supabase client — skip this step.)

## One more required step: create your admin login

This fix does **not** create an admin account for you — it only requires
one to sign in. To create it:

1. Go to your **Supabase dashboard** → your project.
2. Go to **Authentication → Users → Add user**.
3. Enter an email and password — this is what you'll type in at
   `/admin` going forward.

## After this is done

Visit `yoursite.com/admin` — you should now see a sign-in form instead of
the dashboard. Only after signing in with the account you just created
will the dashboard appear. There's also a "Sign Out" button you can add
later if you want one inside the dashboard header — just say the word.
