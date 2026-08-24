import type { Locale } from "@/lib/i18n/config";

const SALES_TRUTH = {
  en: {
    heroTitle: "Deliver a Professional BOQ — With AI Speed and Full Engineer Control",
    heroBody:
      "Use AI where the source is supported, complete every item with direct engineer control where professional input is needed, calculate quantities with visible formulas, and deliver an accurate, review-ready BOQ from one controlled workspace.",
    heroSignal: "AI-assisted when possible. Engineer-controlled from start to delivery.",
    viewPricing: "View pricing",
    aiDraftStageTitle: "AI Draft BOQ",
    aiDraftStageBody:
      "Turn usable project evidence into an editable BOQ, then complete quantities, units, descriptions and rates with direct professional control wherever required.",
    twoWaysEyebrow: "A complete hybrid BOQ workflow",
    twoWaysTitle: "Let AI accelerate the work — keep engineers in control of the final BOQ",
    twoWaysBody:
      "Your team can build, measure, calculate, review and deliver the BOQ directly in Quantara. When you need more capacity, hire TAYQAN to prepare supported work for your team's final review.",
    aiDraftTitle: "AI Draft BOQ",
    aiDraftBody:
      "Create an editable BOQ from usable project evidence. AI accelerates supported extraction and structuring; engineers can add, measure, correct and price every remaining item without leaving the workflow.",
    aiDraftCta: "Explore Quantara features",
    tayqanTitle: "TAYQAN — AI Quantity Surveyor",
    tayqanBody:
      "TAYQAN carries supported QS work from source review through quantity preparation, BOQ assembly and QA. Your authorized professional reviews the result and decides when it is ready to issue.",
    tayqanCta: "See TAYQAN hire options",
    featureSpotlightEyebrow: "Built to deliver the BOQ today",
    featureSpotlightTitle: "Automation where it works. Full professional control everywhere else.",
    featureSpotlightBody:
      "Quantara does not stop when a source needs professional interpretation. AI prepares supported work, while the same platform gives your team full control of measurements, quantities, descriptions, rates, reviews and outputs.",
    aiDraftBullets: [
      "Editable BOQ built from supported project evidence",
      "Direct item creation for scope that needs engineering input",
      "Guided measurement and visible quantity calculations",
      "Missing quantities and units stay visible until completed",
      "Rates remain under your commercial team's control",
      "Professional review and export in the same workspace",
    ],
    tayqanBullets: [
      "Source discovery and processing",
      "Evidence review and quantity preparation",
      "Rate preparation when requested and governed",
      "BOQ assembly and validation / final QA",
      "Prepared for authorized professional review and issue",
    ],
    commercialSummary:
      "Published Starter, Professional, Business, Enterprise Core, Enterprise Scale, and Enterprise Authority subscriptions are available through the public pricing journey, with eligible authenticated checkout when the selected price is approved and active and its provider mapping is active and synchronized.",
    commercialLimitation:
      "Checkout requires an authenticated eligible account, a selected approved and active price, and an active synchronized provider mapping. Anonymous or unauthenticated checkout is not offered. TAYQAN hire is commercially separate from the core SaaS subscription.",
    pricingFaqAnswer:
      "Quantara publishes Starter, Professional and Business subscriptions at AED 149, AED 399 and AED 899 per month, with annual options at AED 1,490, AED 3,990 and AED 8,990. Enterprise Core, Enterprise Scale, and Enterprise Authority are published as annual subscriptions at AED 15,000, AED 25,000, and AED 35,000. Choose a plan, create or sign in to your account and continue to eligible authenticated checkout when the selected price is approved and active and its provider mapping is active and synchronized; anonymous or unauthenticated checkout is not offered. TAYQAN is commercially separate and can be hired for AED 299 per day, AED 999 per week or AED 2,499 per month as a Digital Quantity Surveyor.",
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
    heroTitle: "أنجز جدول كميات احترافياً — بسرعة الذكاء الاصطناعي وتحكم المهندس الكامل",
    heroBody:
      "استخدم الذكاء الاصطناعي مع المصادر المدعومة، واستكمل كل بند بتحكم هندسي مباشر عندما يتطلب العمل مدخلاً مهنياً، واحسب الكميات بمعادلات واضحة، ثم سلّم BOQ دقيقاً وقابلاً للمراجعة من مساحة عمل واحدة.",
    heroSignal: "مساعدة بالذكاء الاصطناعي حيثما أمكن. وتحكم هندسي من البداية حتى التسليم.",
    viewPricing: "عرض الأسعار",
    aiDraftStageTitle: "مسودة BOQ بالذكاء الاصطناعي",
    aiDraftStageBody:
      "حوّل معلومات المشروع القابلة للاستخدام إلى BOQ قابل للتحرير، ثم استكمل الكميات والوحدات والأوصاف والأسعار بتحكم مهني مباشر حيثما يلزم.",
    twoWaysEyebrow: "سير عمل BOQ هجين ومتكامل",
    twoWaysTitle: "دع الذكاء الاصطناعي يسرّع العمل — وأبقِ التحكم بالـ BOQ النهائي للمهندس",
    twoWaysBody:
      "يمكن لفريقك إنشاء BOQ وقياسه وحسابه ومراجعته وتسليمه مباشرة داخل Quantara. وعندما تحتاج إلى قدرة إضافية، وظّف TAYQAN لإعداد العمل المدعوم لمراجعة فريقك النهائية.",
    aiDraftTitle: "AI Draft BOQ",
    aiDraftBody:
      "أنشئ BOQ قابلاً للتحرير من معلومات المشروع القابلة للاستخدام. يسرّع الذكاء الاصطناعي الاستخراج والتنظيم المدعومين، ويمكن للمهندسين إضافة كل بند متبقٍ وقياسه وتصحيحه وتسعيره داخل سير العمل نفسه.",
    aiDraftCta: "استكشف مزايا Quantara",
    tayqanTitle: "TAYQAN — مسّاح كميات بالذكاء الاصطناعي",
    tayqanBody:
      "ينفذ TAYQAN أعمال حصر الكميات المدعومة من مراجعة المصادر إلى إعداد الكميات وتجميع BOQ وضبط الجودة. ويراجع المهني المخوّل النتيجة ويقرر متى تصبح جاهزة للإصدار.",
    tayqanCta: "عرض خيارات توظيف TAYQAN",
    featureSpotlightEyebrow: "مصمم لتسليم BOQ اليوم",
    featureSpotlightTitle: "أتمتة حيث تنجح، وتحكم مهني كامل في كل ما عدا ذلك.",
    featureSpotlightBody:
      "لا يتوقف Quantara عندما يحتاج المصدر إلى تفسير مهني. يجهز الذكاء الاصطناعي العمل المدعوم، وتمنح المنصة نفسها فريقك تحكماً كاملاً بالقياسات والكميات والأوصاف والأسعار والمراجعات والمخرجات.",
    aiDraftBullets: [
      "BOQ قابل للتحرير مبني على معلومات المشروع المدعومة",
      "إنشاء البنود مباشرة للنطاق الذي يحتاج إلى مدخل هندسي",
      "قياس موجّه وحسابات كميات واضحة",
      "إبقاء الكميات والوحدات الناقصة ظاهرة حتى استكمالها",
      "بقاء الأسعار تحت تحكم الفريق التجاري",
      "المراجعة المهنية والتصدير داخل مساحة العمل نفسها",
    ],
    tayqanBullets: [
      "اكتشاف المصادر ومعالجتها",
      "مراجعة الأدلة وإعداد الكميات",
      "إعداد الأسعار عند الطلب وضمن الضوابط",
      "تجميع BOQ والتحقق والمراجعة النهائية",
      "مجهز لمراجعة المهني المخوّل وإصداره",
    ],
    commercialSummary:
      "تتوفر اشتراكات Starter وProfessional وBusiness وEnterprise Core وEnterprise Scale وEnterprise Authority المنشورة عبر رحلة الأسعار العامة، مع إتاحة الدفع الموثق للحساب المؤهل عندما يكون السعر المختار معتمدًا ونشطًا ويكون ربط مزود الدفع نشطًا ومتزامنًا.",
    commercialLimitation:
      "يتطلب الدفع حساباً موثقاً ومؤهلاً وسعراً مختاراً معتمداً وفعالاً وربطاً فعالاً ومتزامناً مع مزود الدفع. لا يتوفر الدفع المجهول أو دون تسجيل الدخول. توظيف TAYQAN منفصل تجارياً عن اشتراك Quantara الأساسي.",
    pricingFaqAnswer:
      "ينشر Quantara خطط Starter وProfessional وBusiness بسعر 149 و399 و899 درهماً شهرياً، مع خيارات سنوية بقيمة 1,490 و3,990 و8,990 درهماً. كما تُنشر خطط Enterprise Core وEnterprise Scale وEnterprise Authority كاشتراكات سنوية بقيمة 15,000 و25,000 و35,000 درهم على التوالي. اختر الخطة وأنشئ حسابك أو سجّل الدخول ثم انتقل إلى الدفع الموثق المؤهل عندما يكون السعر المختار معتمدًا ونشطًا ويكون ربط مزود الدفع نشطًا ومتزامنًا؛ ولا يتوفر الدفع المجهول أو دون تسجيل الدخول. يظل TAYQAN منفصلاً تجارياً ويمكن توظيفه مقابل 299 درهماً لليوم أو 999 درهماً للأسبوع أو 2,499 درهماً شهرياً كمسّاح كميات رقمي.",
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
