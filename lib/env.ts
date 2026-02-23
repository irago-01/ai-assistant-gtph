import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_ENCRYPTION_KEY: z
    .string()
    .min(32, "APP_ENCRYPTION_KEY must be at least 32 characters"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DEMO_USER_EMAIL: z.string().email().default("owner@workos.local"),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  ATLASSIAN_CLIENT_ID: z.string().optional(),
  ATLASSIAN_CLIENT_SECRET: z.string().optional(),
  OAUTH_REDIRECT_BASE: z.string().url().default("http://localhost:3000/api/oauth")
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  DEMO_USER_EMAIL: process.env.DEMO_USER_EMAIL ?? "owner@workos.local",
  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
  ATLASSIAN_CLIENT_ID: process.env.ATLASSIAN_CLIENT_ID,
  ATLASSIAN_CLIENT_SECRET: process.env.ATLASSIAN_CLIENT_SECRET,
  OAUTH_REDIRECT_BASE:
    process.env.OAUTH_REDIRECT_BASE ?? "http://localhost:3000/api/oauth"
});
