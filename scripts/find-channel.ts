import { PrismaClient } from '@prisma/client';
import { classifyMessageAsTask } from '../lib/ai-task-classifier';
import { decryptToken } from '../lib/crypto';

const prisma = new PrismaClient();

async function main() {
  const channelId = 'D08K43056HF';

  const user = await prisma.user.findFirst({
    where: { email: process.env.DEMO_USER_EMAIL || 'owner@workos.local' },
  });

  if (!user) return;

  const connection = await prisma.integrationConnection.findUnique({
    where: { userId_provider: { userId: user.id, provider: 'SLACK' } },
  });

  if (!connection || !connection.encryptedAccessToken) return;

  const token = decryptToken(connection.encryptedAccessToken, process.env.APP_ENCRYPTION_KEY!);
  const myUserId = connection.accountId || process.env.SLACK_TARGET_USER_ID;

  console.log(`\n🔍 Looking up channel: ${channelId}\n`);

  // Try to get conversation info
  const infoResponse = await fetch(
    `https://slack.com/api/conversations.info?channel=${channelId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const infoData = await infoResponse.json();

  if (infoData.ok) {
    const conv = infoData.channel;
    console.log(`✅ Found conversation!\n`);
    console.log(`   Type: ${conv.is_im ? '💬 Direct Message' : conv.is_mpim ? '👥 Group Chat' : conv.is_private ? '🔒 Private Channel' : '📢 Public Channel'}`);
    console.log(`   ID: ${conv.id}`);
    console.log(`   Name: ${conv.name || 'N/A'}`);

    if (conv.is_im) {
      // Get the other user's info
      const userResp = await fetch(
        `https://slack.com/api/users.info?user=${conv.user}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const userData = await userResp.json();
      if (userData.ok) {
        console.log(`   👤 DM with: ${userData.user.real_name || userData.user.name}`);
        console.log(`   Email: ${userData.user.profile?.email || 'N/A'}`);
      }
    } else if (conv.is_mpim) {
      console.log(`   👥 Group members:`);
      const membersResp = await fetch(
        `https://slack.com/api/conversations.members?channel=${channelId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const membersData = await membersResp.json();

      if (membersData.ok) {
        for (const memberId of membersData.members || []) {
          const userResp = await fetch(
            `https://slack.com/api/users.info?user=${memberId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const userData = await userResp.json();
          if (userData.ok) {
            const isYou = memberId === myUserId;
            console.log(`      • ${userData.user.real_name || userData.user.name}${isYou ? ' (YOU)' : ''}`);
          }
        }
      }
    }

    console.log();

    // Fetch messages
    console.log(`\n📨 Fetching messages...\n`);

    const historyResponse = await fetch(
      `https://slack.com/api/conversations.history?channel=${channelId}&limit=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const historyData = await historyResponse.json();

    if (historyData.ok) {
      const messages = historyData.messages || [];
      console.log(`Found ${messages.length} messages\n`);

      const tasks: any[] = [];

      for (const message of messages) {
        if (!message.text || message.subtype) continue;

        const senderId = message.user;
        if (!senderId) continue;

        // Get sender info
        const userResp = await fetch(
          `https://slack.com/api/users.info?user=${senderId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const userData = await userResp.json();
        const senderName = userData.ok ? userData.user?.real_name || userData.user?.name : senderId;
        const isFromMe = senderId === myUserId;

        // Clean text
        const text = message.text
          .replace(/<@[A-Z0-9]+>/g, '')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/_([^_]+)_/g, '$1')
          .trim();

        const timestamp = new Date(parseFloat(message.ts) * 1000);

        console.log(`${timestamp.toLocaleString()} - ${senderName}${isFromMe ? ' (YOU)' : ''}`);
        console.log(`   "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

        // Classify with AI if substantial message
        if (text.length >= 15) {
          const classification = await classifyMessageAsTask(text, {
            isMention: false,
            isDm: conv.is_im || false,
            sender: senderName,
          });

          if (classification.isTask) {
            console.log(`   ✅ TASK: ${classification.taskTitle} (${Math.round(classification.confidence * 100)}% confidence)`);
            tasks.push({
              sender: `${senderName}${isFromMe ? ' (YOU)' : ''}`,
              timestamp,
              ...classification,
              message: text,
            });
          }
        }

        console.log();

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (tasks.length > 0) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`\n🎯 TASKS FOUND (${tasks.length}):\n`);

        tasks.forEach((task, i) => {
          console.log(`\n${i + 1}. ${task.taskTitle}`);
          console.log(`   👤 ${task.sender}`);
          console.log(`   📅 ${task.timestamp.toLocaleString()}`);
          console.log(`   💪 ${Math.round(task.confidence * 100)}% confidence`);
          console.log(`   📝 "${task.message.substring(0, 120)}${task.message.length > 120 ? '...' : ''}"`);
        });

        console.log(`\n${'='.repeat(100)}\n`);
      } else {
        console.log(`\n❌ No tasks found in this conversation\n`);
      }
    } else {
      console.log(`❌ Could not fetch messages: ${historyData.error}`);
    }
  } else {
    console.log(`❌ Channel not found or no access: ${infoData.error}`);
  }
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
