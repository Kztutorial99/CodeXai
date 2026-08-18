"use client";

import { FormEvent, useState } from "react";

type Message = { role: "user" | "agent"; text: string };
type Task = { title: string; detail: string; state: "done" | "active" | "queued" };

const seedTasks: Task[] = [
  { title: "Understand the request", detail: "Analyzing requirements and constraints", state: "done" },
  { title: "Plan the application", detail: "Choosing architecture and files", state: "active" },
  { title: "Build the project", detail: "Generating and editing files", state: "queued" },
  { title: "Run tests", detail: "Build, browser and runtime checks", state: "queued" },
  { title: "Fix issues", detail: "Review failures and iterate", state: "queued" },
  { title: "Publish", detail: "Prepare the production deployment", state: "queued" },
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState(seedTasks);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"preview" | "code">("preview");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || running) return;

    setPrompt("");
    setRunning(true);
    setMessages((current) => [...current, { role: "user", text: value }, { role: "agent", text: "I’m planning this build now…" }]);
    setTasks((current) => current.map((task, index) => ({ ...task, state: index === 1 ? "active" : index === 0 ? "done" : "queued" })));

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: value }),
      });
      const data = await response.json();
      const text = data.content ?? `Error: ${data.error ?? "Unknown agent error"}`;
      setMessages((current) => [...current.slice(0, -1), { role: "agent", text }]);
      setTasks((current) => current.map((task, index) => ({ ...task, state: index === 0 || index === 1 ? "done" : index === 2 ? "active" : "queued" })));
    } catch (error) {
      setMessages((current) => [...current.slice(0, -1), { role: "agent", text: error instanceof Error ? error.message : "Agent request failed" }]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><div className="brand-mark">CX</div><strong>CodeXai</strong><span className="workspace-name">/ New project</span></div>
        <div className="header-actions"><span className="connection"><i /> Qwen connected</span><button className="icon-btn" aria-label="Settings">⚙</button><button className="publish-btn">Publish</button></div>
      </header>

      <div className="mobile-tabs">
        <button className={tab === "preview" ? "selected" : ""} onClick={() => setTab("preview")}>Preview</button>
        <button className={tab === "code" ? "selected" : ""} onClick={() => setTab("code")}>Code</button>
        <button onClick={() => document.getElementById("activity")?.scrollIntoView({ behavior: "smooth" })}>Activity</button>
      </div>

      <main className="builder-grid">
        <aside className="project-rail">
          <div className="rail-title">PROJECT</div>
          <div className="project-card"><span className="project-icon">✦</span><div><strong>New project</strong><small>main</small></div><span className="chevron">⌄</span></div>
          <div className="rail-title">WORKSPACE</div>
          <nav className="rail-nav">
            <button className="active">✦ <span>Agent</span></button>
            <button>▦ <span>Files</span></button>
            <button>◉ <span>Preview</span></button>
            <button>⌁ <span>Deployments</span></button>
          </nav>
          <div className="rail-bottom"><div className="usage"><span>Agent credits</span><strong>Ready</strong></div><div className="user-row"><span className="avatar">S</span><span>Workspace</span><button>•••</button></div></div>
        </aside>

        <section className={`agent-column ${tab === "code" ? "mobile-hidden" : ""}`}>
          <div className="column-heading"><div><strong>Agent</strong><small>Build with natural language</small></div><span className={running ? "live live-running" : "live"}><i /> {running ? "Working" : "Ready"}</span></div>
          <div className="chat-scroll">
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="spark">✦</div>
                <h1>What do you want to build?</h1>
                <p>Describe your idea. CodeXai will plan the work, build it in an isolated environment, test it, and iterate on failures.</p>
                <div className="suggestions">
                  <button onClick={() => setPrompt("Build a modern SaaS dashboard with authentication and a responsive mobile layout")}>Build a SaaS dashboard</button>
                  <button onClick={() => setPrompt("Build a landing page for an AI product with pricing and a waitlist")}>Create a landing page</button>
                  <button onClick={() => setPrompt("Build a simple task manager with projects, filters and a mobile UI")}>Make a task manager</button>
                </div>
              </div>
            ) : (
              <div className="conversation">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="message-avatar">{message.role === "user" ? "S" : "✦"}</div><div className="message-body"><span className="message-label">{message.role === "user" ? "You" : "CodeXai"}</span><p>{message.text}</p></div></div>)}</div>
            )}
          </div>
          <form className="composer" onSubmit={submit}>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask CodeXai to build or change something…" rows={3} />
            <div className="composer-bar"><div className="composer-tools"><button type="button" aria-label="Attach">＋</button><span>Qwen • autonomous mode</span></div><button className="send-btn" disabled={running || !prompt.trim()}>{running ? "…" : "↑"}</button></div>
          </form>
        </section>

        <section className={`preview-column ${tab === "code" ? "code-active" : ""}`}>
          <div className="preview-toolbar"><div className="view-title"><span className="traffic"><i /><i /><i /></span><strong>{tab === "code" ? "Code" : "Live preview"}</strong><span className="preview-url">localhost:3000</span></div><div className="view-actions"><button>↻</button><button>↗</button><button className="device-active">▣</button></div></div>
          <div className="preview-canvas">
            {tab === "code" ? <pre>{`// CodeXai workspace\n// Your generated project will appear here.\n\nexport default function App() {\n  return <YourApp />;\n}`}</pre> : <div className="app-placeholder"><div className="placeholder-window"><div className="placeholder-top"><span /> <span /> <span /></div><div className="placeholder-content"><div className="placeholder-logo">✦</div><h2>Your app preview</h2><p>As CodeXai builds, the running application will appear here.</p><button>Open preview</button></div></div></div>}
          </div>
        </section>

        <aside className="activity-panel" id="activity">
          <div className="activity-head"><div><strong>Build activity</strong><small>Autonomous task loop</small></div><button>•••</button></div>
          <div className="task-list">{tasks.map((task, index) => <div className={`task ${task.state}`} key={task.title}><div className="task-marker">{task.state === "done" ? "✓" : task.state === "active" ? <span className="loader" /> : index + 1}</div><div><strong>{task.title}</strong><span>{task.detail}</span></div></div>)}</div>
          <div className="activity-footer"><span><i className={running ? "pulse" : ""} /> {running ? "Agent is working" : "Waiting for a task"}</span><small>Sandbox isolated</small></div>
        </aside>
      </main>

      <nav className="bottom-nav"><button className="selected">✦<span>Agent</span></button><button onClick={() => setTab("preview")}>◉<span>Preview</span></button><button onClick={() => setTab("code")}>▤<span>Code</span></button><button onClick={() => document.getElementById("activity")?.scrollIntoView({ behavior: "smooth" })}>☷<span>Activity</span></button></nav>
    </div>
  );
}
