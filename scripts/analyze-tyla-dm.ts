import { PrismaClient } from '@prisma/client';
import { classifyMessageAsTask } from '../lib/ai-task-classifier';
import { decryptToken } from '../lib/crypto';

const prisma = new PrismaClient();

async function main() {
  const channelId = 'D08U814U4G5'; // Tyla's DM

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

  console.log(`\n🔍 Analyzing DM with Tyla Duligal...\n`);

  // Fetch messages
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

      const senderName = senderId === 'U07JJS3A69J' ? 'Tyla Duligal' : 'Ira Go';
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
          isDm: true,
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
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
