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

  console.log(`\n🔍 Searching for "Tyla" variations (Tyla, Tyra, Tyler, Tila, etc.)...\n`);

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
  const searchTerms = ['tyla', 'tyra', 'tyler', 'tila', 'tayla', 'thyla'];

  const matchingUsers = allUsers.filter((u: any) => {
    if (u.deleted || u.is_bot) return false;

    const realName = (u.real_name || '').toLowerCase();
    const displayName = (u.profile?.display_name || '').toLowerCase();
    const userName = (u.name || '').toLowerCase();
    const fullText = `${realName} ${displayName} ${userName}`;

    return searchTerms.some(term => fullText.includes(term));
  });

  if (matchingUsers.length === 0) {
    console.log('❌ No users found matching Tyla variations\n');
    console.log('Showing users with names starting with "T":\n');

    allUsers
      .filter((u: any) => !u.deleted && !u.is_bot && u.real_name)
      .filter((u: any) => u.real_name.toLowerCase().startsWith('t'))
      .slice(0, 20)
      .forEach((u: any) => {
        console.log(`  • ${u.real_name} (@${u.name})`);
      });
  } else {
    console.log(`✅ Found ${matchingUsers.length} user(s):\n`);

    matchingUsers.forEach((u: any) => {
      console.log(`  • ${u.real_name || u.name}`);
      console.log(`    Username: @${u.name}`);
      console.log(`    Display Name: ${u.profile?.display_name || 'N/A'}`);
      console.log();
    });
  }

  // Now check if Andrew has any DMs
  console.log(`\n\n🔍 Checking for DMs or channels with Andrew Ryan Penas (U02NYE77Y6T)...\n`);

  const convResponse = await fetch(
    'https://slack.com/api/conversations.list?types=im,mpim,private_channel,public_channel&exclude_archived=true&limit=1000',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const convData = await convResponse.json();

  if (convData.ok) {
    // Check DMs
    const andrewDm = convData.channels?.find((c: any) => c.is_im && c.user === 'U02NYE77Y6T');

    if (andrewDm) {
      console.log(`✅ Found DM with Andrew Ryan Penas`);
      console.log(`   Channel ID: ${andrewDm.id}`);

      const histResp = await fetch(
        `https://slack.com/api/conversations.history?channel=${andrewDm.id}&limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const histData = await histResp.json();

      if (histData.ok && histData.messages?.length > 0) {
        console.log(`   Found ${histData.messages.length} recent messages`);
        const lastMsg = histData.messages[0];
        const lastMsgDate = new Date(parseFloat(lastMsg.ts) * 1000);
        console.log(`   Last message: ${lastMsgDate.toLocaleString()}`);
      }
    } else {
      console.log(`❌ No DM found with Andrew Ryan Penas`);
    }

    // Check channels where Andrew is a member
    console.log(`\n🔍 Checking channels where you and Andrew are both members...\n`);

    let foundChannels = 0;
    for (const channel of convData.channels || []) {
      if (!channel.is_member) continue;
      if (channel.is_im) continue;

      const membersResp = await fetch(
        `https://slack.com/api/conversations.members?channel=${channel.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const membersData = await membersResp.json();

      if (membersData.ok && membersData.members?.includes('U02NYE77Y6T')) {
        foundChannels++;
        console.log(`  • #${channel.name || channel.id} (${channel.is_private ? 'Private' : 'Public'})`);

        if (foundChannels >= 10) {
          console.log(`  ... and more`);
          break;
        }
      }
    }

    console.log(`\nTotal: ${foundChannels} shared channel(s)`);
  }
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
