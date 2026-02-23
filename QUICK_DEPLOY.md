# Quick Deploy to Vercel

## 5-Minute Deployment Guide

### 1. Get a Database (Choose One)

**Option A: Vercel Postgres** (Easiest)
- Go to https://vercel.com/dashboard
- Storage → Create Database → Postgres
- Copy `DATABASE_URL`

**Option B: Neon** (Free Tier)
- Go to https://neon.tech
- Create project → Copy connection string

### 2. Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd /Users/irago/Projects/work-os
vercel
```

Follow prompts, choose defaults.

### 3. Add Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```bash
# Required
DATABASE_URL="your-postgres-url"
APP_ENCRYPTION_KEY="generate-32-char-random-string"
OPENAI_API_KEY="sk-your-openai-key"
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
OAUTH_REDIRECT_BASE="https://your-app.vercel.app/api/oauth"
DEMO_USER_EMAIL="your@email.com"
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Get OpenAI key: https://platform.openai.com/api-keys

### 4. Redeploy

```bash
vercel --prod
```

Done! Visit your app at `https://your-project.vercel.app`

## Optional: Add OAuth (Slack, Microsoft, Atlassian)

Add these to environment variables if you want integrations:
- `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`
- `ATLASSIAN_CLIENT_ID` and `ATLASSIAN_CLIENT_SECRET`

Update redirect URLs in each provider's console to:
```
https://your-app.vercel.app/api/oauth/[provider]/callback
```

## Troubleshooting

**Build fails?**
- Check environment variables are set
- Check DATABASE_URL is correct
- View build logs in Vercel Dashboard

**Database connection fails?**
- Verify DATABASE_URL format
- For Supabase: Use pooling URL (port 6543)
- Check database allows external connections

**Need help?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed guide.
