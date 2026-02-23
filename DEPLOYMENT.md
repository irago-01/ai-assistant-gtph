# Deploying Work OS to Vercel

This guide will walk you through deploying your Work OS application to Vercel.

## Prerequisites

1. A [Vercel account](https://vercel.com/signup)
2. A hosted PostgreSQL database (options below)
3. OpenAI API key for AI features

## Step 1: Set Up a PostgreSQL Database

Choose one of these options for a hosted PostgreSQL database:

### Option A: Vercel Postgres (Recommended)
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Storage" → "Create Database"
3. Select "Postgres"
4. Choose a name and region
5. Copy the `DATABASE_URL` connection string

### Option B: Neon (Free tier available)
1. Go to [Neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string

### Option C: Supabase (Free tier available)
1. Go to [Supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string (use "Connection pooling" for better performance)

## Step 2: Deploy to Vercel

### Method 1: Using Vercel CLI (Recommended)

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy from your project directory:
   ```bash
   cd /Users/irago/Projects/work-os
   vercel
   ```

4. Follow the prompts:
   - Set up and deploy? **Y**
   - Which scope? Select your account
   - Link to existing project? **N** (unless you already created one)
   - Project name? **work-os** (or your preferred name)
   - Directory? **./** (current directory)
   - Override settings? **N**

### Method 2: Using Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/new)
2. Click "Import Git Repository"
3. If your code is on GitHub/GitLab/Bitbucket:
   - Connect your Git provider
   - Select the `work-os` repository
4. If your code is local only:
   - Push to GitHub first, then import

## Step 3: Configure Environment Variables

In your Vercel project settings, add these environment variables:

### Required Variables

```bash
# Database
DATABASE_URL="your-postgres-connection-string-here"

# Encryption (generate a 32+ character random string)
APP_ENCRYPTION_KEY="your-very-long-random-secret-key-here-at-least-32-chars"

# App URL (will be your Vercel domain)
NEXT_PUBLIC_APP_URL="https://your-project-name.vercel.app"
OAUTH_REDIRECT_BASE="https://your-project-name.vercel.app/api/oauth"

# Demo user email
DEMO_USER_EMAIL="your-email@example.com"

# OpenAI API Key (for AI features)
OPENAI_API_KEY="sk-your-openai-api-key"
```

### Optional Variables (for integrations)

```bash
# Slack OAuth (if you want Slack integration)
SLACK_CLIENT_ID="your-slack-client-id"
SLACK_CLIENT_SECRET="your-slack-client-secret"
SLACK_TARGET_USER_ID="your-slack-user-id"

# Microsoft OAuth (if you want Microsoft integration)
MICROSOFT_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CLIENT_SECRET="your-microsoft-client-secret"

# Atlassian OAuth (if you want Confluence integration)
ATLASSIAN_CLIENT_ID="your-atlassian-client-id"
ATLASSIAN_CLIENT_SECRET="your-atlassian-client-secret"

# Translation API (if you want auto-translation)
TRANSLATE_API_URL="your-translation-api-url"
TRANSLATE_API_KEY="your-translation-api-key"
```

### How to Add Environment Variables in Vercel

1. Go to your project in Vercel Dashboard
2. Click "Settings" → "Environment Variables"
3. Add each variable:
   - **Key**: Variable name (e.g., `DATABASE_URL`)
   - **Value**: The actual value
   - **Environment**: Select all (Production, Preview, Development)
4. Click "Save"

## Step 4: Run Database Migrations

After deploying, you need to run Prisma migrations on your production database:

### Method 1: Using Vercel CLI (Recommended)

```bash
# Set the DATABASE_URL locally to your production database
export DATABASE_URL="your-production-postgres-connection-string"

# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Method 2: Using Vercel Build Command

Add a `vercel-build` script to your `package.json`:

```json
"scripts": {
  "vercel-build": "prisma generate && prisma migrate deploy && next build"
}
```

Then redeploy:
```bash
vercel --prod
```

## Step 5: Verify Deployment

1. Visit your deployed URL: `https://your-project-name.vercel.app`
2. Check the logs in Vercel Dashboard if there are any errors
3. Test the following:
   - Dashboard loads
   - AI features work (Live Demo Planner, Slack Studio)
   - Database connection works

## Troubleshooting

### Build Errors

**Error: "Prisma Client not generated"**
```bash
# Add postinstall script to package.json
"postinstall": "prisma generate"
```

**Error: "Cannot find module '@prisma/client'"**
- Make sure `prisma generate` runs during build
- Check that `@prisma/client` is in `dependencies` (not `devDependencies`)

### Database Connection Issues

**Error: "Can't reach database server"**
- Verify your `DATABASE_URL` is correct
- Check that your database allows connections from Vercel IPs
- For Supabase, use the "Connection pooling" URL

**Error: "Too many connections"**
- Use connection pooling (especially important for serverless)
- For Supabase: Use the pooling URL (port 6543)
- For Neon: Connection pooling is automatic

### Runtime Errors

**Error: "APP_ENCRYPTION_KEY must be at least 32 characters"**
- Generate a secure random string:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

**Error: "OPENAI_API_KEY is not defined"**
- Add your OpenAI API key to Vercel environment variables
- Get a key from: https://platform.openai.com/api-keys

## Step 6: Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Click "Add Domain"
3. Enter your custom domain
4. Follow DNS configuration instructions
5. Update `NEXT_PUBLIC_APP_URL` and `OAUTH_REDIRECT_BASE` to use your custom domain

## Important Notes

### Background Worker

The `worker/index.ts` file (for background jobs) won't run on Vercel's serverless platform. For background jobs, you'll need to:

1. **Option A**: Use Vercel Cron Jobs
   - Create API routes that perform the worker tasks
   - Schedule them using `vercel.json`:
     ```json
     {
       "crons": [{
         "path": "/api/cron/sync-slack",
         "schedule": "*/5 * * * *"
       }]
     }
     ```

2. **Option B**: Deploy worker separately
   - Deploy the worker to a platform that supports long-running processes (Railway, Render, etc.)
   - Use the same database connection

### Environment-Specific URLs

Update OAuth redirect URLs in your integration providers:
- Slack: https://api.slack.com/apps
- Microsoft: https://portal.azure.com
- Atlassian: https://developer.atlassian.com/console/myapps/

Add your Vercel domain to the redirect URLs:
```
https://your-project-name.vercel.app/api/oauth/slack/callback
https://your-project-name.vercel.app/api/oauth/microsoft/callback
https://your-project-name.vercel.app/api/oauth/atlassian/callback
```

## Continuous Deployment

Once set up, Vercel will automatically:
- Deploy on every push to `main` branch (production)
- Create preview deployments for pull requests
- Run your build command and tests

To disable auto-deployment:
1. Go to Project Settings → Git
2. Toggle "Production Branch" or "Preview Branches"

## Cost Considerations

- **Vercel**: Free tier includes 100GB bandwidth, unlimited sites
- **Vercel Postgres**: Starts at $20/month for production use
- **Neon**: Free tier includes 0.5GB storage, 10GB transfer
- **Supabase**: Free tier includes 500MB database, 2GB transfer
- **OpenAI**: Pay-per-use based on API calls

## Support

For issues specific to:
- Vercel deployment: https://vercel.com/docs
- Prisma migrations: https://www.prisma.io/docs/guides/deployment
- Next.js on Vercel: https://nextjs.org/docs/deployment
