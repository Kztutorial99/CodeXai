export type AgentStepName = "plan" | "build" | "test" | "repair" | "deploy";

export type AgentStep = {
  id: string;
  name: AgentStepName;
  status: "pending" | "running" | "completed" | "failed";
  detail?: string;
  startedAt?: string;
  completedAt?: string;
};

export type SandboxRunResult = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type AgentPlan = {
  summary: string;
  tasks: string[];
  commands: string[];
};
