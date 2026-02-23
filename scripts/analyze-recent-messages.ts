import { PrismaClient } from '@prisma/client';
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
    where: { userId_provider: { userId: user.id, provider: 'SLACK' } },
  });

  if (!connection || !connection.encryptedAccessToken) {
    console.error('No Slack connection');
    return;
  }

  const token = decryptToken(connection.encryptedAccessToken, process.env.APP_ENCRYPTION_KEY!);
  const myUserId = connection.accountId || process.env.SLACK_TARGET_USER_ID;

  console.log(`\n🔍 Analyzing messages from last 20 days...\n`);

  // Calculate timestamp for 20 days ago
  const twentyDaysAgo = Math.floor(Date.now() / 1000) - 20 * 24 * 60 * 60;

  // Fetch all conversations
  const conversationsResponse = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel,private_channel,mpim,im&exclude_archived=true&limit=500',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await conversationsResponse.json();

  if (!data.ok) {
    console.error('Error:', data.error);
    return;
  }

  const allTasks: Array<any> = [];
  let conversationsChecked = 0;
  let conversationsWithRecentMessages = 0;

  for (const conversation of data.channels || []) {
    conversationsChecked++;

    // Check latest message timestamp first
    const historyResponse = await fetch(
      `https://slack.com/api/conversations.history?channel=${conversation.id}&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const historyData = await historyResponse.json();

    if (!historyData.ok || !historyData.messages || historyData.messages.length === 0) {
      continue;
    }

    const latestMessageTs = parseFloat(historyData.messages[0].ts);

    // Skip if no recent messages
    if (latestMessageTs < twentyDaysAgo) {
      continue;
    }

    conversationsWithRecentMessages++;

    // Check if this has Andrew and Tyla
    let hasAndrew = false;
    let hasTyla = false;
    const convName = conversation.name || conversation.id;

    if (conversation.is_channel || conversation.is_private) {
      const membersResponse = await fetch(
        `https://slack.com/api/conversations.members?channel=${conversation.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const membersData = await membersResponse.json();

      if (membersData.ok) {
        for (const memberId of membersData.members || []) {
          const userResp = await fetch(
            `https://slack.com/api/users.info?user=${memberId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const userData = await userResp.json();
          if (userData.ok) {
            const name = userData.user.real_name || userData.user.name || '';
            if (name.toLowerCase().includes('andrew')) hasAndrew = true;
            if (name.toLowerCase().includes('tyla')) hasTyla = true;
          }
        }
      }
    }

    const isAndrewTylaChat = hasAndrew && hasTyla;

    console.log(`\n📂 ${conversation.is_private ? '🔒' : '📢'} ${convName}${isAndrewTylaChat ? ' ⭐ ANDREW & TYLA!' : ''}`);

    // Fetch recent messages (limit to 100 most recent)
    const fullHistoryResponse = await fetch(
      `https://slack.com/api/conversations.history?channel=${conversation.id}&limit=100&oldest=${twentyDaysAgo}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const fullHistoryData = await fullHistoryResponse.json();

    if (!fullHistoryData.ok) {
      console.log(`  ❌ Can't access: ${fullHistoryData.error}`);
      continue;
    }

    let messageCount = 0;
    let taskCount = 0;

    for (const message of fullHistoryData.messages || []) {
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
        isDm: conversation.is_im || false,
        sender: senderName,
      });

      if (classification.isTask) {
        taskCount++;
        allTasks.push({
          channel: convName,
          channelType: conversation.is_private ? 'Private' : conversation.is_im ? 'DM' : conversation.is_mpim ? 'Group' : 'Public',
          isAndrewTylaChat,
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
  console.log(`\n📈 SUMMARY:`);
  console.log(`   Checked ${conversationsChecked} conversations`);
  console.log(`   Found ${conversationsWithRecentMessages} with messages in last 20 days`);
  console.log(`   Identified ${allTasks.length} tasks\n`);
  console.log(`${'='.repeat(100)}`);

  // Show Andrew & Tyla tasks first
  const andrewTylaTasks = allTasks.filter((t) => t.isAndrewTylaChat);
  if (andrewTylaTasks.length > 0) {
    console.log(`\n⭐ TASKS FROM ANDREW & TYLA GROUP (${andrewTylaTasks.length}):\n`);
    andrewTylaTasks.forEach((task, i) => {
      console.log(`\n${i + 1}. ${task.taskTitle}`);
      console.log(`   📍 #${task.channel}`);
      console.log(`   👤 ${task.sender}`);
      console.log(`   📅 ${task.timestamp}`);
      console.log(`   💪 ${Math.round(task.confidence * 100)}% confidence`);
      console.log(`   📝 "${task.message.substring(0, 120)}${task.message.length > 120 ? '...' : ''}"`);
    });
  }

  // Show all other tasks
  const otherTasks = allTasks.filter((t) => !t.isAndrewTylaChat);
  if (otherTasks.length > 0) {
    console.log(`\n\n🎯 ALL OTHER TASKS (${otherTasks.length}):\n`);
    otherTasks.forEach((task, i) => {
      console.log(`\n${i + 1}. ${task.taskTitle}`);
      console.log(`   📍 [${task.channelType}] #${task.channel}`);
      console.log(`   👤 ${task.sender}`);
      console.log(`   📅 ${task.timestamp}`);
      console.log(`   💪 ${Math.round(task.confidence * 100)}% confidence`);
      console.log(`   📝 "${task.message.substring(0, 120)}${task.message.length > 120 ? '...' : ''}"`);
    });
  }

  console.log(`\n${'='.repeat(100)}\n`);
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
