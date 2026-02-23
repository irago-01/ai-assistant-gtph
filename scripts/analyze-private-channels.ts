import { PrismaClient, ConnectionStatus } from '@prisma/client';
import { classifyMessageAsTask } from '../lib/ai-task-classifier';
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
  const myUserId = connection.accountId || process.env.SLACK_TARGET_USER_ID;

  console.log('\n🔍 Analyzing PRIVATE CHANNEL and PUBLIC CHANNELS with mentions...\n');

  const conversationsResponse = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=500',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await conversationsResponse.json();

  if (!data.ok) {
    console.error('Error:', data.error);
    return;
  }

  const allTasks: Array<any> = [];

  for (const conversation of data.channels || []) {
    // Skip if not private and not a member
    if (!conversation.is_private && !conversation.is_member) {
      continue;
    }

    const convName = conversation.name || conversation.id;
    console.log(`\n📂 ${conversation.is_private ? '🔒' : '📢'} ${convName}`);

    // Fetch messages
    const historyResponse = await fetch(
      `https://slack.com/api/conversations.history?channel=${conversation.id}&limit=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const historyData = await historyResponse.json();

    if (!historyData.ok) {
      console.log(`  ❌ Can't access: ${historyData.error}`);
      continue;
    }

    let messageCount = 0;
    let taskCount = 0;

    for (const message of historyData.messages || []) {
      if (!message.text || message.subtype) continue;

      const senderId = message.user;
      if (!senderId) continue;

      messageCount++;

      // Get sender
      const userResponse = await fetch(
        `https://slack.com/api/users.info?user=${senderId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const userData = await userResponse.json();
      const senderName = userData.ok ? userData.user?.real_name || userData.user?.name : senderId;

      // Clean text
      const text = message.text
        .replace(/<@[A-Z0-9]+>/g, '')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .trim();

      if (text.length < 15) continue;

      // Check if it mentions me or is relevant
      const mentionsMe = message.text.includes(myUserId || '');
      const isFromMe = senderId === myUserId;

      // Classify with AI
      const classification = await classifyMessageAsTask(text, {
        isMention: mentionsMe,
        isDm: false,
        sender: senderName,
      });

      if (classification.isTask) {
        taskCount++;
        allTasks.push({
          channel: convName,
          sender: `${senderName}${isFromMe ? ' (YOU)' : ''}`,
          message: text,
          timestamp: new Date(parseFloat(message.ts) * 1000).toLocaleString(),
          ...classification,
        });
        console.log(`  ✅ TASK: "${text.substring(0, 80)}..."`);
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log(`  📊 ${messageCount} messages analyzed, ${taskCount} tasks found`);
  }

  console.log(`\n\n${'='.repeat(100)}`);
  console.log(`\n🎯 ALL TASKS FOUND (${allTasks.length}):\n`);

  allTasks.forEach((task, i) => {
    console.log(`\n${i + 1}. ${task.taskTitle}`);
    console.log(`   📍 #${task.channel}`);
    console.log(`   👤 ${task.sender}`);
    console.log(`   📅 ${task.timestamp}`);
    console.log(`   💪 ${Math.round(task.confidence * 100)}% confidence`);
    console.log(`   📝 "${task.message.substring(0, 120)}${task.message.length > 120 ? '...' : ''}"`);
  });

  console.log(`\n${'='.repeat(100)}\n`);
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
