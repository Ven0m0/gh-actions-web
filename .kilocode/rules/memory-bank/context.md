# Active Context: Next.js Starter Template

## Current State

**Template Status**: ✅ Ready for development

The template is a clean Next.js 16 starter with TypeScript and Tailwind CSS 4. It's ready for AI-assisted expansion to build any type of application.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] GitHub Actions web UI — trigger workflows, view run history

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Main dashboard (client component) | ✅ Done |
| `src/app/layout.tsx` | Root layout | ✅ Done |
| `src/app/globals.css` | Global styles | ✅ Done |
| `src/components/TriggerModal.tsx` | Workflow trigger modal | ✅ Done |
| `src/lib/github.ts` | GitHub API TypeScript types | ✅ Done |
| `src/app/api/github/check-token/route.ts` | Server-side token check | ✅ Done |
| `src/app/api/github/user/route.ts` | Authenticated user info | ✅ Done |
| `src/app/api/github/[owner]/[repo]/workflows/route.ts` | List workflows | ✅ Done |
| `src/app/api/github/[owner]/[repo]/workflows/[workflow_id]/dispatch/route.ts` | Trigger dispatch | ✅ Done |
| `src/app/api/github/[owner]/[repo]/workflows/[workflow_id]/runs/route.ts` | List runs | ✅ Done |
| `src/app/api/github/[owner]/[repo]/branches/route.ts` | List branches | ✅ Done |
| `.kilocode/` | AI context & recipes | ✅ Ready |

## Current Focus

The GitHub Actions web UI is complete. Features:
- Enter a GitHub PAT token via UI or set `GITHUB_TOKEN` env var server-side
- Load any repository by `owner/repo`
- View all workflows with their current state and latest run status
- Trigger `workflow_dispatch` events with branch selection and custom inputs
- Expand each workflow card to see the last 10 run entries with status badges

## Quick Start Guide

### To add a new page:

Create a file at `src/app/[route]/page.tsx`:
```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### To add components:

Create `src/components/` directory and add components:
```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### To add a database:

Follow `.kilocode/recipes/add-database.md`

### To add API routes:

Create `src/app/api/[route]/route.ts`:
```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Pending Improvements

- [ ] Add more recipes (auth, email, etc.)
- [ ] Add example components
- [ ] Add testing setup recipe

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-03-17 | Built GitHub Actions web UI — workflow list, dispatch trigger, run history |
