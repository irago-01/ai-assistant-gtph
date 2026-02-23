import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

interface TaskClassification {
  isTask: boolean;
  taskTitle: string;
  confidence: number;
  reason: string;
}

export async function classifyMessageAsTask(
  message: string,
  context: { isMention: boolean; isDm: boolean; sender?: string }
): Promise<TaskClassification> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a task classifier. Respond only with valid JSON.",
        },
        {
          role: "user",
          content: `Analyze this Slack message and determine if it's a REAL work task that requires action from the recipient.

Message: "${message}"
Context: ${context.isDm ? "Direct message" : "Mention"} ${context.sender ? `from ${context.sender}` : ""}

Classification rules:
- ACCEPT: Clear requests for help, action, approval, review, or information directed AT the recipient
- REJECT: Greetings, casual conversation, statements without requests, announcements, FYI messages

Respond ONLY with valid JSON:
{
  "isTask": boolean,
  "taskTitle": "clean task title (15-80 chars, no formatting, just the action needed)",
  "confidence": 0-100,
  "reason": "brief explanation"
}`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(text.trim());

    return {
      isTask: result.isTask,
      taskTitle: result.taskTitle || "",
      confidence: result.confidence / 100,
      reason: result.reason || "",
    };
  } catch (error) {
    console.error("AI classification error:", error);
    // Fallback to conservative rejection on error
    return {
      isTask: false,
      taskTitle: "",
      confidence: 0,
      reason: "AI classification failed",
    };
  }
}
