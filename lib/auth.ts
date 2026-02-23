import { prisma } from "@/lib/prisma";

const demoEmail = process.env.DEMO_USER_EMAIL ?? "owner@workos.local";

export async function getCurrentUser() {
  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      name: "Work OS Owner",
      settings: {
        create: {
          keyChannels: ["#ai-enablement", "#automation-requests"],
          keyPeople: ["vp-product@company.com", "cto@company.com"],
          execSenders: ["cto@company.com", "ceo@company.com"],
          keywords: ["ASAP", "urgent", "EOD", "blocking"],
          workingHourStart: 9,
          workingHourEnd: 18,
          taskMin: 8,
          taskMax: 20,
          slackWeight: 0.4,
          emailWeight: 0.35,
          calendarWeight: 0.25
        }
      }
    },
    include: {
      settings: true
    }
  });

  return user;
}
