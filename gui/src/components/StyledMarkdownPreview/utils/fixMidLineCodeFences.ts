/*
    Some models emit a code fence in the middle of a line, e.g.

        I checked the file.```javascript
        const a = 1;
        ```

    CommonMark only recognizes a fence at the start of a line, so the opening
    fence is ignored, the code is rendered as a paragraph, and the closing
    fence then opens a new code block that swallows the rest of the answer.

    This patch moves such an opening fence onto its own line. It only acts on
    a line that ends with ```<language> (a language identifier is required so
    that a stray closing fence is never mistaken for an opening one), and
    never touches lines inside an existing fenced code block. For a block it
    repaired, a closing fence glued to the end of the last code line
    (e.g. `})()```) is split onto its own line as well.
*/

// Opening/closing fence per CommonMark: up to 3 spaces of indentation
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

// "<text>```lang" at the end of a line, the fence not preceded by a backtick
const MID_LINE_OPEN = /^(.*[^`\s])[ \t]*```([\w#+.-]+)[ \t\r]*$/;

// "<code>```" at the end of a line, the fence not preceded by a backtick
const MID_LINE_CLOSE = /^(.*[^`\s])[ \t]*```[ \t\r]*$/;

const countBackticks = (text: string): number =>
  (text.match(/`/g) ?? []).length;

export const fixMidLineCodeFences = (source: string): string => {
  // Fast path: nothing to fix unless a fence follows other text on a line
  if (!/[^`\s][ \t]*```[\w#+.-]+[ \t\r]*$/m.test(source)) return source;

  const lines = source.split("\n");
  const result: string[] = [];

  // The fence of the code block we are currently in, if any
  let openFence: { char: string; length: number; repaired: boolean } | null =
    null;

  for (const line of lines) {
    // Preserve CRLF line endings on lines we split
    const eol = line.endsWith("\r") ? "\r" : "";

    if (openFence) {
      const fence = line.match(FENCE_LINE);
      if (
        fence &&
        fence[1][0] === openFence.char &&
        fence[1].length >= openFence.length &&
        fence[2].trim() === ""
      ) {
        openFence = null;
        result.push(line);
        continue;
      }

      if (openFence.repaired) {
        const close = line.match(MID_LINE_CLOSE);
        if (close) {
          openFence = null;
          result.push(close[1] + eol, "```" + eol);
          continue;
        }
      }

      result.push(line);
      continue;
    }

    const fence = line.match(FENCE_LINE);
    if (fence) {
      // Backtick fences cannot have backticks in their info string
      if (fence[1][0] !== "`" || !fence[2].includes("`")) {
        openFence = {
          char: fence[1][0],
          length: fence[1].length,
          repaired: false,
        };
      }
      result.push(line);
      continue;
    }

    const open = line.match(MID_LINE_OPEN);
    // An odd number of backticks before the fence means it is part of an
    // inline code span, which must be left alone
    if (open && countBackticks(open[1]) % 2 === 0) {
      openFence = { char: "`", length: 3, repaired: true };
      result.push(open[1] + eol, "```" + open[2] + eol);
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
};
