"use client";

import { useState, useEffect, useCallback } from "react";
import type { GitHubWorkflow, GitHubBranch, GitHubRun } from "@/lib/github";

interface TriggerModalProps {
  workflow: GitHubWorkflow;
  repoPath: string;
  token: string;
  onClose: () => void;
}

interface InputPair {
  key: string;
  value: string;
}

function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={`${className} animate-spin`}
      fill="none"
      viewBox="0 0 24 24"
    >
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

export default function TriggerModal({
  workflow,
  repoPath,
  token,
  onClose,
}: TriggerModalProps) {
  const [branch, setBranch] = useState("main");
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [inputs, setInputs] = useState<InputPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [triggeredRun, setTriggeredRun] = useState<GitHubRun | null>(null);

  const authHeaders = useCallback(
    (): HeadersInit => (token ? { "x-github-token": token } : {}),
    [token]
  );

  useEffect(() => {
    const load = async () => {
      setBranchesLoading(true);
      try {
        const res = await fetch(`/api/github/${repoPath}/branches`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data: GitHubBranch[] = await res.json();
          const names = data.map((b) => b.name);
          setBranches(names);
          if (names.includes("main")) setBranch("main");
          else if (names.includes("master")) setBranch("master");
          else if (names.length > 0) setBranch(names[0]);
        }
      } finally {
        setBranchesLoading(false);
      }
    };
    load();
  }, [repoPath, authHeaders]);

  const addInput = () => setInputs((prev) => [...prev, { key: "", value: "" }]);

  const updateInput = (index: number, field: keyof InputPair, value: string) =>
    setInputs((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );

  const removeInput = (index: number) =>
    setInputs((prev) => prev.filter((_, i) => i !== index));

  const handleTrigger = async () => {
    setLoading(true);
    setError(null);

    const inputsObj: Record<string, string> = {};
    inputs.forEach(({ key, value }) => {
      if (key.trim()) inputsObj[key.trim()] = value;
    });

    try {
      const res = await fetch(
        `/api/github/${repoPath}/workflows/${workflow.id}/dispatch`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({
            ref: branch,
            inputs: Object.keys(inputsObj).length > 0 ? inputsObj : undefined,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(
          (data as { message?: string }).message ?? `Error ${res.status}`
        );
        return;
      }

      setSuccess(true);

      // Poll briefly for the new run
      setTimeout(async () => {
        try {
          const runRes = await fetch(
            `/api/github/${repoPath}/workflows/${workflow.id}/runs?per_page=1`,
            { headers: authHeaders() }
          );
          if (runRes.ok) {
            const runData = await runRes.json();
            if (
              runData &&
              typeof runData === "object" &&
              "workflow_runs" in runData &&
              Array.isArray(runData.workflow_runs) &&
              runData.workflow_runs.length > 0
            ) {
              setTriggeredRun(runData.workflow_runs[0] as GitHubRun);
            }
          }
        } catch {
          // non-critical — ignore
        }
      }, 2500);
    } finally {
      setLoading(false);
    }
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Run workflow
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">
              {workflow.path.split("/").pop()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-md hover:bg-zinc-800"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {success ? (
          /* Success state */
          <div className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-100">
                  Workflow triggered!
                </div>
                <div className="text-xs text-zinc-500">
                  Run queued on branch{" "}
                  <span className="text-zinc-300 font-mono">{branch}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2.5">
              {triggeredRun && (
                <a
                  href={triggeredRun.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm rounded-lg transition-colors"
                >
                  View run
                  <svg
                    className="w-3.5 h-3.5"
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
              )}
              {!triggeredRun && (
                <div className="flex-1 flex items-center gap-2 text-xs text-zinc-500 px-2">
                  <Spinner className="w-3.5 h-3.5" />
                  Fetching run link…
                </div>
              )}
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form state */
          <div className="p-5 space-y-4">
            {/* Branch selector */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Branch
              </label>
              {branchesLoading ? (
                <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
                  <Spinner className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-sm text-zinc-500">
                    Loading branches…
                  </span>
                </div>
              ) : branches.length > 0 ? (
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
            </div>

            {/* Inputs */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-400">
                  Inputs{" "}
                  <span className="text-zinc-600 font-normal">(optional)</span>
                </label>
                <button
                  onClick={addInput}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  + Add input
                </button>
              </div>

              {inputs.length === 0 ? (
                <p className="text-xs text-zinc-600 italic py-1">
                  No inputs defined. Add key-value pairs for{" "}
                  <code className="text-zinc-500">workflow_dispatch</code>{" "}
                  inputs.
                </p>
              ) : (
                <div className="space-y-2">
                  {inputs.map((input, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={input.key}
                        onChange={(e) =>
                          updateInput(index, "key", e.target.value)
                        }
                        placeholder="key"
                        className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={input.value}
                        onChange={(e) =>
                          updateInput(index, "value", e.target.value)
                        }
                        placeholder="value"
                        className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => removeInput(index)}
                        className="text-zinc-600 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-zinc-800"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                <svg
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTrigger}
                disabled={loading || branchesLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    Triggering…
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
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
                    Run workflow
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
