import { PrismaClient } from '@prisma/client';
import { decryptToken } from '../lib/crypto';

const prisma = new PrismaClient();

async function main() {
  const memberId = 'U08DTE9M4BS';

  const user = await prisma.user.findFirst({
    where: { email: process.env.DEMO_USER_EMAIL || 'owner@workos.local' },
  });

  if (!user) return;

  const connection = await prisma.integrationConnection.findUnique({
    where: { userId_provider: { userId: user.id, provider: 'SLACK' } },
  });

  if (!connection || !connection.encryptedAccessToken) return;

  const token = decryptToken(connection.encryptedAccessToken, process.env.APP_ENCRYPTION_KEY!);

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
  } else {
    console.log(`❌ User not found: ${userData.error}`);
  }
}

main()
  .catch((e) => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
