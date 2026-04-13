import type { NextRequest } from "next/server";

const BACKEND = process.env.AGENT_BACKEND_URL ?? "http://localhost:8000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const upstream = await fetch(`${BACKEND}/api/jobs/${id}/stream`, {
    headers: { Accept: "text/event-stream" },
  });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
