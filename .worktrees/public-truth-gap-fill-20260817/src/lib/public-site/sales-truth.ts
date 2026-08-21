import type { Locale } from "@/lib/i18n/config";

const SALES_TRUTH = {
  en: {
    heroTitle: "From Project Files to a Reviewable BOQ — Faster",
    heroBody:
      "Extract supported project information, build an AI Draft BOQ, measure and calculate quantities, review the result and generate professional outputs in one controlled workflow.",
    heroSignal: "Extract. Draft. Measure. Calculate. Review. Deliver.",
    viewPricing: "View pricing",
    aiDraftStageTitle: "AI Draft BOQ",
    aiDraftStageBody:
      "Turn usable reviewed or reviewable extracted evidence into an editable draft BOQ while unresolved quantity or unit details remain visible for professional completion.",
    twoWaysEyebrow: "Two ways to move the BOQ forward",
    twoWaysTitle: "Build with Quantara — or hire TAYQAN to do the QS work with you",
    twoWaysBody:
      "Use Quantara's controlled BOQ workflow directly, or hire TAYQAN when you want governed Digital Quantity Surveyor capacity on the project.",
    aiDraftTitle: "AI Draft BOQ",
    aiDraftBody:
      "Create an editable BOQ draft from usable extracted project evidence before every review issue is individually resolved. Quantara preserves supported source and quantity provenance, keeps missing quantity or unit information visible instead of inventing it, and leaves commercial rates under professional control.",
    aiDraftCta: "Explore Quantara features",
    tayqanTitle: "TAYQAN — AI Quantity Surveyor",
    tayqanBody:
      "TAYQAN follows a governed QS workflow from source discovery and evidence review through quantity preparation, BOQ assembly and final QA. It prepares work for human acceptance; it does not automatically approve, issue, certify or tender-submit the BOQ.",
    tayqanCta: "See TAYQAN hire options",
    featureSpotlightEyebrow: "Current workflow",
    featureSpotlightTitle: "New ways to get from project evidence to a professional BOQ",
    featureSpotlightBody:
      "AI Draft BOQ accelerates the review path inside Quantara. TAYQAN adds governed Digital QS capacity when you want the work carried forward on your behalf.",
    aiDraftBullets: [
      "Editable draft built from usable extracted evidence",
      "Explicit project-file scope remains respected",
      "Supported source and quantity provenance stays attached",
      "Missing quantity or unit details remain visible for review",
      "No silently invented commercial rates",
      "Professional review remains required before governed use",
    ],
    tayqanBullets: [
      "Source discovery and processing",
      "Evidence review and quantity preparation",
      "Rate preparation when requested and governed",
      "BOQ assembly and validation / final QA",
      "Ready for Acceptance — never automatic professional approval",
    ],
    commercialSummary:
      "Published Starter, Professional and Business subscriptions are available through the public pricing journey, with authenticated checkout when the selected approved price is active and synchronized.",
    commercialLimitation:
      "Checkout eligibility depends on the authenticated account, selected approved price and synchronized provider mapping. TAYQAN hire is commercially separate from the core SaaS subscription.",
    pricingFaqAnswer:
      "Quantara publishes Starter, Professional and Business subscriptions at AED 149, AED 399 and AED 899 per month, with annual options at AED 1,490, AED 3,990 and AED 8,990. Choose a plan, create your account and continue to eligible authenticated checkout when the selected approved price is active. TAYQAN is commercially separate and can be hired for AED 299 per day, AED 999 per week or AED 2,499 per month as a Digital Quantity Surveyor.",
    tayqanPricingEyebrow: "Hire Digital QS capacity",
    tayqanPricingTitle: "Hire TAYQAN separately from your Quantara subscription",
    tayqanPricingBody:
      "TAYQAN is a separate governed AI Quantity Surveyor hire. Create or sign in to your Quantara account, then use the authenticated TAYQAN hire journey for an eligible package.",
    tayqanAccountCta: "Create account to hire TAYQAN",
    tayqanExistingAccountCta: "Already have an account? Sign in",
    oneTime: "one-time hire",
    perMonth: "per month",
    upToProjects: "Up to {count} distinct projects during the hire period",
    professionalAcceptance:
      "Final professional acceptance remains under human control.",
    tayqanPlans: {
      DAY: {
        title: "TAYQAN Day",
        badge: "Quick Hire",
        bestFor: "Urgent BOQ work, reviews or short QS assignments.",
        duration: "24-hour hire",
      },
      WEEK: {
        title: "TAYQAN Week",
        badge: "Most Popular",
        bestFor: "Active projects requiring several days of focused QS work.",
        duration: "7-day hire",
      },
      MONTHLY: {
        title: "TAYQAN Monthly",
        badge: "Digital QS",
        bestFor: "Companies needing ongoing quantity-surveying capacity across changing workloads.",
        duration: "Recurring monthly hire",
      },
    },
  },
  ar: {
    heroTitle: "من ملفات المشروع إلى جدول كميات قابل للمراجعة — بشكل أسرع",
    heroBody:
      "استخرج معلومات المشروع المدعومة، وأنشئ مسودة BOQ بالذكاء الاصطناعي، وقِس واحسب الكميات، وراجع النتيجة، وأنشئ مخرجات مهنية ضمن سير عمل واحد خاضع للرقابة.",
    heroSignal: "استخراج. مسودة. قياس. حساب. مراجعة. تسليم.",
    viewPricing: "عرض الأسعار",
    aiDraftStageTitle: "مسودة BOQ بالذكاء الاصطناعي",
    aiDraftStageBody:
      "حوّل الأدلة المستخرجة القابلة للاستخدام إلى مسودة BOQ قابلة للتحرير، مع إبقاء أي كمية أو وحدة غير محسومة ظاهرة لاستكمالها ومراجعتها مهنياً.",
    twoWaysEyebrow: "طريقتان لدفع جدول الكميات إلى الأمام",
    twoWaysTitle: "اعمل مباشرة داخل Quantara — أو وظّف TAYQAN للعمل كمسّاح كميات رقمي",
    twoWaysBody:
      "استخدم سير عمل Quantara المنضبط مباشرة، أو وظّف TAYQAN عندما تحتاج إلى قدرة إضافية لإدارة أعمال حصر الكميات ضمن ضوابط واضحة.",
    aiDraftTitle: "AI Draft BOQ",
    aiDraftBody:
      "أنشئ مسودة BOQ قابلة للتحرير من أدلة المشروع المستخرجة والقابلة للاستخدام قبل حل كل نقطة مراجعة على حدة. يحافظ Quantara على مراجع المصدر ومنشأ الكمية عند دعمهما، ويُبقي البيانات الناقصة ظاهرة بدلاً من اختلاقها، ولا يضيف أسعاراً تجارية غير مؤكدة.",
    aiDraftCta: "استكشف مزايا Quantara",
    tayqanTitle: "TAYQAN — مسّاح كميات بالذكاء الاصطناعي",
    tayqanBody:
      "يتبع TAYQAN سير عمل منضبطاً يبدأ من اكتشاف المصادر ومراجعة الأدلة ويمر بإعداد الكميات وتجميع BOQ والمراجعة النهائية. يجهز العمل للقبول البشري ولا يعتمد أو يصدر أو يشهد أو يقدّم العطاء تلقائياً.",
    tayqanCta: "عرض خيارات توظيف TAYQAN",
    featureSpotlightEyebrow: "سير العمل الحالي",
    featureSpotlightTitle: "طرق أحدث للانتقال من أدلة المشروع إلى BOQ مهني",
    featureSpotlightBody:
      "يسرّع AI Draft BOQ مسار المراجعة داخل Quantara، بينما يضيف TAYQAN قدرة مسّاح كميات رقمي منضبط عندما تريد تنفيذ العمل نيابةً عنك.",
    aiDraftBullets: [
      "مسودة قابلة للتحرير مبنية على أدلة مستخرجة قابلة للاستخدام",
      "احترام نطاق ملفات المشروع الذي حدده المستخدم",
      "الحفاظ على مراجع المصدر ومنشأ الكمية عند دعمهما",
      "إبقاء الكمية أو الوحدة الناقصة ظاهرة للمراجعة",
      "عدم اختلاق أسعار تجارية بشكل صامت",
      "بقاء المراجعة المهنية مطلوبة قبل الاستخدام",
    ],
    tayqanBullets: [
      "اكتشاف المصادر ومعالجتها",
      "مراجعة الأدلة وإعداد الكميات",
      "إعداد الأسعار عند الطلب وضمن الضوابط",
      "تجميع BOQ والتحقق والمراجعة النهائية",
      "جاهز للقبول — وليس اعتماداً مهنياً تلقائياً",
    ],
    commercialSummary:
      "خطط Starter وProfessional وBusiness منشورة ضمن رحلة الأسعار العامة، مع انتقال إلى الدفع الموثق عندما يكون السعر المعتمد المختار فعالاً ومتزامناً.",
    commercialLimitation:
      "تعتمد أهلية الدفع على الحساب الموثق والسعر المعتمد المختار وتزامن ربط مزود الدفع. توظيف TAYQAN منفصل تجارياً عن اشتراك Quantara الأساسي.",
    pricingFaqAnswer:
      "ينشر Quantara خطط Starter وProfessional وBusiness بسعر 149 و399 و899 درهماً شهرياً، مع خيارات سنوية بقيمة 1,490 و3,990 و8,990 درهماً. اختر الخطة وأنشئ حسابك ثم انتقل إلى الدفع الموثق عندما يكون السعر المعتمد فعالاً. TAYQAN منفصل تجارياً ويمكن توظيفه مقابل 299 درهماً لليوم أو 999 درهماً للأسبوع أو 2,499 درهماً شهرياً كمسّاح كميات رقمي.",
    tayqanPricingEyebrow: "وظّف قدرة مسّاح كميات رقمي",
    tayqanPricingTitle: "وظّف TAYQAN بشكل منفصل عن اشتراك Quantara",
    tayqanPricingBody:
      "TAYQAN هو توظيف منفصل لمسّاح كميات بالذكاء الاصطناعي ضمن سير عمل منضبط. أنشئ حساب Quantara أو سجّل الدخول ثم استخدم رحلة التوظيف الموثقة للحزمة المؤهلة.",
    tayqanAccountCta: "أنشئ حساباً لتوظيف TAYQAN",
    tayqanExistingAccountCta: "لديك حساب؟ سجّل الدخول",
    oneTime: "توظيف لمرة واحدة",
    perMonth: "شهرياً",
    upToProjects: "حتى {count} مشروعاً مختلفاً خلال فترة التوظيف",
    professionalAcceptance:
      "يبقى القبول المهني النهائي تحت السيطرة البشرية.",
    tayqanPlans: {
      DAY: {
        title: "TAYQAN لليوم",
        badge: "توظيف سريع",
        bestFor: "أعمال BOQ العاجلة أو المراجعات أو مهام QS القصيرة.",
        duration: "توظيف لمدة 24 ساعة",
      },
      WEEK: {
        title: "TAYQAN للأسبوع",
        badge: "الأكثر شيوعاً",
        bestFor: "المشاريع النشطة التي تحتاج عدة أيام من عمل QS المركز.",
        duration: "توظيف لمدة 7 أيام",
      },
      MONTHLY: {
        title: "TAYQAN شهري",
        badge: "مسّاح كميات رقمي",
        bestFor: "الشركات التي تحتاج قدرة مستمرة لحصر الكميات مع تغير أحمال المشاريع.",
        duration: "توظيف شهري متجدد",
      },
    },
  },
} as const;

export function getPublicSalesTruth(locale: Locale) {
  return SALES_TRUTH[locale];
}