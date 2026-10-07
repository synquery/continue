import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  WrenchIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { vscEditorBackground } from "..";
import {
  ProxyToolPayload,
  summarizeProxyToolArgs,
} from "./utils/proxyToolTrace";

interface ProxyToolCallBlockProps {
  payload: ProxyToolPayload;
}

/**
 * Compact, collapsible display of a tool call that was executed by the proxy
 * (see utils/proxyToolTrace.ts)
 */
export function ProxyToolCallBlock({ payload }: ProxyToolCallBlockProps) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDownIcon : ChevronRightIcon;

  return (
    <div className="my-1" data-testid="proxy-tool-call">
      <div
        className="text-description flex min-w-0 cursor-pointer select-none flex-row items-center gap-1.5 text-xs hover:brightness-125"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Chevron className="h-3 w-3 flex-shrink-0" />
        <WrenchIcon className="h-3 w-3 flex-shrink-0" />
        <span className="flex-shrink-0 font-mono">
          {payload.name || "tool"}
        </span>
        <span className="min-w-0 truncate opacity-75">
          {summarizeProxyToolArgs(payload.args)}
        </span>
        {payload.status === "done" && (
          <CheckIcon className="h-3 w-3 flex-shrink-0 text-green-500" />
        )}
        {payload.status === "error" && (
          <XMarkIcon className="h-3 w-3 flex-shrink-0 text-red-500" />
        )}
        {payload.status === "running" && (
          <span className="flex-shrink-0 opacity-75">…</span>
        )}
      </div>
      {open && (
        <div className="mt-1 flex flex-col gap-1 pl-5 text-xs">
          <pre
            className="m-0 max-h-[30vh] overflow-auto whitespace-pre-wrap rounded p-2"
            style={{ backgroundColor: vscEditorBackground }}
          >
            {typeof payload.args === "string"
              ? payload.args
              : JSON.stringify(payload.args, null, 2)}
          </pre>
          {payload.result !== undefined && (
            <pre
              className="m-0 max-h-[30vh] overflow-auto whitespace-pre-wrap rounded p-2"
              style={{ backgroundColor: vscEditorBackground }}
            >
              {payload.result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
