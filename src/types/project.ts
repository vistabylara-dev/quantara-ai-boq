export type ProjectStatus = "draft" | "active" | "review" | "approved" | "completed";

export type Project = {
  id: string;
  reference: string;
  name: string;
  clientName: string;
  clientEmail: string;
  location: string;
  industryId: string;
  currency: string;
  taxRate: number;
  language: string;
  status: ProjectStatus;
  currentRevision: string;
  createdAt: string;
  updatedAt: string;
  description: string;
};
