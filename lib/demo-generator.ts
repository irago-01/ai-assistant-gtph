import { ActivityFeed } from "@prisma/client";

export type DemoTheme = {
  name: string;
  audience: string;
  tags: string[];
};

const DEFAULT_THEMES: DemoTheme[] = [
  {
    name: "AI tools",
    audience: "Cross-functional team leads",
    tags: ["ai", "productivity", "agents"]
  },
  {
    name: "automation",
    audience: "Operations and enablement teams",
    tags: ["automation", "workflows"]
  },
  {
    name: "n8n workflows",
    audience: "Technical builders and analysts",
    tags: ["n8n", "integrations", "orchestration"]
  },
  {
    name: "prompting",
    audience: "Business users adopting AI",
    tags: ["prompting", "best-practices"]
  },
  {
    name: "internal use-cases",
    audience: "Exec sponsors and project owners",
    tags: ["use-cases", "roi", "change-management"]
  }
];

export type GeneratedDemoTopic = {
  title: string;
  outline: string[];
  targetAudience: string;
  prepMinutes: number;
  tags: string[];
};

type RankedTopic = GeneratedDemoTopic & {
  score: number;
};

export function generateWeeklyDemoTopics(
  themes: DemoTheme[] = DEFAULT_THEMES,
  recentTasks: ActivityFeed[] = [],
  trendingKeywords: string[] = []
): GeneratedDemoTopic[] {
  const taskPhrases = recentTasks
    .slice(0, 15)
    .map((task) => task.title)
    .filter(Boolean);

  const keywordPool = Array.from(new Set(trendingKeywords.map((keyword) => keyword.toLowerCase())));

  const topics: RankedTopic[] = themes.flatMap((theme, index) => {
    return [0, 1, 2].map((variation) => {
      const taskHint = taskPhrases[(index + variation) % Math.max(taskPhrases.length, 1)] ??
        "high-impact workflow";
      const keywordHint = keywordPool[(index + variation) % Math.max(keywordPool.length, 1)] ??
        "automation";

      const title = `${capitalize(theme.name)}: ${humanizeHint(taskHint)} with ${keywordHint}`;
      const outline = [
        `Problem framing: where ${theme.name} currently slows execution`,
        `Live build: implement ${keywordHint} in a practical scenario`,
        "Adoption plan: rollout checklist and measurement"
      ];

      const prepMinutes = 35 + variation * 10 + index * 3;
      const score = 100 - index * 5 - variation * 3 + (keywordPool.length > 0 ? 4 : 0);

      return {
        title,
        outline,
        targetAudience: theme.audience,
        prepMinutes,
        tags: Array.from(new Set([...theme.tags, keywordHint])),
        score
      };
    });
  });

  return topics
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map(({ score: _score, ...topic }) => topic);
}

function humanizeHint(input: string) {
  return input
    .replace(/\s+/g, " ")
    .replace(/[#_]/g, " ")
    .trim();
}

function capitalize(value: string) {
  if (!value.length) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
