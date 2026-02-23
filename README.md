# Work OS

A mobile-responsive web app for time management with AI-powered workflows across Slack, Outlook, Jira, and Confluence.

## ✨ AI Features

- **AI Task Classification** - Automatically identifies actionable tasks from Slack messages using GPT-4o-mini
- **AI Demo Topic Generator** - Analyzes recent work messages to suggest relevant demo topics
- **AI Slack Message Generator** - Creates engaging Slack posts with emojis and CTAs
- **Smart Analytics** - Tracks time saved, tasks generated, and productivity metrics

## Built With

- Next.js 15 + TypeScript (UI + API)
- Prisma + PostgreSQL
- OpenAI GPT-4o-mini (AI features)
- pg-boss (job queue / scheduler)

## Included Pages

- Dashboard (`/dashboard`) - Today in One Button + Kanban (Now/Next/Waiting/Done)
- Live Demo Planner (`/live-demo-planner`)
- Confluence Answers (`/confluence-answers`)
- Slack Studio (`/slack-studio`)
- Requests Hub (`/requests-hub`)
- 1:1 Coaching (`/one-on-one-coaching`)
- Settings (`/settings`)
- Setup Wizard (`/setup`)

## Core Behaviors

- Slack + Outlook + Jira signals normalized into `ActivityFeed`
- One-click board generation with role-aware prioritization and confidence/why
- Weekly demo topic generation with configurable themes and trending keywords
- Confluence keyword chip search + admin mapping rules
- Slack post generation, draft history, schedule queue, approval toggle (default ON)
- Jira approve/reject updates and Confluence approval-section audit event
- Strategic enabler AI proficiency tracking with weighted scoring and trend reporting
- Coaching plans and 2-3 session generation with Outlook scheduling stubs
- Coaching automations: 24h reminders, post-session Confluence log template, optional Jira homework creation
- OAuth start/callback routes for Slack/Microsoft/Atlassian with encrypted token storage
- Basic analytics for time saved / tasks generated / posts scheduled

## 🚀 Deploy to Production

### GitHub + Vercel (Recommended)

See **[DEPLOY_NOW.md](./DEPLOY_NOW.md)** for quick deployment (15 minutes).

**Full deployment guides:**
- [DEPLOY_GITHUB.md](./DEPLOY_GITHUB.md) - Deploy with GitHub integration
- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) - 5-minute Vercel CLI deployment
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Comprehensive deployment guide

**Requirements:**
- PostgreSQL database (Neon, Supabase, or Vercel Postgres)
- OpenAI API key for AI features
- 32+ character encryption key

## Run Locally

1. Copy env file and add your OpenAI API key:

```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY from https://platform.openai.com/api-keys
```

2. Start Postgres:

```bash
docker compose up -d postgres
```

3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client + migrate:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

5. Seed:

```bash
npm run prisma:seed
```

6. Run app:

```bash
npm run dev
```

7. (Optional) Run worker for scheduled Slack posts:

```bash
npm run worker
```

## Notes on Integrations

- Slack OAuth now exchanges authorization codes with Slack (`oauth.v2.access`) and stores encrypted tokens.
- Microsoft and Atlassian callbacks still store demo encrypted tokens for local development.
- To wire full live APIs for all providers, replace the remaining simulated token exchange paths in `lib/integrations.ts`.
- For deployed environments, set:
  - `NEXT_PUBLIC_APP_URL=https://<your-domain>`
  - `OAUTH_REDIRECT_BASE=https://<your-domain>/api/oauth`
- Register these redirect URLs in Slack, Microsoft, and Atlassian apps:
  - `https://<your-domain>/api/oauth/slack/callback`
  - `https://<your-domain>/api/oauth/microsoft/callback`
  - `https://<your-domain>/api/oauth/atlassian/callback`
- If `OAUTH_REDIRECT_BASE`/`NEXT_PUBLIC_APP_URL` are not set, Work OS now falls back to the incoming request origin, which supports most hosted deployments.

## Security

- Tokens are encrypted before database storage using AES-256-GCM (`lib/crypto.ts`).
- Use a strong `APP_ENCRYPTION_KEY` in production and rotate regularly.
