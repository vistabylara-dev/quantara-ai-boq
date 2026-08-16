import type { Locale } from "@/lib/i18n/config";

const FEATURE_SALES = {
  en: {
    eyebrow: "Quantara capabilities",
    title: "Everything you need to move from project information to a professional BOQ",
    intro:
      "Bring project sources, AI-assisted BOQ preparation, guided measurement, calculations, revisions, integrations and professional outputs into one controlled construction workflow.",
    featureCountLabel: "Core workflow capabilities",
    integrationCountLabel: "Integration pages",
    integrationTitle: "Connect Quantara to the construction tools your team already uses",
    integrationBody:
      "Explore Quantara integration pages across BIM, CAD, common data environments, cloud storage, construction management, structural engineering and estimating platforms.",
    integrationCta: "Explore all integrations",
    groups: [
      {
        title: "Project and source management",
        body: "Keep project evidence organized before it becomes commercial BOQ data.",
        features: [
          ["Project-first workspaces", "Keep project files, BOQ records, revisions and outputs together inside a dedicated workspace."],
          ["Manual project uploads", "Bring supported PDF and project documents directly into the project workflow."],
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
        body: "Use AI to move the work forward while professional control remains visible.",
        features: [
          ["AI Draft BOQ", "Create an editable BOQ draft from usable project evidence while unresolved details remain visible."],
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
          ["Construction software integrations", "Discover Quantara integration workflows across 43 construction, BIM, CAD, CDE, storage, structural and estimating applications."],
          ["Google Drive project sources", "Bring selected project files from Google Drive into the project workflow."],
          ["Autodesk and AutoCAD workflows", "Use Autodesk-connected project and DWG information within a review-led Quantara workflow."],
          ["Catalogue and industry packages", "Use governed project, company and industry data where it fits the project workflow."],
          ["English and Arabic interface", "Work in English or Arabic with right-to-left interface support."],
        ],
      },
      {
        title: "Professional delivery",
        body: "Turn reviewed BOQ data into controlled project deliverables.",
        features: [
          ["Professional BOQ outputs", "Generate supported project and BOQ outputs from reviewed project information."],
          ["Document templates", "Apply company and project templates to reviewed BOQ records."],
          ["Technical-report assistant", "Prepare structured technical-report content alongside project and BOQ records."],
          ["Revision-aware delivery", "Keep the working BOQ, project evidence and output context aligned through revisions."],
        ],
      },
    ],
    controlTitle: "Professional control remains part of the workflow",
    controlBody:
      "Quantara accelerates structured BOQ work, but project information, measurements, rates and issued outputs still require the responsible construction professional's review.",
    ctaTitle: "Ready to put the full Quantara workflow to work?",
    ctaBody:
      "Create your account, review pricing, or explore TAYQAN when you want Digital QS capacity to carry the work forward with you.",
    createAccount: "Create account",
    viewPricing: "View pricing",
    exploreTayqan: "Explore TAYQAN",
  },
  ar: {
    eyebrow: "قدرات Quantara",
    title: "كل ما تحتاجه للانتقال من معلومات المشروع إلى BOQ مهني",
    intro:
      "اجمع مصادر المشروع، وإعداد BOQ بمساعدة الذكاء الاصطناعي، والقياس الموجّه، والحسابات، والمراجعات، والتكاملات والمخرجات المهنية ضمن سير عمل إنشائي واحد ومنضبط.",
    featureCountLabel: "قدرات سير العمل الأساسية",
    integrationCountLabel: "صفحات التكامل",
    integrationTitle: "اربط Quantara بأدوات البناء والمشاريع التي يستخدمها فريقك",
    integrationBody:
      "استكشف صفحات تكامل Quantara مع منصات BIM وCAD وبيئات البيانات المشتركة والتخزين السحابي وإدارة الإنشاءات والهندسة الإنشائية والتقدير.",
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
        body: "استخدم الذكاء الاصطناعي لدفع العمل إلى الأمام مع إبقاء التحكم المهني واضحاً.",
        features: [
          ["AI Draft BOQ", "أنشئ مسودة BOQ قابلة للتحرير من أدلة المشروع القابلة للاستخدام مع إبقاء التفاصيل غير المحسومة ظاهرة."],
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
          ["تكاملات برامج البناء", "استكشف تكامل Quantara مع 43 تطبيقاً للبناء وBIM وCAD وCDE والتخزين والهندسة والتقدير."],
          ["مصادر Google Drive", "اجلب ملفات المشروع المحددة من Google Drive إلى سير عمل المشروع."],
          ["سير عمل Autodesk وAutoCAD", "استخدم معلومات Autodesk وDWG داخل سير عمل Quantara الخاضع للمراجعة."],
          ["الكتالوج وحزم القطاعات", "استخدم بيانات المشروع والشركة والقطاع المنظمة عندما تناسب سير عمل المشروع."],
          ["واجهة إنجليزية وعربية", "اعمل باللغة الإنجليزية أو العربية مع دعم كامل لاتجاه RTL."],
        ],
      },
      {
        title: "التسليم المهني",
        body: "حوّل بيانات BOQ المراجعة إلى مخرجات مشروع منضبطة.",
        features: [
          ["مخرجات BOQ المهنية", "أنشئ مخرجات المشروع وBOQ المدعومة من معلومات المشروع التي تمت مراجعتها."],
          ["قوالب المستندات", "طبّق قوالب الشركة والمشروع على سجلات BOQ المراجعة."],
          ["مساعد التقارير الفنية", "أعد محتوى التقارير الفنية المنظمة إلى جانب سجلات المشروع وBOQ."],
          ["تسليم مرتبط بالمراجعات", "حافظ على توافق BOQ العامل وأدلة المشروع وسياق المخرجات عبر المراجعات."],
        ],
      },
    ],
    controlTitle: "يبقى التحكم المهني جزءاً من سير العمل",
    controlBody:
      "تسرّع Quantara عمل BOQ المنظم، لكن معلومات المشروع والقياسات والأسعار والمخرجات الصادرة تظل بحاجة إلى مراجعة المهني المسؤول.",
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