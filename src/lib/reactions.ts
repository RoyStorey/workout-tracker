// Shared by server and client: the reactions people can leave, in display order.
export const REACTIONS = ["👍", "🔥", "💪", "👏", "😂"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const isReaction = (s: string): s is Reaction => (REACTIONS as readonly string[]).includes(s);

export type ReactionSummary = { emoji: string; count: number; mine: boolean; names: string };
