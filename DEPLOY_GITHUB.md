# Deploy to Vercel via GitHub

Since you have GitHub connected to Vercel, you can deploy with automatic CI/CD.

## Step 1: Push Your Code to GitHub

```bash
cd /Users/irago/Projects/work-os

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Work OS with AI features"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/work-os.git
git branch -M main
git push -u origin main
```

## Step 2: Set Up Database

Choose a PostgreSQL provider (pick one):

### Option A: Vercel Postgres (Easiest Integration)
1. Go to https://vercel.com/dashboard
2. Click "Storage" → "Create Database"
3. Select "Postgres"
4. Name it: `work-os-db`
5. Copy the `DATABASE_URL`

### Option B: Neon (Free Tier)
1. Go to https://neon.tech
2. Sign up and create a new project
3. Copy the connection string from dashboard

### Option C: Supabase (Free Tier)
1. Go to https://supabase.com
2. Create a new project
3. Go to Settings → Database
4. Copy the **Connection pooling** string (port 6543)

## Step 3: Import to Vercel

1. Go to https://vercel.com/new
2. Your GitHub repository should appear automatically
3. Click "Import" on your `work-os` repository
4. Configure project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./`
   - **Build Command**: `npm run vercel-build` (auto-detected from package.json)
   - **Output Directory**: `.next` (auto-detected)

## Step 4: Add Environment Variables

Before clicking "Deploy", add these environment variables:

### Required Variables

```bash
DATABASE_URL
your-postgres-connection-string-from-step-2

APP_ENCRYPTION_KEY
[Click "Generate" button or paste 32+ char random string]

OPENAI_API_KEY
sk-your-openai-api-key-from-platform.openai.com

NEXT_PUBLIC_APP_URL
https://your-project-name.vercel.app

OAUTH_REDIRECT_BASE
https://your-project-name.vercel.app/api/oauth

DEMO_USER_EMAIL
your-email@example.com
```

**Generate encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Get OpenAI key:** https://platform.openai.com/api-keys

### Optional Variables (for integrations)

Only add these if you want Slack/Microsoft/Atlassian integrations:

```bash
SLACK_CLIENT_ID
[Your Slack app client ID]

SLACK_CLIENT_SECRET
[Your Slack app client secret]

SLACK_TARGET_USER_ID
[Your Slack user ID, e.g., U012ABCDEF]

MICROSOFT_CLIENT_ID
[Your Microsoft app client ID]

MICROSOFT_CLIENT_SECRET
[Your Microsoft app client secret]

ATLASSIAN_CLIENT_ID
[Your Atlassian app client ID]

ATLASSIAN_CLIENT_SECRET
[Your Atlassian app client secret]
```

## Step 5: Deploy

1. Click **"Deploy"** button
2. Wait 2-3 minutes for build to complete
3. Visit your deployed site!

## Step 6: Update App URL (After First Deploy)

After deployment completes:

1. Copy your Vercel URL (e.g., `https://work-os-abc123.vercel.app`)
2. Go to Settings → Environment Variables
3. Update these variables:
   - `NEXT_PUBLIC_APP_URL` → `https://work-os-abc123.vercel.app`
   - `OAUTH_REDIRECT_BASE` → `https://work-os-abc123.vercel.app/api/oauth`
4. Redeploy: Go to Deployments → Click "..." → "Redeploy"

## Automatic Deployments

From now on, every time you push to GitHub:
- **Push to `main`** → Automatic production deployment
- **Push to other branches** → Preview deployment
- **Pull requests** → Preview deployment with unique URL

## Update OAuth Redirect URLs (If Using Integrations)

If you added Slack/Microsoft/Atlassian credentials, update their redirect URLs:

### Slack
1. Go to https://api.slack.com/apps
2. Select your app
3. OAuth & Permissions → Redirect URLs
4. Add: `https://your-app.vercel.app/api/oauth/slack/callback`

### Microsoft
1. Go to https://portal.azure.com
2. Azure Active Directory → App registrations → Your app
3. Authentication → Redirect URIs
4. Add: `https://your-app.vercel.app/api/oauth/microsoft/callback`

### Atlassian
1. Go to https://developer.atlassian.com/console/myapps/
2. Select your app → Authorization
3. Add callback URL: `https://your-app.vercel.app/api/oauth/atlassian/callback`

## Custom Domain (Optional)

1. Buy a domain (Namecheap, Google Domains, etc.)
2. In Vercel project → Settings → Domains
3. Click "Add Domain"
4. Follow DNS configuration instructions
5. Update environment variables to use custom domain

## Monitoring Your App

### View Logs
- Vercel Dashboard → Your Project → Deployments → Click deployment → Logs

### View Analytics
- Vercel Dashboard → Your Project → Analytics

### View Database
- If using Vercel Postgres: Storage tab
- If using Neon/Supabase: Their respective dashboards

## Troubleshooting

### Build Fails

**"Cannot find module '@prisma/client'"**
- ✅ Fixed! The `postinstall` script in package.json generates Prisma client

**"Prisma migrate failed"**
- Check DATABASE_URL is correct
- Verify database is accessible from Vercel
- For Supabase: Use connection pooling URL (port 6543)

### Runtime Errors

**"OPENAI_API_KEY is not defined"**
- Add to environment variables
- Redeploy after adding

**"Database connection timeout"**
- Check DATABASE_URL format
- Verify database allows external connections
- For production databases, enable connection pooling

### Deployment is slow
- First deployment takes 2-4 minutes (installing dependencies)
- Subsequent deployments are faster (1-2 minutes)

## Making Updates

```bash
# Make your changes locally
git add .
git commit -m "Your changes description"
git push

# Vercel automatically deploys!
```

## Cost Estimate

- **Vercel**: Free tier (100GB bandwidth, unlimited sites)
- **Database**:
  - Vercel Postgres: $20/month
  - Neon Free: $0 (0.5GB storage, 10GB transfer)
  - Supabase Free: $0 (500MB database, 2GB transfer)
- **OpenAI**: Pay-per-use (~$0.002 per 1K tokens for GPT-4o-mini)

## Next Steps

1. ✅ Deploy your app
2. Test all features work
3. Set up OAuth integrations (optional)
4. Add custom domain (optional)
5. Enable Vercel Analytics (optional)

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Vercel Discord: https://vercel.com/discord
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed troubleshooting
