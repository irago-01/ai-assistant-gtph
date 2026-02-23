# 🚀 Deploy Now - GitHub + Vercel

Quick deployment steps for your Work OS with GitHub integration.

## 1️⃣ Push to GitHub (5 min)

```bash
cd /Users/irago/Projects/work-os

# Check git status
git status

# Add and commit
git add .
git commit -m "Add AI features: Demo Planner, Slack Studio, Task Analytics"

# Push to GitHub (create repo first if needed)
git push origin main
```

**Don't have a GitHub repo yet?**
1. Go to https://github.com/new
2. Name: `work-os`
3. Keep it private (recommended)
4. Don't initialize with README (you already have code)
5. Copy the commands shown, run them

## 2️⃣ Get Database URL (2 min)

**Quick option - Neon (Free):**
1. https://neon.tech → Sign up
2. Create project → Copy connection string
3. Done!

**Or Vercel Postgres:**
- https://vercel.com/dashboard → Storage → Create Database → Postgres

## 3️⃣ Deploy on Vercel (3 min)

1. Go to https://vercel.com/new
2. Click "Import" on your `work-os` repository
3. Add environment variables (see below)
4. Click "Deploy"

### Environment Variables to Add:

**Copy these, replace values:**
```
DATABASE_URL = paste-your-database-url-here
APP_ENCRYPTION_KEY = [click Generate or run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]
OPENAI_API_KEY = sk-your-key-from-platform.openai.com
NEXT_PUBLIC_APP_URL = https://work-os-your-project.vercel.app
OAUTH_REDIRECT_BASE = https://work-os-your-project.vercel.app/api/oauth
DEMO_USER_EMAIL = your-email@example.com
```

**Note:** For `NEXT_PUBLIC_APP_URL` and `OAUTH_REDIRECT_BASE`, use your actual Vercel URL after first deployment.

## 4️⃣ After First Deploy (1 min)

1. Copy your Vercel URL from deployment
2. Settings → Environment Variables
3. Update `NEXT_PUBLIC_APP_URL` and `OAUTH_REDIRECT_BASE` with your real URL
4. Deployments → Redeploy

## ✅ Done!

Your app is live at: `https://your-project.vercel.app`

### Features Now Live:
- ✨ AI Task Classification from Slack
- 📊 Activity Dashboard with drag-and-drop
- 🎯 AI Demo Topic Generator
- 💬 AI Slack Message Generator with emojis
- 🔗 Confluence Answers

### What Works Automatically:
- Every push to `main` → Production deploy
- Pull requests → Preview deployments
- Database migrations → Auto-run on deploy

## Optional: Add Slack Integration

If you want Slack integration:

1. Create Slack app: https://api.slack.com/apps
2. Get Client ID & Secret
3. Add to Vercel env variables:
   - `SLACK_CLIENT_ID`
   - `SLACK_CLIENT_SECRET`
4. Add redirect URL in Slack: `https://your-app.vercel.app/api/oauth/slack/callback`
5. Redeploy

## Need More Details?

- **GitHub deployment:** [DEPLOY_GITHUB.md](./DEPLOY_GITHUB.md)
- **General deployment:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Quick start:** [QUICK_DEPLOY.md](./QUICK_DEPLOY.md)

## Costs

- **Vercel**: Free tier (plenty for personal/team use)
- **Neon Database**: Free tier (0.5GB storage)
- **OpenAI API**: ~$0.002 per 1K tokens (very cheap for GPT-4o-mini)

Total: **$0/month** on free tiers (upgrade only if needed)

---

**Ready?** Start with step 1! 🚀
