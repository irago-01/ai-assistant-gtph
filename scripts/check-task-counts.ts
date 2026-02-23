import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Count total TaskCard records
  const totalTaskCards = await prisma.taskCard.count();

  // Count TaskCards on the latest board
  const latestBoard = await prisma.taskBoard.findFirst({
    orderBy: { generatedAt: 'desc' },
    include: { tasks: true }
  });

  // Count total ActivityFeed records
  const totalActivityFeed = await prisma.activityFeed.count();

  // Get analytics events
  const analyticsEvents = await prisma.analyticsEvent.findMany({
    where: { eventType: 'TASKS_GENERATED' },
    orderBy: { createdAt: 'desc' }
  });

  console.log('\n📊 Task Counts:');
  console.log(`  Total TaskCard records in database: ${totalTaskCards}`);
  console.log(`  TaskCards on latest board: ${latestBoard?.tasks.length || 0}`);
  console.log(`  Total ActivityFeed records: ${totalActivityFeed}`);
  console.log(`\n📈 Analytics Events (TASKS_GENERATED):`);
  console.log(`  Total events: ${analyticsEvents.length}`);
  console.log(`  Sum of all values: ${analyticsEvents.reduce((sum, e) => sum + e.numericValue, 0)}`);

  if (analyticsEvents.length > 0) {
    console.log(`\n  Recent events:`);
    analyticsEvents.slice(0, 5).forEach((e, i) => {
      console.log(`    ${i + 1}. ${e.createdAt.toISOString()}: ${e.numericValue} tasks`);
    });
  }

  console.log(`\n📋 Latest Board Details:`);
  if (latestBoard) {
    console.log(`  Generated at: ${latestBoard.generatedAt.toISOString()}`);
    console.log(`  Tasks by column:`);
    const byColumn = latestBoard.tasks.reduce((acc, task) => {
      acc[task.column] = (acc[task.column] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    Object.entries(byColumn).forEach(([col, count]) => {
      console.log(`    ${col}: ${count}`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
