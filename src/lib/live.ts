import "server-only";
import { EventEmitter } from "node:events";

// In-process pub/sub for live updates. `npm run start` is a single Node process,
// so every open browser's event stream hangs off this one emitter.
const g = globalThis as unknown as { __liveBus?: EventEmitter; __liveChanged?: Map<number, number> };
const bus = g.__liveBus ?? (g.__liveBus = new EventEmitter().setMaxListeners(0));
// When each challenge last changed, so a page that connects late can catch up.
const changedAt = g.__liveChanged ?? (g.__liveChanged = new Map<number, number>());

/** Has this challenge changed after the given time (ms)? */
export function changedSince(challengeId: number, since: number) {
  return (changedAt.get(challengeId) ?? 0) > since;
}

/** Tell every open page watching this challenge that its data changed. */
export function notifyChallenge(challengeId: number | bigint) {
  changedAt.set(Number(challengeId), Date.now());
  bus.emit("change", Number(challengeId));
}

export function onChallengeChange(fn: (challengeId: number) => void) {
  bus.on("change", fn);
  return () => {
    bus.off("change", fn);
  };
}
