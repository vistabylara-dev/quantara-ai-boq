$ErrorActionPreference = "Stop"

$repo = "vistabylara-dev/quantara-ai-boq"
$branch = "feat/tayqan-hire-conversion-seo-20260817"
$tempDir = Join-Path $env:TEMP ("quantara-tayqan-hire-seo-" + [guid]::NewGuid().ToString("N"))
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Get-SourceFile {
    param(
        [string]$RemotePath,
        [string]$LocalName
    )

    $response = gh api "repos/$repo/contents/$RemotePath?ref=$baseSha" | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) {
        throw "STOP: could not fetch $RemotePath"
    }

    $clean = $response.content -replace "\s", ""
    $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($clean))
    $localPath = Join-Path $tempDir $LocalName
    [IO.File]::WriteAllText($localPath, $text, $utf8)

    return [pscustomobject]@{
        Path = $localPath
        Sha = $response.sha
    }
}

function Set-BranchFile {
    param(
        [string]$RemotePath,
        [string]$LocalPath,
        [string]$ContentSha,
        [string]$Message
    )

    $text = [IO.File]::ReadAllText($LocalPath)
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text))

    $payload = @{
        message = $Message
        content = $encoded
        sha = $ContentSha
        branch = $branch
    } | ConvertTo-Json -Compress

    $payload | gh api --method PUT "repos/$repo/contents/$RemotePath" --input - | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "STOP: failed to update $RemotePath"
    }
}

Write-Host "`n=== 1. PIN CURRENT MAIN ===" -ForegroundColor Cyan
$baseSha = (gh api "repos/$repo/git/ref/heads/main" --jq '.object.sha').Trim()
if ($LASTEXITCODE -ne 0 -or -not $baseSha) {
    throw "STOP: could not resolve current main."
}
Write-Host "BASE MAIN: $baseSha" -ForegroundColor Green

Write-Host "`n=== 2. VERIFY DEDICATED BRANCH NAME IS FREE ===" -ForegroundColor Cyan
$null = gh api "repos/$repo/git/ref/heads/$branch" 2>$null
if ($LASTEXITCODE -eq 0) {
    throw "STOP: branch already exists: $branch"
}
Write-Host "PASS: branch name is free." -ForegroundColor Green

Write-Host "`n=== 3. DOWNLOAD ONLY FOUR APPROVED FILES FROM PINNED MAIN ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$page = Get-SourceFile "src/app/(marketing)/tayqan-ai-quantity-surveyor/page.tsx" "page.tsx"
$registry = Get-SourceFile "src/lib/public-site/search-registry.ts" "search-registry.ts"
$llms = Get-SourceFile "public/llms.txt" "llms.txt"
$test = Get-SourceFile "tests/tayqan-public-landing.test.ts" "tayqan-public-landing.test.ts"

Write-Host "PASS: four-file scope downloaded from exact pinned main." -ForegroundColor Green

Write-Host "`n=== 4. APPLY TAYQAN CONTENT + SEO/GEO/AEO PATCH ===" -ForegroundColor Cyan
$patchScript = @'
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
if (!root) throw new Error('temp root argument required');

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n');
}
function write(name, text) {
  fs.writeFileSync(path.join(root, name), text.endsWith('\n') ? text : text + '\n', 'utf8');
}
function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected once, found ${count}`);
  return text.replace(oldText, newText);
}
function replaceFirst(text, oldText, newText, label) {
  if (!text.includes(oldText)) throw new Error(`${label}: target missing`);
  return text.replace(oldText, newText);
}
function replaceRegexOnce(text, regex, newText, label) {
  const matches = text.match(regex);
  if (!matches) throw new Error(`${label}: target missing`);
  return text.replace(regex, newText);
}

let page = read('page.tsx');

const copyReplacements = [
  ['eyebrow: "Digital QS capacity inside Quantara",', 'eyebrow: "On-demand AI Quantity Surveyor for UAE & GCC teams",', 'English eyebrow'],
  ['title: "Hire TAYQAN — Quantara\'s AI Quantity Surveyor",', 'title: "Hire TAYQAN — AI Quantity Surveyor for BOQ Production",', 'English H1'],
  ['"When you do not have time to carry every BOQ step yourself, TAYQAN can move supported project evidence through a governed Quantity Surveying workflow and prepare the work for your professional acceptance."', '"TAYQAN is built as an execution workflow inside Quantara, not a chatbot-only experience. It carries supported project evidence through source review, quantity preparation, BOQ assembly and final QA, then returns the work for professional acceptance."', 'English intro'],
  ['primaryCta: "Create account to hire TAYQAN",', 'primaryCta: "Start TAYQAN hire",', 'English primary CTA'],
  ['secondaryCta: "View hire options",', 'secondaryCta: "Compare hire options",', 'English secondary CTA'],
  ['assurance: "Human acceptance stays in control",', 'assurance: "Professional acceptance stays in your control",', 'English assurance'],
  ['directAnswerTitle: "What is TAYQAN?",', 'directAnswerTitle: "What does TAYQAN do for your BOQ?",', 'English direct answer heading'],
  ['"TAYQAN is Quantara\'s governed AI Quantity Surveyor / Digital QS workflow. It helps process supported project sources, review evidence, prepare quantities, assemble the BOQ and run final QA while keeping professional acceptance with the responsible human."', '"TAYQAN acts as on-demand Digital QS capacity inside Quantara. It can coordinate supported source processing, review project evidence, prepare quantities from available evidence and measurement logic, assemble a review-ready working BOQ, surface unresolved gaps and run final QA without silently inventing missing geometry, quantities or rates."', 'English direct answer'],
  ['workflowEyebrow: "Governed workflow",', 'workflowEyebrow: "BOQ execution workflow",', 'English workflow eyebrow'],
  ['workflowTitle: "From project sources to Ready for Acceptance",', 'workflowTitle: "One governed path from project evidence to a review-ready BOQ",', 'English workflow title'],
  ['choiceTitle: "Use Quantara directly — or add TAYQAN as Digital QS capacity",', 'choiceTitle: "Use Quantara yourself — or put TAYQAN on the BOQ workload",', 'English choice title'],
  ['delegateTitle: "Hire TAYQAN",', 'delegateTitle: "Put TAYQAN on the workload",', 'English delegate title'],
  ['"Use the governed TAYQAN workflow when you want Digital QS capacity to carry supported BOQ work forward on your behalf while you retain final professional control."', '"Use TAYQAN when you want governed Digital QS capacity to carry supported BOQ preparation forward across multiple stages while you retain final professional control."', 'English delegate body'],
  ['audienceEyebrow: "Built for workload pressure",', 'audienceEyebrow: "AI QS capacity for UAE & GCC workload",', 'English audience eyebrow'],
  ['audienceTitle: "When TAYQAN can be useful",', 'audienceTitle: "Built for teams that need more BOQ throughput",', 'English audience title'],
  ['pricingEyebrow: "Separate TAYQAN hire",', 'pricingEyebrow: "On-demand Digital QS hire",', 'English pricing eyebrow'],
  ['pricingTitle: "Hire for a day, a week or monthly",', 'pricingTitle: "Add BOQ production capacity for a day, a week or monthly",', 'English pricing title'],
  ['"TAYQAN hire is commercially separate from the core Quantara SaaS subscription. Prices below come from the existing TAYQAN commerce configuration; this page does not create a second checkout system."', '"Choose the workload window that fits the project. Sign in, select the project and confirm the TAYQAN hire option inside Quantara. The existing authenticated hire flow opens secure Stripe checkout; this public page does not create or expose a second payment system."', 'English pricing body'],
  ['primaryCta: "أنشئ حساباً لتوظيف TAYQAN",', 'primaryCta: "ابدأ توظيف TAYQAN",', 'Arabic primary CTA'],
  ['secondaryCta: "عرض خيارات التوظيف",', 'secondaryCta: "قارن خيارات التوظيف",', 'Arabic secondary CTA'],
  ['"توظيف TAYQAN منفصل تجارياً عن اشتراك Quantara الأساسي. الأسعار أدناه تأتي من إعدادات تجارة TAYQAN الحالية، وهذه الصفحة لا تنشئ نظام دفع ثانياً."', '"اختر مدة العمل المناسبة للمشروع. سجّل الدخول، واختر المشروع، ثم أكّد خيار توظيف TAYQAN داخل Quantara. رحلة التوظيف الموثقة الحالية تفتح الدفع الآمن عبر Stripe، وهذه الصفحة العامة لا تنشئ أو تعرض نظام دفع ثانياً."', 'Arabic pricing body'],
];
for (const [oldText, newText, label] of copyReplacements) {
  page = replaceOnce(page, oldText, newText, label);
}

page = replaceOnce(
  page,
  `    finalCtaTitle: "Need the BOQ work carried forward?",
    finalCtaBody:
      "Create your Quantara account, then use the authenticated TAYQAN hire journey for the package that matches your workload.",
    signIn: "Already have an account? Sign in",
    faqTitle: "TAYQAN questions",`,
  `    finalCtaTitle: "Put TAYQAN on your next BOQ workload",
    finalCtaBody:
      "Sign in, select the project and continue to the authenticated TAYQAN hire screen. New customers create a Quantara account and project first; the existing backend handles secure checkout.",
    signIn: "Start TAYQAN hire",
    registerCta: "Create Quantara account",
    planCta: "Start secure TAYQAN hire",
    planCtaNote: "Sign in → choose project → confirm hire option → secure checkout",
    newAccountNote: "New to Quantara? Create an account and project first, then return to TAYQAN hire.",
    faqTitle: "TAYQAN AI Quantity Surveyor FAQ",`,
  'English closing copy',
);

page = replaceOnce(
  page,
  `    finalCtaTitle: "هل تريد دفع أعمال BOQ إلى الأمام؟",
    finalCtaBody:
      "أنشئ حساب Quantara ثم استخدم رحلة توظيف TAYQAN الموثقة للحزمة التي تناسب حجم العمل.",
    signIn: "لديك حساب بالفعل؟ سجّل الدخول",
    faqTitle: "أسئلة عن TAYQAN",`,
  `    finalCtaTitle: "ضع TAYQAN على عبء عمل BOQ القادم",
    finalCtaBody:
      "سجّل الدخول، واختر المشروع، ثم انتقل إلى شاشة توظيف TAYQAN الموثقة. ينشئ العملاء الجدد حساب Quantara ومشروعاً أولاً، بينما تتولى البنية الخلفية الحالية رحلة الدفع الآمن.",
    signIn: "ابدأ توظيف TAYQAN",
    registerCta: "أنشئ حساب Quantara",
    planCta: "ابدأ توظيف TAYQAN الآمن",
    planCtaNote: "سجّل الدخول ← اختر المشروع ← أكّد خيار التوظيف ← الدفع الآمن",
    newAccountNote: "جديد في Quantara؟ أنشئ حساباً ومشروعاً أولاً ثم عد إلى توظيف TAYQAN.",
    faqTitle: "الأسئلة الشائعة عن TAYQAN مسّاح الكميات بالذكاء الاصطناعي",`,
  'Arabic closing copy',
);

page = replaceOnce(
  page,
  `} as const;

export default async function TayqanAiQuantitySurveyorPage() {`,
  `} as const;

const TAYQAN_HIRE_LOGIN_HREF = "/login?next=%2Fprojects%3Ftayqan%3Dassign";

export default async function TayqanAiQuantitySurveyorPage() {`,
  'TAYQAN hire handoff constant',
);

const faqBlock = `  const faqs =
    locale === "ar"
      ? [
          {
            question: "ما هو TAYQAN؟",
            answer:
              "TAYQAN هو سير عمل Quantara المنضبط لمسّاح كميات بالذكاء الاصطناعي / مسّاح كميات رقمي. يساعد في معالجة المصادر المدعومة، ومراجعة الأدلة، وإعداد الكميات، وتجميع BOQ والمراجعة النهائية، مع بقاء القبول المهني لدى الإنسان المسؤول.",
          },
          {
            question: "هل TAYQAN مولّد BOQ بالذكاء الاصطناعي؟",
            answer:
              "يمكن لـ TAYQAN تجميع BOQ عامل وجاهز للمراجعة من أدلة المشروع والمدخلات والكميات المدعومة ضمن سير عمل منضبط. النتيجة ليست اعتماداً مهنياً نهائياً وتبقى بحاجة إلى القبول البشري المسؤول.",
          },
          {
            question: "هل يستبدل TAYQAN مسّاح الكميات؟",
            answer:
              "لا. يستطيع TAYQAN دفع مهام سير العمل المدعومة إلى الأمام، لكنه لا يستبدل الحكم المهني أو القبول النهائي أو مسؤولية مسّاح الكميات المسؤول.",
          },
          {
            question: "هل يستطيع TAYQAN قياس أي رسم تلقائياً؟",
            answer:
              "لا. يستخدم TAYQAN معالجة المصادر المدعومة والأدلة والقياسات المتاحة والمراجعة. لا يدّعي حصر أي هندسة رسم بشكل آلي وغير مراقب بالكامل، ولا يختلق أبعاداً مفقودة.",
          },
          {
            question: "كم تبلغ تكلفة TAYQAN؟",
            answer:
              "خيارات التوظيف الحالية هي 299 درهماً لتوظيف يوم لمدة 24 ساعة وحتى مشروعين مختلفين، و999 درهماً لتوظيف أسبوع، و2,499 درهماً شهرياً لقدرة Digital QS مستمرة.",
          },
          {
            question: "أي خيار توظيف TAYQAN أختار؟",
            answer:
              "خيار اليوم مناسب للأعمال القصيرة أو العاجلة وحتى مشروعين مختلفين خلال 24 ساعة، وخيار الأسبوع للعمل المركز لعدة أيام، والخيار الشهري للقدرة المستمرة عبر أحمال عمل متغيرة.",
          },
          {
            question: "كيف تعمل عملية توظيف ودفع TAYQAN؟",
            answer:
              "سجّل الدخول، واختر المشروع من وضع تعيين TAYQAN، ثم افتح شاشة TAYQAN الموثقة وأكّد خيار التوظيف. بعد ذلك تفتح رحلة التوظيف الحالية الدفع الآمن عبر Stripe. هذه الصفحة العامة لا تعالج الدفع ولا تعرض رابط دفع ثابتاً.",
          },
          {
            question: "هل توظيف TAYQAN منفصل عن اشتراك Quantara؟",
            answer:
              "نعم. توظيف TAYQAN منفصل تجارياً عن اشتراك Quantara الأساسي، ويستمر الدفع عبر رحلة TAYQAN الموثقة الحالية داخل الحساب والمشروع.",
          },
          {
            question: "هل TAYQAN مناسب لفرق الإنشاءات في الإمارات ودول الخليج؟",
            answer:
              "تم تصميم TAYQAN لفرق مسح الكميات والمقاولين وMEP وFit-Out والاستشاريين، بما في ذلك أحمال مشاريع الإمارات ودول الخليج. هذا لا يعني اعتماداً من جهة محلية أو قاعدة أسعار محلية أو امتثالاً تنظيمياً تلقائياً.",
          },
          {
            question: "هل يستخرج TAYQAN النص من ملفات PDF الممسوحة ضوئياً؟",
            answer:
              "لا تقوم Quantara حالياً باستخراج نص OCR من ملفات PDF المصورة أو الممسوحة ضوئياً. يمكن اكتشاف الصفحات الصورية، لكن المحتوى يحتاج إلى إدخال أو مراجعة يدوية قبل استخدامه كدليل.",
          },
        ]
      : [
          {
            question: "What is TAYQAN?",
            answer:
              "TAYQAN is Quantara's governed AI Quantity Surveyor / Digital QS workflow for supported source processing, evidence review, quantity preparation, BOQ assembly and final QA, with professional acceptance remaining under human control.",
          },
          {
            question: "Is TAYQAN an AI BOQ generator?",
            answer:
              "TAYQAN can assemble a working, review-ready BOQ from supported project evidence, inputs and quantities inside a governed workflow. The result is not automatic professional approval and remains subject to responsible human acceptance.",
          },
          {
            question: "Does TAYQAN replace a Quantity Surveyor?",
            answer:
              "No. TAYQAN can carry supported workflow tasks forward, but it does not replace professional judgement, final acceptance or the responsible Quantity Surveyor's professional responsibility.",
          },
          {
            question: "Can TAYQAN automatically measure any drawing?",
            answer:
              "No. TAYQAN uses supported source processing and available reviewed evidence and measurements. It does not claim fully unattended arbitrary drawing-geometry takeoff and does not invent missing dimensions.",
          },
          {
            question: "How much does TAYQAN cost?",
            answer:
              "Current hire options are AED 299 for a 24-hour Day hire with up to 2 distinct projects, AED 999 for a Week hire, and AED 2,499 per month for ongoing Digital QS capacity.",
          },
          {
            question: "Which TAYQAN hire option should I choose?",
            answer:
              "Choose Day for urgent or short BOQ assignments and up to 2 distinct projects during 24 hours, Week for several days of focused QS work, and Monthly for ongoing Digital QS capacity across changing workloads.",
          },
          {
            question: "How does TAYQAN checkout work?",
            answer:
              "Sign in, choose the project from TAYQAN assignment mode, open the authenticated TAYQAN screen and confirm the hire option. The existing hire flow then opens secure Stripe checkout. This public page does not process payment or expose a static payment link.",
          },
          {
            question: "Is TAYQAN hire separate from the Quantara subscription?",
            answer:
              "Yes. TAYQAN hire is commercially separate from the core Quantara SaaS subscription and continues through the existing authenticated TAYQAN hire flow inside the account and project.",
          },
          {
            question: "Is TAYQAN for UAE and GCC construction teams?",
            answer:
              "TAYQAN is designed for Quantity Surveying teams, contractors, MEP, fit-out and consultants, including UAE and GCC project workloads. This does not imply local authority approval, a built-in local rate database or automatic regulatory compliance.",
          },
          {
            question: "Does TAYQAN extract text from scanned PDFs?",
            answer:
              "Quantara does not currently perform OCR text extraction from image-only or scanned PDFs. Image-only pages can be detected, but their content needs manual transcription or review before it can be used as evidence.",
          },
        ];`;

page = replaceRegexOnce(
  page,
  /  const faqs =[\s\S]*?\n\n  const jsonLd =/,
  `${faqBlock}\n\n  const jsonLd =`,
  'FAQ block',
);

page = replaceFirst(page, 'href="/register"', 'href={TAYQAN_HIRE_LOGIN_HREF}', 'hero TAYQAN hire CTA');
page = replaceFirst(page, 'href="/pricing"', 'href="#hire-options"', 'hero hire-options anchor');

page = replaceOnce(
  page,
  `      <section className="border-y border-slate-800 bg-slate-950/70 px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
              {copy.pricingEyebrow}`, 
  `      <section id="hire-options" className="border-y border-slate-800 bg-slate-950/70 px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
              {copy.pricingEyebrow}`,
  'pricing anchor',
);

page = replaceOnce(
  page,
  `                  {plan.maxDistinctProjects ? (
                    <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
                      {sales.upToProjects.replace("{count}", String(plan.maxDistinctProjects))}
                    </p>
                  ) : null}
                </article>`,
  `                  {plan.maxDistinctProjects ? (
                    <p className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
                      {sales.upToProjects.replace("{count}", String(plan.maxDistinctProjects))}
                    </p>
                  ) : null}
                  <Link
                    href={TAYQAN_HIRE_LOGIN_HREF}
                    aria-label={\`${'${copy.planCta}'}: ${'${planCopy.title}'} ${'${amount}'}\`}
                    className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-cyan-600 px-5 text-sm font-semibold text-white hover:bg-cyan-500"
                  >
                    {copy.planCta}
                    <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">{copy.planCtaNote}</p>
                </article>`,
  'pricing card hire CTA',
);

page = replaceOnce(
  page,
  `          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">{copy.faqTitle}</h2>`,
  `          </div>
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-400">{copy.newAccountNote}</p>
            <Link href="/register" className="mt-3 inline-flex items-center font-semibold text-cyan-300 hover:text-cyan-200">
              {copy.registerCta}
              <ArrowRight className="ms-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">{copy.faqTitle}</h2>`,
  'new-account pricing handoff',
);

page = replaceOnce(
  page,
  `          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-cyan-600 px-7 font-semibold text-white hover:bg-cyan-500"
            >
              {copy.primaryCta}
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 px-7 font-semibold text-white hover:bg-slate-900"
            >
              {copy.signIn}
            </Link>
          </div>`,
  `          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={TAYQAN_HIRE_LOGIN_HREF}
              className="inline-flex h-12 items-center justify-center rounded-lg bg-cyan-600 px-7 font-semibold text-white hover:bg-cyan-500"
            >
              {copy.signIn}
            </Link>
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-700 px-7 font-semibold text-white hover:bg-slate-900"
            >
              {copy.registerCta}
            </Link>
          </div>`,
  'final CTA handoff',
);

page = replaceOnce(page, 'dateModified: "2026-08-16",', 'dateModified: "2026-08-17",', 'page modified date');
write('page.tsx', page);

let registry = read('search-registry.ts');
registry = replaceOnce(
  registry,
  'page({ path: "/tayqan-ai-quantity-surveyor", title: "TAYQAN AI Quantity Surveyor for BOQ Work | Quantara", description: "Hire TAYQAN, Quantara\'s governed Digital QS, for source review, quantity preparation, BOQ assembly and QA with final human acceptance.", cluster: "audience", intent: "commercial", priority: 0.95, changeFrequency: "weekly" }),',
  'page({ path: "/tayqan-ai-quantity-surveyor", title: "AI Quantity Surveyor UAE & BOQ Generator | TAYQAN", description: "Hire TAYQAN, Quantara\'s AI Quantity Surveyor for governed BOQ preparation, quantity workflows and QA. Choose day, week or monthly Digital QS capacity.", cluster: "audience", intent: "commercial", priority: 0.95, changeFrequency: "weekly" }),',
  'TAYQAN metadata registry',
);
write('search-registry.ts', registry);

let llms = read('llms.txt');
const llmsSection = `## TAYQAN - AI Quantity Surveyor / Digital QS

Canonical public page: https://quantara.vistabylara.com/tayqan-ai-quantity-surveyor

TAYQAN is Quantara's governed AI Quantity Surveyor / Digital QS workflow for teams that want supported BOQ preparation carried across multiple controlled stages rather than handled as isolated prompts. It can support source discovery, source processing, evidence review, quantity preparation, governed rate preparation when requested, BOQ assembly, validation / final QA, and a Ready for Acceptance state.

TAYQAN can assemble a working, review-ready BOQ from supported project evidence, inputs and quantities. It is not automatic professional approval and does not replace the responsible Quantity Surveyor's judgement or acceptance.

Current TAYQAN hire options are:
- TAYQAN Day: AED 299 one-time for a 24-hour hire, up to 2 distinct projects.
- TAYQAN Week: AED 999 one-time for a 7-day hire.
- TAYQAN Monthly / Digital QS: AED 2,499 per month.

Public-to-checkout hire path:
1. Review TAYQAN capabilities and hire options on the public TAYQAN page.
2. Existing customers sign in and return to the TAYQAN project-assignment view.
3. Choose the project and continue to that project's authenticated TAYQAN screen.
4. Confirm the eligible TAYQAN hire option inside Quantara.
5. The existing authenticated hire flow opens secure Stripe checkout. The public page does not process payment, expose a static Stripe payment link, or create a second checkout system.

TAYQAN is designed for Quantity Surveying teams, contractors, MEP, fit-out and consultants, including UAE and GCC project workloads. This does not imply local authority approval, a built-in local rate database or automatic regulatory compliance.

TAYQAN does not automatically approve, issue, lock, tender-submit or certify a BOQ. It must not invent missing geometry, dimensions, quantities or rates. It does not claim fully unattended takeoff from arbitrary drawing geometry. Quantara does not currently perform OCR text extraction from image-only or scanned PDFs. Final professional acceptance remains under human control.

TAYQAN hire is commercially separate from the core Quantara SaaS subscription.`;
llms = replaceRegexOnce(
  llms,
  /## TAYQAN - AI Quantity Surveyor \/ Digital QS[\s\S]*?\n\n## Quantara subscription pricing/,
  `${llmsSection}\n\n## Quantara subscription pricing`,
  'TAYQAN llms section',
);
write('llms.txt', llms);

let test = read('tayqan-public-landing.test.ts');
test = replaceOnce(
  test,
  `    expect(route?.indexable).not.toBe(false);`,
  `    expect(route?.indexable).not.toBe(false);
    expect(route?.title).toBe("AI Quantity Surveyor UAE & BOQ Generator | TAYQAN");
    expect(route?.description).toContain("day, week or monthly Digital QS capacity");`,
  'metadata test assertions',
);
test = replaceOnce(
  test,
  `    expect(pageSource).toContain("TAYQAN_HIRE_PLANS.map");

    expect(pageSource).not.toContain("/api/commerce/checkout");`,
  `    expect(pageSource).toContain("TAYQAN_HIRE_PLANS.map");
    expect(pageSource).toContain('/login?next=%2Fprojects%3Ftayqan%3Dassign');
    expect(pageSource).toContain('id="hire-options"');
    expect(pageSource).toContain("Start secure TAYQAN hire");

    expect(pageSource).not.toContain("/api/commerce/checkout");
    expect(pageSource).not.toContain("/api/tayqan/checkout");
    expect(pageSource).not.toContain("stripe.com");`,
  'safe hire handoff test assertions',
);
test = replaceOnce(
  test,
  `    expect(pageSource).toContain(
      "How do I hire TAYQAN?",
    );`,
  `    expect(pageSource).toContain("Is TAYQAN an AI BOQ generator?");
    expect(pageSource).toContain("Which TAYQAN hire option should I choose?");
    expect(pageSource).toContain("How does TAYQAN checkout work?");
    expect(pageSource).toContain("Is TAYQAN hire separate from the Quantara subscription?");
    expect(pageSource).toContain("Is TAYQAN for UAE and GCC construction teams?");
    expect(pageSource).toContain("Does TAYQAN extract text from scanned PDFs?");`,
  'AEO FAQ test assertions',
);
test = replaceOnce(
  test,
  `    expect(llms).toContain(
      "https://quantara.vistabylara.com/tayqan-ai-quantity-surveyor",
    );`,
  `    expect(llms).toContain(
      "https://quantara.vistabylara.com/tayqan-ai-quantity-surveyor",
    );
    expect(llms).toContain("Public-to-checkout hire path");
    expect(llms).toContain("existing authenticated hire flow opens secure Stripe checkout");`,
  'llms hire path test assertions',
);
write('tayqan-public-landing.test.ts', test);

console.log('PATCH_OK');

'@
$patchPath = Join-Path $tempDir "patch.js"
[IO.File]::WriteAllText($patchPath, $patchScript, $utf8)

node $patchPath $tempDir
if ($LASTEXITCODE -ne 0) {
    throw "STOP: deterministic content patch failed."
}
Write-Host "PASS: content patch applied." -ForegroundColor Green

Write-Host "`n=== 5. LOCAL CONTENT SAFETY CHECKS ===" -ForegroundColor Cyan
$pageText = [IO.File]::ReadAllText($page.Path)
$registryText = [IO.File]::ReadAllText($registry.Path)
$llmsText = [IO.File]::ReadAllText($llms.Path)
$testText = [IO.File]::ReadAllText($test.Path)

$requiredPageSignals = @(
    'AI Quantity Surveyor for BOQ Production',
    '/login?next=%2Fprojects%3Ftayqan%3Dassign',
    'id="hire-options"',
    'Start secure TAYQAN hire',
    'How does TAYQAN checkout work?',
    'Is TAYQAN an AI BOQ generator?',
    'Is TAYQAN for UAE and GCC construction teams?'
)
foreach ($signal in $requiredPageSignals) {
    if (-not $pageText.Contains($signal)) {
        throw "STOP: page missing required signal: $signal"
    }
}

foreach ($forbidden in @('/api/tayqan/checkout', '/api/commerce/checkout', 'stripe.com', 'tayqan_day_299', 'tayqan_week_999', 'tayqan_monthly_2499')) {
    if ($pageText.Contains($forbidden)) {
        throw "STOP: public page contains forbidden checkout/backend signal: $forbidden"
    }
}

if (-not $registryText.Contains('AI Quantity Surveyor UAE & BOQ Generator | TAYQAN')) {
    throw "STOP: TAYQAN metadata title missing."
}
if (-not $llmsText.Contains('Public-to-checkout hire path')) {
    throw "STOP: llms TAYQAN hire path missing."
}
if (-not $testText.Contains('existing authenticated hire flow opens secure Stripe checkout')) {
    throw "STOP: focused test did not receive llms checkout assertion."
}

Write-Host "PASS: no Stripe API, Prisma, workflow or price-code wiring added to public page." -ForegroundColor Green

Write-Host "`n=== 6. CREATE BRANCH ONLY AFTER PATCH VALIDATION ===" -ForegroundColor Cyan
gh api --method POST "repos/$repo/git/refs" -f "ref=refs/heads/$branch" -f "sha=$baseSha" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "STOP: branch creation failed."
}
Write-Host "PASS: branch created from exact pinned main." -ForegroundColor Green

Write-Host "`n=== 7. PUSH FOUR FILES THROUGH GITHUB CONTENTS API ===" -ForegroundColor Cyan
Set-BranchFile "src/app/(marketing)/tayqan-ai-quantity-surveyor/page.tsx" $page.Path $page.Sha "feat(marketing): upgrade TAYQAN hire conversion page"
Set-BranchFile "src/lib/public-site/search-registry.ts" $registry.Path $registry.Sha "seo(marketing): sharpen TAYQAN search intent"
Set-BranchFile "public/llms.txt" $llms.Path $llms.Sha "docs(ai): expand TAYQAN hire discovery"
Set-BranchFile "tests/tayqan-public-landing.test.ts" $test.Path $test.Sha "test(marketing): lock TAYQAN public hire boundaries"
Write-Host "PASS: four approved files pushed." -ForegroundColor Green

Write-Host "`n=== 8. VERIFY EXACT FOUR-FILE SCOPE ===" -ForegroundColor Cyan
$compare = gh api "repos/$repo/compare/$baseSha...$branch" | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
    throw "STOP: compare failed."
}

$actualFiles = @($compare.files | ForEach-Object { $_.filename } | Sort-Object -Unique)
$expectedFiles = @(
    "public/llms.txt",
    "src/app/(marketing)/tayqan-ai-quantity-surveyor/page.tsx",
    "src/lib/public-site/search-registry.ts",
    "tests/tayqan-public-landing.test.ts"
) | Sort-Object

if (($actualFiles -join "`n") -ne ($expectedFiles -join "`n")) {
    Write-Host "ACTUAL FILES:" -ForegroundColor Red
    $actualFiles
    throw "STOP: branch scope is not exactly four approved public files."
}
Write-Host "PASS: exact four-file public scope." -ForegroundColor Green

Write-Host "`n=== 9. OPEN ONE DRAFT PR ===" -ForegroundColor Cyan
$body = @(
    "## TAYQAN single-page conversion + SEO/GEO/AEO upgrade",
    "",
    "### Scope",
    "- upgrade only the public /tayqan-ai-quantity-surveyor page",
    "- add secure hire CTAs that hand users to the existing authenticated TAYQAN project-assignment flow",
    "- expand visible bilingual FAQ / existing page schema inputs",
    "- sharpen TAYQAN metadata for AI Quantity Surveyor + BOQ generator commercial intent",
    "- expand the existing TAYQAN section in public/llms.txt",
    "- strengthen focused public landing tests",
    "",
    "### Verified hire handoff",
    "Public page -> login with safe next path -> /projects?tayqan=assign -> project TAYQAN screen -> existing authenticated secure Stripe checkout.",
    "",
    "### Explicitly untouched",
    "- Stripe configuration / Stripe prices / checkout implementation",
    "- /api/tayqan/checkout",
    "- Prisma / migrations / database",
    "- TAYQAN commerce truth",
    "- TAYQAN runtime / work orders / intake",
    "- authentication behavior",
    "- BOQ engine / measurement / extraction workflow",
    "- project picker behavior",
    "",
    "### Public claim boundaries retained",
    "- no guaranteed accuracy or speed",
    "- no arbitrary unattended drawing takeoff claim",
    "- no OCR extraction claim for scanned PDFs",
    "- no UAE authority approval / local-rate / automatic compliance claim",
    "- final professional acceptance remains human-controlled",
    "",
    "Draft for CI + CodeRabbit review before merge."
) -join "`n"

$prUrl = gh pr create --repo $repo --base main --head $branch --draft --title "feat(marketing): turn TAYQAN page into high-intent hire journey" --body $body
if ($LASTEXITCODE -ne 0) {
    throw "STOP: PR creation failed."
}
Write-Host "PR: $prUrl" -ForegroundColor Green

Write-Host "`n=== 10. TRIGGER CODERABBIT ===" -ForegroundColor Cyan
$prNumber = gh pr view $branch --repo $repo --json number --jq '.number'
if ($LASTEXITCODE -ne 0 -or -not $prNumber) {
    throw "STOP: could not resolve new PR number."
}

gh pr comment $prNumber --repo $repo --body "@coderabbitai review" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "STOP: PR created, but CodeRabbit trigger failed."
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "TAYQAN PUBLIC HIRE PAGE PR CREATED" -ForegroundColor Green
Write-Host "BASE: $baseSha"
Write-Host "BRANCH: $branch"
Write-Host "PR: #$prNumber"
Write-Host "FILES: EXACTLY 4"
Write-Host "PUBLIC TAYQAN PAGE: UPGRADED"
Write-Host "HIRE CTA: EXISTING AUTHENTICATED FLOW"
Write-Host "VISIBLE FAQ: EXPANDED"
Write-Host "SEO/GEO/AEO METADATA: UPGRADED"
Write-Host "LLMS.TXT: UPDATED"
Write-Host "STRIPE CODE: UNCHANGED"
Write-Host "PRISMA/DB: UNCHANGED"
Write-Host "TAYQAN RUNTIME: UNCHANGED"
Write-Host "BOQ WORKFLOW: UNCHANGED"
Write-Host "MERGE: NOT YET"
Write-Host "========================================================" -ForegroundColor Green
Write-Host "Send me only the PR number; I will inspect CI + CodeRabbit before merge." -ForegroundColor Yellow

Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
