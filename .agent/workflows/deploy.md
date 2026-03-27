---
description: How to deploy the Norvexis Core PWA to production on Hostinger
---

# Deployment Info

- **Production URL**: https://www.norvexiscore.com/
- **Hosting**: Hostinger Web Hosting
- **Deploy Method**: GitHub Actions → LFTP to Hostinger FTP
- **Workflow File**: `.github/workflows/deploy.yml`
- **Trigger**: Push to `main` branch or manual `workflow_dispatch`
- **Supabase Project ID**: `tnwahbelwnhqevbgykxo`

## How It Works

1. Push to `main` triggers the `deploy.yml` GitHub Actions workflow
2. The workflow: installs deps → builds with Vite → uploads `./dist/` to Hostinger via LFTP
3. Files go to: `/home/u250946921/domains/norvexiscore.com/public_html/`

## Required GitHub Secrets

- `FTP_USER` — `u250946921.NorvexisCore`
- `FTP_PASSWORD` — Hostinger FTP password
- `FTP_HOST` — `194.164.64.249` (server IP — use IP until `ftp.norvexiscore.com` DNS propagates)
- `VITE_GEMINI_API_KEY`
- `VITE_OPENAI_API_KEY`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`

## Important Notes

- The app is a **static SPA** built with Vite — it does NOT run locally for testing in this workflow
- ALL testing is done on the production domain: https://www.norvexiscore.com/
- Database changes (Supabase migrations) take effect immediately, but **code changes** require a successful deploy
- If `ftp.norvexiscore.com` DNS propagates, the `FTP_HOST` secret can be updated to use the hostname instead of IP
