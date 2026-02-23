import OpenAI from "openai";
import { ActivityFeed } from "@prisma/client";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export type DemoTopic = {
  title: string;
  outline: string[];
  targetAudience: string;
  prepMinutes: number;
  tags: string[];
};

/**
 * Generate demo topics using AI based on recent messages and manual keywords
 */
export async function generateDemoTopicsWithAI(
  recentMessages: ActivityFeed[] = [],
  manualKeywords: string[] = []
): Promise<DemoTopic[]> {
  try {
    // Prepare message context
    const messageContext = recentMessages
      .slice(0, 20)
      .map((msg) => msg.title)
      .filter(Boolean)
      .join("\n- ");

    const keywordContext = manualKeywords.length > 0
      ? `Manual keywords/topics to focus on: ${manualKeywords.join(", ")}`
      : "";

    const prompt = `You are a demo planner assistant. Based on recent work messages and requested topics, generate 10-12 practical demo topics for live sessions.

${messageContext ? `Recent work messages:\n- ${messageContext}\n` : ""}
${keywordContext}

Generate demo topics that:
1. Are practical and actionable
2. Address real work needs from the messages
3. Include the manual keywords/topics if provided
4. Mix technical builds with adoption/strategy sessions
5. Target different audience types (technical builders, business users, leadership)

Respond ONLY with valid JSON in this exact format:
{
  "topics": [
    {
      "title": "Demo topic title (60-90 chars)",
      "outline": ["3-5 bullet points describing the demo flow"],
      "targetAudience": "Who this demo is for",
      "prepMinutes": 30-60,
      "tags": ["2-5 relevant tags"]
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2000,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are an expert demo planner. Generate practical, relevant demo topics. Respond only with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const text = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(text.trim());

    return result.topics || [];
  } catch (error) {
    console.error("AI demo generation error:", error);
    return generateFallbackTopics(manualKeywords);
  }
}

/**
 * Fallback topic generation when AI fails
 */
function generateFallbackTopics(keywords: string[]): DemoTopic[] {
  const defaultTopics: DemoTopic[] = [
    {
      title: "AI Tools for Workflow Automation",
      outline: [
        "Identify repetitive tasks in your workflow",
        "Demo: Build an AI-powered automation",
        "Adoption checklist and ROI tracking",
      ],
      targetAudience: "Cross-functional team leads",
      prepMinutes: 40,
      tags: ["ai", "automation", "productivity"],
    },
    {
      title: "n8n Workflow Building for Non-Technical Users",
      outline: [
        "Understanding n8n interface and nodes",
        "Live build: Simple approval workflow",
        "Troubleshooting common issues",
      ],
      targetAudience: "Business users and operations teams",
      prepMinutes: 45,
      tags: ["n8n", "workflows", "no-code"],
    },
  ];

  // If keywords provided, create custom topics
  if (keywords.length > 0) {
    return keywords.map((keyword, idx) => ({
      title: `${capitalize(keyword)}: Practical Applications and Demo`,
      outline: [
        `Introduction to ${keyword} and its benefits`,
        `Live demonstration: ${keyword} in action`,
        "Q&A and next steps for implementation",
      ],
      targetAudience: "General audience",
      prepMinutes: 35 + idx * 5,
      tags: [keyword.toLowerCase(), "demo", "practical"],
    }));
  }

  return defaultTopics;
}

function capitalize(value: string): string {
  if (!value.length) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
