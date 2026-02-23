import { PrismaClient, ConnectionStatus } from '@prisma/client';
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
  const myUserId = connection.accountId || process.env.SLACK_TARGET_USER_ID;

  console.log(`\n🔍 Your Slack User ID: ${myUserId}\n`);

  // Fetch conversations
  const conversationsResponse = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel,private_channel,mpim,im&exclude_archived=true&limit=500',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await conversationsResponse.json();

  if (!data.ok) {
    console.error('Error:', data.error);
    return;
  }

  console.log(`\n📊 CONVERSATION BREAKDOWN:\n`);

  const dms = data.channels?.filter((c: any) => c.is_im) || [];
  const groupChats = data.channels?.filter((c: any) => c.is_mpim) || [];
  const privateChannels = data.channels?.filter((c: any) => c.is_private && !c.is_im && !c.is_mpim) || [];
  const publicChannels = data.channels?.filter((c: any) => !c.is_private && !c.is_im && !c.is_mpim) || [];

  console.log(`💬 Direct Messages (DMs): ${dms.length}`);
  console.log(`👥 Group Chats (MPIMs): ${groupChats.length}`);
  console.log(`🔒 Private Channels: ${privateChannels.length}`);
  console.log(`📢 Public Channels: ${publicChannels.length}`);

  console.log(`\n\n👥 GROUP CHATS:\n`);
  for (const gc of groupChats) {
    // Get members
    const membersResponse = await fetch(
      `https://slack.com/api/conversations.members?channel=${gc.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const membersData = await membersResponse.json();

    if (membersData.ok) {
      const memberNames = await Promise.all(
        membersData.members.slice(0, 5).map(async (userId: string) => {
          const userResp = await fetch(
            `https://slack.com/api/users.info?user=${userId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const userData = await userResp.json();
          return userData.ok ? userData.user.real_name || userData.user.name : userId;
        })
      );

      console.log(`  • ${gc.name || gc.id}`);
      console.log(`    Members: ${memberNames.join(', ')}`);

      // Check if it has Andrew and Tyla
      const hasAndrew = memberNames.some((n: string) => n.toLowerCase().includes('andrew'));
      const hasTyla = memberNames.some((n: string) => n.toLowerCase().includes('tyla'));
      if (hasAndrew && hasTyla) {
        console.log(`    ⭐ THIS IS THE ANDREW & TYLA GROUP!`);
      }
    }
  }

  console.log(`\n\n💬 RECENT DMs (showing first 10):\n`);
  for (const dm of dms.slice(0, 10)) {
    const userResp = await fetch(
      `https://slack.com/api/users.info?user=${dm.user}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const userData = await userResp.json();
    const userName = userData.ok ? userData.user.real_name || userData.user.name : dm.user;
    console.log(`  • ${userName} (${dm.id})`);
  }
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
