# Translation Worker

Cloudflare Worker that proxies translation requests to Claude (Sonnet 4.6). Holds your Anthropic API key as a Worker secret so it never reaches the browser.

## One-time deploy

1. Install Wrangler (Cloudflare's CLI):
   ```bash
   npm install -g wrangler
   ```

2. Log in (opens browser):
   ```bash
   wrangler login
   ```

3. From this `worker/` directory, set your Anthropic API key as a secret:
   ```bash
   cd worker
   wrangler secret put ANTHROPIC_API_KEY
   # Paste your sk-ant-... key when prompted, press Enter.
   ```

4. Deploy:
   ```bash
   wrangler deploy
   ```
   Wrangler prints a URL like `https://pai-translate.YOURACCOUNT.workers.dev`.

5. Open `shared.js` in the project root, find `TRANSLATION_WORKER_URL`, and paste the URL there.

That's it. Free tier covers 100k requests/day, far more than this tool will ever use.

## Updating the worker code

```bash
cd worker
wrangler deploy
```

## Rotating the API key

```bash
cd worker
wrangler secret put ANTHROPIC_API_KEY  # overwrites
```

## Local testing (optional)

```bash
cd worker
wrangler dev   # serves on http://localhost:8787
```

You'd then point `TRANSLATION_WORKER_URL` at the local URL temporarily.

## Tightening CORS later

The Worker currently allows requests from any origin (`Access-Control-Allow-Origin: *`). If you publish the static site to a known domain, swap the wildcard in `translate.js` for that origin.
