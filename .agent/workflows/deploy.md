---
description: How to deploy the HealthAxis Inventory PWA to production on Hostinger
---

# Deployment Info

- **Production URL**: https://healthaxisinventory.com/
- **Hosting**: Hostinger Node.js Web App
- **Deploy Method**: GitHub Actions → LFTP to Hostinger FTP
- **Workflow File**: `.github/workflows/deploy.yml`
- **Trigger**: Push to `main` branch or manual `workflow_dispatch`
- **Supabase Project ID**: `tnwahbelwnhqevbgykxo`

## How It Works

1. Push to `main` triggers the `deploy.yml` GitHub Actions workflow
2. The workflow: installs deps → builds with Vite → uploads `./dist/` to Hostinger via LFTP
3. Files go to: `/home/u250946921/domains/healthaxisinventory.com/public_html/`

## Required GitHub Secrets

- `FTP_USER` — Hostinger FTP username
- `FTP_PASSWORD` — Hostinger FTP password
- `FTP_HOST` — Hostinger FTP host
- `VITE_GEMINI_API_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`

## Important Notes

- The app is a **static SPA** built with Vite — it does NOT run locally for testing in this workflow
- ALL testing is done on the production domain: https://healthaxisinventory.com/
- Database changes (Supabase migrations) take effect immediately, but **code changes** require a successful deploy
- If the deploy workflow hangs at the LFTP step, it's usually the `apt-get update` being slow — the workflow is optimized to try installing lftp without updating first
