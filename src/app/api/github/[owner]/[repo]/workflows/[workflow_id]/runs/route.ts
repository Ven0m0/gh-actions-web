import { NextRequest, NextResponse } from "next/server";

type Params = { owner: string; repo: string; workflow_id: string };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const token = req.headers.get("x-github-token") || process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { owner, repo, workflow_id } = await params;
  const perPage = req.nextUrl.searchParams.get("per_page") ?? "10";

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/runs?per_page=${perPage}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
