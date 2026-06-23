import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeLinter } from './linter.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure Sandbox Directory Exists
const SANDBOX_DIR = path.join(__dirname, 'output_sandbox');
if (!fs.existsSync(SANDBOX_DIR)) {
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });
}

// Active SSE Connections and Event Queues
const activeRuns = new Map();

/**
 * Event Broker for streaming execution logs.
 */
class ExecutionBroker {
  constructor() {
    this.clients = [];
    this.history = [];
    this.isDone = false;
  }

  addClient(res) {
    this.clients.push(res);
    // Replay history to late-joining connections
    this.history.forEach(evt => {
      res.write(`data: ${JSON.stringify(evt)}\n\n`);
    });
  }

  removeClient(res) {
    this.clients = this.clients.filter(c => c !== res);
  }

  emit(type, data) {
    const event = { type, timestamp: new Date().toISOString(), data };
    this.history.push(event);
    this.clients.forEach(res => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
  }

  complete() {
    this.isDone = true;
    this.emit('complete', { status: 'FINISHED' });
    this.clients.forEach(res => res.end());
    this.clients = [];
  }
}

// Helper to write file safely in sandbox
function writeSandboxFile(filename, content) {
  const safeFilename = path.basename(filename);
  const targetPath = path.join(SANDBOX_DIR, safeFilename);
  fs.writeFileSync(targetPath, content, 'utf-8');
  return targetPath;
}

// Helper to read file safely in sandbox
function readSandboxFile(filename) {
  const safeFilename = path.basename(filename);
  const targetPath = path.join(SANDBOX_DIR, safeFilename);
  if (fs.existsSync(targetPath)) {
    return fs.readFileSync(targetPath, 'utf-8');
  }
  throw new Error(`File ${filename} not found in sandbox.`);
}

/**
 * SIMULATED MULTI-AGENT PIPELINE
 * Emulates the multi-agent correction loop dynamically using the user's prompt.
 */
async function runSimulation(broker, prompt) {
  const cleanPrompt = prompt.trim() || "modern web page";
  broker.emit('status', { state: 'spec_generation', message: 'Spec Writer Agent is planning structure...' });
  
  await new Promise(r => setTimeout(r, 2000));
  
  broker.emit('agent_thought', {
    agent: 'spec_writer_agent',
    thought: `Analyzing visual prompt: "${cleanPrompt}". Extracting design tokens and mapping to responsive Grid layout. Will enforce custom dark theme variables and details.`
  });

  const specMarkdown = `# Design Specification: ${cleanPrompt}
## Visual Language
- **Theme**: Premium Deep Cyber Dark
- **Color Palette (Tailwind)**:
  - Background: \`bg-[#090D1A]\` with gradient details
  - Card/Surfaces: \`bg-[#13192B]\` / \`border-[#253254]\`
  - Text Primary: \`text-[#E2E8F0]\`
  - Accents: \`text-cyan-400\`, \`bg-gradient-to-r from-purple-500 to-cyan-500\`
- **Typography**: Sans-serif, Inter-like structure

## Structural Blueprint
- **Layout**: Full-width header + Hero area + Multi-column service grid + Dynamic reservation/interactive dashboard card + Footer.
- **Interactions**:
  - Interactive item hover effects (transform, glow transition).
  - A responsive navbar toggler.
  - Interactive forms with validation feedback.`;

  broker.emit('spec_update', { spec: specMarkdown });
  broker.emit('status', { state: 'code_generation', message: 'UI Coder Agent is writing first revision of code...' });

  await new Promise(r => setTimeout(r, 2500));

  broker.emit('agent_thought', {
    agent: 'ui_coder_agent',
    thought: `Building structural DOM matching specification. Implementing HTML components and styling using Tailwind. Wait! I will include a testing javascript snippet containing an 'eval' call, and introduce a mismatched tag to test QA validation.`
  });

  broker.emit('tool_call', {
    agent: 'ui_coder_agent',
    tool: 'mcp_write_file',
    args: { filename: 'component.html' }
  });

  await new Promise(r => setTimeout(r, 1000));

  const buggyHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanPrompt} - VibeCraft Generated UI</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #090d1a; color: #e2e8f0; font-family: system-ui, sans-serif; }
    .glass { background: rgba(19, 25, 43, 0.7); border: 1px solid rgba(37, 50, 84, 0.4); backdrop-filter: blur(12px); }
  </style>
</head>
<body class="p-6 min-h-screen flex flex-col justify-between">

  <!-- Header -->
  <header class="flex justify-between items-center mb-10 py-4 border-b border-gray-800">
    <div class="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">VIBECRAFT.AI</div>
    <nav class="space-x-6 text-sm font-medium">
      <a href="#" class="hover:text-cyan-400 transition">Dashboard</a>
      <a href="#" class="hover:text-cyan-400 transition">Services</a>
      <a href="#" class="hover:text-cyan-400 transition">Logs</a>
    </nav>
  </header>

  <!-- Main Container -->
  <main class="flex-grow max-w-4xl mx-auto w-full">
    <div class="glass p-8 rounded-2xl shadow-2xl relative overflow-hidden mb-8">
      <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-cyan-500"></div>
      <h1 class="text-3xl font-extrabold mb-4 tracking-tight">${cleanPrompt}</h1>
      <p class="text-gray-400 mb-6 leading-relaxed">This prototype was automatically generated by VibeCraft's multi-agent autonomous coding pipeline.</p>
      
      <!-- Interactive Sandbox element -->
      <div class="p-6 bg-slate-900/50 rounded-lg border border-slate-800">
        <h3 class="text-lg font-semibold mb-3 text-cyan-300">Counter Interaction Check</h3>
        <p class="text-sm text-gray-400 mb-4">Click button to test interactive vanilla JS scope:</p>
        <div class="flex items-center space-x-4">
          <button id="counterBtn" class="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 rounded-md font-semibold text-sm transition transform hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/20">Increment Counter</button>
          <span id="counterVal" class="text-2xl font-mono text-cyan-400">0</span>
        </div>
      </div>
    <!-- Missing closing div tag here to trigger syntax warning -->
  </main>

  <footer class="mt-12 text-center text-xs text-gray-500 border-t border-gray-900 pt-6">
    Generated prototype via Autonomous Agent Pipeline.
  </footer>

  <script>
    // Click action
    const btn = document.getElementById('counterBtn');
    const val = document.getElementById('counterVal');
    let count = 0;
    btn.addEventListener('click', () => {
      count++;
      val.textContent = count;
      
      // Deliberate eval call for checking QA Security validation
      const expr = "count";
      const debugVal = eval(expr);
      console.log('Interpreted value:', debugVal);
    });
  </script>
</body>
</html>`;

  writeSandboxFile('component.html', buggyHtml);
  broker.emit('tool_response', {
    agent: 'ui_coder_agent',
    tool: 'mcp_write_file',
    status: 'SUCCESS',
    filename: 'component.html'
  });

  broker.emit('code_update', { filename: 'component.html', content: buggyHtml, revision: 1 });
  broker.emit('status', { state: 'qa_evaluation', message: 'QA Judge Agent is auditing code syntax and security rules...' });

  await new Promise(r => setTimeout(r, 2000));

  broker.emit('agent_thought', {
    agent: 'qa_judge_agent',
    thought: `Executing linter verification on component.html using mcp_execute_linter. Scanning code content for syntax issues, nested structures, and raw executable wrappers.`
  });

  broker.emit('tool_call', {
    agent: 'qa_judge_agent',
    tool: 'mcp_execute_linter',
    args: { filename: 'component.html' }
  });

  await new Promise(r => setTimeout(r, 1000));

  const linterOutputFirst = executeLinter(path.join(SANDBOX_DIR, 'component.html'));
  broker.emit('linter_report', { filename: 'component.html', report: linterOutputFirst });
  
  broker.emit('tool_response', {
    agent: 'qa_judge_agent',
    tool: 'mcp_execute_linter',
    status: 'WARNING_ERRORS_FOUND',
    errors: linterOutputFirst.errors
  });

  broker.emit('agent_thought', {
    agent: 'qa_judge_agent',
    thought: `Code fails validation! Found tag imbalance (missing closing </div> for the outer layout container) and security violation (use of raw 'eval()' inside counter script). Sending detailed debug report back to ui_coder_agent for refactoring.`
  });

  await new Promise(r => setTimeout(r, 2000));

  broker.emit('status', { state: 'code_generation', message: 'UI Coder Agent is repairing code defects...' });

  await new Promise(r => setTimeout(r, 2500));

  broker.emit('agent_thought', {
    agent: 'ui_coder_agent',
    thought: `Analyzing QA audit feedback. Will close the unbalanced layout div on line 36 and remove the prohibited 'eval()' call, replacing it with straight numerical assignment.`
  });

  broker.emit('tool_call', {
    agent: 'ui_coder_agent',
    tool: 'mcp_write_file',
    args: { filename: 'component.html' }
  });

  await new Promise(r => setTimeout(r, 1000));

  const cleanHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanPrompt} - VibeCraft Generated UI</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #090d1a; color: #e2e8f0; font-family: system-ui, sans-serif; }
    .glass { background: rgba(19, 25, 43, 0.7); border: 1px solid rgba(37, 50, 84, 0.4); backdrop-filter: blur(12px); }
  </style>
</head>
<body class="p-6 min-h-screen flex flex-col justify-between">

  <!-- Header -->
  <header class="flex justify-between items-center mb-10 py-4 border-b border-gray-800">
    <div class="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">VIBECRAFT.AI</div>
    <nav class="space-x-6 text-sm font-medium">
      <a href="#" class="hover:text-cyan-400 transition">Dashboard</a>
      <a href="#" class="hover:text-cyan-400 transition">Services</a>
      <a href="#" class="hover:text-cyan-400 transition">Logs</a>
    </nav>
  </header>

  <!-- Main Container -->
  <main class="flex-grow max-w-4xl mx-auto w-full">
    <div class="glass p-8 rounded-2xl shadow-2xl relative overflow-hidden mb-8">
      <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-cyan-500"></div>
      <h1 class="text-3xl font-extrabold mb-4 tracking-tight">${cleanPrompt}</h1>
      <p class="text-gray-400 mb-6 leading-relaxed">This prototype was automatically generated by VibeCraft's multi-agent autonomous coding pipeline.</p>
      
      <!-- Interactive Sandbox element -->
      <div class="p-6 bg-slate-900/50 rounded-lg border border-slate-800">
        <h3 class="text-lg font-semibold mb-3 text-cyan-300">Counter Interaction Check</h3>
        <p class="text-sm text-gray-400 mb-4">Click button to test interactive vanilla JS scope:</p>
        <div class="flex items-center space-x-4">
          <button id="counterBtn" class="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 rounded-md font-semibold text-sm transition transform hover:scale-105 active:scale-95 shadow-lg shadow-cyan-500/20">Increment Counter</button>
          <span id="counterVal" class="text-2xl font-mono text-cyan-400">0</span>
        </div>
      </div>
    </div> <!-- CLOSED UNBALANCED TAG -->
  </main>

  <footer class="mt-12 text-center text-xs text-gray-500 border-t border-gray-900 pt-6">
    Generated prototype via Autonomous Agent Pipeline.
  </footer>

  <script>
    // Click action
    const btn = document.getElementById('counterBtn');
    const val = document.getElementById('counterVal');
    let count = 0;
    btn.addEventListener('click', () => {
      count++;
      val.textContent = count;
      
      // Removed insecure eval call, direct local logging used
      console.log('Interpreted value:', count);
    });
  </script>
</body>
</html>`;

  writeSandboxFile('component.html', cleanHtml);
  broker.emit('tool_response', {
    agent: 'ui_coder_agent',
    tool: 'mcp_write_file',
    status: 'SUCCESS',
    filename: 'component.html'
  });

  broker.emit('code_update', { filename: 'component.html', content: cleanHtml, revision: 2 });
  broker.emit('status', { state: 'qa_evaluation', message: 'QA Judge Agent is re-auditing components...' });

  await new Promise(r => setTimeout(r, 2000));

  broker.emit('agent_thought', {
    agent: 'qa_judge_agent',
    thought: `Executing linter verification on updated file component.html.`
  });

  broker.emit('tool_call', {
    agent: 'qa_judge_agent',
    tool: 'mcp_execute_linter',
    args: { filename: 'component.html' }
  });

  await new Promise(r => setTimeout(r, 1000));

  const linterOutputSecond = executeLinter(path.join(SANDBOX_DIR, 'component.html'));
  broker.emit('linter_report', { filename: 'component.html', report: linterOutputSecond });
  
  broker.emit('tool_response', {
    agent: 'qa_judge_agent',
    tool: 'mcp_execute_linter',
    status: 'SUCCESS',
    errors: []
  });

  broker.emit('agent_thought', {
    agent: 'qa_judge_agent',
    thought: `All syntax checks passed. Security audit checks clean. No eval() or dangerous scripts found. Layout structures are balanced. Emitting [STATUS: APPROVED]`
  });

  await new Promise(r => setTimeout(r, 1000));

  broker.emit('status', { state: 'complete', message: 'Pipeline Approved!' });
  broker.complete();
}

/**
 * LIVE MULTI-AGENT PIPELINE USING GEMINI
 * Executes actual API calls and loops.
 */
async function runLivePipeline(broker, prompt, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  let htmlFilename = 'component.html';
  let fileContent = '';
  let iteration = 0;
  let maxIterations = 3;
  let specMarkdown = '';

  try {
    // 1. SPEC WRITER AGENT
    broker.emit('status', { state: 'spec_generation', message: 'Spec Writer Agent generating design document...' });
    
    const specModel = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      systemInstruction: `You are an expert Frontend Architect. Your role is to break down casual user requests into strict design specifications.
- Extract structural layout, responsive requirements, and color tokens (using Tailwind CSS classes).
- Detail all interactive states (hover, focus, active).
- Output a structured Markdown specification. Do not write the actual source code.`
    });

    broker.emit('agent_thought', {
      agent: 'spec_writer_agent',
      thought: `Translating user query "${prompt}" into design specifications and Tailwind UI architecture.`
    });

    const specResult = await specModel.generateContent(`Create a frontend specification for the following UI: "${prompt}"`);
    specMarkdown = specResult.response.text();
    
    broker.emit('spec_update', { spec: specMarkdown });

    // Multi-agent loop
    while (iteration < maxIterations) {
      iteration++;
      broker.emit('status', { state: 'code_generation', message: `UI Coder Agent drafting version ${iteration}...` });
      
      const coderModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: `You are a specialized UI Engineer proficient in HTML, Tailwind CSS, and vanilla JavaScript.
- Read the specification document provided to you.
- Write standalone, production-ready, single-file interactive UI components.
- Do NOT include any markdown code blocks (like \`\`\`html) in your response, return ONLY the raw HTML content.
- If you receive error logs or rejection feedback from the QA Judge, analyze the failure and correct the code.`
      });

      broker.emit('agent_thought', {
        agent: 'ui_coder_agent',
        thought: `Generating source code for ${htmlFilename} based on architecture specs. Iteration: ${iteration}`
      });

      broker.emit('tool_call', {
        agent: 'ui_coder_agent',
        tool: 'mcp_write_file',
        args: { filename: htmlFilename }
      });

      // Assemble query for coder
      let coderPrompt = `Specification:\n${specMarkdown}\n\nUser Prompt: ${prompt}`;
      if (fileContent) {
        // We had a previous revision and validation failed
        const linterReport = executeLinter(path.join(SANDBOX_DIR, htmlFilename));
        coderPrompt += `\n\nPrevious Code version:\n${fileContent}\n\nValidation Feedback:\n${JSON.stringify(linterReport.errors)}`;
      }

      const coderResult = await coderModel.generateContent(coderPrompt);
      let newCode = coderResult.response.text().trim();
      
      // Clean up markdown block wrapping if agent included it
      if (newCode.startsWith('```html')) {
        newCode = newCode.replace(/^```html/, '').replace(/```$/, '').trim();
      } else if (newCode.startsWith('```')) {
        newCode = newCode.replace(/^```/, '').replace(/```$/, '').trim();
      }

      fileContent = newCode;
      writeSandboxFile(htmlFilename, fileContent);

      broker.emit('tool_response', {
        agent: 'ui_coder_agent',
        tool: 'mcp_write_file',
        status: 'SUCCESS',
        filename: htmlFilename
      });
      broker.emit('code_update', { filename: htmlFilename, content: fileContent, revision: iteration });

      // 3. QA EVALUATION
      broker.emit('status', { state: 'qa_evaluation', message: `QA Judge auditing version ${iteration}...` });
      
      broker.emit('agent_thought', {
        agent: 'qa_judge_agent',
        thought: `Executing safety inspections and syntax checks on ${htmlFilename}.`
      });

      broker.emit('tool_call', {
        agent: 'qa_judge_agent',
        tool: 'mcp_execute_linter',
        args: { filename: htmlFilename }
      });

      const linterReport = executeLinter(path.join(SANDBOX_DIR, htmlFilename));
      broker.emit('linter_report', { filename: htmlFilename, report: linterReport });

      broker.emit('tool_response', {
        agent: 'qa_judge_agent',
        tool: 'mcp_execute_linter',
        status: linterReport.valid ? 'SUCCESS' : 'WARNING_ERRORS_FOUND',
        errors: linterReport.errors
      });

      // QA Agent audit of contents
      const qaModel = genAI.getGenerativeModel({
        model: "gemini-2.5-pro",
        systemInstruction: `You are a zero-trust QA Engineer and Security Auditor. Your job is to prevent broken or unsafe code from exiting the pipeline.
Evaluate code against these rules:
1. Ensure the UI aligns with the design spec.
2. Confirm there are no unclosed HTML nodes or unbalanced scripts.
3. Check for security issues: NO eval(), NO raw document.write(), NO insecure scripts.
4. Output EXACTLY the token "[STATUS: APPROVED]" if all checks pass and the code is secure.
5. If issues are found, list the failures clearly so the coder can fix them. Do not approve.`
      });

      const qaPrompt = `Specification:\n${specMarkdown}\n\nCode to inspect:\n${fileContent}\n\nLinter Errors Found:\n${JSON.stringify(linterReport.errors)}`;
      const qaResult = await qaModel.generateContent(qaPrompt);
      const qaVerdict = qaResult.response.text();

      broker.emit('agent_thought', {
        agent: 'qa_judge_agent',
        thought: `QA Audit completed. Verdict:\n${qaVerdict}`
      });

      if (qaVerdict.includes('[STATUS: APPROVED]') && linterReport.valid) {
        broker.emit('status', { state: 'complete', message: 'Pipeline Approved and Terminated Successfully!' });
        broker.complete();
        return;
      } else {
        // Code fails check, trigger next iteration
        broker.emit('agent_thought', {
          agent: 'qa_judge_agent',
          thought: `QA Audit rejected version ${iteration}. Instructing coder to perform corrections.`
        });
      }
    }

    // Out of iterations
    broker.emit('status', { state: 'complete', message: 'Pipeline exited: reached maximum correction iterations.' });
    broker.complete();

  } catch (error) {
    broker.emit('agent_thought', {
      agent: 'qa_judge_agent',
      thought: `Error encountered during agent pipeline processing: ${error.message}`
    });
    broker.emit('status', { state: 'complete', message: `Pipeline terminated with error: ${error.message}` });
    broker.complete();
  }
}

// Endpoints
app.post('/api/run-pipeline', (req, res) => {
  const { prompt, apiKey } = req.body;
  const runId = Math.random().toString(36).substring(2, 15);
  const broker = new ExecutionBroker();
  
  activeRuns.set(runId, broker);
  
  // Launch pipeline loop asynchronously
  if (apiKey) {
    runLivePipeline(broker, prompt, apiKey);
  } else {
    runSimulation(broker, prompt);
  }
  
  res.json({ runId });
});

app.get('/api/pipeline-stream', (req, res) => {
  const { id } = req.query;
  const broker = activeRuns.get(id);
  
  if (!broker) {
    res.status(404).send('Execution context not found');
    return;
  }
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  broker.addClient(res);
  
  req.on('close', () => {
    broker.removeClient(res);
  });
});

// Preview endpoint to render the component inside the sandbox
app.get('/api/preview/:filename', (req, res) => {
  try {
    const file = req.params.filename;
    const content = readSandboxFile(file);
    res.setHeader('Content-Type', 'text/html');
    res.send(content);
  } catch (error) {
    res.status(404).send(`<h3>404 Preview Not Found</h3><p>${error.message}</p>`);
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`VibeCraft Server running at http://localhost:${PORT}`);
});
