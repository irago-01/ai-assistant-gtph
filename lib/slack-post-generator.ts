import { DraftTone } from "@prisma/client";

type SlackPostResult = {
  message: string;
  ctas: string[];
};

const tonePrefix: Record<DraftTone, string> = {
  INFORMATIVE: "Update",
  EXCITED: "Big win",
  EXECUTIVE_SUMMARY: "Summary",
  CASUAL: "Quick note"
};

const toneStyle: Record<DraftTone, string[]> = {
  INFORMATIVE: ["clear", "structured", "neutral"],
  EXCITED: ["energetic", "celebratory", "high-momentum"],
  EXECUTIVE_SUMMARY: ["concise", "decision-ready", "impact-first"],
  CASUAL: ["friendly", "simple", "lightweight"]
};

export function generateSlackPost(topic: string, tone: DraftTone): SlackPostResult {
  const prefix = tonePrefix[tone];
  const style = toneStyle[tone];

  const message = [
    `*${prefix}: ${topic}*`,
    "",
    `- Why this matters: improves execution speed across the team in a ${style[0]} way.`,
    `- What changed: rolled out a ${style[1]} workflow pattern with reusable steps.`,
    `- Next step: use this template for your next request to keep outcomes ${style[2]}.`,
    "",
    "Link: <insert-link>",
    ""
  ].join("\n");

  const ctas = [
    "Reply with your use-case and I will map it to a workflow.",
    "Drop a \"+1\" if you want the walkthrough recording.",
    "Share one blocker and I will include it in next week's demo."
  ];

  return { message, ctas };
}
