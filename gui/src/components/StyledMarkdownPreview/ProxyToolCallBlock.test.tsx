import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../util/test/render";
import StyledMarkdownPreview from ".";

const source = [
  "```tool_call",
  '{ "id": "call_1", "name": "read_file_lines", "arguments": { "filepath": "/p/DESIGN.md" } }',
  "```",
  "```markdown",
  "【DESIGN.md — 全 94 行】 # Title",
  "```",
  "```tool_call",
  '{ "id": "call_2", "name": "fetch_result", "arguments": { "file_id": "f_1", "pattern": "openSNSModal" } }',
  "```",
  "```text",
  "【該当なし】",
  "```",
  "",
  "Final answer",
].join("\n");

describe("StyledMarkdownPreview with proxy tool traces", () => {
  it("renders tool calls as collapsible blocks and keeps the answer as text", async () => {
    const { user } = await renderWithProviders(
      <StyledMarkdownPreview source={source} isRenderingInStepContainer />,
    );

    await waitFor(() =>
      expect(screen.getAllByTestId("proxy-tool-call")).toHaveLength(2),
    );
    expect(screen.getByText("read_file_lines")).toBeInTheDocument();
    expect(screen.getByText("filepath=DESIGN.md")).toBeInTheDocument();
    expect(screen.getByText("Final answer").tagName).toBe("P");
    expect(screen.queryByText(/全 94 行/)).not.toBeInTheDocument();

    await user.click(screen.getByText("read_file_lines"));
    expect(screen.getByText(/全 94 行/)).toBeInTheDocument();
  });
});
