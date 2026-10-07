/*
    Proxies that run the agent loop server-side (e.g. wl-openai-proxy) replay
    the loop to the client as markdown:

    ```tool_call
    { "id": "...", "name": "read_file_lines", "arguments": { ... } }
    ```
    ```javascript
    <tool result>
    ```

    Rendered as-is, every call and result becomes a full code block, and a
    result in a ```markdown block makes patchNestedMarkdown swallow the rest of
    the message. This collapses each call (and the result block directly after
    it) into a single ~~~proxy_tool block holding a JSON payload, which the
    markdown preview renders as a compact, collapsible tool call.
*/

export const PROXY_TOOL_LANG = "proxy_tool";

const TOOL_CALL_FENCE = "```tool_call";

export type ProxyToolStatus = "running" | "done" | "error";

export interface ProxyToolPayload {
  name: string;
  args: Record<string, unknown> | string;
  result?: string;
  resultLang?: string;
  status: ProxyToolStatus;
}

function isBareFence(line: string): boolean {
  return line.trim() === "```";
}

function isResultFence(line: string): boolean {
  return /^```[\w+.#-]*\s*$/.test(line) && line.trim() !== TOOL_CALL_FENCE;
}

function parseToolCall(text: string): Pick<ProxyToolPayload, "name" | "args"> {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        name: typeof parsed.name === "string" ? parsed.name : "",
        args: parsed.arguments ?? {},
      };
    }
  } catch {
    // Incomplete (still streaming) or malformed JSON
  }
  const name = text.match(/"name"\s*:\s*"([^"]*)"/)?.[1] ?? "";
  return { name, args: {} };
}

function toBlock(payload: ProxyToolPayload): string[] {
  // JSON.stringify output is a single line, so it can never close the fence
  return [`~~~${PROXY_TOOL_LANG}`, JSON.stringify(payload), "~~~"];
}

export const collapseProxyToolTraces = (source: string): string => {
  if (!source.includes(TOOL_CALL_FENCE)) {
    return source;
  }

  // Segments glued without a newline produce lines like "``````tool_call"
  const lines = source.replace(/^```(?=```\w)/gm, "```\n").split("\n");
  const out: string[] = [];
  let insideOtherBlock = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (insideOtherBlock) {
      if (isBareFence(line)) {
        insideOtherBlock = false;
      }
      out.push(line);
      i++;
      continue;
    }

    if (line.trim() !== TOOL_CALL_FENCE) {
      if (line.trimStart().startsWith("```")) {
        insideOtherBlock = true;
      }
      out.push(line);
      i++;
      continue;
    }

    // Tool call block
    let callEnd = i + 1;
    while (callEnd < lines.length && !isBareFence(lines[callEnd])) {
      callEnd++;
    }
    const call = parseToolCall(lines.slice(i + 1, callEnd).join("\n"));

    if (callEnd >= lines.length) {
      // Call is still streaming
      out.push(...toBlock({ ...call, status: "running" }));
      break;
    }

    const resultStart = callEnd + 1;
    if (resultStart >= lines.length || !isResultFence(lines[resultStart])) {
      // No result (yet)
      out.push(
        ...toBlock({
          ...call,
          status: resultStart >= lines.length ? "running" : "done",
        }),
      );
      i = resultStart;
      continue;
    }

    let resultEnd = resultStart + 1;
    while (resultEnd < lines.length && !isBareFence(lines[resultEnd])) {
      resultEnd++;
    }
    const result = lines.slice(resultStart + 1, resultEnd).join("\n");
    const resultLang = lines[resultStart].trim().slice(3) || undefined;
    const finished = resultEnd < lines.length;

    out.push(
      ...toBlock({
        ...call,
        result,
        resultLang,
        status: !finished
          ? "running"
          : /^(Error|エラー)/.test(result.trim())
            ? "error"
            : "done",
      }),
    );
    i = resultEnd + 1;
  }

  return out.join("\n");
};

export function parseProxyToolPayload(
  content: string | undefined,
): ProxyToolPayload | undefined {
  if (!content) {
    return undefined;
  }
  try {
    const payload = JSON.parse(content);
    if (payload && typeof payload.name === "string") {
      return payload;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * One-line summary of the arguments, e.g. `filepath=app.js, start_line=1`
 */
export function summarizeProxyToolArgs(
  args: ProxyToolPayload["args"],
  maxLength = 80,
): string {
  if (typeof args === "string") {
    return truncate(args, maxLength);
  }
  const parts = Object.entries(args).map(([key, value]) => {
    let text: string;
    if (typeof value === "string") {
      // Show file names rather than full paths
      text =
        /^(\/|[A-Za-z]:\\)/.test(value) && !/\s/.test(value)
          ? (value.split(/[\\/]/).filter(Boolean).pop() ?? value)
          : value;
    } else {
      text = JSON.stringify(value);
    }
    return `${key}=${truncate(text.replace(/\s+/g, " "), 40)}`;
  });
  return truncate(parts.join(", "), maxLength);
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength - 1) + "…" : text;
}
