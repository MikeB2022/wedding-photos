# Wedding Photo Sharing — Setup Guide

## Files Included
- `index.html` — Admin dashboard (you use this to configure & manage)
- `upload.html` — Guest-facing page (QR codes link here)
- `README.md` — This file

---

## Quick Start (No Backend Required)

For the simplest setup with no coding:

1. **Host the files** on any web hosting service (Netlify, GitHub Pages, Vercel, etc.) — all free options work.
2. **Open `index.html`** and fill in your wedding details (names, date, venue).
3. **Connect your Google Photos share link:**
   - Open the Google Photos app on your phone
   - Create a new album for your wedding
   - Tap "Share" → "Create shared album link"
   - Paste that link into the "Google Photos" section
4. **Generate QR codes** — one per table — and print them.
5. Guests scan the QR code → see the upload page → share photos → you see them in Google Photos.

---

## Full Google Photos API Integration (Advanced)

For automatic photo uploads (no guest Google account needed):

### Step 1: Google Cloud Console
1. Go to https://console.cloud.google.com
2. Create a new project: "Wedding Photos Sharing"
3. Go to **APIs & Services → Library**
4. Search for **"Google Photos Library API"** and enable it

### Step 2: OAuth Credentials
1. Go to **APIs & Services → Credentials**
2. Click **"Create Credentials" → "OAuth 2.0 Client IDs"**
3. Application type: **Web Application**
4. Name: "Wedding Photo Upload"
5. Authorized JavaScript origins: `https://your-site.com`
6. Authorized redirect URIs: `https://your-site.com/index.html`
7. Copy the **Client ID**

### Step 3: Configure the Site
1. Open `index.html` in a text editor
2. Find `const GOOGLE_CLIENT_ID = ''` and paste your Client ID
3. In the admin panel, click **"API Setup Guide"** and enter your Client ID
4. Click **"Authorize with Google"** — sign in with your Google account

### Step 4: Backend Endpoint (for guest uploads)
Guests don't sign in to Google — instead, you need a small backend to receive their photos and forward them to your Google Photos album using your authorized token.

**Simple Node.js backend (deploy to Vercel/Railway/Render):**

```javascript
// api/upload.js
const { google } = require('googleapis');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  // Use your stored OAuth token
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
  
  // Upload to Google Photos
  const response = await fetch('https://photoslibrary.googleapis.com/v1/uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'X-Goog-Upload-Protocol': 'raw',
    },
    body: req.body
  });
  
  const uploadToken = await response.text();
  
  // Add to album
  await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      albumId: process.env.GOOGLE_ALBUM_ID,
      newMediaItems: [{
        simpleMediaItem: { uploadToken }
      }]
    })
  });
  
  res.json({ success: true });
}
```

### Step 5: Environment Variables
Set these in your hosting provider:
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
GOOGLE_ALBUM_ID=your-wedding-album-id
```

---

## Customizing the QR Code URL

The QR codes link to `upload.html` with URL parameters encoding your wedding details:

```
upload.html?table=3&n1=Alexandra&n2=James&date=June+14+2025&venue=Rosewood+Gardens
```

All these parameters are automatically set when you generate QR codes from the admin panel.

---

## Printing QR Cards

1. In the admin panel, set your table count and click **"Generate Tables"**
2. Select **"Print All Cards"**
3. Print on card stock (A6 or 4×6" works great for table cards)
4. For best results, use a color printer to show the gold accent colors

---

## Hosting Options (Free)

| Service | URL | Notes |
|---------|-----|-------|
| Netlify | netlify.com | Drag & drop deploy, free SSL |
| Vercel | vercel.com | Great for adding Node.js backend |
| GitHub Pages | pages.github.com | Free, needs GitHub account |
| Cloudflare Pages | pages.cloudflare.com | Very fast, generous free tier |

---

## Support

For help with Google API setup or customization, refer to:
- Google Photos Library API docs: https://developers.google.com/photos
- OAuth 2.0 guide: https://developers.google.com/identity/protocols/oauth2
