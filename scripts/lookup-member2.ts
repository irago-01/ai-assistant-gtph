import { PrismaClient } from '@prisma/client';
import { decryptToken } from '../lib/crypto';

const prisma = new PrismaClient();

async function main() {
  const memberId = 'U07JJS3A69J';

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

  console.log(`\n🔍 Looking up member: ${memberId}\n`);

  const userResp = await fetch(
    `https://slack.com/api/users.info?user=${memberId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const userData = await userResp.json();

  if (userData.ok) {
    const u = userData.user;
    console.log(`✅ Found user!\n`);
    console.log(`   Name: ${u.real_name || u.name}`);
    console.log(`   Username: @${u.name}`);
    console.log(`   User ID: ${u.id}`);
    console.log(`   Email: ${u.profile?.email || 'N/A'}`);
    console.log(`   Display Name: ${u.profile?.display_name || 'N/A'}`);
    console.log(`   Status: ${u.deleted ? '❌ Deleted' : u.is_bot ? '🤖 Bot' : '✅ Active'}`);
    console.log();

    // Check for DM
    console.log(`🔍 Checking for DM with this user...\n`);

    const convResponse = await fetch(
      'https://slack.com/api/conversations.list?types=im&exclude_archived=true&limit=1000',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const convData = await convResponse.json();

    if (convData.ok) {
      const dm = convData.channels?.find((c: any) => c.is_im && c.user === memberId);

      if (dm) {
        console.log(`✅ Found DM channel: ${dm.id}\n`);

        // Check for messages
        const histResp = await fetch(
          `https://slack.com/api/conversations.history?channel=${dm.id}&limit=5`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const histData = await histResp.json();

        if (histData.ok && histData.messages?.length > 0) {
          console.log(`📨 Found ${histData.messages.length} recent messages:`);

          for (const msg of histData.messages.slice(0, 5)) {
            const timestamp = new Date(parseFloat(msg.ts) * 1000);
            const isFromMe = msg.user === myUserId;
            console.log(`\n   ${timestamp.toLocaleString()} - ${isFromMe ? 'YOU' : u.real_name}`);
            console.log(`   "${msg.text?.substring(0, 100)}${msg.text?.length > 100 ? '...' : ''}"`);
          }
        } else {
          console.log(`❌ No messages found in DM`);
        }
      } else {
        console.log(`❌ No DM channel found with this user`);
      }
    }
  } else {
    console.log(`❌ User not found: ${userData.error}`);
  }
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
