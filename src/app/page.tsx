"use client";

import { useState, useEffect, useCallback } from "react";
import type { GitHubWorkflow, GitHubRun, GitHubUser } from "@/lib/github";
import TriggerModal from "@/components/TriggerModal";

// ─── Utilities ───────────────────────────────────────────────────────────────

function statusColors(status: string, conclusion: string | null) {
  if (status === "in_progress" || status === "queued" || status === "waiting") {
    return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
  }
  if (status === "completed") {
    switch (conclusion) {
      case "success":
        return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case "failure":
        return "text-red-400 bg-red-400/10 border-red-400/20";
      case "cancelled":
      case "skipped":
      case "stale":
        return "text-zinc-500 bg-zinc-500/10 border-zinc-500/20";
      default:
        return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
    }
  }
  return "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
}

function statusLabel(status: string, conclusion: string | null) {
  if (status === "in_progress") return "Running";
  if (status === "queued") return "Queued";
  if (status === "waiting") return "Waiting";
  if (status === "completed" && conclusion) {
    return conclusion.charAt(0).toUpperCase() + conclusion.slice(1);
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function timeAgo(dateStr: string) {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function StatusBadge({
  status,
  conclusion,
}: {
  status: string;
  conclusion: string | null;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors(status, conclusion)}`}
    >
      {status === "in_progress" && <Spinner className="w-2.5 h-2.5" />}
      {statusLabel(status, conclusion)}
    </span>
  );
}

function RunRow({ run }: { run: GitHubRun }) {
  return (
    <a
      href={run.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/60 transition-colors rounded-lg group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <StatusBadge status={run.status} conclusion={run.conclusion} />
        <div className="min-w-0">
          <span className="text-sm text-zinc-200">
            Run&nbsp;#{run.run_number}
          </span>
          {run.triggering_actor && (
            <span className="text-zinc-500 text-sm">
              {" "}
              by {run.triggering_actor.login}
            </span>
          )}
          <div className="text-xs text-zinc-500 mt-0.5 font-mono">
            {run.head_branch ?? "—"} · {timeAgo(run.created_at)}
          </div>
        </div>
      </div>
      <svg
        className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 flex-shrink-0 ml-3 transition-colors"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </a>
  );
}

function WorkflowCard({
  workflow,
  repoPath,
  token,
  onTrigger,
}: {
  workflow: GitHubWorkflow;
  repoPath: string;
  token: string;
  onTrigger: (w: GitHubWorkflow) => void;
}) {
  const [latestRun, setLatestRun] = useState<GitHubRun | null>(null);
  const [runs, setRuns] = useState<GitHubRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsOpen, setRunsOpen] = useState(false);

  const authHeaders = useCallback(
    (): HeadersInit => (token ? { "x-github-token": token } : {}),
    [token]
  );

  // Fetch the most-recent run for the status preview
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          `/api/github/${repoPath}/workflows/${workflow.id}/runs?per_page=1`,
          { headers: authHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          if (
            data &&
            Array.isArray(
              (data as { workflow_runs?: GitHubRun[] }).workflow_runs
            ) &&
            (data as { workflow_runs: GitHubRun[] }).workflow_runs.length > 0
          ) {
            setLatestRun(
              (data as { workflow_runs: GitHubRun[] }).workflow_runs[0]
            );
          }
        }
      } catch {
        // non-critical
      }
    };
    load();
  }, [workflow.id, repoPath, authHeaders]);

  const toggleRuns = async () => {
    if (runsOpen) {
      setRunsOpen(false);
      return;
    }
    setRunsLoading(true);
    try {
      const res = await fetch(
        `/api/github/${repoPath}/workflows/${workflow.id}/runs?per_page=10`,
        { headers: authHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setRuns(
          (data as { workflow_runs?: GitHubRun[] }).workflow_runs ?? []
        );
      }
    } finally {
      setRunsLoading(false);
      setRunsOpen(true);
    }
  };

  const fileName = workflow.path.split("/").pop() ?? workflow.path;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-zinc-100 truncate">
                {workflow.name}
              </h3>
              <span
                className={`text-xs px-1.5 py-0.5 rounded border ${
                  workflow.state === "active"
                    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                    : "text-zinc-500 bg-zinc-500/10 border-zinc-500/20"
                }`}
              >
                {workflow.state}
              </span>
            </div>
            <div className="text-xs text-zinc-500 font-mono mt-1">
              {fileName}
            </div>
            {latestRun && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge
                  status={latestRun.status}
                  conclusion={latestRun.conclusion}
                />
                <span className="text-xs text-zinc-500">
                  {timeAgo(latestRun.created_at)}
                  {latestRun.head_branch
                    ? ` · ${latestRun.head_branch}`
                    : ""}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => onTrigger(workflow)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
              </svg>
              Run
            </button>
            <button
              onClick={toggleRuns}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
            >
              {runsLoading ? (
                <Spinner className="w-3.5 h-3.5" />
              ) : (
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${runsOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              )}
              History
            </button>
          </div>
        </div>
      </div>

      {/* Runs drawer */}
      {runsOpen && (
        <div className="border-t border-zinc-800">
          {runs.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-zinc-600">
              No runs found for this workflow.
            </p>
          ) : (
            <div className="p-2">
              {runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  // Token state
  const [hasServerToken, setHasServerToken] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);

  // Repo + workflows state
  const [repoInput, setRepoInput] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [workflows, setWorkflows] = useState<GitHubWorkflow[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [workflowsError, setWorkflowsError] = useState<string | null>(null);

  // Modal
  const [triggerTarget, setTriggerTarget] = useState<GitHubWorkflow | null>(
    null
  );

  // Check for server-side token on mount
  useEffect(() => {
    fetch("/api/github/check-token")
      .then((r) => r.json())
      .then((d) => {
        const has = (d as { hasToken: boolean }).hasToken;
        setHasServerToken(has);
        // If server has token, also try to load user info
        if (has) {
          fetch("/api/github/user")
            .then((r) => r.json())
            .then((u) => setUser(u as GitHubUser))
            .catch(() => null);
        }
      })
      .catch(() => setHasServerToken(false));
  }, []);

  const authHeaders = useCallback(
    (): HeadersInit => (token ? { "x-github-token": token } : {}),
    [token]
  );

  const handleConnectToken = async () => {
    const t = tokenInput.trim();
    if (!t) return;
    setTokenLoading(true);
    setTokenError(null);
    try {
      const res = await fetch("/api/github/user", {
        headers: { "x-github-token": t },
      });
      if (!res.ok) {
        setTokenError("Invalid token — check your PAT scopes.");
        return;
      }
      const u = await res.json();
      setToken(t);
      setUser(u as GitHubUser);
      setTokenInput("");
    } finally {
      setTokenLoading(false);
    }
  };

  const loadWorkflows = async () => {
    const path = repoInput.trim();
    if (!path) return;
    if (!path.includes("/")) {
      setWorkflowsError("Use the format: owner/repo");
      return;
    }
    setWorkflowsLoading(true);
    setWorkflowsError(null);
    setWorkflows([]);
    setRepoPath("");
    try {
      const res = await fetch(`/api/github/${path}/workflows`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setWorkflowsError(
          (data as { message?: string }).message ?? `Error ${res.status}`
        );
        return;
      }
      setWorkflows(
        (data as { workflows?: GitHubWorkflow[] }).workflows ?? []
      );
      setRepoPath(path);
    } finally {
      setWorkflowsLoading(false);
    }
  };

  const isReady = hasServerToken || !!token;
  const showTokenForm = hasServerToken === false && !token;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Header ── */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Logo */}
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
              </svg>
            </div>
            <span className="font-semibold text-zinc-100 text-sm">
              GitHub Actions
            </span>
          </div>

          {/* Auth status */}
          <div>
            {hasServerToken === null && (
              <span className="text-xs text-zinc-600">Checking…</span>
            )}
            {hasServerToken === true && !user && (
              <span className="text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
                Token configured
              </span>
            )}
            {user && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                @{user.login}
              </span>
            )}
            {hasServerToken === false && !token && (
              <span className="text-xs text-zinc-600">Not connected</span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {/* ── Token setup ── */}
        {showTokenForm && (
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-200 mb-1">
              Connect GitHub
            </h2>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              Create a Personal Access Token with{" "}
              <code className="text-zinc-400 bg-zinc-800 px-1 py-0.5 rounded">
                repo
              </code>{" "}
              and{" "}
              <code className="text-zinc-400 bg-zinc-800 px-1 py-0.5 rounded">
                workflow
              </code>{" "}
              scopes, then paste it below. Alternatively, set{" "}
              <code className="text-zinc-400 bg-zinc-800 px-1 py-0.5 rounded">
                GITHUB_TOKEN
              </code>{" "}
              as an environment variable on the server.
            </p>
            <div className="flex gap-3">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnectToken()}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleConnectToken}
                disabled={tokenLoading || !tokenInput.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {tokenLoading && <Spinner className="w-4 h-4" />}
                Connect
              </button>
            </div>
            {tokenError && (
              <p className="mt-2 text-xs text-red-400">{tokenError}</p>
            )}
          </section>
        )}

        {/* ── Repo picker ── */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3">
            Repository
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadWorkflows()}
              placeholder="owner/repository"
              className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={loadWorkflows}
              disabled={workflowsLoading || !repoInput.trim() || !isReady}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-sm font-medium rounded-lg transition-colors"
            >
              {workflowsLoading ? (
                <>
                  <Spinner className="w-4 h-4" />
                  Loading…
                </>
              ) : (
                "Load"
              )}
            </button>
          </div>
          {!isReady && hasServerToken !== null && (
            <p className="mt-2 text-xs text-zinc-600">
              Connect a GitHub token above first.
            </p>
          )}
          {workflowsError && (
            <p className="mt-2 text-xs text-red-400">{workflowsError}</p>
          )}
        </section>

        {/* ── Workflow list ── */}
        {workflows.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Workflows — {repoPath}
              </h2>
              <span className="text-xs text-zinc-600">
                {workflows.length} found
              </span>
            </div>
            <div className="space-y-3">
              {workflows.map((wf) => (
                <WorkflowCard
                  key={wf.id}
                  workflow={wf}
                  repoPath={repoPath}
                  token={token}
                  onTrigger={setTriggerTarget}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state after load */}
        {!workflowsLoading && repoPath && workflows.length === 0 && (
          <div className="text-center py-12 text-zinc-600 text-sm">
            No workflows found in{" "}
            <span className="font-mono text-zinc-500">{repoPath}</span>.
          </div>
        )}
      </div>

      {/* ── Trigger modal ── */}
      {triggerTarget && (
        <TriggerModal
          workflow={triggerTarget}
          repoPath={repoPath}
          token={token}
          onClose={() => setTriggerTarget(null)}
        />
      )}
    </main>
  );
}
