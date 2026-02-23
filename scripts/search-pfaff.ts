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

  console.log(`\n🔍 Searching for Andrew Pfaff...\n`);

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

  // Search for Pfaff
  const pfaffUsers = allUsers.filter((u: any) => {
    const realName = (u.real_name || '').toLowerCase();
    const email = (u.profile?.email || '').toLowerCase();
    const userName = (u.name || '').toLowerCase();

    return realName.includes('pfaff') || email.includes('pfaff') || userName.includes('pfaff');
  });

  if (pfaffUsers.length === 0) {
    console.log('❌ No users found with "Pfaff" in their name\n');
  } else {
    console.log(`✅ Found ${pfaffUsers.length} user(s) with "Pfaff":\n`);

    for (const u of pfaffUsers) {
      console.log(`  • ${u.real_name || u.name}`);
      console.log(`    Username: @${u.name}`);
      console.log(`    User ID: ${u.id}`);
      console.log(`    Email: ${u.profile?.email || 'N/A'}`);
      console.log(`    Status: ${u.deleted ? '❌ Deleted' : u.is_bot ? '🤖 Bot' : '✅ Active'}`);
      console.log();

      // Check for DM
      const convResponse = await fetch(
        'https://slack.com/api/conversations.list?types=im&exclude_archived=true&limit=1000',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const convData = await convResponse.json();

      if (convData.ok) {
        const dm = convData.channels?.find((c: any) => c.is_im && c.user === u.id);

        if (dm) {
          console.log(`  ✅ Found DM channel: ${dm.id}`);

          // Check for messages
          const histResp = await fetch(
            `https://slack.com/api/conversations.history?channel=${dm.id}&limit=10`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const histData = await histResp.json();

          if (histData.ok && histData.messages?.length > 0) {
            console.log(`  📨 Found ${histData.messages.length} messages`);
            const lastMsg = histData.messages[0];
            const lastMsgDate = new Date(parseFloat(lastMsg.ts) * 1000);
            console.log(`  Last message: ${lastMsgDate.toLocaleString()}`);
            console.log(`  Preview: "${lastMsg.text?.substring(0, 80)}..."`);
          }
        } else {
          console.log(`  ❌ No DM channel found`);
        }
      }
      console.log();
    }
  }

  // Also search for users with tyme.com email and first name starting with D
  console.log(`\n🔍 Searching for users with "@tyme.com" email starting with "D" (for possible "Tyla D.")...\n`);

  const tymeUsers = allUsers.filter((u: any) => {
    const email = (u.profile?.email || '').toLowerCase();
    const realName = (u.real_name || '').toLowerCase();

    return email.includes('@tyme.com') &&
           !u.deleted &&
           !u.is_bot &&
           (realName.startsWith('d') || realName.includes(' d'));
  });

  console.log(`Found ${tymeUsers.length} @tyme.com users with names starting with or containing "D":\n`);

  tymeUsers.slice(0, 20).forEach((u: any) => {
    console.log(`  • ${u.real_name} - ${u.profile?.email}`);
  });
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
