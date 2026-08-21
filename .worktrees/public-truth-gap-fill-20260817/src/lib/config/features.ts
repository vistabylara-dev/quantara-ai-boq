import {
  PUBLIC_CAPABILITIES,
  type PublicCapabilityStatus,
} from "@/lib/public-site/product-truth";

export type FeatureStatus = "available" | "controlled" | "limited" | "unavailable";

export interface PublicFeature {
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  status: FeatureStatus;
}

const publicStatus: Record<PublicCapabilityStatus, FeatureStatus> = {
  AVAILABLE: "available",
  CONTROLLED_ACCESS: "controlled",
  LIMITED: "limited",
  NOT_AVAILABLE: "unavailable",
};

export const publicFeatures: PublicFeature[] = PUBLIC_CAPABILITIES.map((capability) => ({
  slug: capability.id,
  name: capability.name,
  shortDescription: capability.summary,
  longDescription: capability.limitation
    ? `${capability.summary} ${capability.limitation}`
    : capability.summary,
  status: publicStatus[capability.status],
}));
