# Railway Proxy Website

This project is a simple frontend + backend app you can deploy on Railway.

## What it does

- Serves a web page where you enter a URL.
- Calls a backend endpoint (`/api/proxy`) that fetches the URL server-side.
- Returns and previews the fetched response.

## Security notes

This includes basic SSRF protections:

- Only allows `http` and `https` URLs.
- Blocks targets resolving to private/reserved network ranges.

You should still add stronger controls for production use (auth, rate limiting, allow-lists, abuse monitoring).

## Run locally

```bash
npm install
npm run start
```

Then open `http://localhost:3000`.

## Deploy to Railway

1. Push this repository to GitHub.
2. Create a new Railway project from the repo.
3. Railway will run `npm start` automatically.
