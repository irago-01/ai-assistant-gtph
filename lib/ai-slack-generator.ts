import OpenAI from "openai";
import { DraftTone } from "@prisma/client";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

type SlackPostResult = {
  message: string;
  ctas: string[];
};

const TONE_DESCRIPTIONS: Record<DraftTone, string> = {
  INFORMATIVE: "professional, clear, and structured - focus on facts and actionable information",
  EXCITED: "enthusiastic, energetic, and celebratory - emphasize wins and positive momentum",
  EXECUTIVE_SUMMARY: "concise, high-level, and decision-ready - lead with impact and key takeaways",
  CASUAL: "friendly, conversational, and approachable - keep it light and easy to digest",
};

/**
 * Generate engaging Slack messages using AI with proper formatting and emojis
 */
export async function generateSlackPostWithAI(
  topic: string,
  tone: DraftTone
): Promise<SlackPostResult> {
  try {
    const toneDescription = TONE_DESCRIPTIONS[tone];

    const prompt = `You are a Slack message expert. Generate an engaging Slack post about: "${topic}"

Tone: ${tone} (${toneDescription})

Requirements:
1. Start with a compelling headline using *bold* (use * asterisks for Slack bold formatting)
2. Include 3-4 relevant emojis throughout (but don't overdo it)
3. Use bullet points (•) for key information
4. Keep it concise: 3-5 sentences max
5. Make it engaging and action-oriented
6. Use Slack formatting: *bold*, _italic_, \`code\` where appropriate
7. No markdown headers (#), use *bold text* instead
8. End with a clear call-to-action or next step

Also suggest 3 call-to-action options that encourage engagement (replies, reactions, follow-ups).

Respond ONLY with valid JSON in this exact format:
{
  "message": "The full Slack message with emojis and formatting",
  "ctas": ["CTA option 1", "CTA option 2", "CTA option 3"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert at writing engaging Slack messages. Generate Slack-ready messages with proper formatting and relevant emojis. Respond only with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const text = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(text.trim());

    return {
      message: result.message || generateFallbackMessage(topic, tone),
      ctas: result.ctas || generateFallbackCTAs(),
    };
  } catch (error) {
    console.error("AI Slack generation error:", error);
    return generateFallbackMessage(topic, tone);
  }
}

/**
 * Fallback message generation when AI fails
 */
function generateFallbackMessage(topic: string, tone: DraftTone): SlackPostResult {
  const toneEmojis: Record<DraftTone, string> = {
    INFORMATIVE: "📢",
    EXCITED: "🎉",
    EXECUTIVE_SUMMARY: "📊",
    CASUAL: "👋",
  };

  const emoji = toneEmojis[tone];

  const message = `${emoji} *${topic}*

• This is an important update for the team
• We've made progress on key initiatives
• Next steps will be shared soon

💬 Questions? Feel free to reach out!`;

  return {
    message,
    ctas: generateFallbackCTAs(),
  };
}

/**
 * Fallback CTAs when AI fails
 */
function generateFallbackCTAs(): string[] {
  return [
    "Reply with your thoughts or questions",
    "React with 👍 if this is helpful",
    "Share your experience in the thread",
  ];
}
