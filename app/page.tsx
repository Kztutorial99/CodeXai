"use client";

import { FormEvent, useState } from "react";

const initialSteps = [
  ["Plan", "Analyze requirements and architecture"],
  ["Build", "Generate and modify project files"],
  ["Test", "Run checks and inspect the preview"],
  ["Repair", "Diagnose failures and iterate"],
  ["Deploy", "Prepare the application for Vercel"],
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [running, setRunning] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim() || running) return;
    setRunning(true);
    setResult("Planning your application…");
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      setResult(data.content ?? `Error: ${data.error ?? "Unknown error"}`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Agent request failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><div className="logo">CX</div> CodeXai</div>
        <div className="status"><span className="dot" /> Qwen Agent ready</div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="section-title">Project</div>
          <div className="project"><strong>New application</strong><span>Autonomous workspace</span></div>
          <div className="section-title">Workspace</div>
          <nav className="nav">
            <button className="active">Overview</button>
            <button>Files</button>
            <button>Preview</button>
            <button>Terminal</button>
            <button>Deployments</button>
          </nav>
        </aside>
        <main className="main">
          <div className="toolbar"><h1>Autonomous Builder</h1><div className="toolbar-actions"><button className="btn">Preview</button><button className="btn primary">Deploy</button></div></div>
          <section className="preview">
            <div className="preview-head"><span className="browser-dot" /><span className="browser-dot" /><span className="browser-dot" /> Live Preview</div>
            <div className="preview-body">
              {result ? (
                <div><h2>Agent output</h2><p>{result}</p></div>
              ) : (
                <div>
                  <h2>Build with CodeXai</h2>
                  <p>Describe an application and the autonomous agent will plan the work. Runtime execution, browser testing, repair and Vercel deployment are the next layers of the platform.</p>
                </div>
              )}
            </div>
          </section>
        </main>
        <aside className="agent">
          <div className="agent-head"><strong>CodeXai Agent</strong><p>Powered by Qwen • autonomous workflow</p></div>
          <div className="steps">{initialSteps.map(([title, desc], index) => <div className={`step ${index === 0 ? "running" : ""}`} key={title}><div className="step-icon">{index + 1}</div><div><strong>{title}</strong><span>{desc}</span></div></div>)}</div>
          <form className="prompt" onSubmit={submit}>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Tell CodeXai what you want to build…" />
            <div className="prompt-row"><span className="hint">Qwen API runs server-side</span><button className="btn primary" disabled={running}>{running ? "Running…" : "Build"}</button></div>
          </form>
        </aside>
      </div>
    </div>
  );
}
