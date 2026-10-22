import { getAgentByName } from "agents";
import { WorkersAITTS } from "agents/voice";
import { Hono } from "hono";
import { speakableText, VOICE_SPEAK_CHARS } from "../shared";
import type { AuthVariables } from "./auth";
import { safeError } from "./log";

/**
 * A finished job's answer read aloud, when an admin has turned voice on
 * (Settings > Jobs). The Agents SDK's WorkersAITTS (Deepgram Aura 1) turns
 * the text into MP3, billed per character. Under /api, so Access has checked
 * who is listening. Dictation is Org's voice input instead (org.ts).
 */
export const voiceRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

voiceRoutes.post("/speak", async (c) => {
  const org = await getAgentByName(c.env.Org, c.get("orgId"));
  if (!(await org.voiceEnabled())) {
    return c.json({ error: "Voice is turned off. An admin can turn it on in Settings > Jobs." }, 403);
  }
  const { runId } = await c.req.json<{ runId?: string }>().catch(() => ({ runId: undefined }));
  const summary = typeof runId === "string" ? await org.answerToSpeak(runId) : null;
  const text = summary ? speakableText(summary).slice(0, VOICE_SPEAK_CHARS) : "";
  if (!text) {
    return c.json({ error: "This job has no answer to read yet." }, 404);
  }
  try {
    const audio = await new WorkersAITTS(c.env.AI).synthesize(text, c.req.raw.signal);
    if (!audio) {
      throw new Error("No audio returned");
    }
    return new Response(audio, { headers: { "cache-control": "no-store", "content-type": "audio/mpeg" } });
  } catch (error) {
    console.warn("Reading aloud failed", safeError(error));
    return c.json({ error: "powerhouse could not read that aloud. Try again." }, 502);
  }
});
