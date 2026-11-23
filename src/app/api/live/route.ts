import { getCurrentUser } from "@/lib/auth";
import { changedSince, onChallengeChange } from "@/lib/live";
import { canViewChallenge, getChallengeById } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream: `GET /api/live?ids=1,2,3[&k=invitecode]`.
 * Sends `data: <challengeId>` whenever one of those challenges changes. It carries
 * no stats itself; the page re-fetches through the normal access-checked render.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("k");
  const user = await getCurrentUser();
  const ids = new Set(
    (url.searchParams.get("ids") ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 50)
      .filter((id) => {
        const c = getChallengeById(id);
        return !!c && canViewChallenge(c, user?.id, key);
      }),
  );

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (s: string) => {
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          cleanup();
        }
      };
      send("retry: 3000\n: connected\n\n");
      // Catch up on anything that changed between the page render and this connection.
      const since = Number(url.searchParams.get("since")) || 0;
      for (const id of ids) if (since && changedSince(id, since)) send(`data: ${id}\n\n`);
      const off = onChallengeChange((id) => {
        if (ids.has(id)) send(`data: ${id}\n\n`);
      });
      // Comment pings keep proxies and routers from closing an idle connection.
      const ping = setInterval(() => send(": ping\n\n"), 20_000);
      cleanup = () => {
        off();
        clearInterval(ping);
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
