/**
 * Normalizes non-standard chat completion streams from proxies that run an
 * agent loop server-side (e.g. wl-openai-proxy) and replay the trace to the
 * client as text.
 *
 * Such proxies emit every turn of the loop as its own `choices[].index`
 * (assistant tool call, tool result, assistant tool call, ...) and then, in
 * the final choice, re-send the whole trace followed by the actual answer.
 * Continue only reads `choices[0].delta.content`, so without normalization:
 *  - segments are glued together without a newline, producing broken code
 *    fences such as "``````tool_call"
 *  - the entire trace is shown twice
 *
 * Standard OpenAI-compatible servers always stream a single choice index, so
 * this normalizer is a no-op for them.
 */
export class ProxyTraceStreamNormalizer {
  private emitted = "";
  private lastIndex: number | undefined;
  private replayBuffer: string | undefined;

  /**
   * Takes the content of one chunk and returns the content that should be
   * shown instead (possibly an empty string while a potential replay is
   * buffered). A segment that ends while still matching a replay is dropped.
   */
  push(index: number | undefined, content: string): string {
    if (
      index !== undefined &&
      this.lastIndex !== undefined &&
      index !== this.lastIndex &&
      this.emitted.length > 0
    ) {
      // A new segment started. Its beginning may replay everything we have
      // already shown, so buffer until we can tell. A previous segment that
      // still matched a replay when it ended is dropped.
      this.replayBuffer = "";
    }
    if (index !== undefined) {
      this.lastIndex = index;
    }

    if (this.replayBuffer === undefined) {
      return this.emit(content);
    }

    this.replayBuffer += content;
    const shown = trimLeadingNewlines(this.emitted);
    const buffered = trimLeadingNewlines(this.replayBuffer);

    if (shown.startsWith(buffered)) {
      // Still consistent with a replay of what was already shown
      return "";
    }

    this.replayBuffer = undefined;
    if (buffered.startsWith(shown)) {
      // Replay finished, only show what comes after it
      return this.emitSegmentStart(buffered.slice(shown.length));
    }
    // Not a replay, just a new segment
    return this.emitSegmentStart(buffered);
  }

  private emitSegmentStart(text: string): string {
    if (!text) {
      return "";
    }
    if (!this.emitted.endsWith("\n") && !text.startsWith("\n")) {
      text = "\n" + text;
    }
    return this.emit(text);
  }

  private emit(text: string): string {
    this.emitted += text;
    return text;
  }
}

function trimLeadingNewlines(text: string): string {
  return text.replace(/^\n+/, "");
}
