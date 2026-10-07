import { describe, expect, it } from "vitest";
import { ProxyTraceStreamNormalizer } from "./proxyTraceStreamNormalizer";

function run(chunks: [number | undefined, string][]): string {
  const normalizer = new ProxyTraceStreamNormalizer();
  return chunks
    .map(([index, content]) => normalizer.push(index, content))
    .join("");
}

const call =
  '\n```tool_call\n{\n "id": "call_1",\n "name": "read_file_lines"\n}\n```';
const result = "\n```text\nok\n```";

describe("ProxyTraceStreamNormalizer", () => {
  it("passes standard single-choice streams through unchanged", () => {
    const chunks: [number | undefined, string][] = [
      [0, "Hello"],
      [0, " world"],
      [0, "\n```ts\nconst a = 1;\n```"],
    ];
    expect(run(chunks)).toBe("Hello world\n```ts\nconst a = 1;\n```");
  });

  it("passes streams without an index through unchanged", () => {
    expect(
      run([
        [undefined, "a"],
        [undefined, "b"],
      ]),
    ).toBe("ab");
  });

  it("drops a replayed trace and keeps the final answer", () => {
    const replay = (call + result).replace(/^\n+/, "");
    const output = run([
      [2, call],
      [3, result],
      [4, replay + "\n\nThe answer"],
    ]);
    expect(output).toBe(call + result + "\n\nThe answer");
  });

  it("drops a replay that is streamed in several chunks", () => {
    const replay = (call + result).replace(/^\n+/, "");
    const output = run([
      [2, call],
      [3, result],
      [4, replay.slice(0, 10)],
      [4, replay.slice(10)],
      [4, "\n\nThe"],
      [4, " answer"],
    ]);
    expect(output).toBe(call + result + "\n\nThe answer");
  });

  it("separates segments that are not newline separated", () => {
    const output = run([
      [2, "```text\nfirst\n```"],
      [3, "```tool_call\n{}\n```"],
    ]);
    expect(output).toBe("```text\nfirst\n```\n```tool_call\n{}\n```");
    expect(output).not.toContain("``````");
  });

  it("drops a segment that ends while still matching a replay", () => {
    const output = run([
      [2, call],
      [3, call.replace(/^\n+/, "").slice(0, 5)],
      [4, "\nDone"],
    ]);
    expect(output).toBe(call + "\nDone");
  });
});
