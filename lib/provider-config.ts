import { Provider } from "@prisma/client";

export type ProviderConfig = {
  provider: Provider;
  label: string;
  description: string;
  scopes: string[];
  userScopes?: string[];
};

export const PROVIDER_CONFIG: ProviderConfig[] = [
  {
    provider: "SLACK",
    label: "Slack",
    description: "Read activity and draft/schedule posts",
    scopes: [
      "chat:write"
    ],
    userScopes: [
      "channels:read",
      "groups:read",
      "im:read",
      "users:read",
      "channels:history",
      "groups:history",
      "im:history"
    ]
  },
  {
    provider: "MICROSOFT",
    label: "Microsoft Outlook",
    description: "Read calendar and mail signals",
    scopes: ["offline_access", "User.Read", "Mail.Read", "Calendars.Read"]
  },
  {
    provider: "ATLASSIAN",
    label: "Atlassian (Jira + Confluence)",
    description: "Review approvals and update Confluence",
    scopes: [
      "read:jira-work",
      "write:jira-work",
      "search:confluence",
      "write:confluence-content"
    ]
  }
];
