import "server-only";
import { EventEmitter } from "node:events";

// In-process pub/sub for live updates. `npm run start` is a single Node process,
// so every open browser's event stream hangs off this one emitter.
const g = globalThis as unknown as { __liveBus?: EventEmitter };
const bus = g.__liveBus ?? (g.__liveBus = new EventEmitter().setMaxListeners(0));

/** Tell every open page watching this challenge that its data changed. */
export function notifyChallenge(challengeId: number | bigint) {
  bus.emit("change", Number(challengeId));
}

export function onChallengeChange(fn: (challengeId: number) => void) {
  bus.on("change", fn);
  return () => {
    bus.off("change", fn);
  };
}
