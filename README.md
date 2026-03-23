# Wedding Photo Sharing — Setup Guide

## Files Included
- `index.html` — Admin dashboard (you use this)
- `upload.html` — Guest upload page (QR codes link here)
- `netlify/functions/auth.js` — OAuth token exchange
- `netlify/functions/refresh.js` — Token refresh
- `netlify/functions/upload.js` — Photo upload to Google Photos
- `netlify/functions/albums.js` — Album management
- `netlify.toml` — Netlify configuration

---

## Step 1: Deploy to Netlify

1. Go to **netlify.com** and sign up (free)
2. Drag the entire `wedding-photos` folder onto the Netlify dashboard
3. Copy your new URL e.g. `https://amazing-name-123.netlify.app`

---

## Step 2: Google Cloud Setup

1. Go to https://console.cloud.google.com → New Project → name it `Wedding Photos`
2. Go to **APIs & Services → Library** → enable **Google Photos Library API**
3. Go to **OAuth consent screen** → External → fill in app name + your email
   - Under Scopes: add `photoslibrary`
   - Under Test users: add your own Google email
4. Go to **Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Type: Web Application
   - Authorized redirect URI: `https://your-site.netlify.app/` (your exact Netlify URL with trailing slash)
5. Copy the **Client ID** and **Client Secret**

---

## Step 3: Add Environment Variables in Netlify

In Netlify → Site Settings → Environment Variables, add:
- `GOOGLE_CLIENT_ID` = your Client ID
- `GOOGLE_CLIENT_SECRET` = your Client Secret

Then go to Deploys → Trigger deploy → Deploy site.

---

## Step 4: Connect in Admin

1. Open `https://your-site.netlify.app/`
2. Fill in your wedding details and save your Netlify URL
3. In the Google Photos section, paste your Client ID + Secret
4. Click **Authorize with Google**
5. Create or select your wedding album
6. Generate QR codes and print!

---

## Troubleshooting

- **redirect_uri mismatch**: The URI in Google Cloud must match your Netlify URL exactly including trailing slash
- **"App not verified" warning**: Click Advanced → Go to app. Normal for personal apps.
- **Photos not showing**: Click Refresh — Google Photos API has a short delay
