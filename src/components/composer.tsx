"use client";

import { useRef, useState, useTransition } from "react";
import { postMessage } from "@/lib/actions/conversation";

export function Composer({ challengeId }: { challengeId: number }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    const body = text.trim();
    if (!body || pending) return;
    start(async () => {
      const res = await postMessage(challengeId, body);
      if (res.ok) {
        setText("");
        setError(null);
        if (ref.current) ref.current.style.height = "";
      } else setError(res.error);
    });
  };

  return (
    <form
      className="p-3"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div className="flex items-end gap-2 rounded-md border border-line-strong bg-surface p-1.5 focus-within:border-ink">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          maxLength={1000}
          placeholder="Say something to the group…"
          aria-label="Message"
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-faint"
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn-primary h-9 px-3 text-xs" disabled={pending || !text.trim()}>
          Send
        </button>
      </div>
      {error ? <p className="mt-1.5 text-xs text-bad">{error}</p> : <p className="mt-1.5 text-[11px] text-faint">Enter to send · Shift+Enter for a new line</p>}
    </form>
  );
}
