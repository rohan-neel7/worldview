# Security Policy & Provider Setup Guide

## Reporting Vulnerabilities

If you discover a security vulnerability or potential credential leak within this repository, please report it privately. Do **NOT** open a public issue on GitHub.

- **Contact**: Reach out directly via repository owner contact info or email.
- **Response Time**: Initial acknowledgment within 48 hours.

---

## Security Architecture

Worldview implements defensive security practices to prevent secret theft and API quota exhaustion:

1. **Server-Side Key Isolation**: All secret credentials (`GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `AISSTREAM_API_KEY`) reside exclusively in server-side environment variables on `server/index.js`. They are never passed to or bundled in the client SPA bundle.
2. **Client Key Restriction**: Any browser-visible API key (`VITE_GOOGLE_MAPS_KEY`) must be restricted by domain in the provider dashboard.
3. **Abuse Protection**:
   - Per-IP rate limiting (10 requests / 15 minutes for AI calls, 60 requests / minute for data endpoints).
   - Global daily request limits for expensive generative AI endpoints.
   - Global concurrency semaphore (max 2 active AI calls concurrently).
   - Request parameter validation and normalized LRU/TTL caching.
   - Upstream request timeouts (8-second max).
   - Maximum body payload size limits (10kb).

---

## Provider Dashboard Configuration Guide

To ensure complete protection of your API accounts before making this project publicly accessible, complete the following manual configurations in each provider's dashboard:

### 1. Google Cloud Console (Google Maps & 3D Tiles)
- **API Key**: `VITE_GOOGLE_MAPS_KEY`
- **Dashboard Action**:
  1. Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
  2. Select your Google Maps API Key.
  3. Under **Application restrictions**, select **Websites (HTTP referrers)**.
  4. Add your authorized deployment domains (e.g., `https://yourdomain.com/*`, `http://localhost:*`).
  5. Under **API restrictions**, select **Restrict key** and select only **Map Tiles API** / **Photorealistic 3D Tiles**.
  6. Under **Quotas**, set a daily cap (e.g., 10,000 requests/day) and configure **Billing Alerts** in Google Cloud Billing.

### 2. Google AI Studio (Google Gemini)
- **API Key**: `GEMINI_API_KEY_1` / `GEMINI_API_KEY_2`
- **Dashboard Action**:
  1. Open [Google AI Studio API Keys](https://aistudio.google.com/app/apikey).
  2. Create a dedicated API key for Worldview.
  3. Keep this key **server-side only** in your backend deployment environment variables (`GEMINI_API_KEY_1`).
  4. Monitor request quotas in the Google Cloud Console associated project.

### 3. AISStream (Maritime Vessel Tracking)
- **API Key**: `AISSTREAM_API_KEY`
- **Dashboard Action**:
  1. Open [AISStream Account Dashboard](https://aisstream.io/).
  2. Generate a dedicated API key for Worldview.
  3. Keep this key **server-side only** in your backend deployment environment variables (`AISSTREAM_API_KEY`).
  4. If key exposure is suspected, revoke and regenerate the API key immediately.

---

## Security Verification Checklist Before Publishing

- [ ] All `.env` files are excluded from Git index (`git status` shows no `.env` files).
- [ ] `.env.example` contains only empty placeholders.
- [ ] Previously exposed API keys have been revoked/rotated in provider dashboards.
- [ ] `VITE_GOOGLE_MAPS_KEY` is restricted by HTTP Referrers in Google Cloud Console.
- [ ] Server backend (`server/index.js`) is running and handling `/api/*` requests.
