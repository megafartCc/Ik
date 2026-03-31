# Railway Proxy Website

This project is a simple frontend + backend app you can deploy on Railway.

## What it does

- Serves a web page where you enter a URL.
- Calls a backend endpoint (`/api/proxy`) that fetches the URL server-side.
- Returns and previews the fetched response.

## About IP exposure and blacklisting

- Your visitor's IP is **not forwarded** to target sites.
- With direct proxying, target sites still see **your Railway server egress IP**.
- Some targets (Cloudflare/DataDome/etc.) block datacenter IPs and return challenge pages.

To reduce blacklisting risk in production:

1. Put the service behind auth (never open proxy to the public).
2. Add rate limiting + abuse monitoring.
3. Disable direct egress (`ALLOW_DIRECT_EGRESS=false`) until you have a dedicated outbound proxy/VPN pool.
4. Use residential/ISP rotating egress from a provider if you need high success on protected sites.

## Security notes

This includes basic SSRF protections:

- Only allows `http` and `https` URLs.
- Blocks targets resolving to private/reserved network ranges.

You should still add stronger controls for production use (auth, rate limiting, allow-lists, abuse monitoring).

## Run locally

```bash
npm run start
```

Then open `http://localhost:3000`.

## Deploy to Railway

1. Push this repository to GitHub.
2. Create a new Railway project from the repo.
3. Railway will run `npm start` automatically.
4. Set `ALLOW_DIRECT_EGRESS=false` until your outbound proxy strategy is ready.
