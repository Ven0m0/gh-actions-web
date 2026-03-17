import { NextRequest, NextResponse } from "next/server";

type Params = { owner: string; repo: string; workflow_id: string };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const token = req.headers.get("x-github-token") || process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { owner, repo, workflow_id } = await params;
  const body = await req.json();

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  // GitHub returns 204 No Content on success
  if (res.status === 204 || res.ok) {
    return NextResponse.json({ success: true });
  }

  let error: unknown;
  try {
    error = await res.json();
  } catch {
    error = { message: `HTTP ${res.status}` };
  }
  return NextResponse.json(error, { status: res.status });
}
