import { PrismaClient } from '@prisma/client';
import { decryptToken } from '../lib/crypto';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: process.env.DEMO_USER_EMAIL || 'owner@workos.local' },
  });

  if (!user) return;

  const connection = await prisma.integrationConnection.findUnique({
    where: { userId_provider: { userId: user.id, provider: 'SLACK' } },
  });

  if (!connection || !connection.encryptedAccessToken) return;

  const token = decryptToken(connection.encryptedAccessToken, process.env.APP_ENCRYPTION_KEY!);

  console.log(`\n🔍 Analyzing email domains in workspace...\n`);

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
  const domains = new Map<string, number>();

  allUsers.forEach((u: any) => {
    if (u.deleted || u.is_bot) return;

    const email = u.profile?.email || '';
    if (email) {
      const domain = email.split('@')[1];
      domains.set(domain, (domains.get(domain) || 0) + 1);
    }
  });

  console.log('Top email domains:\n');
  Array.from(domains.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([domain, count]) => {
      console.log(`  ${domain}: ${count} users`);
    });

  // Search specifically for andrew.pfaff
  console.log(`\n\n🔍 Searching for "andrew.pfaff" in all email addresses...\n`);

  const andrewPfaffUser = allUsers.find((u: any) => {
    const email = (u.profile?.email || '').toLowerCase();
    return email.includes('andrew') && email.includes('pfaff');
  });

  if (andrewPfaffUser) {
    console.log(`✅ Found user:`);
    console.log(`  Name: ${andrewPfaffUser.real_name}`);
    console.log(`  Email: ${andrewPfaffUser.profile?.email}`);
    console.log(`  Username: @${andrewPfaffUser.name}`);
    console.log(`  User ID: ${andrewPfaffUser.id}`);
  } else {
    console.log(`❌ No user found with "andrew.pfaff" in email`);

    // Show all Andrews
    console.log(`\n📋 All users with "andrew" in name or email:\n`);
    allUsers
      .filter((u: any) => {
        const name = (u.real_name || '').toLowerCase();
        const email = (u.profile?.email || '').toLowerCase();
        return (name.includes('andrew') || email.includes('andrew')) && !u.deleted && !u.is_bot;
      })
      .forEach((u: any) => {
        console.log(`  • ${u.real_name} - ${u.profile?.email || 'No email'} (@${u.name})`);
      });
  }
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
