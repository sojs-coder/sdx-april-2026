import type { NextRequest } from "next/server";

const BACKEND = process.env.AGENT_BACKEND_URL ?? "http://localhost:8000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const resp = await fetch(`${BACKEND}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}

export async function GET() {
  const resp = await fetch(`${BACKEND}/api/jobs`);
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}
