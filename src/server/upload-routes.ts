import { getAgentByName } from "agents";
import { Hono } from "hono";
import { UPLOAD_LIMITS } from "../shared";
import type { AuthVariables } from "./auth";
import { safeError } from "./log";

/**
 * Files a member attaches to a job (the composer's paperclip). Under /api,
 * so Access has checked who is uploading. The file becomes text here, the
 * way the Agents SDK's web_fetch reads documents: text formats as they are,
 * everything else through Workers AI Markdown Conversion (env.AI.toMarkdown,
 * free for documents). Only the text is kept, in Org; the file is not.
 */
export const uploadRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

/** Read as they are: converting them would gain nothing. */
const TEXT_TYPES = /^(text\/|application\/(json|xml|x-ndjson|csv)\b)/i;
const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|ndjson|xml|ya?ml|log)$/i;

uploadRoutes.post("/", async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "Attach a file." }, 400);
  }
  if (file.size > UPLOAD_LIMITS.bytes) {
    return c.json({ error: `${file.name} is larger than ${UPLOAD_LIMITS.bytes / 1_000_000} MB.` }, 413);
  }
  const name = (file.name || "file").replace(/[\r\n"]/g, " ").slice(0, UPLOAD_LIMITS.name);
  if (file.type.startsWith("image/")) {
    // Describing an image runs billed models; left out until it is a choice.
    return c.json({ error: `${name} is an image. Images are not supported yet; attach documents or text.` }, 415);
  }
  let text: string;
  try {
    text = TEXT_TYPES.test(file.type) || TEXT_EXTENSIONS.test(name) ? await file.text() : await convert(c.env, name, file);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 422);
  }
  if (!text.trim()) {
    return c.json({ error: `${name} has no text powerhouse can read.` }, 422);
  }
  try {
    const org = await getAgentByName(c.env.Org, c.get("orgId"));
    return c.json(await org.saveUpload(c.get("email"), name, text));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});

async function convert(env: Env, name: string, file: File) {
  let result: ConversionResponse;
  try {
    result = await env.AI.toMarkdown({ blob: file, name });
  } catch (error) {
    console.warn("Converting an upload failed", safeError(error));
    throw new Error(`powerhouse could not read ${name}. Try a PDF, a Word or Excel document, or a text file.`);
  }
  if (result.format === "error") {
    throw new Error(`powerhouse could not read ${name}: ${result.error}`);
  }
  return result.data;
}
