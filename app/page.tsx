"use client";

import { FormEvent, useEffect, useState } from "react";

type Message = { role: "user" | "agent"; text: string };
type Task = { title: string; detail: string; state: "done" | "active" | "queued" | "failed" };
type MobileTab = "agent" | "preview" | "code" | "activity";
type AgentStep = { name: string; status: string; detail?: string };
type AgentResult = {
  previewUrl?: string | null;
  files?: string[];
  steps?: AgentStep[];
  executions?: Array<{ command: string; ok: boolean; stdout: string; stderr: string; durationMs: number }>;
  plan?: { summary?: string };
  repairAttempts?: number;
};

const seedTasks: Task[] = [
  { title: "Understand the request", detail: "Analyzing requirements and constraints", state: "done" },
  { title: "Plan the application", detail: "Qwen generates architecture and source files", state: "queued" },
  { title: "Build the project", detail: "Writing files and installing dependencies", state: "queued" },
  { title: "Run tests", detail: "Running the production build and inspecting failures", state: "queued" },
  { title: "Fix issues", detail: "Qwen diagnoses failures and repairs files", state: "queued" },
  { title: "Live preview", detail: "Starting the generated application", state: "queued" },
];

function taskState(status: string | undefined): Task["state"] {
  if (status === "completed") return "done";
  if (status === "running") return "active";
  if (status === "failed") return "failed";
  return "queued";
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState(seedTasks);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<MobileTab>("agent");
  const [workspaceId, setWorkspaceId] = useState("default");
  const [result, setResult] = useState<AgentResult | null>(null);

  useEffect(() => {
    const existing = window.localStorage.getItem("codexai-workspace-id");
    if (existing) setWorkspaceId(existing);
    else {
      const id = crypto.randomUUID().slice(0, 18);
      window.localStorage.setItem("codexai-workspace-id", id);
      setWorkspaceId(id);
    }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || running) return;

    setPrompt("");
    setRunning(true);
    setTab("agent");
    setResult(null);
    setMessages((current) => [
      ...current,
      { role: "user", text: value },
      { role: "agent", text: "I’m starting the autonomous build: planning files, creating the workspace, building and testing it…" },
    ]);
    setTasks(seedTasks.map((task, index) => ({ ...task, state: index === 0 ? "done" : index === 1 ? "active" : "queued" })));

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: value, workspaceId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Autonomous agent failed");
      setResult(data);

      const summary = data.plan?.summary ?? "Build completed.";
      const previewText = data.previewUrl ? `\n\nLive preview: ${data.previewUrl}` : "";
      const repairText = data.repairAttempts ? ` Automated repair attempts: ${data.repairAttempts}.` : "";
      setMessages((current) => [
        ...current.slice(0, -1),
        { role: "agent", text: `${summary}\n\nI created ${data.files?.length ?? 0} project files, ran the build/test loop, and attempted automated repair when needed.${repairText}${previewText}` },
      ]);

      const stepMap = new Map((data.steps ?? []).map((step: AgentStep) => [step.name, step.status]));
      const hasPlan = stepMap.has("plan");
      setTasks([
        { ...seedTasks[0], state: hasPlan ? "done" : "active" },
        { ...seedTasks[1], state: taskState(stepMap.get("plan")) },
        { ...seedTasks[2], state: taskState(stepMap.get("build")) },
        { ...seedTasks[3], state: taskState(stepMap.get("test")) },
        { ...seedTasks[4], state: taskState(stepMap.get("repair")) },
        { ...seedTasks[5], state: taskState(stepMap.get("deploy")) },
      ]);
      if (data.previewUrl) setTab("preview");
      else if (data.files?.length) setTab("code");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Agent request failed";
      setMessages((current) => [...current.slice(0, -1), { role: "agent", text }]);
      setTasks((current) => current.map((task, index) => index === 1 ? { ...task, state: "failed" } : task));
    } finally {
      setRunning(false);
    }
  }

  const setMobileTab = (nextTab: MobileTab) => {
    setTab(nextTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const codePreview = result?.files?.length
    ? result.files.map((file) => `// ${file}`).join("\n")
    : "// Generated project files will appear here.";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><div className="brand-mark">CX</div><strong>CodeXai</strong><span className="workspace-name">/ New project</span></div>
        <div className="header-actions"><span className="connection"><i /> Qwen connected</span><button className="icon-btn" aria-label="Settings">⚙</button><button className="publish-btn">Publish</button></div>
      </header>

      <div className="mobile-tabs">
        {(["agent", "preview", "code", "activity"] as MobileTab[]).map((item) => <button key={item} className={tab === item ? "selected" : ""} onClick={() => setMobileTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </div>

      <main className="builder-grid">
        <aside className="project-rail">
          <div className="rail-title">PROJECT</div>
          <div className="project-card"><span className="project-icon">✦</span><div><strong>New project</strong><small>{workspaceId}</small></div><span className="chevron">⌄</span></div>
          <div className="rail-title">WORKSPACE</div>
          <nav className="rail-nav"><button className="active">✦ <span>Agent</span></button><button>▦ <span>Files</span></button><button>◉ <span>Preview</span></button><button>⌁ <span>Deployments</span></button></nav>
          <div className="rail-bottom"><div className="usage"><span>Agent credits</span><strong>Ready</strong></div><div className="user-row"><span className="avatar">S</span><span>Workspace</span><button>•••</button></div></div>
        </aside>

        <section className={`agent-column mobile-pane ${tab === "agent" ? "mobile-pane-active" : ""}`}>
          <div className="column-heading"><div><strong>Agent</strong><small>Autonomous build workspace</small></div><span className={running ? "live live-running" : "live"}><i /> {running ? "Working" : "Ready"}</span></div>
          <div className="chat-scroll">
            {messages.length === 0 ? <div className="welcome"><div className="spark">✦</div><h1>What do you want to build?</h1><p>CodeXai will generate files with Qwen, execute them in a persistent Vercel Sandbox, build, repair failures, and start a live preview.</p><div className="suggestions"><button onClick={() => setPrompt("Build a modern SaaS dashboard with authentication and a responsive mobile layout")}>Build a SaaS dashboard</button><button onClick={() => setPrompt("Build a landing page for an AI product with pricing and a waitlist")}>Create a landing page</button><button onClick={() => setPrompt("Build a simple task manager with projects, filters and a mobile UI")}>Make a task manager</button></div></div> : <div className="conversation">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="message-avatar">{message.role === "user" ? "S" : "✦"}</div><div className="message-body"><span className="message-label">{message.role === "user" ? "You" : "CodeXai"}</span><p>{message.text}</p></div></div>)}</div>}
          </div>
          <form className="composer" onSubmit={submit}><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask CodeXai to build or change something…" rows={3} /><div className="composer-bar"><div className="composer-tools"><button type="button" aria-label="Attach">＋</button><span>Qwen • autonomous mode</span></div><button className="send-btn" disabled={running || !prompt.trim()}>{running ? "…" : "↑"}</button></div></form>
        </section>

        <section className={`preview-column mobile-pane ${tab === "preview" ? "mobile-pane-active" : ""}`}>
          <div className="preview-toolbar"><div className="view-title"><span className="traffic"><i /><i /><i /></span><strong>Live preview</strong><span className="preview-url">{result?.previewUrl ? "Sandbox :3000" : "waiting"}</span></div><div className="view-actions"><button>↻</button><button>↗</button><button className="device-active">▣</button></div></div>
          <div className="preview-canvas">{result?.previewUrl ? <iframe title="CodeXai live preview" src={result.previewUrl} className="live-preview-frame" /> : <div className="app-placeholder"><div className="placeholder-window"><div className="placeholder-top"><span /> <span /> <span /></div><div className="placeholder-content"><div className="placeholder-logo">✦</div><h2>Live app preview</h2><p>Run Build to create the app and start a real sandbox preview.</p><button onClick={() => setMobileTab("agent")}>Ask Agent to build</button></div></div></div>}</div>
        </section>

        <section className={`preview-column mobile-pane ${tab === "code" ? "mobile-pane-active" : ""}`}>
          <div className="preview-toolbar"><div className="view-title"><span className="traffic"><i /><i /><i /></span><strong>Generated files</strong><span className="preview-url">{result?.files?.length ? `${result.files.length} files` : "workspace"}</span></div></div>
          <div className="preview-canvas"><pre>{codePreview}</pre></div>
        </section>

        <aside className={`activity-panel mobile-pane ${tab === "activity" ? "mobile-pane-active" : ""}`} id="activity">
          <div className="activity-head"><div><strong>Build activity</strong><small>Autonomous task loop</small></div><button>•••</button></div>
          <div className="task-list">{tasks.map((task, index) => <div className={`task ${task.state}`} key={task.title}><div className="task-marker">{task.state === "done" ? "✓" : task.state === "active" ? <span className="loader" /> : task.state === "failed" ? "!" : index + 1}</div><div><strong>{task.title}</strong><span>{task.detail}</span></div></div>)}</div>
          {result?.executions?.length ? <div className="execution-list">{result.executions.map((item, index) => <div className="execution" key={`${item.command}-${index}`}><span className={item.ok ? "exec-ok" : "exec-fail"}>{item.ok ? "✓" : "!"}</span><code>{item.command}</code><small>{item.durationMs}ms</small></div>)}</div> : null}
          <div className="activity-footer"><span><i className={running ? "pulse" : ""} /> {running ? "Agent is working" : result ? "Build session complete" : "Waiting for a task"}</span><small>Persistent sandbox</small></div>
        </aside>
      </main>

      <nav className="bottom-nav">{(["agent", "preview", "code", "activity"] as MobileTab[]).map((item) => <button key={item} className={tab === item ? "selected" : ""} onClick={() => setMobileTab(item)}><span>{item === "agent" ? "✦" : item === "preview" ? "◉" : item === "code" ? "▤" : "☷"}</span><span>{item[0].toUpperCase() + item.slice(1)}</span></button>)}</nav>
    </div>
  );
}
