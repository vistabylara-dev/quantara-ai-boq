import type { Locale } from "@/lib/i18n/config";

const FEATURE_SALES = {
  en: {
    eyebrow: "Quantara capabilities",
    title: "Everything your team needs to complete and deliver a professional BOQ",
    intro:
      "Combine AI-assisted preparation with complete engineer-controlled BOQ creation, guided measurement, visible calculations, rates, revisions, industry libraries and professional outputs in one controlled construction workflow.",
    featureCountLabel: "Core workflow capabilities",
    integrationCountLabel: "Documented integration workflows",
    integrationTitle: "Connect Quantara to the construction tools your team already uses",
    integrationBody:
      "Explore documented workflows across BIM, CAD, common data environments, cloud storage, construction management, structural engineering and estimating platforms. Each page identifies whether the connection is active, controlled access, file-based or planned.",
    integrationCta: "Explore all integrations",
    groups: [
      {
        title: "Project and source management",
        body: "Keep project evidence organized before it becomes commercial BOQ data.",
        features: [
          ["Project-first workspaces", "Keep project files, BOQ records, revisions and outputs together inside a dedicated workspace."],
          ["Direct project uploads", "Bring supported PDF and project documents directly into the project workflow."],
          ["Structured XLSX and CSV imports", "Import structured schedules and BOQ data for review and controlled use."],
          ["Hybrid-source projects", "Combine documents, spreadsheets, connected applications and professional input in one project."],
          ["Source normalization", "Turn varied project information into consistent, reviewable BOQ records."],
          ["Project Source Centre", "Manage ingested project documents, evidence and source versions from one place."],
          ["Source version control", "Keep distinct source versions visible as project information changes."],
          ["BOQ source traceability", "Keep supported source identity and evidence references connected to BOQ work."],
        ],
      },
      {
        title: "AI-assisted BOQ work",
        body: "Use AI to accelerate supported work, then complete every remaining BOQ requirement under professional control.",
        features: [
          ["AI Draft BOQ", "Create an editable BOQ from usable project evidence while unresolved details remain visible for completion."],
          ["Complete BOQ creation", "Create sections and items, control quantities, units, descriptions and rates, and complete the BOQ even when AI extraction is not suitable."],
          ["Voice instructions", "Use spoken instructions to support BOQ and measurement workflows."],
          ["Typed instructions", "Use text instructions to guide structured BOQ work and updates."],
          ["Structured AI proposals", "Review AI-proposed changes before they become governed project data."],
          ["Selective approval", "Approve the specific changes you want to accept into the controlled workflow."],
          ["Governed revision creation", "Record accepted changes inside identifiable project and BOQ revisions."],
          ["TAYQAN — AI Quantity Surveyor", "Add governed Digital QS capacity for source review, quantity preparation, BOQ assembly and final QA."],
        ],
      },
      {
        title: "Measurement and quantity calculation",
        body: "Move from reviewed dimensions to visible, confirmable quantities.",
        features: [
          ["Guided BOQ measurement", "Work through supported measurement types with explicit dimensions and professional confirmation."],
          ["Deterministic quantity calculations", "Calculate supported quantities using defined engineering formulas rather than hidden estimates."],
          ["Visible engineering formulas", "See the equation and proposed quantity before confirming it into the BOQ."],
          ["Voice-assisted measurement editing", "Enter or correct supported measurements using voice with review before governed use."],
          ["BOQ validation review", "Surface supported validation findings before relying on a project output."],
        ],
      },
      {
        title: "Connected project ecosystem",
        body: "Bring external construction and project information into the Quantara workflow.",
        features: [
          ["Construction software workflows", "Discover 43 documented construction, BIM, CAD, CDE, storage, structural and estimating workflows with an explicit connection status on each page."],
          ["Google Drive project sources", "Bring selected project files from Google Drive into the project workflow."],
          ["Autodesk and AutoCAD workflows", "Use Autodesk-connected project and DWG information within a review-led Quantara workflow."],
          ["Catalogue and industry packages", "Use governed project, company and industry data where it fits the project workflow."],
          ["Company library", "Save reviewed BOQ items into a company-wide library with versions and variants, and reuse them across future projects."],
          ["English and Arabic interface", "Work in English or Arabic with right-to-left interface support."],
        ],
      },
      {
        title: "Professional delivery",
        body: "Turn reviewed BOQ data into controlled project deliverables.",
        features: [
          ["Professional BOQ outputs", "Generate supported project and BOQ outputs from reviewed project information."],
          ["Client proposal links", "Share a secure, token-gated proposal link generated from a reviewed BOQ revision or technical report, with optional passcode protection and an expiry date."],
          ["Document templates", "Apply company and project templates to reviewed BOQ records."],
          ["Technical-report assistant", "Prepare structured technical-report content alongside project and BOQ records."],
          ["Revision-aware delivery", "Keep the working BOQ, project evidence and output context aligned through revisions."],
        ],
      },
    ],
    controlTitle: "Professional control is what makes the workflow complete",
    controlBody:
      "AI is an accelerator, not a blocker. Your team retains direct control to create, measure, calculate, price, correct and review the BOQ whenever professional input is needed, then generate the required output from the same controlled record.",
    ctaTitle: "Ready to put the full Quantara workflow to work?",
    ctaBody:
      "Create your account, review pricing, or explore TAYQAN when you want Digital QS capacity to carry the work forward with you.",
    createAccount: "Create account",
    viewPricing: "View pricing",
    exploreTayqan: "Explore TAYQAN",
  },
  ar: {
    eyebrow: "قدرات Quantara",
    title: "كل ما يحتاجه فريقك لإكمال وتسليم BOQ مهني",
    intro:
      "اجمع الإعداد بمساعدة الذكاء الاصطناعي مع إنشاء BOQ متكامل بتحكم هندسي، والقياس الموجّه، والحسابات الواضحة، والأسعار، والمراجعات، ومكتبات القطاعات والمخرجات المهنية ضمن سير عمل واحد.",
    featureCountLabel: "قدرات سير العمل الأساسية",
    integrationCountLabel: "سير عمل تكامل موثق",
    integrationTitle: "اربط Quantara بأدوات البناء والمشاريع التي يستخدمها فريقك",
    integrationBody:
      "استكشف سير العمل الموثق مع منصات BIM وCAD وبيئات البيانات المشتركة والتخزين السحابي وإدارة الإنشاءات والهندسة والتقدير. وتوضح كل صفحة ما إذا كان الاتصال فعالاً أو خاضعاً للتحكم أو قائماً على الملفات أو مخططاً له.",
    integrationCta: "استكشف جميع التكاملات",
    groups: [
      {
        title: "إدارة المشروع والمصادر",
        body: "نظّم أدلة المشروع قبل أن تتحول إلى بيانات تجارية داخل BOQ.",
        features: [
          ["مساحات عمل مخصصة للمشروع", "احتفظ بملفات المشروع وسجلات BOQ والمراجعات والمخرجات داخل مساحة عمل واحدة."],
          ["رفع ملفات المشروع", "أضف ملفات PDF والمستندات المدعومة مباشرة إلى سير عمل المشروع."],
          ["استيراد XLSX وCSV المنظم", "استورد الجداول وبيانات BOQ المنظمة للمراجعة والاستخدام المنضبط."],
          ["مشاريع متعددة المصادر", "اجمع المستندات والجداول والتطبيقات المتصلة والمدخلات المهنية داخل مشروع واحد."],
          ["توحيد بيانات المصادر", "حوّل معلومات المشروع المختلفة إلى سجلات BOQ متسقة وقابلة للمراجعة."],
          ["مركز مصادر المشروع", "أدر مستندات المشروع والأدلة وإصدارات المصادر من مكان واحد."],
          ["إدارة إصدارات المصادر", "احتفظ بإصدارات منفصلة وواضحة للمصادر مع تغير معلومات المشروع."],
          ["تتبّع مصدر BOQ", "احتفظ بهوية المصدر ومراجع الأدلة المدعومة مرتبطة بعمل BOQ."],
        ],
      },
      {
        title: "عمل BOQ بمساعدة الذكاء الاصطناعي",
        body: "استخدم الذكاء الاصطناعي لتسريع العمل المدعوم، ثم استكمل كل متطلبات BOQ المتبقية تحت التحكم المهني.",
        features: [
          ["AI Draft BOQ", "أنشئ BOQ قابلاً للتحرير من معلومات المشروع القابلة للاستخدام مع إبقاء التفاصيل غير المحسومة ظاهرة للاستكمال."],
          ["إنشاء BOQ متكامل", "أنشئ الأقسام والبنود وتحكم بالكميات والوحدات والأوصاف والأسعار وأكمل BOQ حتى عندما لا يكون الاستخراج بالذكاء الاصطناعي مناسباً."],
          ["الأوامر الصوتية", "استخدم التعليمات الصوتية لدعم سير عمل BOQ والقياس."],
          ["الأوامر النصية", "استخدم التعليمات المكتوبة لتوجيه عمل BOQ المنظم وتحديثاته."],
          ["مقترحات AI المنظمة", "راجع التغييرات المقترحة بالذكاء الاصطناعي قبل أن تصبح بيانات مشروع خاضعة للضوابط."],
          ["الموافقة الانتقائية", "وافق فقط على التغييرات التي تريد إدخالها إلى سير العمل المنضبط."],
          ["إنشاء المراجعات المنضبط", "سجّل التغييرات المقبولة داخل مراجعات واضحة للمشروع وBOQ."],
          ["TAYQAN — مسّاح كميات بالذكاء الاصطناعي", "أضف قدرة مسّاح كميات رقمي لمراجعة المصادر وإعداد الكميات وتجميع BOQ والمراجعة النهائية."],
        ],
      },
      {
        title: "القياس وحساب الكميات",
        body: "انتقل من الأبعاد المراجعة إلى كميات واضحة وقابلة للتأكيد.",
        features: [
          ["القياس الموجّه لـ BOQ", "اعمل عبر أنواع القياس المدعومة باستخدام أبعاد واضحة وتأكيد مهني."],
          ["حسابات كميات حتمية", "احسب الكميات المدعومة باستخدام معادلات هندسية محددة بدلاً من تقديرات مخفية."],
          ["معادلات هندسية مرئية", "شاهد المعادلة والكمية المقترحة قبل اعتمادها داخل BOQ."],
          ["تعديل القياسات بالصوت", "أدخل أو صحح القياسات المدعومة بالصوت مع المراجعة قبل الاستخدام."],
          ["مراجعة التحقق من BOQ", "اعرض نتائج التحقق المدعومة قبل الاعتماد على مخرجات المشروع."],
        ],
      },
      {
        title: "منظومة المشروع المتصلة",
        body: "اجلب معلومات البناء والمشروع الخارجية إلى سير عمل Quantara.",
        features: [
          ["سير عمل برامج البناء", "استكشف 43 سير عمل موثقاً للبناء وBIM وCAD وCDE والتخزين والهندسة والتقدير، مع حالة اتصال واضحة في كل صفحة."],
          ["مصادر Google Drive", "اجلب ملفات المشروع المحددة من Google Drive إلى سير عمل المشروع."],
          ["سير عمل Autodesk وAutoCAD", "استخدم معلومات Autodesk وDWG داخل سير عمل Quantara الخاضع للمراجعة."],
          ["الكتالوج وحزم القطاعات", "استخدم بيانات المشروع والشركة والقطاع المنظمة عندما تناسب سير عمل المشروع."],
          ["مكتبة الشركة", "احفظ بنود BOQ المراجعة داخل مكتبة على مستوى الشركة مع إصدارات ومتغيرات، وأعد استخدامها في مشاريع مستقبلية."],
          ["واجهة إنجليزية وعربية", "اعمل باللغة الإنجليزية أو العربية مع دعم كامل لاتجاه RTL."],
        ],
      },
      {
        title: "التسليم المهني",
        body: "حوّل بيانات BOQ المراجعة إلى مخرجات مشروع منضبطة.",
        features: [
          ["مخرجات BOQ المهنية", "أنشئ مخرجات المشروع وBOQ المدعومة من معلومات المشروع التي تمت مراجعتها."],
          ["روابط عروض العملاء", "شارك رابط عرض آمناً محمياً برمز وصول يُنشأ من مراجعة معتمدة لجدول كميات أو تقرير فني، مع حماية اختيارية برمز مرور وتاريخ انتهاء صلاحية."],
          ["قوالب المستندات", "طبّق قوالب الشركة والمشروع على سجلات BOQ المراجعة."],
          ["مساعد التقارير الفنية", "أعد محتوى التقارير الفنية المنظمة إلى جانب سجلات المشروع وBOQ."],
          ["تسليم مرتبط بالمراجعات", "حافظ على توافق BOQ العامل وأدلة المشروع وسياق المخرجات عبر المراجعات."],
        ],
      },
    ],
    controlTitle: "التحكم المهني هو ما يجعل سير العمل مكتملاً",
    controlBody:
      "الذكاء الاصطناعي أداة لتسريع العمل وليس عائقاً. يحتفظ فريقك بالتحكم المباشر لإنشاء BOQ وقياسه وحسابه وتسعيره وتصحيحه ومراجعته كلما لزم المدخل المهني، ثم إنشاء المخرج المطلوب من السجل المنضبط نفسه.",
    ctaTitle: "هل أنت مستعد لاستخدام سير عمل Quantara الكامل؟",
    ctaBody:
      "أنشئ حسابك، وراجع الأسعار، أو استكشف TAYQAN عندما تريد قدرة مسّاح كميات رقمي تساعدك في دفع العمل إلى الأمام.",
    createAccount: "إنشاء حساب",
    viewPricing: "عرض الأسعار",
    exploreTayqan: "استكشف TAYQAN",
  },
} as const;

export function getPublicFeatureSales(locale: Locale) {
  return FEATURE_SALES[locale];
}
