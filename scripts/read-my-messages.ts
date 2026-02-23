import { PrismaClient } from '@prisma/client';
import { decryptToken } from '../lib/crypto';

const prisma = new PrismaClient();

// Cache for user display names
const userCache = new Map<string, string>();

async function slackGet(token: string, endpoint: string, params?: Record<string, string>) {
  const url = new URL(`https://slack.com/api/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error || 'Unknown'}`);
  }
  return data;
}

async function getUserDisplayName(token: string, userId: string | null): Promise<string> {
  if (!userId) return 'Unknown';
  if (userCache.has(userId)) return userCache.get(userId)!;

  try {
    const response = await slackGet(token, 'users.info', { user: userId });
    const name = response.user?.profile?.display_name || response.user?.real_name || response.user?.name || 'Unknown';
    userCache.set(userId, name);
    return name;
  } catch {
    return 'Unknown';
  }
}

async function main() {
  // Get user's Slack token
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      provider: 'SLACK',
      status: 'CONNECTED',
    },
  });

  if (!connection || !connection.encryptedAccessToken) {
    console.log('No active Slack connection found.');
    return;
  }

  const tokenSecret = process.env.APP_ENCRYPTION_KEY;
  if (!tokenSecret) {
    console.log('APP_ENCRYPTION_KEY not found in environment.');
    return;
  }

  const token = decryptToken(connection.encryptedAccessToken, tokenSecret);

  // Get authenticated user info
  const authTest = await slackGet(token, 'auth.test');
  const myUserId = authTest.user_id;
  console.log(`\n=== Messages sent by: ${authTest.user} (${myUserId}) ===\n`);

  // Get all conversations
  const convResponse = await slackGet(token, 'users.conversations', {
    types: 'public_channel,private_channel,mpim,im',
    limit: '200',
  });

  const conversations = convResponse.channels || [];
  const allMyMessages: Array<{
    text: string;
    ts: string;
    channel: string;
    channelName: string;
    isDm: boolean;
    dmUserId?: string;
    time: Date;
  }> = [];

  // Fetch messages from each conversation (increased to fetch more)
  for (const conv of conversations.slice(0, 50)) {
    try {
      const oldest = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // 30 days ago
      const history = await slackGet(token, 'conversations.history', {
        channel: conv.id,
        oldest: oldest.toString(),
        limit: '200',
      });

      const myMessages = (history.messages || [])
        .filter((msg: any) => msg.user === myUserId && msg.type === 'message' && !msg.subtype)
        .map((msg: any) => ({
          text: msg.text || '',
          ts: msg.ts,
          channel: conv.id,
          channelName: conv.is_im ? 'DM' : conv.name ? `#${conv.name}` : 'Unknown',
          isDm: conv.is_im,
          dmUserId: conv.is_im ? conv.user : undefined,
          time: new Date(parseFloat(msg.ts) * 1000),
        }));

      allMyMessages.push(...myMessages);
    } catch (err: any) {
      // Skip errors silently for channels we can't access
    }
  }

  // Sort by time descending
  allMyMessages.sort((a, b) => b.time.getTime() - a.time.getTime());

  console.log(`📤 Found ${allMyMessages.length} messages you sent (last 30 days)\n`);

  for (const msg of allMyMessages) {
    let recipient = msg.channelName;

    // For DMs, get the recipient's name
    if (msg.isDm && msg.dmUserId) {
      const recipientName = await getUserDisplayName(token, msg.dmUserId);
      recipient = `DM to ${recipientName}`;
    }

    const preview = msg.text.length > 300 ? msg.text.slice(0, 300) + '...' : msg.text;
    console.log(`\n📤 To: ${recipient}`);
    console.log(`   Time: ${msg.time.toLocaleString()}`);
    console.log(`   Message: ${preview}`);
  }

  console.log(`\n\n=== Total: ${allMyMessages.length} messages ===`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
