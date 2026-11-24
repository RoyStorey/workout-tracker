import "server-only";
import crypto from "node:crypto";
import { db } from "./db";

/**
 * Delete a user. Teams and challenges they own pass to their longest-standing
 * other member; ones with nobody else are deleted. Their sets, messages and
 * reactions go with them.
 */
export function deleteUserCascade(userId: number) {
  const d = db();
  d.transaction(() => {
    const teams = d.prepare("SELECT id FROM teams WHERE owner_id = ?").all(userId) as { id: number }[];
    for (const t of teams) {
      const heir = d
        .prepare("SELECT user_id FROM team_members WHERE team_id = ? AND user_id != ? ORDER BY joined_at LIMIT 1")
        .get(t.id, userId) as { user_id: number } | undefined;
      if (heir) {
        d.prepare("UPDATE teams SET owner_id = ? WHERE id = ?").run(heir.user_id, t.id);
        d.prepare("UPDATE team_members SET role = 'owner' WHERE team_id = ? AND user_id = ?").run(t.id, heir.user_id);
      } else d.prepare("DELETE FROM teams WHERE id = ?").run(t.id);
    }
    const chals = d.prepare("SELECT id FROM challenges WHERE owner_id = ?").all(userId) as { id: number }[];
    for (const c of chals) {
      const heir = d
        .prepare("SELECT user_id FROM challenge_members WHERE challenge_id = ? AND user_id != ? ORDER BY joined_at LIMIT 1")
        .get(c.id, userId) as { user_id: number } | undefined;
      if (heir) d.prepare("UPDATE challenges SET owner_id = ? WHERE id = ?").run(heir.user_id, c.id);
      else d.prepare("DELETE FROM challenges WHERE id = ?").run(c.id);
    }
    d.prepare("DELETE FROM users WHERE id = ?").run(userId);
  })();
}

const WORDS = [
  "maple", "tiger", "river", "stone", "cedar", "falcon", "ember", "harbor", "meadow", "comet", "summit", "willow",
  "otter", "granite", "canyon", "breeze", "copper", "lantern", "orbit", "pepper", "quartz", "rocket", "saddle", "timber",
  "violet", "walnut", "badger", "candle", "dune", "fjord", "glacier", "hazel", "iris", "jasper", "kettle", "lemon",
];

/** Easy to read aloud or type on a phone: two words and four digits, e.g. maple-tiger-4821. */
export function temporaryPassword() {
  const pick = () => WORDS[crypto.randomInt(WORDS.length)];
  return `${pick()}-${pick()}-${crypto.randomInt(1000, 10000)}`;
}
