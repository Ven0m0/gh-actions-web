const STORAGE_KEY = 'github_actions_token';
const API_BASE = 'https://api.github.com';

let token = '';
let currentRepo = '';
let workflows = [];
let branches = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(dateStr) {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getStatusClass(status, conclusion) {
  if (status === 'in_progress' || status === 'queued' || status === 'waiting') return 'running';
  if (status === 'completed') {
    if (conclusion === 'success') return 'success';
    if (conclusion === 'failure' || conclusion === 'timed_out') return 'failure';
  }
  return 'neutral';
}

function getStatusLabel(status, conclusion) {
  if (status === 'in_progress') return 'Running';
  if (status === 'queued') return 'Queued';
  if (status === 'waiting') return 'Waiting';
  if (status === 'completed' && conclusion) {
    return conclusion.charAt(0).toUpperCase() + conclusion.slice(1);
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function spinnerSvg() {
  return `<svg class="spinner" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"/>
    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75"/>
  </svg>`;
}

function statusBadge(status, conclusion) {
  const cls = getStatusClass(status, conclusion);
  const label = getStatusLabel(status, conclusion);
  const spin = status === 'in_progress' ? spinnerSvg() : '';
  return `<span class="status-badge ${cls}">${spin}${label}</span>`;
}

function stateBadge(state) {
  const cls = state === 'active' ? 'active' : 'inactive';
  return `<span class="state-badge ${cls}">${state}</span>`;
}

async function githubFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function githubPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (res.status === 204) return { success: true };
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function updateAuthStatus() {
  const el = $('#auth-status');
  if (token) {
    el.innerHTML = `<span class="auth-badge connected"><span class="dot"></span>Connected</span>`;
  } else {
    el.innerHTML = `<span class="auth-badge disconnected">Not connected</span>`;
  }
}

function showTokenSection() {
  $('#token-section').classList.remove('hidden');
}

function hideTokenSection() {
  $('#token-section').classList.add('hidden');
}

async function connectToken() {
  const input = $('#token-input');
  const errorEl = $('#token-error');
  const btn = $('#connect-btn');
  const t = input.value.trim();
  
  if (!t) return;
  
  btn.disabled = true;
  btn.textContent = 'Connecting...';
  errorEl.classList.add('hidden');
  
  try {
    token = t;
    const user = await githubFetch('/user');
    localStorage.setItem(STORAGE_KEY, token);
    updateAuthStatus();
    hideTokenSection();
    input.value = '';
  } catch (e) {
    token = '';
    errorEl.textContent = 'Invalid token — check your PAT scopes.';
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Connect';
  }
}

async function loadWorkflows() {
  const input = $('#repo-input');
  const errorEl = $('#repo-error');
  const btn = $('#load-btn');
  const repo = input.value.trim();
  
  if (!repo) return;
  if (!repo.includes('/')) {
    errorEl.textContent = 'Use the format: owner/repo';
    errorEl.classList.remove('hidden');
    return;
  }
  
  if (!token) {
    errorEl.textContent = 'Connect a GitHub token first.';
    errorEl.classList.remove('hidden');
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = `${spinnerSvg()} Loading...`;
  errorEl.classList.add('hidden');
  $('#workflows-section').classList.add('hidden');
  
  try {
    currentRepo = repo;
    const data = await githubFetch(`/repos/${repo}/actions/workflows`);
    workflows = data.workflows || [];
    renderWorkflows();
    $('#workflows-section').classList.remove('hidden');
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Load';
  }
}

function renderWorkflows() {
  const title = $('#workflows-title');
  const count = $('#workflows-count');
  const list = $('#workflows-list');
  
  title.textContent = `Workflows — ${currentRepo}`;
  count.textContent = `${workflows.length} found`;
  
  list.innerHTML = workflows.map(wf => {
    const filename = wf.path.split('/').pop();
    return `
      <div class="workflow-card" data-id="${wf.id}">
        <div class="workflow-header">
          <div class="workflow-top">
            <div class="workflow-info">
              <div class="workflow-name">
                ${escapeHtml(wf.name)}
                ${stateBadge(wf.state)}
              </div>
              <div class="workflow-path mono">${escapeHtml(filename)}</div>
              <div class="workflow-latest" data-latest="${wf.id}">
                <span class="status-badge neutral">Loading...</span>
              </div>
            </div>
            <div class="workflow-actions">
              <button class="primary small" onclick="openTriggerModal(${wf.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polygon points="14.752 11.168 11.555 9.036 10 9.87 10 14.133 11.555 14.965 14.752 12.833"/>
                </svg>
                Run
              </button>
              <button class="secondary small" onclick="toggleRuns(${wf.id})">
                <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 9l-7 7-7-7"/>
                </svg>
                History
              </button>
            </div>
          </div>
        </div>
        <div class="runs-drawer hidden" data-runs="${wf.id}"></div>
      </div>
    `;
  }).join('');
  
  workflows.forEach(wf => loadLatestRun(wf.id));
}

async function loadLatestRun(workflowId) {
  try {
    const data = await githubFetch(`/repos/${currentRepo}/actions/workflows/${workflowId}/runs?per_page=1`);
    const el = $(`.workflow-latest[data-latest="${workflowId}"]`);
    if (data.workflow_runs && data.workflow_runs.length > 0) {
      const run = data.workflow_runs[0];
      el.innerHTML = `
        ${statusBadge(run.status, run.conclusion)}
        <span style="font-size:12px;color:var(--text-dim)">
          ${timeAgo(run.created_at)}
          ${run.head_branch ? ` · ${escapeHtml(run.head_branch)}` : ''}
        </span>
      `;
    } else {
      el.innerHTML = '<span style="font-size:12px;color:var(--text-dim)">No runs</span>';
    }
  } catch {
    // ignore
  }
}

async function toggleRuns(workflowId) {
  const drawer = $(`.runs-drawer[data-runs="${workflowId}"]`);
  const card = $(`.workflow-card[data-id="${workflowId}"]`);
  const chevron = card.querySelector('.chevron');
  
  if (!drawer.classList.contains('hidden')) {
    drawer.classList.add('hidden');
    chevron.style.transform = '';
    return;
  }
  
  drawer.classList.remove('hidden');
  chevron.style.transform = 'rotate(180deg)';
  drawer.innerHTML = '<div class="loading-inline">' + spinnerSvg() + 'Loading runs...</div>';
  
  try {
    const data = await githubFetch(`/repos/${currentRepo}/actions/workflows/${workflowId}/runs?per_page=10`);
    const runs = data.workflow_runs || [];
    
    if (runs.length === 0) {
      drawer.innerHTML = '<div class="runs-drawer empty">No runs found for this workflow.</div>';
      return;
    }
    
    drawer.innerHTML = runs.map(run => `
      <a class="run-item" href="${run.html_url}" target="_blank" rel="noopener">
        <div class="run-info">
          ${statusBadge(run.status, run.conclusion)}
          <div class="run-meta">
            <span class="run-number">Run #${run.run_number}</span>
            ${run.triggering_actor ? `<span class="run-actor"> by ${escapeHtml(run.triggering_actor.login)}</span>` : ''}
            <div class="run-details mono">
              ${run.head_branch || '—'} · ${timeAgo(run.created_at)}
            </div>
          </div>
        </div>
        <svg class="run-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
        </svg>
      </a>
    `).join('');
  } catch (e) {
    drawer.innerHTML = `<div class="runs-drawer empty">Error loading runs: ${escapeHtml(e.message)}</div>`;
  }
}

let currentModalWorkflow = null;
let modalInputs = [];

async function openTriggerModal(workflowId) {
  const wf = workflows.find(w => w.id === workflowId);
  if (!wf) return;
  
  currentModalWorkflow = wf;
  modalInputs = [];
  
  const modal = $('#modal');
  const filename = $('#modal-filename');
  const body = $('#modal-body');
  
  filename.textContent = wf.path.split('/').pop();
  
  body.innerHTML = `
    <div class="form-group">
      <label>Branch</label>
      <div id="branch-select-container">
        <div class="loading-inline">${spinnerSvg()}Loading branches...</div>
      </div>
    </div>
    <div class="form-group">
      <div class="inputs-header">
        <label>Inputs <span>(optional)</span></label>
        <button type="button" onclick="addModalInput()">+ Add input</button>
      </div>
      <div id="modal-inputs">
        <p class="inputs-empty">No inputs defined. Add key-value pairs for workflow_dispatch inputs.</p>
      </div>
    </div>
    <div class="modal-actions">
      <button class="secondary" onclick="closeModal()">Cancel</button>
      <button class="primary" id="trigger-btn" onclick="triggerWorkflow()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polygon points="14.752 11.168 11.555 9.036 10 9.87 10 14.133 11.555 14.965 14.752 12.833"/>
        </svg>
        Run workflow
      </button>
    </div>
  `;
  
  modal.classList.remove('hidden');
  loadBranches();
}

async function loadBranches() {
  const container = $('#branch-select-container');
  try {
    const data = await githubFetch(`/repos/${currentRepo}/branches?per_page=100`);
    branches = data || [];
    const names = branches.map(b => b.name);
    
    let defaultBranch = 'main';
    if (names.includes('main')) defaultBranch = 'main';
    else if (names.includes('master')) defaultBranch = 'master';
    else if (names.length > 0) defaultBranch = names[0];
    
    container.innerHTML = `
      <select id="branch-select">
        ${names.map(n => `<option value="${escapeHtml(n)}"${n === defaultBranch ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('')}
      </select>
    `;
  } catch {
    container.innerHTML = `<input type="text" id="branch-select" value="main" placeholder="main">`;
  }
}

function addModalInput() {
  modalInputs.push({ key: '', value: '' });
  renderModalInputs();
}

function updateModalInput(index, field, value) {
  modalInputs[index][field] = value;
}

function removeModalInput(index) {
  modalInputs.splice(index, 1);
  renderModalInputs();
}

function renderModalInputs() {
  const container = $('#modal-inputs');
  if (modalInputs.length === 0) {
    container.innerHTML = '<p class="inputs-empty">No inputs defined. Add key-value pairs for workflow_dispatch inputs.</p>';
    return;
  }
  container.innerHTML = modalInputs.map((inp, i) => `
    <div class="input-row-item">
      <input type="text" placeholder="key" value="${escapeHtml(inp.key)}" onchange="updateModalInput(${i}, 'key', this.value)">
      <input type="text" placeholder="value" value="${escapeHtml(inp.value)}" onchange="updateModalInput(${i}, 'value', this.value)">
      <button type="button" onclick="removeModalInput(${i})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');
}

async function triggerWorkflow() {
  const btn = $('#trigger-btn');
  const body = $('#modal-body');
  const branchEl = $('#branch-select');
  const branch = branchEl.value || 'main';
  
  const inputs = {};
  modalInputs.forEach(inp => {
    if (inp.key.trim()) inputs[inp.key.trim()] = inp.value;
  });
  
  btn.disabled = true;
  btn.innerHTML = `${spinnerSvg()} Triggering...`;
  
  try {
    await githubPost(`/repos/${currentRepo}/actions/workflows/${currentModalWorkflow.id}/dispatches`, {
      ref: branch,
      inputs: Object.keys(inputs).length > 0 ? inputs : undefined
    });
    
    body.innerHTML = `
      <div class="success-state">
        <div class="success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h3>Workflow triggered!</h3>
        <p>Run queued on branch <code>${escapeHtml(branch)}</code></p>
        <div class="success-actions">
          <a href="https://github.com/${currentRepo}/actions" target="_blank" rel="noopener">
            View on GitHub
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
              <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
          </a>
          <button class="primary" onclick="closeModal()">Done</button>
        </div>
      </div>
    `;
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polygon points="14.752 11.168 11.555 9.036 10 9.87 10 14.133 11.555 14.965 14.752 12.833"/>
      </svg>
      Run workflow
    `;
    alert(`Error: ${e.message}`);
  }
}

function closeModal() {
  $('#modal').classList.add('hidden');
  currentModalWorkflow = null;
  modalInputs = [];
}

function init() {
  token = localStorage.getItem(STORAGE_KEY) || '';
  updateAuthStatus();
  
  if (!token) {
    showTokenSection();
  }
  
  $('#connect-btn').addEventListener('click', connectToken);
  $('#token-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') connectToken();
  });
  
  $('#load-btn').addEventListener('click', loadWorkflows);
  $('#repo-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') loadWorkflows();
  });
  
  $('#modal .modal-backdrop').addEventListener('click', closeModal);
  $('#modal .close-btn').addEventListener('click', closeModal);
  
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

document.addEventListener('DOMContentLoaded', init);
