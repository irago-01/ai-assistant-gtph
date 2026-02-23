import { PrismaClient } from '@prisma/client';
import { decryptToken } from '../lib/crypto';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: process.env.DEMO_USER_EMAIL || 'owner@workos.local' },
  });

  if (!user) {
    console.error('User not found!');
    return;
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: { userId_provider: { userId: user.id, provider: 'SLACK' } },
  });

  if (!connection || !connection.encryptedAccessToken) {
    console.error('No Slack connection');
    return;
  }

  const token = decryptToken(connection.encryptedAccessToken, process.env.APP_ENCRYPTION_KEY!);

  console.log(`\n🔍 Searching for users with "Andrew" or "Tyla" in their names...\n`);

  // Fetch all users
  const usersResponse = await fetch(
    'https://slack.com/api/users.list?limit=1000',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await usersResponse.json();

  if (!data.ok) {
    console.error('Error:', data.error);
    return;
  }

  const allUsers = data.members || [];
  console.log(`Total users in workspace: ${allUsers.length}\n`);

  const matchingUsers = allUsers.filter((u: any) => {
    const realName = (u.real_name || '').toLowerCase();
    const displayName = (u.profile?.display_name || '').toLowerCase();
    const userName = (u.name || '').toLowerCase();

    return realName.includes('andrew') || realName.includes('tyla') ||
           displayName.includes('andrew') || displayName.includes('tyla') ||
           userName.includes('andrew') || userName.includes('tyla');
  });

  if (matchingUsers.length === 0) {
    console.log('❌ No users found with "Andrew" or "Tyla" in their names\n');
    console.log('Showing sample of users in workspace:\n');

    allUsers.slice(0, 20).forEach((u: any) => {
      if (!u.deleted && !u.is_bot && u.real_name) {
        console.log(`  • ${u.real_name} (@${u.name})`);
      }
    });
  } else {
    console.log(`✅ Found ${matchingUsers.length} user(s):\n`);

    matchingUsers.forEach((u: any) => {
      console.log(`  • ${u.real_name || u.name}`);
      console.log(`    Username: @${u.name}`);
      console.log(`    User ID: ${u.id}`);
      console.log(`    Display Name: ${u.profile?.display_name || 'N/A'}`);
      console.log(`    Status: ${u.deleted ? '❌ Deleted' : u.is_bot ? '🤖 Bot' : '✅ Active'}`);
      console.log();
    });
  }
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
