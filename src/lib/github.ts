export interface GitHubWorkflow {
  id: number;
  node_id: string;
  name: string;
  path: string;
  state: "active" | "deleted" | "disabled_fork" | "disabled_inactivity" | "disabled_manually";
  created_at: string;
  updated_at: string;
  url: string;
  html_url: string;
  badge_url: string;
}

export interface GitHubRun {
  id: number;
  name: string | null;
  workflow_id: number;
  head_branch: string | null;
  run_number: number;
  status: "queued" | "in_progress" | "completed" | "waiting" | "requested" | "pending";
  conclusion:
    | "action_required"
    | "cancelled"
    | "failure"
    | "neutral"
    | "skipped"
    | "stale"
    | "success"
    | "timed_out"
    | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  triggering_actor: {
    login: string;
    avatar_url: string;
  } | null;
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface WorkflowsResponse {
  total_count: number;
  workflows: GitHubWorkflow[];
}

export interface RunsResponse {
  total_count: number;
  workflow_runs: GitHubRun[];
}
