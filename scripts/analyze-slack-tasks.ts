import { PrismaClient, ConnectionStatus } from '@prisma/client';
import { classifyMessageAsTask } from '../lib/ai-task-classifier';
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

  // Get Slack connection
  const connection = await prisma.integrationConnection.findUnique({
    where: {
      userId_provider: {
        userId: user.id,
        provider: 'SLACK',
      },
    },
  });

  if (!connection || connection.status !== ConnectionStatus.CONNECTED || !connection.encryptedAccessToken) {
    console.error('No active Slack connection found. Please connect Slack first.');
    return;
  }

  const tokenSecret = process.env.APP_ENCRYPTION_KEY;
  if (!tokenSecret) {
    console.error('APP_ENCRYPTION_KEY not found in environment');
    return;
  }

  let token: string;
  try {
    token = decryptToken(connection.encryptedAccessToken, tokenSecret);
  } catch (error) {
    console.error('Failed to decrypt Slack token:', error);
    return;
  }

  const userId = connection.accountId || process.env.SLACK_TARGET_USER_ID;

  console.log('\n🔍 Fetching Slack messages...\n');

  // Fetch conversations
  const conversationsResponse = await fetch(
    'https://slack.com/api/conversations.list?types=im,mpim',
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const conversationsData = await conversationsResponse.json();

  if (!conversationsData.ok) {
    console.error('Failed to fetch conversations:', conversationsData.error);
    return;
  }

  const tasks: Array<{
    message: string;
    sender: string;
    isTask: boolean;
    taskTitle: string;
    confidence: number;
    reason: string;
  }> = [];

  let messageCount = 0;

  // Check each conversation
  for (const conversation of conversationsData.channels || []) {
    const historyResponse = await fetch(
      `https://slack.com/api/conversations.history?channel=${conversation.id}&limit=50`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const historyData = await historyResponse.json();

    if (!historyData.ok) continue;

    for (const message of historyData.messages || []) {
      if (!message.text || message.user === userId) continue;

      messageCount++;

      // Get sender name
      const userResponse = await fetch(
        `https://slack.com/api/users.info?user=${message.user}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const userData = await userResponse.json();
      const senderName = userData.ok ? userData.user.real_name : message.user;

      // Clean text
      const text = message.text
        .replace(/<@[A-Z0-9]+>/g, '')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .trim();

      console.log(`Analyzing message ${messageCount}: "${text.substring(0, 60)}..."`);

      // Use AI to classify
      const classification = await classifyMessageAsTask(text, {
        isMention: text.includes(userId || ''),
        isDm: conversation.is_im || false,
        sender: senderName,
      });

      tasks.push({
        message: text,
        sender: senderName,
        ...classification,
      });

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`\n\n✅ Analyzed ${messageCount} messages\n`);
  console.log('=' .repeat(80));
  console.log('\n📋 IDENTIFIED TASKS:\n');

  const identifiedTasks = tasks.filter((t) => t.isTask);

  if (identifiedTasks.length === 0) {
    console.log('No pending tasks found.');
  } else {
    identifiedTasks.forEach((task, index) => {
      console.log(`${index + 1}. ${task.taskTitle}`);
      console.log(`   From: ${task.sender}`);
      console.log(`   Confidence: ${Math.round(task.confidence * 100)}%`);
      console.log(`   Reason: ${task.reason}`);
      console.log(`   Original: "${task.message.substring(0, 100)}${task.message.length > 100 ? '...' : ''}"`);
      console.log();
    });

    console.log(`\n✨ Found ${identifiedTasks.length} actionable tasks!\n`);
  }

  console.log('=' .repeat(80));
  console.log('\n📊 REJECTED MESSAGES:\n');

  const rejected = tasks.filter((t) => !t.isTask);
  rejected.slice(0, 10).forEach((task, index) => {
    console.log(`${index + 1}. "${task.message.substring(0, 80)}${task.message.length > 80 ? '...' : ''}"`);
    console.log(`   Reason: ${task.reason}\n`);
  });

  if (rejected.length > 10) {
    console.log(`... and ${rejected.length - 10} more non-task messages\n`);
  }
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
