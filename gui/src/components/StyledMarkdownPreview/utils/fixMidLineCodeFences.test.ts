import { fixMidLineCodeFences } from "./fixMidLineCodeFences";

describe("fixMidLineCodeFences", () => {
  it("leaves well-formed markdown unchanged", () => {
    const source = "Some text\n\n```javascript\nconst a = 1;\n```\n\nMore text";
    expect(fixMidLineCodeFences(source)).toBe(source);
  });

  it("moves an opening fence that follows text onto its own line", () => {
    const source =
      "中身を確認しました。```javascript\n(()=>{\n  return 1;\n})()\n```\n\nこの設定は…";
    const expected =
      "中身を確認しました。\n```javascript\n(()=>{\n  return 1;\n})()\n```\n\nこの設定は…";
    expect(fixMidLineCodeFences(source)).toBe(expected);
  });

  it("handles whitespace between the text and the fence", () => {
    const source = "Here it is: ```python\nprint(1)\n```";
    const expected = "Here it is:\n```python\nprint(1)\n```";
    expect(fixMidLineCodeFences(source)).toBe(expected);
  });

  it("splits a closing fence glued to the last line of a repaired block", () => {
    const source = "Code:```js\nconst a = 1;\nfoo()```\nAfter";
    const expected = "Code:\n```js\nconst a = 1;\nfoo()\n```\nAfter";
    expect(fixMidLineCodeFences(source)).toBe(expected);
  });

  it("does not split a glued closing fence of a block it did not repair", () => {
    const source = "```js\nconst s = 'a```';\nfoo()```\n```";
    expect(fixMidLineCodeFences(source)).toBe(source);
  });

  it("does not touch lines inside an existing code block", () => {
    const source =
      "```markdown\nExample:```js\nconst a = 1;\n```\n\nText after```";
    expect(fixMidLineCodeFences(source)).toBe(source);
  });

  it("does not touch lines inside a tilde code block", () => {
    const source = "~~~\nExample:```js\n~~~";
    expect(fixMidLineCodeFences(source)).toBe(source);
  });

  it("requires a language identifier", () => {
    const source = "Some text```\ncode\n```";
    expect(fixMidLineCodeFences(source)).toBe(source);
  });

  it("ignores fences that are part of an inline code span", () => {
    const source = "Use `a```js\nmore` here";
    expect(fixMidLineCodeFences(source)).toBe(source);
  });

  it("ignores a fence with more text after the language on the same line", () => {
    const source = "Write ```js code``` inline";
    expect(fixMidLineCodeFences(source)).toBe(source);
  });

  it("fixes multiple broken blocks in one message", () => {
    const source = "First:```ts\nlet a;\n```\nSecond:```py\nb = 1\n```";
    const expected = "First:\n```ts\nlet a;\n```\nSecond:\n```py\nb = 1\n```";
    expect(fixMidLineCodeFences(source)).toBe(expected);
  });

  it("handles CRLF line endings", () => {
    const source = "Text```js\r\nconst a = 1;\r\n```\r\n";
    const expected = "Text\r\n```js\r\nconst a = 1;\r\n```\r\n";
    expect(fixMidLineCodeFences(source)).toBe(expected);
  });
});
