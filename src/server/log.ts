/**
 * An error, reduced to what is safe to log. AI SDK errors carry the whole
 * request (`requestBodyValues`: the conversation, the company profile,
 * connection results) and logging the object would write it to Workers
 * Logs even with TRACE_PAYLOADS off.
 */
export function safeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: String(error).slice(0, 500) };
  }
  const e = error as Error & { status?: number; statusCode?: number; code?: unknown };
  return {
    message: e.message.slice(0, 500),
    name: e.name,
    ...(e.status ?? e.statusCode ? { status: e.status ?? e.statusCode } : {}),
    ...(typeof e.code === "string" ? { code: e.code } : {}),
  };
}
