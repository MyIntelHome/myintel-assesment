import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the environment (set in Vercel project settings).
// The key stays on the server and is never sent to the browser.
const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "AI analysis not configured" });
    return;
  }

  try {
    const { roomLabel, photos } = req.body || {};
    if (!Array.isArray(photos) || photos.length === 0) {
      res.status(400).json({ error: "No photos provided" });
      return;
    }

    const photoContents = photos.slice(0, 3).map(p => ({
      type: "image",
      source: { type: "base64", media_type: p.mimeType, data: p.data },
    }));

    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          ...photoContents,
          {
            type: "text",
            text: `You are a CAPS-certified occupational therapist conducting a home safety assessment of the ${roomLabel || "room"}. Analyze these photos for safety hazards, accessibility issues, and aging-in-place risks.

Return ONLY a JSON object, no markdown, no explanation:
{
  "findings": [
    { "severity": "danger", "text": "description" },
    { "severity": "warning", "text": "description" },
    { "severity": "info", "text": "description" }
  ],
  "myintel": ["sensor recommendation 1", "sensor recommendation 2"]
}

severity rules: danger = immediate fall/injury risk needing action now. warning = moderate concern, should address. info = observation or future consideration.
Max 5 findings. myintel array should reference specific smart home sensor types (motion, fall detection, lighting automation, door/entry sensors, occupancy).
If image quality is too low or no hazards visible, return empty findings array.`,
          },
        ],
      }],
    });

    const text = (message.content || []).map(c => c.text || "").join("");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    res.status(200).json(parsed);
  } catch (err) {
    console.error("analyze error:", err);
    res.status(500).json({ error: "Analysis failed" });
  }
}
