import { PrismaClient, ActivitySource } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const messages = await prisma.activityFeed.findMany({
    where: {
      source: ActivitySource.SLACK,
    },
    orderBy: {
      eventAt: 'desc',
    },
    take: 50,
  });

  console.log(`\n=== Found ${messages.length} Slack Messages ===\n`);

  for (const msg of messages) {
    console.log(`📧 ${msg.title}`);
    console.log(`   From: ${msg.author || 'Unknown'}`);
    console.log(`   Channel: ${msg.channel || 'N/A'}`);
    console.log(`   Time: ${msg.eventAt.toISOString()}`);
    console.log(`   DM: ${msg.isDm ? 'Yes' : 'No'} | Mention: ${msg.isMention ? 'Yes' : 'No'}`);
    if (msg.body && msg.body.length > 0) {
      const preview = msg.body.length > 200 ? msg.body.slice(0, 200) + '...' : msg.body;
      console.log(`   Message: ${preview}`);
    }
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
