"use client";

import { useState } from "react";
import { LinkIcon } from "./icons";

export function CopyLink({ path, label = "Copy invite link", className }: { path: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const go = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button type="button" onClick={go} className={className ?? "btn-ghost"}>
      <LinkIcon size={16} /> {copied ? "Copied!" : label}
    </button>
  );
}
