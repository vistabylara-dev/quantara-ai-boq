/** Only these reviewed statements are rendered. Model-generated prices,
 * promises, URLs, payment status and commercial terms are never displayed. */
export const SALES_ANSWERS = {
  overview: {
    en: "Quantara helps your team create, measure, review and deliver BOQs in one workspace. AI assists supported sources; your engineer retains control of quantities, rates and final approval.",
    ar: "تساعد كوانتارا فريقك على إعداد جداول الكميات وقياسها ومراجعتها وتسليمها من مساحة عمل واحدة. يدعم الذكاء الاصطناعي المصادر المتوافقة، ويحتفظ المهندس بالتحكم في الكميات والأسعار والاعتماد النهائي.",
    href: "/features",
  },
  fitout: {
    en: "For fit-out and joinery teams, start with one representative project. Organise its BOQ sections, review supported imported information, complete quantities and rates, then check the required outputs. Confirm specialist catalogue access in your selected plan.",
    ar: "لفرق التشطيبات والنجارة، ابدأ بمشروع ممثل لأعمالك. نظّم أقسام جدول الكميات، وراجع البيانات المستوردة المدعومة، وأكمل الكميات والأسعار ثم تحقق من المخرجات المطلوبة. تحقق من إتاحة الكتالوجات المتخصصة ضمن الخطة المختارة.",
    href: "/boq-software-for-fit-out-companies",
  },
  sources: {
    en: "Structured XLSX/CSV files and supported tables in text-based PDFs can accelerate BOQ preparation. Scanned PDFs need professional input; Quantara does not promise automatic extraction from every drawing. Test your source type before purchasing for that workflow.",
    ar: "يمكن لملفات XLSX وCSV المنظمة والجداول المدعومة في ملفات PDF النصية تسريع إعداد جدول الكميات. تحتاج الملفات الممسوحة ضوئياً إلى إدخال مهني، ولا تعد كوانتارا باستخراج آلي من كل رسم. تحقق من توافق نوع ملفك قبل شراء الخطة لهذا الغرض.",
    href: "/pdf-boq-extraction",
  },
  pricing: {
    en: "Choose a plan from the current pricing page. The selected plan continues through account registration, email verification and Quantara’s secure checkout. Current prices, billing periods and included access are shown there; I cannot offer discounts or confirm payment in this conversation.",
    ar: "اختر خطة من صفحة الأسعار الحالية. تنتقل الخطة المختارة إلى إنشاء الحساب والتحقق من البريد ثم الدفع الآمن في كوانتارا. تظهر هناك الأسعار ودورات الفوترة والصلاحيات المشمولة. لا يمكنني تقديم خصومات أو تأكيد الدفع ضمن هذه المحادثة.",
    href: "/pricing",
  },
  tayqan: {
    en: "TAYQAN assists supported quantity-surveying work, from source review through BOQ preparation and checks. Your authorised professional reviews the result. Review the available hire options and source requirements to see whether this fits your project.",
    ar: "يساعد تيقّن في أعمال حصر الكميات المدعومة، من مراجعة المصادر إلى إعداد جدول الكميات والتحقق منه. يراجع المختص المخوّل النتائج. اطّلع على خيارات التوظيف ومتطلبات المصادر للتأكد من ملاءمتها لمشروعك.",
    href: "/tayqan-ai-quantity-surveyor",
  },
  human: {
    en: "Lara can help confirm a custom scope, integration requirement or commercial question. Use Contact sales to share your company, source files required, team size and preferred contact method. Please do not share passwords, payment-card details or confidential drawings in this chat.",
    ar: "يمكن للارا مساعدتك في تحديد نطاق خاص أو متطلبات تكامل أو استفسار تجاري. استخدم التواصل مع المبيعات لمشاركة شركتك وأنواع الملفات وعدد المستخدمين وطريقة التواصل المفضلة. لا تشارك كلمات المرور أو بيانات البطاقات أو الرسومات السرية في المحادثة.",
    href: "/contact-sales",
  },
} as const;
export type SalesAnswerId = keyof typeof SALES_ANSWERS;
export const SALES_QUESTIONS = {
  industry: { en: "Which industry does your team work in?", ar: "ما قطاع عمل فريقك؟" },
  source: { en: "Do you start from spreadsheets, text PDFs or scanned drawings?", ar: "هل تبدأ من جداول إلكترونية أم ملفات PDF نصية أم رسومات ممسوحة؟" },
  team: { en: "How many people need access?", ar: "كم مستخدماً يحتاج إلى الوصول؟" },
  next: { en: "Would you like to compare plans or discuss your project with Lara?", ar: "هل ترغب في مقارنة الخطط أم مناقشة مشروعك مع لارا؟" },
} as const;
export type SalesQuestionId = keyof typeof SALES_QUESTIONS;

export function fallbackSelection(message: string): { answer: SalesAnswerId; question: SalesQuestionId } {
  if (/price|cost|pay|buy|plan|discount|سعر|اسعار|أسعار|شراء|دفع|خصم/i.test(message)) return { answer: "pricing", question: "team" };
  if (/scan|pdf|xlsx|csv|ocr|drawing|مسح|رسم|ملف/i.test(message)) return { answer: "sources", question: "source" };
  if (/joinery|fit.?out|نجارة|تشطيب/i.test(message)) return { answer: "fitout", question: "source" };
  if (/tayqan|تيقن|تيقّن/i.test(message)) return { answer: "tayqan", question: "source" };
  if (/human|lara|refund|integration|لارا|استرداد|تكامل/i.test(message)) return { answer: "human", question: "next" };
  return { answer: "overview", question: "industry" };
}
