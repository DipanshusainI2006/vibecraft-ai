// DOM Elements Selection
const btnRun = document.getElementById('btn-run');
const btnRunLabel = document.getElementById('btn-run-label');
const promptInput = document.getElementById('prompt-input');
const apiKeyInput = document.getElementById('api-key');
const apiKeySection = document.getElementById('api-key-section');
const btnModeSim = document.getElementById('btn-mode-sim');
const btnModeLive = document.getElementById('btn-mode-live');
const modeBadge = document.getElementById('mode-badge');
const globalPip = document.getElementById('global-pip');
const globalStatusLabel = document.getElementById('global-status-label');

// Stage List Items
const stageSpec = document.getElementById('stage-spec');
const stageSpecState = document.getElementById('stage-spec-state');
const stageCode = document.getElementById('stage-code');
const stageCodeState = document.getElementById('stage-code-state');
const stageQa = document.getElementById('stage-qa');
const stageQaState = document.getElementById('stage-qa-state');
const stageDone = document.getElementById('stage-done');
const stageDoneState = document.getElementById('stage-done-state');

// DAG Flow Nodes & Connectors
const dagSpec = document.getElementById('dag-spec');
const dagSpecState = document.getElementById('dag-spec-state');
const dagCode = document.getElementById('dag-code');
const dagCodeState = document.getElementById('dag-code-state');
const dagQa = document.getElementById('dag-qa');
const dagQaState = document.getElementById('dag-qa-state');
const dagOut = document.getElementById('dag-out');
const dagOutState = document.getElementById('dag-out-state');

const arrow1 = document.getElementById('arrow-1');
const arrow2 = document.getElementById('arrow-2');
const arrow3 = document.getElementById('arrow-3');

// Terminal & Code
const terminalOutput = document.getElementById('terminal-output');
const iterCounter = document.getElementById('iter-counter');
const codeTabs = document.getElementById('code-tabs');
const codeOutput = document.getElementById('code-output');
const codeMeta = document.getElementById('code-meta');

// Tabs Selection
const tabPreview = document.getElementById('tab-preview');
const tabSpec = document.getElementById('tab-spec');
const tabAudit = document.getElementById('tab-audit');

const contentPreview = document.getElementById('content-preview');
const contentSpec = document.getElementById('content-spec');
const contentAudit = document.getElementById('content-audit');

const previewFrame = document.getElementById('preview-frame');
const previewUrl = document.getElementById('preview-url');
const previewPlaceholder = document.getElementById('preview-placeholder');
const specBody = document.getElementById('spec-body');

// Audit Panel Elements
const ringFg = document.getElementById('ring-fg');
const ringValue = document.getElementById('ring-value');
const auditVerdict = document.getElementById('audit-verdict');
const auditRunInfo = document.getElementById('audit-run-info');
const auditCounts = document.getElementById('audit-counts');
const findingsList = document.getElementById('findings-list');

const polSyntax = document.getElementById('pol-syntax');
const polEval = document.getElementById('pol-eval');
const polDom = document.getElementById('pol-dom');
const polSSL = document.getElementById('pol-ssl');

// State Variables
let isRunning = false;
let mode = 'sim'; // 'sim' or 'live'
let eventSource = null;
let codeRevisions = {}; // stores revision content
let activeRevision = null;
let totalDeductions = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const savedKey = sessionStorage.getItem('gemini_api_key');
  if (savedKey) {
    apiKeyInput.value = savedKey;
  }
});

// Mode Switching Handler
window.setMode = function(newMode) {
  if (isRunning) return;
  mode = newMode;
  if (mode === 'sim') {
    btnModeSim.classList.add('active');
    btnModeLive.classList.remove('active');
    apiKeySection.classList.add('hidden');
    modeBadge.textContent = 'DEMO MODE';
    modeBadge.className = 'run-mode-badge';
  } else {
    btnModeLive.classList.add('active');
    btnModeSim.classList.remove('active');
    apiKeySection.classList.remove('hidden');
    modeBadge.textContent = 'LIVE GEMINI';
    modeBadge.className = 'run-mode-badge accent';
  }
};

// Clear Logs Handler
window.clearLogs = function() {
  terminalOutput.innerHTML = '<div class="tline tline-system">▸ Logs cleared.</div>';
};

// Switch Tabs Handler
window.switchOutTab = function(targetTab) {
  tabPreview.classList.remove('active');
  tabSpec.classList.remove('active');
  tabAudit.classList.remove('active');
  
  contentPreview.classList.remove('active');
  contentSpec.classList.remove('active');
  contentAudit.classList.remove('active');
  
  if (targetTab === 'preview') {
    tabPreview.classList.add('active');
    contentPreview.classList.add('active');
  } else if (targetTab === 'spec') {
    tabSpec.classList.add('active');
    contentSpec.classList.add('active');
  } else if (targetTab === 'audit') {
    tabAudit.classList.add('active');
    contentAudit.classList.add('active');
  }
};

// Execute Pipeline Click Action
window.startPipeline = async function() {
  if (isRunning) return;

  const prompt = promptInput.value.trim();
  if (!prompt) {
    alert('Please enter a design prompt.');
    return;
  }

  const apiKey = apiKeyInput.value.trim();
  if (mode === 'live') {
    if (!apiKey) {
      alert('Please enter your Gemini API key for Live Mode.');
      return;
    }
    sessionStorage.setItem('gemini_api_key', apiKey);
  }

  // Set visual run state
  isRunning = true;
  btnRun.disabled = true;
  btnRunLabel.textContent = 'Running Pipeline...';
  
  globalPip.className = 'status-pip running';
  globalStatusLabel.textContent = 'Executing Autonomous Multi-Agent Loop...';

  // Reset elements
  terminalOutput.innerHTML = '';
  codeTabs.innerHTML = '<span class="code-tab-placeholder">Generating code...</span>';
  codeOutput.textContent = '// Code generation in progress...';
  codeMeta.textContent = '';
  codeRevisions = {};
  activeRevision = null;
  iterCounter.textContent = '';

  previewFrame.src = 'about:blank';
  previewUrl.textContent = 'about:blank';
  previewPlaceholder.classList.remove('hidden');

  specBody.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-title">Generating Specification</div>
      <div class="empty-sub">Design spec is being drafted by Spec Writer Agent...</div>
    </div>
  `;

  resetLinterReport();
  resetDAGFlow();
  resetStagesList();

  logToConsole('system', 'Initializing VibeCraft Pipeline Execution Context...');

  try {
    const res = await fetch('/api/run-pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, apiKey: mode === 'live' ? apiKey : null })
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }

    const { runId } = await res.json();
    logToConsole('system', `Pipeline session registered. Run ID: ${runId}`);

    // Connect SSE Stream
    eventSource = new EventSource(`/api/pipeline-stream?id=${runId}`);

    eventSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      handleSSEEvent(parsed);
    };

    eventSource.onerror = () => {
      logToConsole('error', 'Execution connection lost or model capacity exhausted. Halting.');
      terminatePipelineRun(false);
    };

  } catch (err) {
    logToConsole('error', `Initialization Error: ${err.message}`);
    terminatePipelineRun(false);
  }
};

// Event Handler
function handleSSEEvent(event) {
  const { type, data } = event;

  switch (type) {
    case 'status':
      updateStagesUI(data.state, data.message);
      break;

    case 'agent_thought':
      const name = data.agent.replace('_agent', '').toUpperCase();
      let logClass = 'tline-system';
      if (name === 'SPEC_WRITER') logClass = 'tline-spec';
      if (name === 'UI_CODER') logClass = 'tline-code';
      if (name === 'QA_JUDGE') logClass = 'tline-qa';
      
      logToConsole(logClass, `[${name}] Thought: ${data.thought}`);
      break;

    case 'tool_call':
      logToConsole('tline-tool', `▸ Running Tool: ${data.tool} (${JSON.stringify(data.args)})`);
      break;

    case 'tool_response':
      const success = data.status === 'SUCCESS';
      logToConsole(
        success ? 'tline-success' : 'tline-error',
        `◂ Tool Response: ${data.status} ${data.filename || ''}`
      );
      break;

    case 'spec_update':
      renderSpecification(data.spec);
      switchOutTab('spec');
      break;

    case 'code_update':
      updateCodeRevision(data.filename, data.content, data.revision);
      break;

    case 'linter_report':
      renderLinterReport(data.report, data.revision);
      break;

    case 'complete':
      logToConsole('tline-success', `▸ Pipeline finished: ${data.status}`);
      terminatePipelineRun(true);
      break;

    default:
      console.log('Unknown SSE type:', type);
  }
}

// Complete run state termination
function terminatePipelineRun(success) {
  isRunning = false;
  btnRun.disabled = false;
  btnRunLabel.textContent = 'Execute Pipeline';

  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  globalPip.className = `status-pip ${success ? 'success' : 'error'}`;
  globalStatusLabel.textContent = success ? 'Pipeline Run Completed — Viewport Active' : 'Pipeline Execution Failed';

  if (success) {
    previewPlaceholder.classList.add('hidden');
    previewFrame.src = `/api/preview/component.html?t=${Date.now()}`;
    previewUrl.textContent = 'http://localhost:3000/output_sandbox/component.html';
    switchOutTab('preview');
  }
}

// Stage Tracker + DAG updates
function updateStagesUI(state, message) {
  resetStagesList();
  resetDAGFlow();

  logToConsole('tline-system', `▸ Transition: ${message}`);

  if (state === 'spec_generation') {
    stageSpec.classList.add('active');
    stageSpecState.textContent = 'Drafting Spec...';
    dagSpec.classList.add('active');
    dagSpecState.textContent = 'RUNNING';
  }
  else if (state === 'code_generation') {
    stageSpec.classList.add('done');
    stageSpecState.textContent = 'Done';
    
    stageCode.classList.add('active');
    stageCodeState.textContent = 'Writing UI...';
    
    dagSpecState.textContent = 'IDLE';
    dagCode.classList.add('active');
    dagCodeState.textContent = 'RUNNING';
    arrow1.classList.add('lit');
  }
  else if (state === 'qa_evaluation') {
    stageSpec.classList.add('done');
    stageSpecState.textContent = 'Done';
    stageCode.classList.add('done');
    stageCodeState.textContent = 'Done';
    
    stageQa.classList.add('active');
    stageQaState.textContent = 'Auditing...';
    
    dagSpecState.textContent = 'IDLE';
    dagCodeState.textContent = 'IDLE';
    dagQa.classList.add('active');
    dagQaState.textContent = 'RUNNING';
    
    arrow1.classList.add('lit');
    arrow2.classList.add('lit');
  }
  else if (state === 'complete') {
    stageSpec.classList.add('done');
    stageSpecState.textContent = 'Done';
    stageCode.classList.add('done');
    stageCodeState.textContent = 'Done';
    stageQa.classList.add('done');
    stageQaState.textContent = 'Done';
    
    stageDone.classList.add('done');
    stageDoneState.textContent = 'Approved';
    
    dagSpecState.textContent = 'IDLE';
    dagCodeState.textContent = 'IDLE';
    dagQaState.textContent = 'IDLE';
    dagOut.classList.add('active');
    dagOutState.textContent = 'READY';
    
    arrow1.classList.add('lit');
    arrow2.classList.add('lit');
    arrow2.classList.remove('loop-active');
    arrow3.classList.add('lit');
  }
}

// Log line helper
function logToConsole(cssClass, message) {
  const div = document.createElement('div');
  div.className = `tline ${cssClass}`;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  terminalOutput.appendChild(div);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// Markdown Specification renderer
function renderSpecification(md) {
  if (!md) return;
  let parsed = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^\s*\-\s+(.*$)/gim, '<li>$1</li>')
    .replace(/\`([^`]+)\`/g, '<code>$1</code>');

  parsed = parsed.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
  parsed = parsed.replace(/<\/ul>\s*<ul>/g, '');
  specBody.innerHTML = parsed;
}

// Code revision switcher
function updateCodeRevision(filename, content, revision) {
  codeRevisions[revision] = content;
  
  // Clear placeholder on first revision
  if (Object.keys(codeRevisions).length === 1) {
    codeTabs.innerHTML = '';
  }

  // Create new tab tab
  const tab = document.createElement('button');
  tab.className = 'code-tab active';
  tab.textContent = `Rev ${revision}`;
  tab.dataset.rev = revision;

  // Un-activate siblings
  codeTabs.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
  codeTabs.appendChild(tab);

  codeOutput.textContent = content;
  activeRevision = revision;
  codeMeta.textContent = `${filename} (${content.length} bytes)`;

  // Bind click event
  tab.addEventListener('click', (e) => {
    const rev = e.target.dataset.rev;
    codeTabs.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    codeOutput.textContent = codeRevisions[rev];
    activeRevision = rev;
  });

  iterCounter.textContent = `[Iteration ${revision}]`;
}

// Renders the detailed linter & security metrics
function renderLinterReport(report, revision) {
  switchOutTab('audit');
  findingsList.innerHTML = '';

  let syntaxOk = true;
  let evalOk = true;
  let domOk = true;
  let sslOk = true;

  report.errors.forEach(err => {
    const msg = err.message.toLowerCase();
    if (msg.includes('tag') || msg.includes('unclosed') || msg.includes('mismatched')) {
      syntaxOk = false;
    }
    if (msg.includes('eval(')) {
      evalOk = false;
    }
    if (msg.includes('document.write')) {
      domOk = false;
    }
    if (msg.includes('http:')) {
      sslOk = false;
    }
  });

  let score = 100;
  if (!syntaxOk) score -= 25;
  if (!evalOk) score -= 25;
  if (!domOk) score -= 25;
  if (!sslOk) score -= 25;

  // Set checklists icon style
  updateCheckState(polSyntax, syntaxOk);
  updateCheckState(polEval, evalOk);
  updateCheckState(polDom, domOk);
  updateCheckState(polSSL, sslOk);

  // Animate ring & labels
  ringValue.textContent = score;
  const dashOffset = 201.06 - (201.06 * score) / 100;
  ringFg.style.strokeDashoffset = dashOffset;

  if (score >= 90) {
    ringFg.className.baseVal = 'ring-fg';
    auditVerdict.textContent = 'SECURE';
    auditVerdict.className = 'audit-verdict pass';
    auditRunInfo.textContent = `Revision ${revision} verified clean`;
    
    auditCounts.innerHTML = `
      <span class="count-badge ok">0 Errors</span>
      <span class="count-badge ok">0 Warnings</span>
    `;
    arrow2.classList.remove('loop-active');
  } else {
    ringFg.className.baseVal = 'ring-fg warn';
    auditVerdict.textContent = 'POLICY VIOLATION';
    auditVerdict.className = 'audit-verdict fail';
    auditRunInfo.textContent = `Revision ${revision} rejected by Judge`;

    // Loopback arrow animation in flow graph
    arrow2.classList.add('loop-active');

    const errCount = report.errors.filter(e => e.severity === 'error').length;
    const warnCount = report.errors.filter(e => e.severity === 'warning').length;

    auditCounts.innerHTML = `
      ${errCount > 0 ? `<span class="count-badge error">${errCount} Errors</span>` : ''}
      ${warnCount > 0 ? `<span class="count-badge warn">${warnCount} Warnings</span>` : ''}
    `;
  }

  // Populate list
  if (report.errors.length === 0) {
    findingsList.innerHTML = `
      <div class="finding-empty">
        🎉 Security audit passed. Zero policies violated.
      </div>
    `;
    return;
  }

  report.errors.forEach(err => {
    const item = document.createElement('div');
    item.className = `finding-item f-${err.severity}`;
    
    let label = 'ERROR';
    if (err.severity === 'warning') label = 'WARNING';
    if (err.severity === 'security') label = 'VULNERABILITY';

    item.innerHTML = `
      <div class="finding-meta">
        <span class="f-sev-${err.severity}">${label}</span>
        <span class="f-line">Line ${err.line}</span>
      </div>
      <div class="finding-msg">${err.message}</div>
    `;
    findingsList.appendChild(item);
  });
}

function updateCheckState(el, passed) {
  el.className = `policy-item ${passed ? 'pass' : 'fail'}`;
  const icon = el.querySelector('.policy-icon');
  if (icon) {
    icon.textContent = passed ? '✔️' : '❌';
  }
}

function resetLinterReport() {
  ringValue.textContent = '--';
  ringFg.style.strokeDashoffset = 201.06;
  ringFg.className.baseVal = 'ring-fg';

  auditVerdict.textContent = 'Pending';
  auditVerdict.className = 'audit-verdict';
  auditRunInfo.textContent = 'Awaiting pipeline audit';
  auditCounts.innerHTML = '';

  updateCheckState(polSyntax, true);
  polSyntax.className = 'policy-item';
  polSyntax.querySelector('.policy-icon').textContent = '⚪';

  updateCheckState(polEval, true);
  polEval.className = 'policy-item';
  polEval.querySelector('.policy-icon').textContent = '⚪';

  updateCheckState(polDom, true);
  polDom.className = 'policy-item';
  polDom.querySelector('.policy-icon').textContent = '⚪';

  updateCheckState(polSSL, true);
  polSSL.className = 'policy-item';
  polSSL.querySelector('.policy-icon').textContent = '⚪';

  findingsList.innerHTML = `
    <div class="finding-empty">Run the pipeline to generate audit findings.</div>
  `;
}

function resetDAGFlow() {
  dagSpec.className = 'dag-node';
  dagSpecState.textContent = 'IDLE';
  
  dagCode.className = 'dag-node';
  dagCodeState.textContent = 'IDLE';
  
  dagQa.className = 'dag-node';
  dagQaState.textContent = 'IDLE';
  
  dagOut.className = 'dag-node dag-node-output';
  dagOutState.textContent = 'AWAITING';

  arrow1.className = 'dag-arrow';
  arrow2.className = 'dag-arrow bidirectional';
  arrow3.className = 'dag-arrow approved';
}

function resetStagesList() {
  stageSpec.className = 'stage';
  stageSpecState.textContent = 'Idle';
  
  stageCode.className = 'stage';
  stageCodeState.textContent = 'Idle';
  
  stageQa.className = 'stage';
  stageQaState.textContent = 'Idle';
  
  stageDone.className = 'stage';
  stageDoneState.textContent = 'Idle';
}
