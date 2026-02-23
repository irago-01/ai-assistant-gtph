import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const feeds = await prisma.activityFeed.findMany({
    where: {
      source: 'SLACK',
    },
    orderBy: {
      eventAt: 'desc'
    },
    take: 20,
    select: {
      title: true,
      body: true,
      isMention: true,
      isDm: true,
      eventAt: true,
    }
  });

  console.log('\n=== RECENT SLACK MESSAGES ===\n');
  for (const feed of feeds) {
    console.log(`Title: ${feed.title}`);
    console.log(`Body (first 200 chars): ${feed.body?.substring(0, 200)}`);
    console.log(`Type: ${feed.isMention ? 'Mention' : ''} ${feed.isDm ? 'DM' : ''}`);
    console.log(`Date: ${feed.eventAt}`);
    console.log('---\n');
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
