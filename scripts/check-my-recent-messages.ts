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
  const myUserId = connection.accountId || process.env.SLACK_TARGET_USER_ID;

  console.log(`\n🔍 Fetching YOUR most recent messages...\n`);
  console.log(`Your User ID: ${myUserId}\n`);

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

  const allMyMessages: Array<{
    channel: string;
    channelType: string;
    text: string;
    timestamp: Date;
    recipient?: string;
  }> = [];

  console.log(`Checking ${data.channels?.length || 0} conversations...\n`);

  for (const conversation of data.channels || []) {
    // Only check channels where user is a member or DMs
    if (!conversation.is_member && !conversation.is_im) continue;

    const convName = conversation.name || conversation.id;

    // Fetch recent messages
    const historyResponse = await fetch(
      `https://slack.com/api/conversations.history?channel=${conversation.id}&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const historyData = await historyResponse.json();

    if (!historyData.ok) continue;

    // Find messages from you
    for (const message of historyData.messages || []) {
      if (message.user === myUserId && message.text && !message.subtype) {
        // Get recipient name if DM
        let recipientName = '';
        if (conversation.is_im) {
          const userResp = await fetch(
            `https://slack.com/api/users.info?user=${conversation.user}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const userData = await userResp.json();
          recipientName = userData.ok ? userData.user?.real_name || userData.user?.name : conversation.user;
        }

        allMyMessages.push({
          channel: convName,
          channelType: conversation.is_im ? 'DM' : conversation.is_private ? 'Private' : conversation.is_mpim ? 'Group' : 'Public',
          text: message.text,
          timestamp: new Date(parseFloat(message.ts) * 1000),
          recipient: recipientName || undefined,
        });
      }
    }
  }

  // Sort by timestamp (most recent first)
  allMyMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  console.log(`\n📨 YOUR ${Math.min(50, allMyMessages.length)} MOST RECENT MESSAGES:\n`);
  console.log('='.repeat(100));

  allMyMessages.slice(0, 50).forEach((msg, index) => {
    console.log(`\n${index + 1}. ${msg.timestamp.toLocaleString()}`);

    if (msg.channelType === 'DM' && msg.recipient) {
      console.log(`   📍 [DM] To: ${msg.recipient}`);
    } else {
      console.log(`   📍 [${msg.channelType}] #${msg.channel}`);
    }

    const cleanText = msg.text
      .replace(/<@[A-Z0-9]+>/g, '@user')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .trim();

    console.log(`   💬 "${cleanText.substring(0, 150)}${cleanText.length > 150 ? '...' : ''}"`);
  });

  console.log(`\n${'='.repeat(100)}`);
  console.log(`\nTotal messages from you found: ${allMyMessages.length}\n`);
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
