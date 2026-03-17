import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ hasToken: !!process.env.GITHUB_TOKEN });
}
