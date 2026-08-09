export const publicAccessOptions = [
  {
    name: "Controlled Early Access",
    commercialTerms: "Access reviewed before activation",
    description: "Request access to Quantara's currently supported BOQ workflows.",
    features: [
      "Supported text-based PDF, XLSX and CSV workflows",
      "Structured BOQ review and project records",
      "Professional review required before commercial use",
      "Workspace and feature availability confirmed during review"
    ],
    href: "/register",
    ctaLabel: "Request Early Access",
    featured: true
  },
  {
    name: "Requirements and Commercial Review",
    commercialTerms: "Custom written scope and quotation",
    description: "Discuss organizational requirements before access or paid services are proposed.",
    features: [
      "Workflow and supported-format review",
      "Configuration and integration availability check",
      "Implementation scope documented before commitment",
      "Commercial terms confirmed separately in writing"
    ],
    href: "/contact-sales",
    ctaLabel: "Discuss Requirements",
    featured: false
  }
] as const;
