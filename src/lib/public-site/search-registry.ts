import type { Metadata, MetadataRoute } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const PUBLIC_SITE_ORIGIN = "https://quantara.vistabylara.com";
export const PUBLIC_CONTENT_REVIEW_DATE = "2026-09-06";

export type PublicTopicCluster =
  | "core"
  | "pdf-extraction"
  | "measurement"
  | "audience"
  | "regional"
  | "education"
  | "comparison"
  | "company"
  | "legal";

export type PublicSearchPage = {
  path: `/${string}` | "/";
  title: string;
  description: string;
  cluster: PublicTopicCluster;
  intent: "commercial" | "informational" | "navigational";
  indexable?: boolean;
  priority?: number;
  changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"];
};

function page(entry: PublicSearchPage): PublicSearchPage {
  return entry;
}

const metadataCopy = getDictionary("en").publicContent.metadata;

export const PUBLIC_SEARCH_PAGES = [
  page({ path: "/", title: "AI BOQ & Quantity Takeoff Software | Quantara", description: "Upload drawings and generate a quantity-complete unpriced BOQ with calculation evidence, source provenance and engineer review across ten industries.", cluster: "core", intent: "commercial", priority: 1, changeFrequency: "weekly" }),
  page({ path: "/features", title: "AI Quantity Takeoff & BOQ Features | Quantara", description: "Generate evidence-backed unpriced BOQs from drawings, review assumptions and quantities, add rates, control revisions and produce documents.", cluster: "core", intent: "commercial", priority: 0.95, changeFrequency: "weekly" }),
  page({ path: "/about", title: "About Quantara BOQ Workflow Software", description: "Learn what Quantara is, who it supports and how Vista By Lara is developing an AI-assisted BOQ workflow for construction professionals.", cluster: "company", intent: "navigational" }),
  page({ path: "/security", title: metadataCopy.securityTitle, description: metadataCopy.securityDescription, cluster: "company", intent: "informational" }),
  page({ path: "/terms", title: metadataCopy.termsTitle, description: metadataCopy.termsDescription, cluster: "legal", intent: "navigational", priority: 0.3, changeFrequency: "yearly" }),
  page({ path: "/privacy", title: metadataCopy.privacyTitle, description: metadataCopy.privacyDescription, cluster: "legal", intent: "navigational", priority: 0.3, changeFrequency: "yearly" }),
  page({ path: "/data-processing", title: metadataCopy.dataProcessingTitle, description: metadataCopy.dataProcessingDescription, cluster: "legal", intent: "navigational", indexable: false, priority: 0.3, changeFrequency: "yearly" }),
  page({ path: "/cookie-policy", title: metadataCopy.cookiePolicyTitle, description: metadataCopy.cookiePolicyDescription, cluster: "legal", intent: "navigational", indexable: false, priority: 0.3, changeFrequency: "yearly" }),
  page({ path: "/acceptable-use", title: metadataCopy.acceptableUseTitle, description: metadataCopy.acceptableUseDescription, cluster: "legal", intent: "navigational", indexable: false, priority: 0.3, changeFrequency: "yearly" }),
  page({ path: "/subprocessors", title: metadataCopy.subprocessorsTitle, description: metadataCopy.subprocessorsDescription, cluster: "legal", intent: "navigational", indexable: false, priority: 0.3, changeFrequency: "yearly" }),
  page({ path: "/contact-sales", title: metadataCopy.contactSalesTitle, description: metadataCopy.contactSalesDescription, cluster: "company", intent: "commercial" }),
  page({ path: "/ai-boq-software", title: "AI BOQ Generator from Drawings | Quantara", description: "Select an industry, upload the drawing set and generate a structured, quantity-complete unpriced BOQ with formulas, evidence, assumptions and engineer review.", cluster: "core", intent: "commercial", priority: 0.98, changeFrequency: "weekly" }),
  page({ path: "/boq-software", title: "Professional BOQ Software for Construction Teams | Quantara", description: "Create complete BOQs with AI assistance and professional controls for items, quantities, units, rates, calculations, revisions, validation and outputs.", cluster: "core", intent: "commercial" }),
  page({ path: "/construction-estimating-software", title: "Construction Estimating and BOQ Software | Quantara", description: "Understand how Quantara supports BOQ organization and reviewed estimating inputs while leaving rates, risk and professional decisions to the team.", cluster: "core", intent: "commercial" }),
  page({ path: "/boq-management", title: "BOQ Management Software for Projects | Quantara", description: "Organize BOQ sections, items, quantities, revisions and supported outputs inside controlled project workflows with professional review.", cluster: "core", intent: "commercial" }),
  page({ path: "/pdf-boq-extraction", title: "PDF BOQ Extraction for Text-Based Files | Quantara", description: "See how Quantara captures supported information from text-based PDF BOQs for review, plus the limits for complex and scanned files.", cluster: "pdf-extraction", intent: "commercial" }),
  page({ path: "/scanned-pdf-boq", title: "Scanned PDF BOQ Detection and OCR Status | Quantara", description: "Quantara detects image-only PDF pages but does not currently perform OCR text extraction. Learn the manual review path and limitations.", cluster: "pdf-extraction", intent: "informational" }),
  page({ path: "/quantity-surveying-software", title: "AI Quantity Surveying & Takeoff Software | Quantara", description: "Turn supported drawing sets into traceable unpriced BOQs, with quantity evidence, visible calculations, assumptions, revisions and professional outputs.", cluster: "audience", intent: "commercial", priority: 0.95, changeFrequency: "weekly" }),
  page({ path: "/tayqan-ai-quantity-surveyor", title: "TAYQAN AI Quantity Surveyor for BOQ Work | Quantara", description: "Hire TAYQAN, Quantara's governed Digital QS, for source review, quantity preparation, BOQ assembly and QA with final human acceptance.", cluster: "audience", intent: "commercial", priority: 0.95, changeFrequency: "weekly" }),
  page({ path: "/boq-integrations", title: "BOQ Integrations for Construction Software | Quantara", description: "Explore Quantara integration pages for BIM, CAD, CDE, cloud storage, estimating, structural engineering and construction management tools.", cluster: "core", intent: "commercial", priority: 0.9, changeFrequency: "weekly" }),
  page({ path: "/boq-document-generation", title: "BOQ Document Generation from Reviewed Data | Quantara", description: "Generate supported BOQ documents and project outputs from reviewed records while keeping professional approval outside the software.", cluster: "core", intent: "commercial" }),
  page({ path: "/resources", title: "BOQ Resources and Construction Workflow Guides", description: "Explore practical BOQ definitions, document-extraction guidance, review checklists, measurement formulas and workflow comparisons.", cluster: "education", intent: "informational" }),
  page({ path: "/what-is-a-boq", title: "What Is a BOQ? Meaning, Example & Format", description: "A clear guide to Bill of Quantities meaning, sections, units, unpriced and priced BOQs, examples, preparation and professional review.", cluster: "education", intent: "informational", priority: 0.9, changeFrequency: "monthly" }),
  page({ path: "/boq-vs-construction-estimate", title: "BOQ vs Construction Estimate: Key Differences", description: "Compare a Bill of Quantities with a construction estimate across scope, quantities, rates, assumptions and project use.", cluster: "education", intent: "informational" }),
  page({ path: "/boq-vs-bill-of-materials", title: "BOQ vs Bill of Materials: Key Differences", description: "Compare a Bill of Quantities with a Bill of Materials across purpose, structure, quantities, labour and construction use.", cluster: "education", intent: "informational" }),
  page({ path: "/how-to-prepare-a-boq", title: "How to Prepare a BOQ: Professional Workflow Guide", description: "Follow a practical BOQ preparation workflow covering source review, scope, item structure, measurement, rates, checking and issue control.", cluster: "education", intent: "informational" }),
  page({ path: "/boq-review-checklist", title: "BOQ Review Checklist for Construction Teams", description: "Use a practical checklist to review BOQ scope, descriptions, quantities, units, rates, assumptions, exclusions and revisions.", cluster: "education", intent: "informational" }),
  page({ path: "/common-boq-errors", title: "Common BOQ Errors and Professional Review Steps", description: "Learn how to identify common BOQ omissions, duplicates, unit errors, quantity issues, weak descriptions and revision conflicts.", cluster: "education", intent: "informational" }),
  page({ path: "/boq-revision-control", title: "BOQ Revision Control and Version Management", description: "Learn how clear BOQ versions, change records, review decisions and issue status support controlled construction workflows.", cluster: "education", intent: "informational" }),
  page({ path: "/how-to-convert-pdf-boq-to-excel", title: "How to Convert a PDF BOQ to Excel Safely", description: "Review a practical PDF-to-Excel BOQ workflow covering selectable text, scanned pages, tables, merged cells, quantities and verification.", cluster: "pdf-extraction", intent: "informational" }),
  page({ path: "/text-pdf-vs-scanned-pdf", title: "Text PDF vs Scanned PDF for BOQ Extraction", description: "Understand how selectable-text and image-only PDFs affect BOQ extraction, OCR requirements, error risk and professional review.", cluster: "pdf-extraction", intent: "informational" }),
  page({ path: "/ocr-for-boq-documents", title: "OCR for BOQ Documents: Uses and Limitations", description: "Learn what OCR does for scanned BOQ files, where recognition errors occur and why Quantara's current workflow does not include OCR extraction.", cluster: "pdf-extraction", intent: "informational" }),
  page({ path: "/how-to-review-ai-extracted-boq", title: "How to Review AI-Extracted BOQ Information", description: "Follow a structured review of AI-assisted BOQ extraction covering sources, descriptions, units, quantities, exceptions and approval boundaries.", cluster: "pdf-extraction", intent: "informational" }),
  page({ path: "/quantity-takeoff-vs-boq-management", title: "Quantity Takeoff vs BOQ Management", description: "Compare drawing measurement and quantity takeoff with BOQ organization, revision control, validation and document workflows.", cluster: "measurement", intent: "informational" }),
  page({ path: "/industries", title: "Industry-Specific BOQ Software | Quantara", description: "Create professional BOQs for contractors, QS, MEP, HVAC, fit-out, fire protection, FM and consultants with specialist libraries and engineer control.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-contractors", title: "BOQ Software for Contractors | Quantara", description: "Support contractor BOQ sources, reviewed extraction, item organization, revisions, validation and professional project outputs.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-quantity-surveyors", title: "BOQ Software for Quantity Surveyors | Quantara", description: "Review sources, dimensions, visible calculations, BOQ records and revisions while retaining full professional judgement and responsibility.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-mep-contractors", title: "MEP BOQ Software for Contractors | Quantara", description: "Create MEP BOQs with supported schedules, direct item and measurement controls, visible calculations, specialist libraries, rates, revisions and outputs.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-hvac-contractors", title: "HVAC BOQ Software for Contractors | Quantara", description: "Create HVAC BOQs using specialist catalogue items, controlled duct and pipe measurements, visible quantity formulas, rates, revisions and outputs.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-fit-out-companies", title: "Fit-Out & Interior BOQ Software | Quantara", description: "Create fit-out BOQs with finishes libraries, controlled room measurements, quantities, rates, client revisions and professional outputs in one workspace.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-fire-fighting-contractors", title: "Fire-Fighting BOQ Software | Quantara", description: "Create fire-protection BOQs with supported schedules, professional engineering inputs, specialist items, controlled rates, revisions and outputs.", cluster: "audience", intent: "commercial" }),
  page({ path: "/boq-software-for-facilities-management", title: "Facilities Management BOQ Software | Quantara", description: "Facilities Management is not currently a supported autonomous Quantara estimator industry.", cluster: "audience", intent: "informational", indexable: false, priority: 0.2, changeFrequency: "yearly" }),
  page({ path: "/boq-software-for-engineering-consultants", title: "BOQ Software for Engineering Consultants | Quantara", description: "Prepare consultant BOQs with structured sources, engineering input, visible calculations, controlled revisions and client-ready professional outputs.", cluster: "audience", intent: "commercial" }),
  page({ path: "/gcc-boq-software", title: "BOQ Software for GCC Construction Teams | Quantara", description: "Create professional GCC BOQs with AI-assisted preparation, engineer-controlled workflows, industry libraries, visible calculations, rates and revisions.", cluster: "regional", intent: "commercial" }),
  page({ path: "/boq-software-uae", title: "BOQ Software UAE for Construction Teams | Quantara", description: "Create and deliver UAE construction BOQs using AI-assisted preparation, direct item and quantity control, specialist libraries, rates and outputs.", cluster: "regional", intent: "commercial" }),
  page({ path: "/boq-software-dubai", title: "BOQ Software Dubai for Contractors & QS | Quantara", description: "Prepare Dubai project BOQs with AI-assisted sources, full engineer control, industry-specific items, visible formulas, rates, revisions and outputs.", cluster: "regional", intent: "commercial" }),
  page({ path: "/boq-software-abu-dhabi", title: "BOQ Software Abu Dhabi for Project Teams | Quantara", description: "Prepare Abu Dhabi project BOQs with supported AI assistance, controlled measurements and rates, specialist libraries, revisions and professional outputs.", cluster: "regional", intent: "commercial" }),
  page({ path: "/construction-estimating-software-uae", title: "Construction Estimating Software UAE | Quantara", description: "Organize reviewed estimating inputs and BOQ records for UAE projects while keeping pricing, risk and commercial decisions with professionals.", cluster: "regional", intent: "commercial" }),
  page({ path: "/mep-estimating-software-uae", title: "MEP Estimating and BOQ Software UAE | Quantara", description: "Organize supported UAE MEP schedules, BOQ items and revisions without claiming automatic drawing takeoff, rates or design compliance.", cluster: "regional", intent: "commercial" }),
  page({ path: "/boq-software-saudi-arabia", title: "BOQ Software for Saudi Arabia Projects | Quantara", description: "Support review-led BOQ organization for Saudi projects without claims of local regulatory approval, market rates or automatic measurement.", cluster: "regional", intent: "commercial" }),
  page({ path: "/boq-software-qatar", title: "BOQ Software for Qatar Project Workflows | Quantara", description: "Organize supported Qatar BOQ records and revisions without claims of local authority approval, pricing data or automated takeoff.", cluster: "regional", intent: "commercial" }),
  page({ path: "/boq-software-oman", title: "BOQ Software for Oman Project Workflows | Quantara", description: "Support structured BOQ exchange and review for Oman projects without claims of local approval, market rates or automatic measurement.", cluster: "regional", intent: "commercial" }),
  page({ path: "/comparisons", title: "BOQ Software and Workflow Comparisons", description: "Compare BOQ software with spreadsheets, manual preparation, OCR, quantity takeoff and document management using clear capability boundaries.", cluster: "comparison", intent: "informational" }),
  page({ path: "/boq-software-comparison-uae", title: "BOQ Software Comparison UAE | Quantara", description: "Compare Quantara, CostX, Candy, Procore, Autodesk Forma Takeoff, STACK and PlanSwift by BOQ workflow, takeoff, controls, outputs and UAE fit.", cluster: "comparison", intent: "commercial" }),
  page({ path: "/quantara-vs-excel-for-boq", title: "Quantara vs Excel for BOQ Workflows", description: "Compare Quantara and Excel across project sources, BOQ structure, visible calculations, revisions, validation and professional control.", cluster: "comparison", intent: "commercial" }),
  page({ path: "/boq-software-vs-spreadsheets", title: "BOQ Software vs Spreadsheets: Workflow Comparison", description: "Compare structured BOQ software and spreadsheets across records, formulas, revisions, collaboration, review and output control.", cluster: "comparison", intent: "informational" }),
  page({ path: "/ai-boq-vs-manual-boq-preparation", title: "AI-Assisted vs Manual BOQ Preparation", description: "Compare AI-assisted and manual BOQ preparation across source handling, review, correction and professional responsibility without invented savings.", cluster: "comparison", intent: "informational" }),
  page({ path: "/ocr-vs-structured-boq-extraction", title: "OCR vs Structured BOQ Extraction", description: "Compare text recognition with structured BOQ extraction, field review and project organization, including Quantara's current no-OCR limitation.", cluster: "comparison", intent: "informational" }),
  page({ path: "/quantity-takeoff-vs-boq-software", title: "AI Takeoff Software Comparison: Quantara, Togal, Kreo & CostX", description: "Compare Quantara with Togal.AI, Kreo and RIB CostX for drawing takeoff, estimating, unpriced BOQ generation, evidence, revisions and professional outputs.", cluster: "comparison", intent: "commercial" }),
  page({ path: "/boq-software-vs-document-management", title: "BOQ Software vs Document Management", description: "Compare BOQ item and revision workflows with document storage systems across structured records, review, validation and outputs.", cluster: "comparison", intent: "informational" }),
  page({ path: "/construction-estimating-software-vs-excel", title: "Construction Estimating Software vs Excel", description: "Compare construction estimating software and Excel across BOQs, rates, assumptions, formulas, revisions and professional review.", cluster: "comparison", intent: "informational" }),
  page({ path: "/when-to-use-boq-software", title: "When to Use BOQ Software: Decision Guide", description: "Assess when BOQ software may help with source volume, item structure, calculation review, revisions, validation and team coordination.", cluster: "comparison", intent: "informational" }),
  page({ path: "/site-map", title: "Quantara Public Website Sitemap", description: "Browse Quantara's public product, audience, regional, comparison, educational, company and legal pages from one directory.", cluster: "company", intent: "navigational", priority: 0.4 }),
  page({ path: "/boq-calculation-formulas", title: "BOQ Calculation Formulas and Quantity Guide", description: "Review common length, area, volume, weight and cost formulas with professional-input requirements and project-specific limitations.", cluster: "measurement", intent: "informational" }),
  page({ path: "/pricing", title: metadataCopy.pricingTitle, description: metadataCopy.pricingDescription, cluster: "company", intent: "commercial" }),
] as const satisfies readonly PublicSearchPage[];

export type PublicSearchPath = (typeof PUBLIC_SEARCH_PAGES)[number]["path"];

export function getPublicSearchPage(path: PublicSearchPath): PublicSearchPage {
  const entry = PUBLIC_SEARCH_PAGES.find((candidate) => candidate.path === path);
  if (!entry) throw new Error(`Unknown public search path: ${path}`);
  return entry;
}

const AR_SEO: Record<string, { title: string; description: string }> = {
  "/": {
    "title": "برنامج إعداد جداول الكميات المدعوم بالذكاء الاصطناعي في الإمارات | Quantara",
    "description": "أنشئ وسلّم جداول كميات احترافية مع إعداد مدعوم بالذكاء الاصطناعي، وتحكم كامل للمهندس، وقياس موجّه، وحسابات مرئية، ومراجعات ومخرجات متكامل."
  },
  "/features": {
    "title": "ميزات برنامج جداول الكميات وتحكم المهندس | Quantara",
    "description": "اجمع بين مسودة جدول الكميات بالذكاء الاصطناعي والإنشاء المباشر للبنود، والقياس الموجّه، والمعادلات، والأسعار، والمراجعات، ومكتبات قطاع الإنشاءات، وTAYQAN، والمخرجات المهنية."
  },
  "/about": {
    "title": "نبذة عن برنامج سير عمل جداول الكميات من Quantara",
    "description": "تعرّف إلى Quantara، والفئات المستفيدة منها، وكيف تطور Vista By Lara سير عمل جداول الكميات المدعوم بالذكاء الاصطناعي للمتخصصين في قطاع الإنشاءات."
  },
  "/ai-boq-software": {
    "title": "برنامج جداول الكميات المدعوم بالذكاء الاصطناعي مع تحكم المهندس | Quantara",
    "description": "استخدم إعداد جداول الكميات المدعوم بالذكاء الاصطناعي حيثما كان متاحاً، ثم قم بالإضافة والقياس والحساب والتسعير والمراجعة والتسليم لكل بند آخر ضمن سير عمل واحد."
  },
  "/boq-software": {
    "title": "برنامج جداول الكميات الاحترافي لفرق الإنشاءات | Quantara",
    "description": "أنشئ جداول كميات كاملة بمساعدة الذكاء الاصطناعي وتحكم مهني للبنود والكميات والوحدات والأسعار والحسابات والمراجعات والتحقق والمخرجات."
  },
  "/construction-estimating-software": {
    "title": "برنامج تقدير تكاليف البناء وجداول الكميات | Quantara",
    "description": "افهم كيف تدعم Quantara تنظيم جداول الكميات ومدخلات التقدير المراجعة، مع ترك قرارات الأسعار والمخاطر والقرارات المهنية لفريق العمل."
  },
  "/boq-management": {
    "title": "برنامج إدارة جداول الكميات للمشاريع | Quantara",
    "description": "نظم أقسام جداول الكميات وبنودها وكمياتها ومراجعاتها والمخرجات المدعومة ضمن مسارات عمل محكومة للمشروع مع مراجعة مهنية."
  },
  "/pdf-boq-extraction": {
    "title": "استخراج جداول الكميات من ملفات PDF النصية | Quantara",
    "description": "شاهد كيف تلتقط Quantara المعلومات المدعومة من ملفات جداول الكميات النصية بصيغة PDF لمراجعتها، مع حدود التعامل مع الملفات المعقدة والممسوحة ضوئيًا."
  },
  "/scanned-pdf-boq": {
    "title": "اكتشاف ملفات PDF الممسوحة ضوئيًا وحالة تقنية OCR | Quantara",
    "description": "تكتشف Quantara صفحات PDF المكونة من صور فقط، لكنها لا تدعي استخراج النص عبر OCR حاليًا. تعرّف إلى مسار المراجعة اليدوية وحدود النظام."
  },
  "/quantity-surveying-software": {
    "title": "برنامج حصر الكميات وإعداد جداول الكميات في الإمارات | Quantara",
    "description": "ساعد حاسبي الكميات في إعداد جداول كميات كاملة باستخدام مصادر مدعومة بالذكاء الاصطناعي، وقياس موجّه، وحسابات مرئية، وأسعار ومراجعات ومخرجات محكومة."
  },
  "/tayqan-ai-quantity-surveyor": {
    "title": "حاسب الكميات الرقمي TAYQAN لمهام جداول الكميات | Quantara",
    "description": "عيّن TAYQAN، حاسب الكميات الرقمي المحكوم في Quantara، لمراجعة المصادر، وإعداد الكميات، وتجميع جدول الكميات وفحوصات الجودة مع موافقة بشرية نهائية."
  },
  "/boq-integrations": {
    "title": "تكاملات جداول الكميات مع برامج الإنشاءات | Quantara",
    "description": "استكشف صفحات تكامل Quantara لأدوات BIM، وCAD، وبيئات البيانات المشتركة (CDE)، والتخزين السحابي، وتقدير التكاليف، والهندسة الإنشائية، وإدارة الإنشاءات."
  },
  "/boq-document-generation": {
    "title": "إنشاء مستندات جداول الكميات من البيانات المُراجعة | Quantara",
    "description": "أنشئ مستندات جداول الكميات المدعومة ومخرجات المشروع من السجلات المُراجعة مع الحفاظ على الاعتماد المهني خارج البرنامج."
  },
  "/resources": {
    "title": "موارد جداول الكميات وأدلة سير عمل الإنشاءات",
    "description": "استكشف التعريفات العملية لجداول الكميات، وإرشادات استخراج المستندات، وقوائم المراجعة، ومعادلات القياس، ومقارنات مسارات العمل."
  },
  "/what-is-a-boq": {
    "title": "ما هو جدول الكميات (BOQ)؟ شرح مفصل",
    "description": "تعرّف إلى محتويات جدول الكميات، ومن يقوم بإعداده ومراجعته، وكيف يدعم عمليات طرح المناقصات والتسعير ومراقبة المشروع."
  },
  "/boq-vs-construction-estimate": {
    "title": "جدول الكميات مقابل تقدير تكاليف البناء: الفروق الرئيسية",
    "description": "قارن بين جدول الكميات وتقدير تكاليف البناء من حيث النطاق، والكميات، والأسعار، والافتراضات، والاستخدام في المشروع."
  },
  "/boq-vs-bill-of-materials": {
    "title": "جدول الكميات مقابل قائمة المواد: الفروق الرئيسية",
    "description": "قارن بين جدول الكميات وقائمة المواد من حيث الغرض، والهيكل، والكميات، والعمالة، والاستخدام في أعمال التنفيذ."
  },
  "/how-to-prepare-a-boq": {
    "title": "كيفية إعداد جدول كميات: دليل مسار العمل المهني",
    "description": "اتبع مسار عمل عملي لإعداد جدول الكميات يغطي مراجعة المصدر، والنطاق، وهيكل البنود، والقياس، والأسعار، والتدقيق، والتحكم في الإصدارات."
  },
  "/boq-review-checklist": {
    "title": "قائمة مراجعة جدول الكميات لفرق الإنشاءات",
    "description": "استخدم قائمة مرجعية عملية لمراجعة نطاق جدول الكميات، والأوصاف، والكميات، والوحدات، والأسعار، والافتراضات، والاستثناءات، والمراجعات."
  },
  "/common-boq-errors": {
    "title": "أخطاء جداول الكميات الشائعة وخطوات المراجعة المهنية",
    "description": "تعرّف إلى كيفية تحديد حالات الإغفال الشائعة في جداول الكميات، والتكرار، وأخطاء الوحدات، ومشكلات الكميات، والأوصاف الضعيفة، وتعارض المراجعات."
  },
  "/boq-revision-control": {
    "title": "التحكم في مراجعات وإصدارات جدول الكميات",
    "description": "تعرّف كيف تدعم الإصدارات الواضحة لجداول الكميات وسجلات التغييرات وقرارات المراجعة وحالة الإصدار مسارات عمل الإنشاءات المنضبطة."
  },
  "/how-to-convert-pdf-boq-to-excel": {
    "title": "كيفية تحويل جدول كميات PDF إلى Excel بشكل آمن",
    "description": "راجع سير عمل عملي لتحويل جداول الكميات من PDF إلى Excel يغطي النصوص القابلة للتحديد، والصفحات الممسوحة ضوئيًا، والجداول، والخلايا المدمجة، والكميات، والتحقق."
  },
  "/text-pdf-vs-scanned-pdf": {
    "title": "ملفات PDF النصية مقابل ملفات PDF الممسوحة ضوئيًا لاستخراج جداول الكميات",
    "description": "افهم كيف تؤثر ملفات PDF النصية وملفات PDF المصورة على استخراج جداول الكميات، ومتطلبات تقنية التعرف الضوئي على الحروف (OCR)، ومخاطر الأخطاء، والمراجعة المهنية."
  },
  "/ocr-for-boq-documents": {
    "title": "تقنية OCR لمستندات جداول الكميات: الاستخدامات والقيود",
    "description": "تعرّف إلى ما تقدمه تقنية OCR لملفات جداول الكميات الممسوحة ضوئيًا، ومواضع أخطاء التعرف، وسبب عدم شمول مسار عمل Quantara الحالي لاستخراج OCR."
  },
  "/how-to-review-ai-extracted-boq": {
    "title": "كيفية مراجعة معلومات جداول الكميات المستخرجة بالذكاء الاصطناعي",
    "description": "اتبع مراجعة منظمة لاستخراج جداول الكميات المدعوم بالذكاء الاصطناعي تغطي المصادر، والأوصاف، والوحدات، والكميات، والاستثناءات، وحدود الاعتماد."
  },
  "/quantity-takeoff-vs-boq-management": {
    "title": "حصر الكميات مقابل إدارة جداول الكميات",
    "description": "قارن بين أدوات القياس عبر المخططات وحصر الكميات وبين تنظيم جداول الكميات، والتحكم في الإصدارات، والتحقق، ومسارات عمل المستندات."
  },
  "/industries": {
    "title": "برنامج جداول الكميات المتخصص | Quantara",
    "description": "أنشئ جداول كميات احترافية للمقاولين، وحاسبي الكميات، ومقاولي الأعمال الميكانيكية والكهربائية (MEP)، والتكييف (HVAC)، وأعمال التجهيز الداخلي، ومكافحة الحريق، وإدارة المرافق، والاستشاريين مع مكتبات متخصصة وتحكم هندسي."
  },
  "/boq-software-for-contractors": {
    "title": "برنامج جداول الكميات للمقاولين | Quantara",
    "description": "ادعم مصادر جداول كميات المقاولين، والاستخراج المراجع، وتنظيم البنود، والإصدارات، والتحقق، ومخرجات المشاريع المهنية."
  },
  "/boq-software-for-quantity-surveyors": {
    "title": "برنامج جداول الكميات لحاسبي الكميات | Quantara",
    "description": "راجع المصادر، والأبعاد، والحسابات المرئية، وسجلات ومراجعات جداول الكميات مع الاحتفاظ بالحكم والمسؤولية المهنية الكاملة."
  },
  "/boq-software-for-mep-contractors": {
    "title": "برنامج جداول كميات الأعمال الميكانيكية والكهربائية للمقاولين | Quantara",
    "description": "أنشئ جداول كميات أعمال MEP مع جداول مدعومة، وضوابط مباشرة للبنود والقياس، وحسابات مرئية، ومكتبات متخصصة، وأسعار، ومراجعات ومخرجات."
  },
  "/boq-software-for-hvac-contractors": {
    "title": "برنامج جداول كميات أنظمة التكييف (HVAC) للمقاولين | Quantara",
    "description": "أنشئ جداول كميات أعمال التكييف (HVAC) باستخدام بنود الكتالوج المتخصصة، والقياسات المنضبطة للأنابيب والمجاري، ومعادلات الكميات المرئية، والأسعار، والمراجعات، والمخرجات."
  },
  "/boq-software-for-fit-out-companies": {
    "title": "برنامج جداول كميات أعمال التجهيز الداخلي | Quantara",
    "description": "أنشئ جداول كميات أعمال التجهيز الداخلي (Fit-out) مع مكتبات التشطيبات، وقياسات الغرف المضبوطة، والكميات، والأسعار، ومراجعات العملاء، والمخرجات المهنية في مساحة عمل واحدة."
  },
  "/boq-software-for-fire-fighting-contractors": {
    "title": "برنامج جداول كميات أنظمة مكافحة الحريق | Quantara",
    "description": "أنشئ جداول كميات أنظمة مكافحة الحريق مع جداول مدعومة، ومدخلات هندسية مهنية، وبنود متخصصة، وأسعار مضبوطة، ومراجعات ومخرجات."
  },
  "/boq-software-for-facilities-management": {
    "title": "برنامج جداول كميات إدارة المرافق | Quantara",
    "description": "جهّز جداول كميات أعمال الصيانة والإصلاح والتجديد مع بنود قابلة لإعادة الاستخدام، وكميات وأسعار مضبوطة، وإصدارات، ومراجعة العملاء والمخرجات المهنية."
  },
  "/boq-software-for-engineering-consultants": {
    "title": "برنامج جداول الكميات للاستشاريين الهندسيين | Quantara",
    "description": "أعد جداول الكميات الاستشارية مع مصادر منظمة، ومدخلات هندسية، وحسابات مرئية، ومراجعات محكومة، ومخرجات احترافية جاهزة للعميل."
  },
  "/gcc-boq-software": {
    "title": "برنامج جداول الكميات لفرق الإنشاءات في دول الخليج | Quantara",
    "description": "أنشئ جداول كميات خليجية احترافية مع إعداد مدعوم بالذكاء الاصطناعي، ومسارات عمل يتحكم فيها المهندس، ومكتبات متخصصة، وحسابات مرئية، وأسعار وإصدارات."
  },
  "/boq-software-uae": {
    "title": "برنامج جداول الكميات في الإمارات لفرق الإنشاءات | Quantara",
    "description": "أنشئ وسلّم جداول كميات مشاريع الإنشاءات في الإمارات باستخدام الإعداد المدعوم بالذكاء الاصطناعي، والتحكم المباشر في البنود والكميات، والمكتبات المتخصصة، والأسعار والمخرجات."
  },
  "/boq-software-dubai": {
    "title": "برنامج جداول الكميات في دبي للمقاولين وحاسبي الكميات | Quantara",
    "description": "أعد جداول كميات مشاريع دبي باستخدام مصادر مدعومة بالذكاء الاصطناعي، وتحكم هندسي كامل، وبنود متخصصة في القطاع، ومعادلات مرئية، وأسعار، ومراجعات، ومخرجات."
  },
  "/boq-software-abu-dhabi": {
    "title": "برنامج جداول الكميات في أبوظبي لفرق المشاريع | Quantara",
    "description": "أعد جداول كميات مشاريع أبوظبي مع مساعدة الذكاء الاصطناعي المدعومة، والقياسات والأسعار المنضبطة، والمكتبات المتخصصة، والمراجعات، والمخرجات المهنية."
  },
  "/construction-estimating-software-uae": {
    "title": "برنامج تقدير تكاليف البناء في الإمارات | Quantara",
    "description": "نظم مدخلات التقدير المُراجعة وسجلات جداول الكميات لمشاريع الإمارات مع إبقاء قرارات التسعير والمخاطر والقرارات التجارية بيد المتخصصين."
  },
  "/mep-estimating-software-uae": {
    "title": "برنامج تقدير أعمال MEP وجداول الكميات في الإمارات | Quantara",
    "description": "نظم جداول مشاريع MEP في الإمارات المدعومة وبنود جداول الكميات والإصدارات دون الادعاء بحصر المخططات تلقائيًا أو تسعيرها أو الامتثال للتصميم."
  },
  "/boq-software-saudi-arabia": {
    "title": "برنامج جداول الكميات لمشاريع السعودية | Quantara",
    "description": "ادعم تنظيم جداول الكميات المستندة إلى المراجعة لمشاريع السعودية دون الادعاء بالاعتماد التنظيمي المحلي، أو أسعار السوق، أو القياس التلقائي."
  },
  "/boq-software-qatar": {
    "title": "برنامج جداول الكميات لمشاريع قطر | Quantara",
    "description": "نظم سجلات وإصدارات جداول الكميات المدعومة في قطر دون الادعاء باعتماد الجهات المحلية، أو توفير بيانات التسعير، أو حصر الكميات الآلي."
  },
  "/boq-software-oman": {
    "title": "برنامج جداول الكميات لمسارات العمل في عمان | Quantara",
    "description": "ادعم تبادل جداول الكميات المنظمة ومراجعتها للمشاريع في عمان دون الادعاء بالاعتماد المحلي، أو تقديم أسعار السوق، أو القياس الآلي."
  },
  "/comparisons": {
    "title": "مقارنات برامج جداول الكميات ومسارات العمل",
    "description": "قارن برامج جداول الكميات مع جداول البيانات، والإعداد اليدوي، وتقنية OCR، وحصر الكميات، وإدارة المستندات باستخدام حدود قدرات واضحة."
  },
  "/boq-software-comparison-uae": {
    "title": "مقارنة برامج جداول الكميات في الإمارات | Quantara",
    "description": "قارن Quantara، وCostX، وCandy، وProcore، وAutodesk Forma Takeoff، وSTACK، وPlanSwift من حيث مسار عمل جدول الكميات، وحصر الكميات، والضوابط، والمخرجات، وملاءمتها للسوق الإماراتي."
  },
  "/quantara-vs-excel-for-boq": {
    "title": "Quantara مقابل Excel لمسارات عمل جداول الكميات",
    "description": "قارن بين Quantara وExcel من حيث مصادر المشروع، وهيكل جدول الكميات، والحسابات المرئية، والمراجعات، والتحقق، والتحكم المهني."
  },
  "/boq-software-vs-spreadsheets": {
    "title": "برنامج جداول الكميات مقابل جداول البيانات: مقارنة مسارات العمل",
    "description": "قارن بين برامج جداول الكميات المنظمة وجداول البيانات من حيث السجلات، والمعادلات، والإصدارات، والتعاون، والمراجعة، والتحكم في المخرجات."
  },
  "/ai-boq-vs-manual-boq-preparation": {
    "title": "إعداد جدول الكميات بمساعدة الذكاء الاصطناعي مقابل الإعداد اليدوي",
    "description": "قارن بين إعداد جدول الكميات بمساعدة الذكاء الاصطناعي والإعداد اليدوي من حيث التعامل مع المصادر، والمراجعة، والتصحيح، والمسؤولية المهنية دون اختلاق وفورات غير واقعية."
  },
  "/ocr-vs-structured-boq-extraction": {
    "title": "تقنية OCR مقابل الاستخراج المنظم لجدول الكميات",
    "description": "قارن تقنية التعرف على النصوص بالاستخراج المنظم لجدول الكميات، والمراجعة الميدانية وتنظيم المشروع، متضمنًا قيد Quantara الحالي المتعلق بعدم وجود تقنية OCR."
  },
  "/quantity-takeoff-vs-boq-software": {
    "title": "حصر الكميات مقابل برنامج جداول الكميات",
    "description": "قارن أدوات القياس المستندة إلى المخططات ببرامج مسار عمل جدول الكميات من حيث مراجعة المصادر، والحسابات، والإصدارات، والتحقق، والمخرجات."
  },
  "/boq-software-vs-document-management": {
    "title": "برنامج جداول الكميات مقابل إدارة المستندات",
    "description": "قارن مسارات عمل بنود وإصدارات جداول الكميات مع أنظمة تخزين المستندات من حيث السجلات المنظمة، والمراجعة، والتحقق، والمخرجات."
  },
  "/construction-estimating-software-vs-excel": {
    "title": "برنامج تقدير تكاليف البناء مقابل Excel",
    "description": "قارن بين برنامج تقدير تكاليف البناء وExcel من حيث جداول الكميات، والأسعار، والافتراضات، والمعادلات، والإصدارات، والمراجعة المهنية."
  },
  "/when-to-use-boq-software": {
    "title": "متى تستخدم برنامج جداول الكميات: دليل اتخاذ القرار",
    "description": "قيّم متى يمكن لبرنامج جداول الكميات المساعدة في حجم المصادر، وهيكل البنود، ومراجعة الحسابات، والإصدارات، والتحقق، وتنسيق جهود الفريق."
  },
  "/site-map": {
    "title": "خريطة الموقع العام لـ Quantara",
    "description": "تصفح صفحات المنتج العامة لـ Quantara، والفئات المستهدفة، والمناطق، والمقارنات، والموارد التعليمية، وصفحات الشركة، والصفحات القانونية من دليل واحد."
  },
  "/boq-calculation-formulas": {
    "title": "معادلات حساب جداول الكميات ودليل الكميات",
    "description": "راجع معادلات الطول والمساحة والحجم والوزن والتكلفة الشائعة مع متطلبات الإدخال المهنية والقيود الخاصة بالمشروع."
  }
,
  "/data-processing": {
    "title": "?????? ???????? | Quantara",
    "description": "???? ??? ????? ???? Quantara ??????? ???????? ???????? ??? ?????? ?? ???????? ????????."
  },
  "/cookie-policy": {
    "title": "????? ????? ????? ???????? | Quantara",
    "description": "????? ??? ?????? Quantara ????? ????? ???????? ??????? ?????? ???????? ?????? ??????."
  },
  "/acceptable-use": {
    "title": "????? ????????? ??????? | Quantara",
    "description": "??????? ????????? ??????? ???????? ????? Quantara ????? ???? ???? ????? ??????????."
  },
  "/subprocessors": {
    "title": "????????? ???????? | Quantara",
    "description": "????? ?????????? ???????? ????????? ????? ??????? ?? ????? ????? Quantara."
  },
  "/privacy": {
    "title": "????? ???????? | Quantara",
    "description": "???? ??? ????? ????? ???????? ??????? ?????????? ???????? ?? Quantara."
  },
  "/terms": {
    "title": "?????? ???????? | Quantara",
    "description": "?????? ???????? ????????? ???? ???? ???????? ????? ?????? Quantara."
  },
  "/security": {
    "title": "?????? ????????? | Quantara",
    "description": "????? ?????? Quantara ????? ???????? ??????? ???????? ????????? ???????? ????????."
  },
  "/pricing": {
    "title": "??????? ?????? ???????? | Quantara",
    "description": "????? ????? ???????? ?????? ???? ????? ???????? ?????? ?? ????? ????? ?????? ????? ???????."
  },
  "/contact-sales": {
    "title": "????? ?? ???????? | Quantara",
    "description": "????? ?? ???? ?????? Quantara ??????? ???????? ??????? ??? ??? ???? ??????."
  }
};

export function createPublicPageMetadata(path: PublicSearchPath, locale?: string): Metadata {
  const entry = getPublicSearchPage(path);
  const isAr = locale === 'ar';
  
  let currentTitle = entry.title;
  let currentDescription = entry.description;
  
  if (isAr && AR_SEO[path]) {
    currentTitle = AR_SEO[path].title;
    currentDescription = AR_SEO[path].description;
  }

  const enUrl = `${PUBLIC_SITE_ORIGIN}${path === '/' ? '' : path}`;
  const arUrl = `${PUBLIC_SITE_ORIGIN}/ar${path === '/' ? '' : path}`;
  const canonicalUrl = isAr ? arUrl : enUrl;

  return {
    title: { absolute: currentTitle },
    description: currentDescription,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'en-AE': enUrl,
        'ar-AE': arUrl,
        'x-default': enUrl,
      },
    },
    robots: {
      index: entry.indexable !== false,
      follow: entry.indexable !== false,
      googleBot: {
        index: entry.indexable !== false,
        follow: entry.indexable !== false,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title: currentTitle,
      description: currentDescription,
      url: canonicalUrl,
      siteName: 'Quantara',
      locale: isAr ? 'ar_AE' : 'en_AE',
      type: 'website',
      images: [{
        url: `${PUBLIC_SITE_ORIGIN}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: 'Quantara AI-assisted BOQ workflow software',
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: currentTitle,
      description: currentDescription,
      images: [`${PUBLIC_SITE_ORIGIN}/twitter-image`],
    },
  };
}
export function createPublicUtilityMetadata(
  path: string,
  title: string,
  description: string,
): Metadata {
  const canonicalUrl = `${PUBLIC_SITE_ORIGIN}${path === "/" ? "" : path}`;
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: { "en-AE": canonicalUrl },
    },
    robots: { index: false, follow: false, noarchive: true },
  };
}

export function createPrivateUtilityMetadata(
  title: string,
  description: string,
): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: null },
    robots: { index: false, follow: false, noarchive: true },
    referrer: "no-referrer",
  };
}
