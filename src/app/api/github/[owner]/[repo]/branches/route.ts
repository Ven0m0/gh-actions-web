import { NextRequest, NextResponse } from "next/server";

type Params = { owner: string; repo: string };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const token = req.headers.get("x-github-token") || process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { owner, repo } = await params;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
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
