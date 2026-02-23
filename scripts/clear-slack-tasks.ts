import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all SLACK ActivityFeed entries...');

  const result = await prisma.activityFeed.deleteMany({
    where: {
      source: 'SLACK',
    },
  });

  console.log(`Deleted ${result.count} SLACK messages`);
  console.log('Now regenerate your dashboard to fetch fresh messages with the new filtering!');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
