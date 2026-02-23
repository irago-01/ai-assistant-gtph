import { PrismaClient, ActivitySource } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get the actual user ID
  const user = await prisma.user.findFirst({
    where: {
      email: process.env.DEMO_USER_EMAIL || 'owner@workos.local',
    },
  });

  if (!user) {
    console.error('User not found!');
    return;
  }

  const userId = user.id;

  // Define all pending tasks based on Slack analysis
  const tasks = [
    // HIGH PRIORITY - People waiting on you
    {
      title: 'From Jaco Viljoen: Provide Claude access for Veronica Mould',
      body: 'Assist with Claude access for Veronica Mould. Ticket: [CSD-231242] Request For Claude License. Follow-up ticket: HHD-20965',
      priority: 1,
      dueHours: 24,
    },
    {
      title: 'From Mia: Set up n8n workflow training and Dynamic Calendar Tool',
      body: 'Mia from Cape Town needs n8n workflow support. Has a Dynamic Calendar Tool challenge - Partner marketing team needs automation for offer mailer send dates. Wants WWFB-style list delivered via Slack.',
      priority: 1,
      dueHours: 48,
    },
    {
      title: 'From Malefane Mokoena: Help with Slack-Jira integration',
      body: 'Building Slack → Jira integration. Stuck on permissions (read, write, edit for users only). Needs assistance with user ticket logging from Slack to Jira.',
      priority: 1,
      dueHours: 48,
    },
    {
      title: 'From Dave B (Tyme): Link two accounts',
      body: 'Link two accounts: ChatGPT (david.bekker@tymedigital.com) and Claude (david.bekker@tyme.com)',
      priority: 2,
      dueHours: 24,
    },
    {
      title: 'From Makhado Tshihatu: Provide Lovable credits',
      body: 'Makhado needs Lovable credits. Approved ticket HHD-20782 is waiting on access. Also mentioned free plan issue when logging in with Makhado.Tshihatu@tymedigital.com',
      priority: 2,
      dueHours: 48,
    },
    {
      title: 'Follow up: AD account ticket with U036XQGJKSL',
      body: 'Following up on your AD ticket. Message sent: "papi! ano balita sa ticket ko k AD?"',
      priority: 2,
      dueHours: 24,
    },

    // PROJECT BLOCKERS
    {
      title: 'ER Automation 2026: Resolve One Service Desk Project dependency',
      body: 'Project blocked by One Service Desk Project (Jira consolidation). Need to either wait or build with Lovable (waiting on credits). Explore Jira as ER ticketing system with n8n for Slack notifications.',
      priority: 1,
      dueHours: 72,
    },
    {
      title: 'ER Automation: Connect with Katy about Jira plans dependency',
      body: 'Wala akong visibility, need to ask Katy to bring up the dependency of the project for Group Jira plans. Message to U06883U2BE2.',
      priority: 2,
      dueHours: 48,
    },

    // ACCESS & PERMISSIONS
    {
      title: 'PIM Roles: Fazil Ahamed ADM account',
      body: 'Request PIM roles for fazil.ahamed-adm@gotyme.com.ph: Cloud Application Administrator, Application Administrator. Coordinating with U0875N9Q7LN.',
      priority: 2,
      dueHours: 48,
    },
    {
      title: 'Claude/ChatGPT Access Cleanup',
      body: 'Clean up unused AI tool licenses. Posted to #claude_usersph asking users if they prefer Claude over ChatGPT to reallocate ChatGPT slots.',
      priority: 3,
      dueHours: 168, // 1 week
    },

    // AI BOOTCAMP & TRAINING
    {
      title: 'AI Bootcamp: Coordinate workflows for AI Ambassadors',
      body: 'AI Bootcamp next week for AI Ambassadors. Need to test and build AI workflows. Schedule coordination for Monday bootcamp. Budget/merch planning needed.',
      priority: 1,
      dueHours: 120, // 5 days
    },
    {
      title: 'Draft message for AI Ambassadors workflow testing',
      body: 'Draft and post message to AI ambassadors on Tuesday for workflow testing session. Move Lovable schedule to Friday for bootcamp.',
      priority: 2,
      dueHours: 72,
    },
    {
      title: 'Confirm AI Bootcamp budget with Ms. Gi',
      body: 'Ms. Gi is asking for costs. Need to confirm budget and merch for AI Bootcamp (21 ambassadors estimated).',
      priority: 2,
      dueHours: 96,
    },

    // N8N & WORKFLOW STANDARDS
    {
      title: 'Document n8n NPROD → PROD migration process',
      body: 'Follow up on process for push to PROD. Requirements: sticky notes, labels, timezone, time saved estimates. Workflows need to be better than MVP before PROD migration.',
      priority: 2,
      dueHours: 96,
    },
    {
      title: 'Add PMO project demo to Confluence',
      body: 'Record demo of PMO project that Andrew requested and add to Confluence.',
      priority: 3,
      dueHours: 120,
    },

    // TEAM COORDINATION
    {
      title: 'Strategic Enablers huddle',
      body: 'Schedule huddle for updates on Strategic Enablers. Assessment results pending.',
      priority: 2,
      dueHours: 48,
    },
    {
      title: 'Weekly AI Live Session: Slack AI Chatbot demo',
      body: 'Demo Slack AI Chatbot in Weekly AI Live session. Includes n8n workflow tutorials and authentication guides.',
      priority: 2,
      dueHours: 168, // Next week
    },

    // SUPPORT REQUESTS
    {
      title: 'From SQ(TymeX): Help get access to Teams',
      body: 'SQ is waiting for someone to let them into Teams',
      priority: 3,
      dueHours: 48,
    },
    {
      title: 'From Jessica Moshoeshoe: Profile restricted (RESOLVED)',
      body: 'Jessica mentioned profile was restricted and couldn\'t create projects. This appears resolved but confirm.',
      priority: 4,
      dueHours: 168,
    },

    // INTEGRATIONS & API
    {
      title: 'AI Automation: Clarify Claude CoWork installation for AI Ambassadors',
      body: 'Some AI ambassadors are asking whether they can install Claude CoWork. Need to clarify if they need Claude account access first. CC: U05N10QSAKU, U06PUNBPU49, U08DTE9M4BS',
      priority: 3,
      dueHours: 72,
    },
    {
      title: 'API Keys: Tableau and Mixpanel for AI Ambassadors',
      body: 'Question from AI Ambassador: Can we request API keys from Tableau and Mixpanel for data sources? Need to coordinate with U05N10QSAKU, U072KK2MF9V',
      priority: 3,
      dueHours: 96,
    },

    // COMMUNICATION & DOCUMENTATION
    {
      title: 'Post authentication guide to People channel',
      body: 'Created guide explaining Basic Authentication and Header Authentication for webhook nodes. Already posted to #people-goph.',
      priority: 4,
      dueHours: 0, // Done
    },
    {
      title: 'PacMan PROD testing notification',
      body: 'Informed team about PacMan PROD testing. Non-prod environment inactive. Already communicated to team.',
      priority: 4,
      dueHours: 0, // Done
    },

    // SYSTEM ACCESS
    {
      title: 'Bitbucket access request for PR submission',
      body: 'Requested access to Bitbucket repository: tymerepos/ph-n8n-resources. Need access to submit PR.',
      priority: 3,
      dueHours: 120,
    },
  ];

  console.log(`\n🎯 Creating ${tasks.length} tasks...\n`);

  for (const task of tasks) {
    const dueAt = task.dueHours > 0 ? new Date(Date.now() + task.dueHours * 60 * 60 * 1000) : null;
    const eventAt = new Date();

    await prisma.activityFeed.create({
      data: {
        userId,
        source: ActivitySource.MANUAL,
        sourceId: `manual-task-${Date.now()}-${Math.random()}`,
        title: task.title,
        body: task.body,
        url: null,
        author: null,
        channel: 'Task List',
        priorityHint: task.priority <= 2 ? 0.9 : 0.6,
        dueAt,
        eventAt,
        metadata: {
          taskSource: 'slack-analysis',
          originalPriority: task.priority,
        },
        isUnread: true,
        isFlagged: task.priority === 1,
        isMention: false,
        isDm: false,
        isStarred: task.priority === 1,
      },
    });

    console.log(`✅ Created: ${task.title}`);
  }

  console.log(`\n✨ Successfully created ${tasks.length} tasks!\n`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
