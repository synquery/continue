import { describe, expect, it } from "vitest";
import { patchNestedMarkdown } from "./patchNestedMarkdown";
import {
  collapseProxyToolTraces,
  parseProxyToolPayload,
  PROXY_TOOL_LANG,
  ProxyToolPayload,
  summarizeProxyToolArgs,
} from "./proxyToolTrace";

function payloads(markdown: string): ProxyToolPayload[] {
  const lines = markdown.split("\n");
  return lines
    .filter((_, i) => i > 0 && lines[i - 1] === `~~~${PROXY_TOOL_LANG}`)
    .map((line) => parseProxyToolPayload(line)!);
}

const readCall = [
  "```tool_call",
  "{",
  ' "id": "call_1",',
  ' "name": "read_file_lines",',
  ' "arguments": {',
  ' "filepath": "/Users/me/project/DESIGN.md",',
  ' "start_line": 1',
  "}",
  "}",
  "```",
].join("\n");

const markdownResult = [
  "```markdown",
  "【DESIGN.md — 全 94 行】 # Title",
  "```",
].join("\n");

describe("collapseProxyToolTraces", () => {
  it("leaves markdown without tool calls unchanged", () => {
    const source = "Hello\n```ts\nconst a = 1;\n```\n";
    expect(collapseProxyToolTraces(source)).toBe(source);
  });

  it("collapses a tool call and its result into one block", () => {
    const output = collapseProxyToolTraces(
      `${readCall}\n${markdownResult}\n\nAnswer`,
    );
    expect(output).not.toContain("```");
    expect(output.endsWith("\n\nAnswer")).toBe(true);
    expect(payloads(output)).toEqual([
      {
        name: "read_file_lines",
        args: { filepath: "/Users/me/project/DESIGN.md", start_line: 1 },
        result: "【DESIGN.md — 全 94 行】 # Title",
        resultLang: "markdown",
        status: "done",
      },
    ]);
  });

  it("keeps a markdown result from swallowing the rest of the message", () => {
    const source = `${readCall}\n${markdownResult}\n${readCall}\n${markdownResult}\n\nAnswer\n\n\`\`\`bash\nls\n\`\`\``;
    const patched = patchNestedMarkdown(collapseProxyToolTraces(source));
    expect(patched).toContain("\nAnswer\n\n```bash\nls\n```");
  });

  it("marks error results", () => {
    const output = collapseProxyToolTraces(
      `${readCall}\n\`\`\`html\nError: not found\n\`\`\``,
    );
    expect(payloads(output)[0].status).toBe("error");
  });

  it("marks calls that are still streaming as running", () => {
    expect(payloads(collapseProxyToolTraces(readCall.slice(0, 40)))[0]).toEqual(
      { name: "", args: {}, status: "running" },
    );
    expect(payloads(collapseProxyToolTraces(readCall))[0].status).toBe(
      "running",
    );
    expect(
      payloads(collapseProxyToolTraces(`${readCall}\n\`\`\`text\npartial`))[0],
    ).toMatchObject({ status: "running", result: "partial" });
  });

  it("repairs fences glued together without a newline", () => {
    const source = `\`\`\`text\nresult\n\`\`\`${readCall}\n${markdownResult}`;
    const output = collapseProxyToolTraces(source);
    expect(output).not.toContain("``````");
    expect(payloads(output)).toHaveLength(1);
  });

  it("does not touch tool_call fences inside other code blocks", () => {
    const source = `\`\`\`md\nExample:\n${readCall}\n`;
    expect(collapseProxyToolTraces(source)).toBe(source);
  });
});

describe("summarizeProxyToolArgs", () => {
  it("shortens paths and long values", () => {
    expect(
      summarizeProxyToolArgs({
        filepath: "/Users/me/project/src/app.js",
        start_line: 1,
      }),
    ).toBe("filepath=app.js, start_line=1");
    expect(
      summarizeProxyToolArgs({ command: "cp", args: "/a/b.txt /a/c.txt" }),
    ).toBe("command=cp, args=/a/b.txt /a/c.txt");
  });
});
