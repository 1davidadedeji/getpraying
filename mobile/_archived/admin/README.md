# Archived mobile admin (removed from app router)

Moderation and CMS live in **web-admin** (`@workspace/web-admin`), not in the native app.

These screens were moved out of `mobile/app/` so Expo Router no longer registers `/admin/*` routes.

Open the team dashboard from **Settings → Team dashboard** in the mobile app, or deploy web-admin and set `EXPO_PUBLIC_WEB_ADMIN_ORIGIN` in mobile builds.
