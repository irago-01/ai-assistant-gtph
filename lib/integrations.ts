import { ConnectionStatus, IntegrationConnection, Provider } from "@prisma/client";

import { encryptToken } from "@/lib/crypto";
import { PROVIDER_CONFIG } from "@/lib/provider-config";
import { prisma } from "@/lib/prisma";

const providerToOAuth = {
  SLACK: {
    authorizeUrl: "https://slack.com/oauth/v2/authorize"
  },
  MICROSOFT: {
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
  },
  ATLASSIAN: {
    authorizeUrl: "https://auth.atlassian.com/authorize"
  }
} as const;

type SlackOAuthResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  team?: {
    id?: string;
    name?: string;
  };
  authed_user?: {
    id?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
};

function getCredentials(provider: Provider) {
  if (provider === "SLACK") {
    return {
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET
    };
  }
  if (provider === "MICROSOFT") {
    return {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET
    };
  }
  return {
    clientId: process.env.ATLASSIAN_CLIENT_ID,
    clientSecret: process.env.ATLASSIAN_CLIENT_SECRET
  };
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function resolveOAuthRedirectBase(requestOrigin?: string) {
  if (requestOrigin) {
    return `${trimTrailingSlash(requestOrigin)}/api/oauth`;
  }

  const configured = process.env.OAUTH_REDIRECT_BASE?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  return "http://localhost:3000/api/oauth";
}

export function resolveAppBaseUrl(requestOrigin?: string) {
  if (requestOrigin) {
    return trimTrailingSlash(requestOrigin);
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  return "http://localhost:3000";
}

export function buildOAuthUrl(
  provider: Provider,
  state: string,
  options?: { requestOrigin?: string }
) {
  const creds = getCredentials(provider);
  if (!creds.clientId) {
    throw new Error(`${provider} client ID missing`);
  }

  const config = PROVIDER_CONFIG.find((item) => item.provider === provider);
  const redirectBase = resolveOAuthRedirectBase(options?.requestOrigin);
  const redirectUri = `${redirectBase}/${provider.toLowerCase()}/callback`;

  if (!config) {
    throw new Error("Provider config missing");
  }

  if (provider === "SLACK") {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      scope: config.scopes.join(","),
      redirect_uri: redirectUri,
      state
    });
    if (config.userScopes && config.userScopes.length > 0) {
      params.set("user_scope", config.userScopes.join(","));
    }

    return `${providerToOAuth[provider].authorizeUrl}?${params.toString()}`;
  }

  if (provider === "MICROSOFT") {
    const params = new URLSearchParams({
      client_id: creds.clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope: config.scopes.join(" "),
      state
    });

    return `${providerToOAuth[provider].authorizeUrl}?${params.toString()}`;
  }

  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: creds.clientId,
    scope: config.scopes.join(" "),
    redirect_uri: redirectUri,
    response_type: "code",
    prompt: "consent",
    state
  });

  return `${providerToOAuth[provider].authorizeUrl}?${params.toString()}`;
}

export async function connectProviderWithCode(input: {
  userId: string;
  provider: Provider;
  code: string;
  requestOrigin?: string;
}) {
  const tokenSecret = process.env.APP_ENCRYPTION_KEY;
  if (!tokenSecret) {
    throw new Error("APP_ENCRYPTION_KEY missing");
  }

  const config = PROVIDER_CONFIG.find((item) => item.provider === input.provider);
  if (!config) {
    throw new Error("Provider config missing");
  }

  const simulatedAccessToken = `demo_access_${input.provider.toLowerCase()}_${input.code.slice(0, 10)}`;
  const simulatedRefreshToken = `demo_refresh_${input.provider.toLowerCase()}_${input.code.slice(-10)}`;

  let accessToken = simulatedAccessToken;
  let refreshToken = simulatedRefreshToken;
  let tokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  let scopes = [...config.scopes];
  let accountName = `${input.provider} account`;

  if (input.provider === "SLACK") {
    const creds = getCredentials("SLACK");
    if (!creds.clientId || !creds.clientSecret) {
      throw new Error("SLACK client credentials missing");
    }

    const redirectBase = resolveOAuthRedirectBase(input.requestOrigin);
    const redirectUri = `${redirectBase}/slack/callback`;

    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code: input.code,
        redirect_uri: redirectUri
      }).toString()
    });

    if (!response.ok) {
      throw new Error(`Slack token exchange failed (${response.status})`);
    }

    const payload = (await response.json()) as SlackOAuthResponse;
    if (!payload.ok) {
      throw new Error(`Slack token exchange error: ${payload.error ?? "unknown_error"}`);
    }

    const authedUserId = payload.authed_user?.id?.trim() || undefined;
    const userAccessToken = payload.authed_user?.access_token?.trim();
    if (!userAccessToken) {
      throw new Error(
        "Slack user token missing. In Slack OAuth settings, configure user scopes and reinstall the app, then reconnect."
      );
    }

    accessToken = userAccessToken;
    if (!accessToken) {
      throw new Error("Slack token exchange returned no access token");
    }

    refreshToken = payload.authed_user?.refresh_token ?? payload.refresh_token ?? simulatedRefreshToken;

    const expiresInSeconds = payload.authed_user?.expires_in ?? payload.expires_in;
    if (expiresInSeconds && Number.isFinite(expiresInSeconds)) {
      tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    }

    const parseScopes = (value?: string) =>
      (value ?? "")
        .split(/[,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);

    const grantedScopes = Array.from(
      new Set([...parseScopes(payload.scope), ...parseScopes(payload.authed_user?.scope)])
    );

    if (grantedScopes.length > 0) {
      scopes = grantedScopes;
    }

    accountName = payload.team?.name
      ? `${payload.team.name} (Slack)`
      : payload.authed_user?.id
        ? `Slack user ${payload.authed_user.id}`
        : "Slack account";

    const connection = await prisma.integrationConnection.upsert({
      where: {
        userId_provider: {
          userId: input.userId,
          provider: input.provider
        }
      },
      update: {
        status: ConnectionStatus.CONNECTED,
        scopes,
        ...(authedUserId ? { accountId: authedUserId } : {}),
        encryptedAccessToken: encryptToken(accessToken, tokenSecret),
        encryptedRefreshToken: encryptToken(refreshToken, tokenSecret),
        tokenExpiresAt,
        accountName
      },
      create: {
        userId: input.userId,
        provider: input.provider,
        status: ConnectionStatus.CONNECTED,
        accountId: authedUserId ?? null,
        scopes,
        encryptedAccessToken: encryptToken(accessToken, tokenSecret),
        encryptedRefreshToken: encryptToken(refreshToken, tokenSecret),
        tokenExpiresAt,
        accountName
      }
    });

    return connection;
  }

  const connection = await prisma.integrationConnection.upsert({
    where: {
      userId_provider: {
        userId: input.userId,
        provider: input.provider
      }
    },
    update: {
      status: ConnectionStatus.CONNECTED,
      scopes,
      encryptedAccessToken: encryptToken(accessToken, tokenSecret),
      encryptedRefreshToken: encryptToken(refreshToken, tokenSecret),
      tokenExpiresAt,
      accountName
    },
    create: {
      userId: input.userId,
      provider: input.provider,
      status: ConnectionStatus.CONNECTED,
      scopes,
      encryptedAccessToken: encryptToken(accessToken, tokenSecret),
      encryptedRefreshToken: encryptToken(refreshToken, tokenSecret),
      tokenExpiresAt,
      accountName
    }
  });

  return connection;
}

export async function getIntegrationStatuses(userId: string) {
  const existing = await prisma.integrationConnection.findMany({
    where: { userId }
  });

  const statusMap = new Map<Provider, IntegrationConnection>(
    existing.map((item) => [item.provider, item])
  );

  return PROVIDER_CONFIG.map((config) => {
    const current = statusMap.get(config.provider);

    return {
      provider: config.provider,
      label: config.label,
      description: config.description,
      requiredScopes: Array.from(new Set([...config.scopes, ...(config.userScopes ?? [])])),
      connected: current?.status === ConnectionStatus.CONNECTED,
      status: current?.status ?? ConnectionStatus.DISCONNECTED,
      accountName: current?.accountName ?? null,
      tokenExpiresAt: current?.tokenExpiresAt ?? null
    };
  });
}

export async function disconnectProvider(userId: string, provider: Provider) {
  return prisma.integrationConnection.upsert({
    where: {
      userId_provider: {
        userId,
        provider
      }
    },
    update: {
      status: ConnectionStatus.DISCONNECTED,
      scopes: [],
      accountId: null,
      accountName: null,
      encryptedAccessToken: null,
      encryptedRefreshToken: null,
      tokenExpiresAt: null
    },
    create: {
      userId,
      provider,
      status: ConnectionStatus.DISCONNECTED,
      scopes: []
    }
  });
}
