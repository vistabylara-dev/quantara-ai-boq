export type MetricCard = {
  label: string;
  value: string;
  trend: string;
  state: "normal" | "success" | "warning" | "danger";
};

export type PhaseItem = {
  title: string;
  status: "active" | "locked";
  description: string;
};

export type ProjectRow = {
  name: string;
  projectId: string;
  stage: string;
  confidence: string;
  status: string;
  updated: string;
};
