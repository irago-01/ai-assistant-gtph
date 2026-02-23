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

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      userId_provider: { userId: user.id, provider: 'SLACK' },
    },
  });

  if (!connection || connection.status !== ConnectionStatus.CONNECTED || !connection.encryptedAccessToken) {
    console.error('No active Slack connection found.');
    return;
  }

  const tokenSecret = process.env.APP_ENCRYPTION_KEY;
  if (!tokenSecret) {
    console.error('APP_ENCRYPTION_KEY not found');
    return;
  }

  let token: string;
  try {
    token = decryptToken(connection.encryptedAccessToken, tokenSecret);
  } catch (error) {
    console.error('Failed to decrypt token:', error);
    return;
  }

  const myUserId = connection.accountId || process.env.SLACK_TARGET_USER_ID;

  console.log('\n🔍 Fetching ALL Slack conversations...\n');

  // Fetch all conversation types: public channels, private channels, DMs, and group DMs
  const conversationsResponse = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel,private_channel,mpim,im&exclude_archived=true&limit=500',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const conversationsData = await conversationsResponse.json();

  if (!conversationsData.ok) {
    console.error('Failed to fetch conversations:', conversationsData.error);
    return;
  }

  console.log(`Found ${conversationsData.channels?.length || 0} conversations\n`);

  const allMessages: Array<{
    conversation: string;
    sender: string;
    message: string;
    timestamp: string;
    isTask: boolean;
    taskTitle: string;
    confidence: number;
    reason: string;
  }> = [];

  // Find group chat with Andrew P. and Tyla D.
  const targetGroupChat = conversationsData.channels?.find((c: any) =>
    c.is_mpim && (c.name?.includes('andrew') || c.name?.includes('tyla'))
  );

  if (targetGroupChat) {
    console.log(`\n📱 Found group chat: ${targetGroupChat.name}\n`);
  }

  for (const conversation of conversationsData.channels || []) {
    const convName = conversation.name || conversation.id;
    const isGroupChatWithAndrewTyla = conversation.id === targetGroupChat?.id;

    // Prioritize: DMs, group chat with Andrew/Tyla, and other important conversations
    if (!conversation.is_im && !conversation.is_mpim && !isGroupChatWithAndrewTyla) {
      continue; // Skip regular channels for now
    }

    console.log(`\n📂 Analyzing: ${convName}${isGroupChatWithAndrewTyla ? ' (Andrew P. & Tyla D.)' : ''}`);

    const historyResponse = await fetch(
      `https://slack.com/api/conversations.history?channel=${conversation.id}&limit=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const historyData = await historyResponse.json();

    if (!historyData.ok) {
      console.log(`  ❌ Failed to fetch history: ${historyData.error}`);
      continue;
    }

    for (const message of historyData.messages || []) {
      if (!message.text || message.subtype) continue;

      const senderId = message.user;
      const isFromMe = senderId === myUserId;

      // Get sender name
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
        .replace(/`([^`]+)`/g, '$1')
        .trim();

      if (text.length < 10) continue;

      // Classify with AI
      const classification = await classifyMessageAsTask(text, {
        isMention: text.includes(myUserId || ''),
        isDm: conversation.is_im || false,
        sender: senderName,
      });

      allMessages.push({
        conversation: convName,
        sender: `${senderName}${isFromMe ? ' (YOU)' : ''}`,
        message: text,
        timestamp: new Date(parseFloat(message.ts) * 1000).toISOString(),
        ...classification,
      });

      console.log(`  ${classification.isTask ? '✅ TASK' : '⚪ Not task'}: "${text.substring(0, 60)}..."`);

      await new Promise((resolve) => setTimeout(resolve, 300)); // Rate limiting
    }
  }

  console.log(`\n\n${'='.repeat(100)}`);
  console.log('\n🎯 IDENTIFIED TASKS:\n');

  const tasks = allMessages.filter((m) => m.isTask);

  if (tasks.length === 0) {
    console.log('No tasks found.');
  } else {
    tasks.forEach((task, index) => {
      console.log(`\n${index + 1}. ${task.taskTitle}`);
      console.log(`   📍 ${task.conversation}`);
      console.log(`   👤 From: ${task.sender}`);
      console.log(`   📅 ${new Date(task.timestamp).toLocaleString()}`);
      console.log(`   💪 Confidence: ${Math.round(task.confidence * 100)}%`);
      console.log(`   📝 Original: "${task.message.substring(0, 150)}${task.message.length > 150 ? '...' : ''}"`);
    });

    console.log(`\n\n✨ Total tasks found: ${tasks.length}`);
  }

  console.log(`\n${'='.repeat(100)}\n`);
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
