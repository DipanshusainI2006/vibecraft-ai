# VibeCraft AI — Project Documentation & Flow Architecture

## 📋 Project Description
**VibeCraft AI** is an autonomous web application interface generator powered by a multi-agent developer pipeline. It emulates an enterprise-grade development cycle by dividing tasks among specialized AI roles: creating visual design systems, writing responsive frontend code, and performing automated code quality audits.

The application allows users to submit visual prompt requirements (e.g., *"cyberpunk coffee shop landing page"*), watch the agents think, collaborate, and iterate via real-time console streaming, and interact with the finalized layout inside a sandboxed iframe.

### 🌟 Core Objectives
1.  **Orchestration Separation**: Breaking complex UI generation tasks down into separate visual design planning, coding, and code-review stages to optimize code accuracy and structure.
2.  **Zero-Trust QA Auditing**: Emulating secure, production-ready pipelines by executing an independent validation phase on every piece of code before deployment.
3.  **Self-Healing Capabilities**: Allowing agents to consume linter error logs and perform automated code repair iteratively without user intervention.

---

## ⚙️ Architecture & Execution Modes

VibeCraft AI runs on an Express backend and serves a CSS-driven glassmorphic web portal. It operates in two main modes:

*   **Interactive Simulation (Demo Mode)**: Emulates the multi-agent pipeline using pre-designed step-by-step agent interactions. In this mode, the system deliberately introduces a syntax error (unbalanced HTML tags) and a security hazard (`eval()`) to demonstrate how the automated self-healing loop corrects code errors.
*   **Live Gemini API Mode**: Integrates directly with the Google Gemini API (`gemini-2.5-pro` for spec planning/QA reviews, and `gemini-2.5-flash` for high-speed coding). It makes real API calls to synthesize specifications and write functional code, runs the custom linter live, and iteratively repairs code if errors are caught.

---

## 📐 Multi-Agent Flow Diagram

Below is the execution flow of the VibeCraft AI pipeline showing the sequential agent handoffs and the self-healing loop:

```mermaid
graph TD
    %% Define Styles
    classDef startEnd fill:#1A2333,stroke:#3B82F6,stroke-width:2px,color:#E2E8F0;
    classDef agentNode fill:#1E1B4B,stroke:#818CF8,stroke-width:2px,color:#E2E8F0;
    classDef process fill:#111827,stroke:#374151,stroke-width:1px,color:#9CA3AF;
    classDef decision fill:#312E81,stroke:#C084FC,stroke-width:2px,color:#E2E8F0;
    
    %% Flow Steps
    Start([User inputs design prompt]) --> Mode{Select Mode};
    
    %% Modes
    Mode -->|Demo Mode| Sim[Execute Simulated Pipeline];
    Mode -->|Live Mode| Live[Execute Live Gemini Pipeline];
    
    %% Spec Writer Agent
    Sim --> SpecAgent[<b>1. Spec Writer Agent</b><br/>Creates style guide and design specifications];
    Live --> SpecAgent;
    
    %% UI Coder Agent
    SpecAgent -->|Handoff Spec| CoderAgent[<b>2. UI Coder Agent</b><br/>Generates HTML, CSS (Tailwind), and Javascript];
    
    %% Output Generation
    CoderAgent -->|Writes component.html| WriteFile[Write to output_sandbox/];
    
    %% QA Judge Agent
    WriteFile --> QAAgent[<b>3. QA Judge Agent</b><br/>Reads file from sandbox and initiates Audit];
    QAAgent -->|Invokes executeLinter()| Linter[Execute Syntax & Security Scans];
    
    %% Decision Point
    Linter --> Verdict{Linter Passes?};
    
    %% Fail Loop
    Verdict -->|No: Syntax errors / Security warnings| FailLog[Generate Debug Logs];
    FailLog -->|Feedback Loop| CoderAgent;
    
    %% Success Loop
    Verdict -->|Yes: Approved| Approve[Promote code to Approved Output];
    Approve --> Sandbox[Render component in Preview Iframe];
    Sandbox --> End([Pipeline Successfully Terminated]);

    %% Apply Classes
    class Start,End startEnd;
    class SpecAgent,CoderAgent,QAAgent agentNode;
    class Sim,Live,WriteFile,Linter,FailLog,Approve,Sandbox process;
    class Mode,Verdict decision;
```

---

## 🎥 Agent Pipeline Execution Video

Here is a recording showing the autonomous multi-agent pipeline executing in simulation mode:

![Agent Pipeline Execution](images/agent_pipeline_execution.webp)

---

## 🛡️ QA Linter Rules

The QA validation is executed by the custom static analyzer inside `linter.js`. It enforces the following security and structural patterns:

| Target File | Severity Level | Linter Rule Description | Reason |
| :--- | :--- | :--- | :--- |
| **HTML** | `error` | Strict tag opening and closing balance using stack verification. | Prevents broken DOM layouts, rendering bugs, and broken visual hierarchies. |
| **HTML/JS** | `security-error` | Search and block raw usage of `eval()`. | Blocks raw string execution patterns to prevent Cross-Site Scripting (XSS) injections. |
| **HTML** | `security-warning` | Search and flag DOM manipulation via `document.write()`. | Poor performance and security; can overwrite the entire webpage DOM on load. |
| **HTML** | `security-warning` | Block loading scripts over unencrypted HTTP (e.g. `src="http://..."`). | Prevents Man-in-the-Middle (MITM) attacks and data interception. |
