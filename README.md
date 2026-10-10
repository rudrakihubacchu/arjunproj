# CampusConnect — Server-backed Student Portal

CampusConnect is a multi-page student portal with a premium glass UI and motion effects. Unlike the previous standalone page, authentication and user submissions are handled by an Express server and stored in SQLite.

## Features

- Public landing/index page at `/` (template: `views/index.ejs`, stylesheet: `public/css/index.css`, motion script: `public/js/index.js`). Signed-in users are redirected from `/` to `/overview`. `/index` redirects to the homepage.

- Separate URLs/pages: `/` (homepage), `/login`, `/register`, `/forgot-password`, `/reset-password`, `/overview`, `/notices`, `/timetable`, `/materials`, `/events`, `/feedback`, and `/profile`.
- Real registration and login with email uniqueness checks and bcrypt password hashing.
- Server-side sessions persisted in SQLite, HttpOnly/SameSite cookies, CSRF-token validation, login/register rate limiting, and security headers.
- Password reset tokens are random, hashed in the database, single-use, and expire after 30 minutes. Configure SMTP to email reset links.
- Profile/course updates and password changes are saved in SQLite.
- Feedback submissions and event-interest selections persist in the database and are tied to the signed-in account.
- Filters and global search, responsive mobile navigation, loading states, animated entrance/reveals, pointer-lit cards, floating hero artwork, scroll progress, colorful moving violet/cyan/rose/mint ambient gradients across every authenticated portal page, cursor-responsive background glow, frosted-glass panels, and reduced-motion support.
- Learning cards link to real external learning resources.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

1. Open a terminal in this folder.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`.
4. For local testing, the example settings work as-is. For production, replace `SESSION_SECRET` with a unique random value of at least 32 characters and set `NODE_ENV=production`.
5. Start the server:

   ```bash
   npm start
   ```

6. Open [http://localhost:3000](http://localhost:3000), create an account on the Register page, and sign in.

The SQLite database and login sessions are created in `./data` automatically. Keep the `data` folder backed up if you need to retain accounts and submissions.

## Password reset email

Set the following values in `.env` to configure your SMTP provider:

- `SMTP_HOST`
- `SMTP_PORT` (usually `587`)
- `SMTP_SECURE` (`true` for implicit TLS, otherwise `false` for STARTTLS)
- `SMTP_USER` and `SMTP_PASS` when required by the provider
- `SMTP_FROM`
- `APP_URL` to your deployed HTTPS website URL

Without SMTP, password-reset URLs are printed to the server terminal in local development only. In production, set up email delivery; the application does not reveal whether the account exists in the reset response.

## Before deploying for a real college

This is a working account-backed application starter, but not yet integrated with any particular college identity provider or academic system. The initial notice board, timetable, and event records are starter content and must be replaced with verified college data. Attendance deliberately displays as unavailable instead of inventing a percentage; to show real attendance, connect a verified college API/database. Add institution-specific email verification, privacy/terms pages, backups, monitoring, and an administrator/content-management workflow before a production rollout. Deploy behind HTTPS so secure session cookies work.

## Animation references

The motion and reveal patterns are inspired by these open-source GitHub projects; this implementation uses native CSS/JavaScript so it does not require these animation packages at runtime:

- [AOS — Animate on Scroll](https://github.com/michalsnik/aos)
- [Animate.css](https://github.com/animate-css/animate.css)
- [GSAP](https://github.com/greensock/GSAP)
