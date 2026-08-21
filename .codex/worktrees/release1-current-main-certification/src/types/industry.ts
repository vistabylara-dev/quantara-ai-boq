export type IndustryStatus = "active" | "inactive" | "planned";

export type IndustryEngine = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  status: IndustryStatus;
  supportedUnits: string[];
  boqSections: IndustrySection[];
  requiredFields: string[];
  calculationTypes: string[];
  validationRules: string[];
  documentLabels: Record<string, string>;
  dashboardMetrics: IndustryDashboardMetric[];
};

export type IndustrySection = {
  id: string;
  code: string;
  title: string;
  description: string;
  order: number;
};

export type IndustryDashboardMetric = {
  label: string;
  value: string;
  status: "normal" | "success" | "warning" | "error";
};
