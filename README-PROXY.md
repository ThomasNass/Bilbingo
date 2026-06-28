Deploy a CORS proxy for your Google Apps Script (Vercel)

1) Set `GAS_URL` environment variable to your Apps Script deployment URL.

- Via Vercel web UI: go to Project Settings → Environment Variables → add `GAS_URL`.
- Or with Vercel CLI:

```bash
vercel env add GAS_URL production
# paste the script URL when prompted
```

2) Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

3) Update frontend `scripts/app.js`

Replace `API_BASE_URL` with your deployed proxy endpoint, e.g.

```javascript
const API_BASE_URL = 'https://your-project.vercel.app/api/proxy';
```

4) Test

- Open your GitHub Pages site or local site and try logging in.
- The proxy will add `Access-Control-Allow-Origin: *` so the browser can reach Google Apps Script via the proxy.

Notes:
- Using a public proxy exposes your script endpoint to the world through the Vercel project. Keep `GAS_URL` private.
- For production, restrict CORS by changing `Access-Control-Allow-Origin` in `api/proxy.js` to your domain.
