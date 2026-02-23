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

  console.log(`\n🔍 Searching for Andrew and Tyla...\n`);

  // Fetch all conversations including those without recent messages
  const conversationsResponse = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel,private_channel,mpim,im&exclude_archived=true&limit=1000',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await conversationsResponse.json();

  if (!data.ok) {
    console.error('Error:', data.error);
    return;
  }

  console.log(`Found ${data.channels?.length || 0} total conversations\n`);

  const dms = data.channels?.filter((c: any) => c.is_im) || [];
  const groupChats = data.channels?.filter((c: any) => c.is_mpim) || [];

  console.log(`💬 Direct Messages: ${dms.length}`);
  console.log(`👥 Group Chats (MPIMs): ${groupChats.length}\n`);

  // Check each DM for Andrew or Tyla
  console.log(`\n🔍 Searching DMs for Andrew or Tyla...\n`);
  for (const dm of dms) {
    const userResp = await fetch(
      `https://slack.com/api/users.info?user=${dm.user}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const userData = await userResp.json();

    if (userData.ok) {
      const name = userData.user.real_name || userData.user.name || '';
      if (name.toLowerCase().includes('andrew') || name.toLowerCase().includes('tyla')) {
        console.log(`✅ Found DM with: ${name}`);
        console.log(`   Channel ID: ${dm.id}`);

        // Check latest message
        const historyResp = await fetch(
          `https://slack.com/api/conversations.history?channel=${dm.id}&limit=1`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const historyData = await historyResp.json();

        if (historyData.ok && historyData.messages?.length > 0) {
          const lastMsg = historyData.messages[0];
          const lastMsgDate = new Date(parseFloat(lastMsg.ts) * 1000);
          console.log(`   Last message: ${lastMsgDate.toLocaleString()}`);
          console.log(`   Preview: "${lastMsg.text?.substring(0, 60)}..."`);
        } else {
          console.log(`   No messages found`);
        }
        console.log();
      }
    }
  }

  // Check each group chat for Andrew AND Tyla
  console.log(`\n🔍 Searching Group Chats for Andrew AND Tyla...\n`);
  for (const gc of groupChats) {
    const membersResp = await fetch(
      `https://slack.com/api/conversations.members?channel=${gc.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const membersData = await membersResp.json();

    if (membersData.ok) {
      const memberNames: string[] = [];
      let hasAndrew = false;
      let hasTyla = false;

      for (const memberId of membersData.members || []) {
        const userResp = await fetch(
          `https://slack.com/api/users.info?user=${memberId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const userData = await userResp.json();

        if (userData.ok) {
          const name = userData.user.real_name || userData.user.name || '';
          memberNames.push(name);
          if (name.toLowerCase().includes('andrew')) hasAndrew = true;
          if (name.toLowerCase().includes('tyla')) hasTyla = true;
        }
      }

      if (hasAndrew && hasTyla) {
        console.log(`⭐ Found Group Chat with Andrew AND Tyla!`);
        console.log(`   Name: ${gc.name || gc.id}`);
        console.log(`   Channel ID: ${gc.id}`);
        console.log(`   Members: ${memberNames.join(', ')}`);

        // Check latest message
        const historyResp = await fetch(
          `https://slack.com/api/conversations.history?channel=${gc.id}&limit=1`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const historyData = await historyResp.json();

        if (historyData.ok && historyData.messages?.length > 0) {
          const lastMsg = historyData.messages[0];
          const lastMsgDate = new Date(parseFloat(lastMsg.ts) * 1000);
          console.log(`   Last message: ${lastMsgDate.toLocaleString()}`);
          console.log(`   Preview: "${lastMsg.text?.substring(0, 60)}..."`);
        } else {
          console.log(`   No messages found`);
        }
        console.log();
      }
    }
  }

  // Check private and public channels
  const channels = data.channels?.filter((c: any) => !c.is_im && !c.is_mpim) || [];
  console.log(`\n🔍 Searching Channels (${channels.length} total) for Andrew AND Tyla...\n`);

  let foundCount = 0;
  for (const channel of channels) {
    // Only check if user is a member
    if (!channel.is_member) continue;

    const membersResp = await fetch(
      `https://slack.com/api/conversations.members?channel=${channel.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const membersData = await membersResp.json();

    if (membersData.ok) {
      const memberNames: string[] = [];
      let hasAndrew = false;
      let hasTyla = false;

      for (const memberId of (membersData.members || []).slice(0, 50)) {
        const userResp = await fetch(
          `https://slack.com/api/users.info?user=${memberId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const userData = await userResp.json();

        if (userData.ok) {
          const name = userData.user.real_name || userData.user.name || '';
          memberNames.push(name);
          if (name.toLowerCase().includes('andrew')) hasAndrew = true;
          if (name.toLowerCase().includes('tyla')) hasTyla = true;
        }
      }

      if (hasAndrew && hasTyla) {
        foundCount++;
        console.log(`⭐ Found Channel with Andrew AND Tyla!`);
        console.log(`   Type: ${channel.is_private ? '🔒 Private' : '📢 Public'}`);
        console.log(`   Name: #${channel.name || channel.id}`);
        console.log(`   Channel ID: ${channel.id}`);
        console.log(`   Members (showing first 50): ${memberNames.join(', ')}`);

        // Check latest message
        const historyResp = await fetch(
          `https://slack.com/api/conversations.history?channel=${channel.id}&limit=1`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const historyData = await historyResp.json();

        if (historyData.ok && historyData.messages?.length > 0) {
          const lastMsg = historyData.messages[0];
          const lastMsgDate = new Date(parseFloat(lastMsg.ts) * 1000);
          console.log(`   Last message: ${lastMsgDate.toLocaleString()}`);
          console.log(`   Preview: "${lastMsg.text?.substring(0, 60)}..."`);
        } else {
          console.log(`   No messages found`);
        }
        console.log();
      }
    }
  }

  console.log(`\n📊 Summary: Found ${foundCount} channel(s) with both Andrew and Tyla\n`);
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
