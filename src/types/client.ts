export type Client = {
  id: string;
  companyId: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxRegistrationNumber: string | null;
  notes: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientWithProjectCount = Client & { projectCount: number };

export type ClientListResult = {
  items: Client[];
  total: number;
  page: number;
  pageSize: number;
};
