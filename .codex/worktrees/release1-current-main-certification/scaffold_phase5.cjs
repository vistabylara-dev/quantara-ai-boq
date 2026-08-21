const fs = require('fs');
const path = require('path');

const TARGET_DIR = 'C:\\Users\\PC\\Desktop\\quantara-ai-boq\\src\\app';

const regions = [
  {
    slug: 'boq-software-uae',
    title: 'BOQ Software UAE for Contractors and Quantity Surveyors | Quantara',
    description: 'Organize UAE construction BOQ workflows, supported project documents, revisions, templates and professional outputs using Quantara.',
    h1: 'BOQ Software for UAE Construction and Estimating Teams',
    breadcrumbLabel: 'BOQ Software UAE',
    breadcrumbParent: { href: '/gcc-boq-software', label: 'GCC BOQ Software' },
    audienceDescription: 'For UAE contractors, estimators and quantity surveyors requiring structured BOQ and project document workflows.',
    directAnswer: 'Quantara provides UAE construction teams with a structured platform to organize tender documents, manage consultant revisions, and build project BOQ records.',
    challenges: [
      {
        title: 'Mixed Tender Formats',
        description: 'UAE construction and tender workflows vary by project, often involving a mix of scanned PDFs, consultant Excel files, and unstructured project narratives.'
      },
      {
        title: 'High Revision Volume',
        description: 'Managing frequent consultant, contractor, and subcontractor revisions during the tender phase requires strict document control.'
      }
    ],
    workflowDescription: 'Quantara supports teams in structuring BOQs from supported documents. It provides version control for revisions, centralizes project templates, and generates professional outputs. While multilingual documents may occur on UAE projects, users manage their own descriptions and records.',
    workflowExample: 'A UAE main contractor receives a complex PDF BOQ from a project consultant. They use Quantara to extract the document, structure the items, and apply their company’s controlled template before issuing distinct packages to local subcontractors for pricing.',
    typicalCategories: [
      'Preliminaries',
      'Civil and Structural',
      'Architectural Finishes',
      'MEP Works',
      'Provisional Sums'
    ],
    supportedInputs: ['Text-based PDF', 'Scanned PDF', 'XLSX', 'CSV'],
    plannedInputs: ['CAD', 'BIM', 'IFC'],
    supportedOutputs: ['Structured Excel (XLSX)', 'Formatted PDF Proposals', 'CSV Exports'],
    limitations: [
      'Quantara does not claim UAE compliance or specific regulatory approval.',
      'Quantara does not provide UAE-specific market rates or calculate UAE VAT.',
      'Quantara does not support automated Arabic language translation or native parsing unless explicitly verified in the future.'
    ],
    faqs: [
      { question: 'Is Quantara available to UAE construction companies?', answer: 'Yes, Quantara is available for UAE-based contractors, estimators, and quantity surveyors to manage their BOQ workflows.' },
      { question: 'Does Quantara include UAE construction rates?', answer: 'No, Quantara does not provide pre-built UAE market rates or pricing databases. Users must apply their own rates to the structured BOQ.' },
      { question: 'Does Quantara support UAE VAT calculations?', answer: 'No, Quantara does not calculate VAT or other local taxes. It focuses purely on structuring the BOQ items and quantities.' },
      { question: 'Can Quantara process Arabic BOQ documents?', answer: 'Currently, Quantara is optimized for English documents. It does not claim native Arabic OCR or translation support unless explicitly verified.' },
      { question: 'Is Quantara hosted in the UAE?', answer: 'Quantara utilizes global cloud infrastructure and does not guarantee specific local data residency in the UAE at this time.' },
      { question: 'Does it comply with Dubai Municipality regulations?', answer: 'Quantara is a document workflow tool and does not provide engineering approval or regulatory compliance validation.' },
      { question: 'Can I manage consultant revisions?', answer: 'Yes, Quantara includes revision tracking to manage updates from consultants or clients during the tender phase.' },
      { question: 'What does Controlled Early Access mean for regional users?', answer: 'It means the platform is active but access is managed to ensure high performance and dedicated support for early adopters.' },
      { question: 'Which file formats are currently supported?', answer: 'Quantara supports Text-based PDF, Scanned PDF, XLSX, and CSV imports.' },
      { question: 'Does Quantara replace a local quantity surveyor?', answer: 'No, professional review by a qualified QS or estimator is always required.' }
    ],
    relatedPages: [
      { href: '/boq-software-dubai', label: 'BOQ Software Dubai' },
      { href: '/boq-software-abu-dhabi', label: 'BOQ Software Abu Dhabi' },
      { href: '/construction-estimating-software-uae', label: 'UAE Estimating Software' },
      { href: '/mep-estimating-software-uae', label: 'UAE MEP Estimating' },
      { href: '/boq-software', label: 'BOQ Software' }
    ]
  },
  {
    slug: 'boq-software-dubai',
    title: 'BOQ Software Dubai for Contractors, MEP and Fit-Out Teams | Quantara',
    description: 'Support Dubai BOQ and estimating workflows with structured documents, revisions, templates and professionally reviewed project outputs using Quantara.',
    h1: 'BOQ Software for Dubai Contractors, MEP and Fit-Out Projects',
    breadcrumbLabel: 'BOQ Software Dubai',
    breadcrumbParent: { href: '/gcc-boq-software', label: 'GCC BOQ Software' },
    audienceDescription: 'For Dubai contractors, MEP firms, fit-out companies and QS teams managing fast-moving tender documentation.',
    directAnswer: 'Quantara provides Dubai construction teams with a workflow platform to manage interior fit-out scope, MEP documents, and high-volume client revisions.',
    challenges: [
      {
        title: 'Fast-Moving Tender Schedules',
        description: 'Dubai projects often feature aggressive tender timelines, requiring rapid consolidation of PDF and Excel BOQ data.'
      },
      {
        title: 'Interior and MEP Complexity',
        description: 'High-end fit-out and complex MEP coordination require structured BOQ records to prevent scope gaps during fast-track delivery.'
      }
    ],
    workflowDescription: 'Quantara allows teams to organize detailed project and proposal documents into controlled records. Whether managing fit-out finishes or MEP schedules, the platform structures the BOQ data for professional review before tender submission.',
    workflowExample: 'A Dubai fit-out company receives a revised scope of works in PDF just days before the tender deadline. They use Quantara to quickly extract the new joinery and ceiling items, updating their structured BOQ to match the client\'s latest revision.',
    typicalCategories: [
      'Fit-out Finishes',
      'Joinery Works',
      'MEP Services',
      'Specialist Installations',
      'Preliminaries'
    ],
    supportedInputs: ['Text-based PDF', 'Scanned PDF', 'XLSX', 'CSV'],
    plannedInputs: ['CAD', 'BIM', 'IFC'],
    supportedOutputs: ['Structured Excel (XLSX)', 'Formatted PDF Proposals', 'CSV Exports'],
    limitations: [
      'Quantara does not claim a local Dubai office unless explicitly verified.',
      'Quantara does not claim Dubai authority approval or specific integration with Dubai Municipality systems.',
      'Quantara does not provide automated visual drawing measurement.'
    ],
    faqs: [
      { question: 'Can Dubai fit-out companies use Quantara for BOQ workflows?', answer: 'Yes, Quantara is well-suited for organizing detailed interior fit-out BOQs and tracking client variations.' },
      { question: 'Does Quantara integrate with Dubai government portals?', answer: 'No, Quantara does not integrate directly with local tender or government portals. Users must export their BOQ to Excel or PDF for manual submission.' },
      { question: 'Is Quantara approved by Dubai authorities?', answer: 'Quantara is an independent software tool and does not claim any official government approval or certification.' },
      { question: 'Can I manage MEP scope separation?', answer: 'Yes, the platform allows you to create structured sections to cleanly separate mechanical, electrical, and plumbing scope.' },
      { question: 'Does it support scanned PDFs from local consultants?', answer: 'Yes, OCR is available for scanned PDFs, though all extracted data must be professionally reviewed.' },
      { question: 'Does Quantara have a local office in Dubai?', answer: 'Quantara operates globally; we do not claim a physical local office in Dubai at this time.' },
      { question: 'Can I track fast-moving revisions?', answer: 'Yes, the platform\'s revision control is designed to handle multiple iterations of a BOQ quickly.' },
      { question: 'Is there a pre-built library for Dubai rates?', answer: 'No, Quantara provides the structure; you must apply your own market rates.' },
      { question: 'How do I export my final proposal?', answer: 'You can export the structured BOQ as a formatted PDF proposal or an XLSX file.' }
    ],
    relatedPages: [
      { href: '/boq-software-uae', label: 'BOQ Software UAE' },
      { href: '/boq-software-for-fit-out-companies', label: 'Fit-Out BOQ Software' },
      { href: '/boq-software-for-mep-contractors', label: 'MEP BOQ Software' },
      { href: '/construction-estimating-software', label: 'Construction Estimating Software' },
      { href: '/contact-sales', label: 'Contact Sales' }
    ]
  },
  {
    slug: 'boq-software-abu-dhabi',
    title: 'BOQ Software Abu Dhabi for Construction and Engineering Teams | Quantara',
    description: 'Organize Abu Dhabi BOQ workflows, project records, revisions, templates and supported professional outputs with Quantara.',
    h1: 'BOQ Software for Abu Dhabi Construction and Engineering Workflows',
    breadcrumbLabel: 'BOQ Software Abu Dhabi',
    breadcrumbParent: { href: '/gcc-boq-software', label: 'GCC BOQ Software' },
    audienceDescription: 'For Abu Dhabi construction, engineering and facilities-management teams requiring robust BOQ structuring.',
    directAnswer: 'Quantara helps Abu Dhabi project teams organize consultant and contractor documentation, manage revisions, and structure engineering workflows.',
    challenges: [
      {
        title: 'Complex Engineering Documentation',
        description: 'Large-scale infrastructure and engineering projects generate massive volumes of PDF and Excel documentation that must be structured accurately.'
      },
      {
        title: 'Strict Consultant Standards',
        description: 'Matching the exact BOQ structure required by lead consultants across multiple project revisions demands tight document control.'
      }
    ],
    workflowDescription: 'Quantara supports structured records for engineering and facilities-management workflows. By organizing supported documents into controlled templates, teams can manage project revisions efficiently and prepare data for professional output review.',
    workflowExample: 'An Abu Dhabi engineering consultant uses Quantara to consolidate multiple PDF BOQ sections from various disciplines into a single, unified project record before issuing it to contractors for tender.',
    typicalCategories: [
      'Infrastructure Works',
      'Civil Engineering',
      'Facilities Management',
      'MEP Services',
      'General Preliminaries'
    ],
    supportedInputs: ['Text-based PDF', 'Scanned PDF', 'XLSX', 'CSV'],
    plannedInputs: ['CAD', 'BIM', 'IFC'],
    supportedOutputs: ['Structured Excel (XLSX)', 'Formatted PDF Proposals', 'CSV Exports'],
    limitations: [
      'Quantara does not claim public-sector approval or regulatory integration.',
      'Quantara does not perform engineering validation or design compliance checks.',
      'All outputs must be reviewed by qualified local engineering professionals.'
    ],
    faqs: [
      { question: 'Is Quantara suitable for Abu Dhabi engineering consultants?', answer: 'Yes, it provides the structured workflows necessary to organize multidisciplinary BOQs and track revisions.' },
      { question: 'Does Quantara have Abu Dhabi public-sector approval?', answer: 'No, Quantara does not claim any specific public-sector approval or regulatory certification.' },
      { question: 'Can facilities-management teams use Quantara?', answer: 'Yes, FM teams can structure BOQs for refurbishment and maintenance works using the platform.' },
      { question: 'Does it support standard measurement methods like CESMM?', answer: 'Quantara provides the structure, but it does not strictly enforce or automatically apply CESMM or any other specific measurement standard.' },
      { question: 'Can I consolidate multiple consultant PDFs?', answer: 'Yes, you can extract items from multiple PDFs and organize them into a single, structured project BOQ.' },
      { question: 'How is revision control handled for large projects?', answer: 'Revisions are tracked sequentially, allowing teams to maintain a clear audit trail of changes over time.' },
      { question: 'Can I share the BOQ with my team?', answer: 'Yes, Quantara supports collaborative project records for your internal team.' },
      { question: 'Are CAD or BIM files supported?', answer: 'No, CAD, BIM, and IFC integrations are currently in the Planned phase.' }
    ],
    relatedPages: [
      { href: '/boq-software-uae', label: 'BOQ Software UAE' },
      { href: '/boq-software-for-engineering-consultants', label: 'Engineering Consultant BOQ' },
      { href: '/boq-software-for-facilities-management', label: 'FM BOQ Software' },
      { href: '/boq-management', label: 'BOQ Management' },
      { href: '/contact-sales', label: 'Contact Sales' }
    ]
  },
  {
    slug: 'construction-estimating-software-uae',
    title: 'Construction Estimating Software UAE and BOQ Workflows | Quantara',
    description: 'Organize UAE construction scope, BOQ items, revisions, templates, assumptions and professional estimating outputs using Quantara.',
    h1: 'Construction Estimating Software for UAE BOQ and Project Workflows',
    breadcrumbLabel: 'UAE Estimating Software',
    breadcrumbParent: { href: '/gcc-boq-software', label: 'GCC BOQ Software' },
    audienceDescription: 'For UAE teams linking BOQ preparation to their core construction-estimating processes.',
    directAnswer: 'Quantara provides a structured foundation for UAE estimating teams, organizing BOQ items, quantities, and assumptions before professional pricing review.',
    challenges: [
      {
        title: 'Unstructured Estimating Data',
        description: 'Estimators frequently waste hours re-typing BOQ descriptions from PDFs into pricing spreadsheets, risking critical omissions.'
      },
      {
        title: 'Tracking Assumptions',
        description: 'Failing to clearly link commercial assumptions and exclusions to specific BOQ items often leads to disputes post-award.'
      }
    ],
    workflowDescription: 'Quantara clarifies the BOQ-to-estimate relationship by allowing teams to structure quantities, units, rates, and explicit assumptions. Users can apply company templates to supported project documents, ensuring a clean baseline for professional pricing review.',
    workflowExample: 'A UAE estimator imports a scanned PDF BOQ into Quantara. They structure the items, add specific notes for their commercial exclusions, and export the clean, organized list to Excel for final rate application.',
    typicalCategories: [
      'Site Preparation',
      'Concrete Works',
      'Masonry',
      'Metals',
      'Finishes'
    ],
    supportedInputs: ['Text-based PDF', 'Scanned PDF', 'XLSX', 'CSV'],
    plannedInputs: ['CAD', 'BIM', 'IFC'],
    supportedOutputs: ['Structured Excel (XLSX)', 'Formatted PDF Proposals', 'CSV Exports'],
    limitations: [
      'Quantara does not provide an automatic final-cost guarantee.',
      'Quantara does not claim to include UAE rate libraries or databases.',
      'Quantara does not calculate VAT or other statutory deductions.'
    ],
    faqs: [
      { question: 'How does Quantara assist UAE estimators?', answer: 'It accelerates the pre-pricing phase by structuring BOQ documents, allowing estimators to focus on applying rates rather than data entry.' },
      { question: 'Does it include a UAE pricing database?', answer: 'No, Quantara does not provide pre-built rate libraries. Estimators must use their own commercial rates.' },
      { question: 'Can I track estimating assumptions?', answer: 'Yes, assumptions and exclusions can be documented directly against specific BOQ sections or items.' },
      { question: 'Does Quantara guarantee final project costs?', answer: 'No, Quantara is a workflow tool. Final cost guarantees are entirely the responsibility of the estimating professional.' },
      { question: 'Does it support VAT calculation?', answer: 'No, Quantara does not handle tax calculations like VAT.' },
      { question: 'Can I export the structured BOQ to my estimating software?', answer: 'Yes, you can export the data to CSV or XLSX for import into your primary financial or estimating system.' },
      { question: 'Are standard company templates supported?', answer: 'Yes, you can save your preferred BOQ structure as a template for future use.' },
      { question: 'Does Quantara perform visual quantity takeoff?', answer: 'No, automated drawing measurement and visual takeoff are Planned features.' }
    ],
    relatedPages: [
      { href: '/boq-software-uae', label: 'BOQ Software UAE' },
      { href: '/construction-estimating-software', label: 'Construction Estimating Software' },
      { href: '/boq-vs-construction-estimate', label: 'BOQ vs Construction Estimate' },
      { href: '/boq-review-checklist', label: 'BOQ Review Checklist' },
      { href: '/features', label: 'Features' }
    ]
  },
  {
    slug: 'mep-estimating-software-uae',
    title: 'MEP Estimating Software UAE for Structured BOQ Workflows | Quantara',
    description: 'Organize UAE mechanical, electrical and plumbing BOQ workflows, documents, revisions and professional outputs using Quantara.',
    h1: 'MEP Estimating Software for UAE Contractors and Project Teams',
    breadcrumbLabel: 'UAE MEP Estimating Software',
    breadcrumbParent: { href: '/gcc-boq-software', label: 'GCC BOQ Software' },
    audienceDescription: 'For UAE MEP contractors and estimators managing complex technical schedules and multi-discipline BOQs.',
    directAnswer: 'Quantara helps UAE MEP contractors structure mechanical, electrical, and plumbing BOQs, track technical schedules, and manage project revisions.',
    challenges: [
      {
        title: 'Multi-Discipline Complexity',
        description: 'Separating HVAC, plumbing, drainage, and electrical scope from a massive consultant BOQ is tedious and error-prone.'
      },
      {
        title: 'Technical Schedule Extraction',
        description: 'Extracting data accurately from detailed equipment schedules in PDF format is a major bottleneck for MEP estimators.'
      }
    ],
    workflowDescription: 'Quantara provides the structure to manage distinct MEP scopes, including HVAC, fire fighting, controls, and testing & commissioning. Users can organize revisions and technical schedules into a unified BOQ, preparing the data for professional review.',
    workflowExample: 'An MEP estimator in the UAE uses Quantara to extract equipment schedules from a consultant’s PDF, organizing the AHUs and FCUs into a structured HVAC section while keeping the lighting fixtures in a separate Electrical section.',
    typicalCategories: [
      'HVAC',
      'Plumbing and Drainage',
      'Electrical Services',
      'Fire Fighting',
      'Testing and Commissioning'
    ],
    supportedInputs: ['Text-based PDF', 'Scanned PDF', 'XLSX', 'CSV'],
    plannedInputs: ['CAD', 'BIM', 'IFC'],
    supportedOutputs: ['Structured Excel (XLSX)', 'Formatted PDF Proposals', 'CSV Exports'],
    limitations: [
      'Quantara does not claim automatic MEP measurement from drawings.',
      'Quantara does not validate engineering code compliance.',
      'Quantara does not provide pre-built MEP pricing libraries.'
    ],
    faqs: [
      { question: 'Can I manage electrical and mechanical scope separately?', answer: 'Yes, you can create distinct sections within Quantara to cleanly separate different MEP disciplines.' },
      { question: 'Does Quantara measure pipe or cable lengths automatically?', answer: 'No, automated drawing measurement is a Planned feature and is not currently active.' },
      { question: 'Can I extract HVAC equipment schedules?', answer: 'Yes, you can extract technical schedules from PDFs and structure them, though manual verification is required.' },
      { question: 'Does it validate MEP engineering compliance?', answer: 'No, Quantara is a workflow tool and provides no engineering approval or compliance validation.' },
      { question: 'Can I track testing and commissioning items?', answer: 'Yes, testing, balancing, and commissioning can be organized as structured items in your BOQ.' },
      { question: 'How are MEP revisions handled?', answer: 'You can use revision control to track updates to specific MEP sections as consultant addenda are issued.' },
      { question: 'Does it include UAE MEP rates?', answer: 'No, Quantara does not include pricing databases or local rates.' },
      { question: 'What formats can I export to?', answer: 'You can export your structured MEP BOQ to XLSX, CSV, or formatted PDF proposals.' }
    ],
    relatedPages: [
      { href: '/boq-software-for-mep-contractors', label: 'MEP BOQ Software' },
      { href: '/boq-software-for-hvac-contractors', label: 'HVAC BOQ Software' },
      { href: '/boq-software-for-fire-fighting-contractors', label: 'Fire Fighting BOQ Software' },
      { href: '/pdf-boq-extraction', label: 'PDF BOQ Extraction' },
      { href: '/features', label: 'Features' }
    ]
  },
  {
    slug: 'boq-software-saudi-arabia',
    title: 'BOQ Software Saudi Arabia for Construction and Estimating Teams | Quantara',
    description: 'Support Saudi construction BOQ workflows with structured documents, project records, revisions, templates and professionally reviewed outputs using Quantara.',
    h1: 'BOQ Software for Saudi Arabia Construction and Estimating Workflows',
    breadcrumbLabel: 'BOQ Software Saudi Arabia',
    breadcrumbParent: { href: '/gcc-boq-software', label: 'GCC BOQ Software' },
    audienceDescription: 'For Saudi construction, MEP and QS teams managing large-scale and multidisciplinary project documentation.',
    directAnswer: 'Quantara supports Saudi construction teams by providing a platform to structure complex consultant BOQs, manage revisions, and organize estimating records.',
    challenges: [
      {
        title: 'Massive Project Scale',
        description: 'Giga-projects and large-scale developments generate enormous BOQs that are difficult to manage across disparate spreadsheet files.'
      },
      {
        title: 'Stringent Revision Tracking',
        description: 'Keeping track of continuous tender addenda and scope changes requires a structured revision-control system.'
      }
    ],
    workflowDescription: 'Quantara helps organize contractor and consultant BOQs. It provides revision control and supports PDF and spreadsheet workflows. Teams can establish structured project records for professional review before formal submission.',
    workflowExample: 'A main contractor in Saudi Arabia receives a 500-page PDF BOQ for a commercial development. They use Quantara to extract the text, structure the major divisions, and apply a controlled template to distribute the workload among their estimating team.',
    typicalCategories: [
      'Earthworks',
      'Concrete Structure',
      'MEP Infrastructure',
      'Architectural Works',
      'Landscaping'
    ],
    supportedInputs: ['Text-based PDF', 'Scanned PDF', 'XLSX', 'CSV'],
    plannedInputs: ['CAD', 'BIM', 'IFC'],
    supportedOutputs: ['Structured Excel (XLSX)', 'Formatted PDF Proposals', 'CSV Exports'],
    limitations: [
      'Quantara does not claim Saudi regulatory compliance or government integration.',
      'Quantara does not guarantee local hosting or data residency in Saudi Arabia.',
      'Quantara does not claim native Arabic language support unless explicitly verified.'
    ],
    faqs: [
      { question: 'Does Quantara comply with Saudi construction regulations?', answer: 'Quantara is a document management and workflow tool; it does not provide regulatory compliance or engineering certification.' },
      { question: 'Can Quantara process Arabic BOQ documents?', answer: 'Quantara is currently optimized for English. It does not support native Arabic translation or parsing unless explicitly verified.' },
      { question: 'Is Quantara hosted in Saudi Arabia?', answer: 'No, Quantara uses global cloud infrastructure and does not claim local data residency in Saudi Arabia.' },
      { question: 'Does it support Saudi government tender portals?', answer: 'No, there is no direct integration. You must export your data to Excel or PDF for manual upload.' },
      { question: 'Can large multidisciplinary teams use it?', answer: 'Yes, it is designed to help structure large BOQs, making it easier to manage complex multidisciplinary projects.' },
      { question: 'How does revision control work?', answer: 'It allows you to lock versions of your BOQ, ensuring you have a clear historical record of changes across tender addenda.' },
      { question: 'Are standard measurement rules built-in?', answer: 'No, you define the structure. Quantara does not enforce specific measurement rules like POMI or CESMM.' },
      { question: 'Does it include local Saudi rates?', answer: 'No, the platform focuses on BOQ structuring. Users must apply their own market rates.' }
    ],
    relatedPages: [
      { href: '/gcc-boq-software', label: 'GCC BOQ Software' },
      { href: '/boq-software', label: 'BOQ Software' },
      { href: '/construction-estimating-software', label: 'Construction Estimating Software' },
      { href: '/boq-software-for-contractors', label: 'BOQ Software for Contractors' },
      { href: '/features', label: 'Features' }
    ]
  },
  {
    slug: 'boq-software-qatar',
    title: 'BOQ Software Qatar for Contractors and Project Teams | Quantara',
    description: 'Organize Qatar BOQ workflows, project documents, revisions, templates and professional construction outputs using Quantara.',
    h1: 'BOQ Software for Qatar Construction and Project Workflows',
    breadcrumbLabel: 'BOQ Software Qatar',
    breadcrumbParent: { href: '/gcc-boq-software', label: 'GCC BOQ Software' },
    audienceDescription: 'For Qatar construction, MEP, consultant and contractor teams seeking structured BOQ workflows.',
    directAnswer: 'Quantara provides Qatar project teams with a structured platform to manage consultant documentation, MEP coordination, and tender revisions.',
    challenges: [
      {
        title: 'Rigorous Consultant Review',
        description: 'Tender submissions often require strict adherence to consultant-issued BOQ formats, making manual data entry risky.'
      },
      {
        title: 'MEP Coordination',
        description: 'Managing the overlap between structural and MEP BOQ sections requires clean, structured data organization.'
      }
    ],
    workflowDescription: 'Quantara assists with structuring BOQ records from consultant and contractor documentation. It simplifies MEP coordination, manages tender revisions, and utilizes templates to prepare documents for professional review.',
    workflowExample: 'A Qatar-based MEP contractor uses Quantara to extract equipment schedules from a consultant’s PDF, structuring the items into a master BOQ to ensure no required testing and commissioning items are missed during pricing.',
    typicalCategories: [
      'Substructure',
      'Superstructure',
      'MEP Services',
      'External Works',
      'Provisional Sums'
    ],
    supportedInputs: ['Text-based PDF', 'Scanned PDF', 'XLSX', 'CSV'],
    plannedInputs: ['CAD', 'BIM', 'IFC'],
    supportedOutputs: ['Structured Excel (XLSX)', 'Formatted PDF Proposals', 'CSV Exports'],
    limitations: [
      'Quantara does not claim Qatar regulatory compliance.',
      'Quantara does not include Qatar market-rate data or pricing libraries.',
      'Quantara does not integrate directly with local tender portals.'
    ],
    faqs: [
      { question: 'Does Quantara support Qatar tender portals?', answer: 'No, Quantara does not integrate directly with local tender portals. You can export your structured BOQ to Excel for manual submission.' },
      { question: 'Does it include Qatar market rates?', answer: 'No, Quantara does not provide pricing databases. You must use your own commercial rates.' },
      { question: 'Can I manage MEP coordination?', answer: 'Yes, you can structure specific sections within your BOQ to clearly separate and coordinate MEP scope.' },
      { question: 'Is it suitable for consultant workflows?', answer: 'Yes, consultants can use Quantara to structure their BOQs and manage revisions before issuing them to contractors.' },
      { question: 'How do I handle scanned documents?', answer: 'Quantara supports OCR for scanned PDFs, but rigorous professional review of the extracted text is mandatory.' },
      { question: 'Can I use company templates?', answer: 'Yes, you can save standardized BOQ structures as templates for recurring project types.' },
      { question: 'Does Quantara validate compliance?', answer: 'No, it is a document workflow tool and does not validate engineering or regulatory compliance.' },
      { question: 'Can I export a professional proposal?', answer: 'Yes, the platform allows you to generate formatted PDF proposals from your structured data.' }
    ],
    relatedPages: [
      { href: '/gcc-boq-software', label: 'GCC BOQ Software' },
      { href: '/boq-software', label: 'BOQ Software' },
      { href: '/boq-software-for-mep-contractors', label: 'MEP BOQ Software' },
      { href: '/boq-revision-control', label: 'BOQ Revision Control' },
      { href: '/features', label: 'Features' }
    ]
  },
  {
    slug: 'boq-software-oman',
    title: 'BOQ Software Oman for Construction and Estimating Teams | Quantara',
    description: 'Support Oman BOQ workflows with structured project documents, revisions, templates and professionally reviewed outputs using Quantara.',
    h1: 'BOQ Software for Oman Construction and Estimating Workflows',
    breadcrumbLabel: 'BOQ Software Oman',
    breadcrumbParent: { href: '/gcc-boq-software', label: 'GCC BOQ Software' },
    audienceDescription: 'For Oman contractors, consultants and estimating teams looking for reliable BOQ workflow software.',
    directAnswer: 'Quantara helps Oman construction teams organize PDF and spreadsheet BOQs, manage project revisions, and generate structured outputs.',
    challenges: [
      {
        title: 'Document Consolidation',
        description: 'Tender packages often arrive in a mix of unstructured PDF and Excel formats that are difficult to consolidate.'
      },
      {
        title: 'Tracking Client Changes',
        description: 'Managing client revisions effectively without a structured system often leads to pricing errors and missed scope.'
      }
    ],
    workflowDescription: 'Quantara streamlines contractor and consultant workflows by structuring PDF and spreadsheet BOQs. It tracks project revisions, organizes client records, and produces structured outputs for professional validation.',
    workflowExample: 'A main contractor in Oman uses Quantara to import a text-based PDF BOQ, quickly organizing the items into structured sections for civil works and finishes, allowing their team to begin pricing much faster.',
    typicalCategories: [
      'Preliminaries',
      'Civil Works',
      'Finishes',
      'MEP Works',
      'External Site Works'
    ],
    supportedInputs: ['Text-based PDF', 'Scanned PDF', 'XLSX', 'CSV'],
    plannedInputs: ['CAD', 'BIM', 'IFC'],
    supportedOutputs: ['Structured Excel (XLSX)', 'Formatted PDF Proposals', 'CSV Exports'],
    limitations: [
      'Quantara does not claim Oman regulatory compliance.',
      'Quantara does not provide local-rate support or cost databases.',
      'Visual quantity takeoff and drawing measurement are not currently supported.'
    ],
    faqs: [
      { question: 'Is Quantara available to construction teams in Oman?', answer: 'Yes, Quantara is a cloud-based platform available to contractors and estimators in Oman.' },
      { question: 'Does Quantara include Oman market rates?', answer: 'No, Quantara does not supply pricing data or local rates. Users must apply their own pricing.' },
      { question: 'Can I extract BOQs from PDFs?', answer: 'Yes, Quantara can extract items from both text-based and scanned PDFs to help structure your BOQ.' },
      { question: 'Does Quantara comply with local Oman regulations?', answer: 'Quantara is a document management tool and does not claim specific regulatory or engineering compliance.' },
      { question: 'How do I manage client revisions?', answer: 'You can use the platform’s revision control features to track changes between different issues of a BOQ.' },
      { question: 'Does it support automated drawing measurement?', answer: 'No, automated drawing measurement and visual takeoff are currently Planned features.' },
      { question: 'Can I create my own BOQ templates?', answer: 'Yes, you can define and save your own structural templates for use on future projects.' },
      { question: 'What formats can I export my BOQ to?', answer: 'You can export the data to Structured Excel (XLSX), CSV, or formatted PDF proposals.' }
    ],
    relatedPages: [
      { href: '/gcc-boq-software', label: 'GCC BOQ Software' },
      { href: '/boq-software', label: 'BOQ Software' },
      { href: '/boq-management', label: 'BOQ Management' },
      { href: '/how-to-prepare-a-boq', label: 'How to Prepare a BOQ' },
      { href: '/features', label: 'Features' }
    ]
  }
];

const writeRegionalArticle = (region) => {
  const folderPath = path.join(TARGET_DIR, region.slug);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const content = `import { Metadata } from "next";
import RegionalLandingPage, { RegionalLandingPageContent } from "@/components/layout/regional-landing-page";

export const metadata: Metadata = {
  title: ${JSON.stringify(region.title)},
  description: ${JSON.stringify(region.description)},
  alternates: {
    canonical: "https://quantara.vistabylara.com/${region.slug}",
  },
  openGraph: {
    title: ${JSON.stringify(region.title)},
    description: ${JSON.stringify(region.description)},
    url: "https://quantara.vistabylara.com/${region.slug}",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: ${JSON.stringify(region.title)},
    description: ${JSON.stringify(region.description)},
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function Page() {
  const content: RegionalLandingPageContent = {
    breadcrumbLabel: ${JSON.stringify(region.breadcrumbLabel)},
    breadcrumbParent: ${JSON.stringify(region.breadcrumbParent)},
    title: ${JSON.stringify(region.h1)},
    audienceDescription: ${JSON.stringify(region.audienceDescription)},
    directAnswer: ${JSON.stringify(region.directAnswer)},
    challenges: ${JSON.stringify(region.challenges, null, 2)},
    workflowDescription: ${JSON.stringify(region.workflowDescription)},
    workflowExample: ${JSON.stringify(region.workflowExample)},
    typicalCategories: ${JSON.stringify(region.typicalCategories, null, 2)},
    supportedInputs: ${JSON.stringify(region.supportedInputs, null, 2)},
    plannedInputs: ${JSON.stringify(region.plannedInputs, null, 2)},
    supportedOutputs: ${JSON.stringify(region.supportedOutputs, null, 2)},
    limitations: ${JSON.stringify(region.limitations, null, 2)},
    faqs: ${JSON.stringify(region.faqs, null, 2)},
    relatedPages: ${JSON.stringify(region.relatedPages, null, 2)},
    schema: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": "https://quantara.vistabylara.com/${region.slug}",
          "url": "https://quantara.vistabylara.com/${region.slug}",
          "name": ${JSON.stringify(region.title)},
          "description": ${JSON.stringify(region.description)}
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://quantara.vistabylara.com/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": ${JSON.stringify(region.breadcrumbParent.label)},
              "item": "https://quantara.vistabylara.com${region.breadcrumbParent.href}"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": ${JSON.stringify(region.breadcrumbLabel)},
              "item": "https://quantara.vistabylara.com/${region.slug}"
            }
          ]
        },
        {
          "@type": "FAQPage",
          "mainEntity": ${JSON.stringify(region.faqs.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": faq.answer
            }
          })), null, 2)}
        }
      ]
    }
  };

  return <RegionalLandingPage content={content} />;
}
`;

  fs.writeFileSync(path.join(folderPath, 'page.tsx'), content, 'utf8');
};

regions.forEach(writeRegionalArticle);

// Scaffold /gcc-boq-software index page
const gccIndexFolder = path.join(TARGET_DIR, 'gcc-boq-software');
if (!fs.existsSync(gccIndexFolder)) {
  fs.mkdirSync(gccIndexFolder, { recursive: true });
}

const gccIndexContent = `import { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe } from "lucide-react";
import PublicFooter from "@/components/layout/public-footer";

export const metadata: Metadata = {
  title: "GCC BOQ Software for Construction and Estimating Teams | Quantara",
  description: "Explore how Quantara supports structured BOQ, document, revision and professional-review workflows for construction teams across the GCC.",
  alternates: {
    canonical: "https://quantara.vistabylara.com/gcc-boq-software",
  },
  openGraph: {
    title: "GCC BOQ Software for Construction and Estimating Teams | Quantara",
    description: "Explore how Quantara supports structured BOQ, document, revision and professional-review workflows for construction teams across the GCC.",
    url: "https://quantara.vistabylara.com/gcc-boq-software",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  }
};

const regionalLinks = [
  { href: "/boq-software-uae", name: "UAE BOQ Software", desc: "For UAE contractors, estimators and quantity surveyors." },
  { href: "/boq-software-dubai", name: "Dubai BOQ Software", desc: "For Dubai fit-out, MEP and construction teams." },
  { href: "/boq-software-abu-dhabi", name: "Abu Dhabi BOQ Software", desc: "For Abu Dhabi engineering and construction teams." },
  { href: "/construction-estimating-software-uae", name: "UAE Estimating Software", desc: "For UAE BOQ and project estimating workflows." },
  { href: "/mep-estimating-software-uae", name: "UAE MEP Estimating Software", desc: "For structured mechanical, electrical, and plumbing workflows." },
  { href: "/boq-software-saudi-arabia", name: "Saudi Arabia BOQ Software", desc: "For Saudi construction and estimating teams." },
  { href: "/boq-software-qatar", name: "Qatar BOQ Software", desc: "For Qatar contractors and project teams." },
  { href: "/boq-software-oman", name: "Oman BOQ Software", desc: "For Oman construction and estimating teams." }
];

export default function GCCIndexPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-blue-900">Quantara</span>
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link href="/features" className="text-sm font-medium text-slate-600 hover:text-blue-600">Features</Link>
            <Link href="/resources" className="text-sm font-medium text-slate-600 hover:text-blue-600">Resources</Link>
            <Link href="/industries" className="text-sm font-medium text-slate-600 hover:text-blue-600">Industries</Link>
            <Link href="/contact-sales" className="text-sm font-medium text-slate-600 hover:text-blue-600">Contact Sales</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-blue-600 hidden sm:block">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              Request Early Access
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-16 md:py-24">
        <header className="mb-16 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold mb-6 uppercase tracking-wider">
            <Globe className="w-4 h-4" /> Regional Workflows
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-8 leading-tight">
            GCC BOQ Software for Regional Construction Project Workflows
          </h1>
          <div className="prose prose-lg text-slate-600 mx-auto leading-relaxed">
            <p>
              The GCC contains diverse markets, contract practices, and project requirements. Quantara supports these document-heavy tender and revision workflows across the region.
            </p>
            <p>
              Whether handling contractor packages, consultant documentation, or MEP coordination, Quantara helps structure BOQ records from supported document formats into controlled templates. All outputs require professional review, and country-specific regulatory requirements must be assessed independently.
            </p>
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {regionalLinks.map((link, idx) => (
            <Link key={idx} href={link.href} className="group flex flex-col justify-between p-8 bg-white border border-slate-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50/50 transition-all shadow-sm hover:shadow-md">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 group-hover:text-blue-700 mb-3 flex items-center justify-between">
                  {link.name}
                  <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transform -translate-x-4 group-hover:translate-x-0 transition-all" />
                </h2>
                <p className="text-slate-600">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        <section className="bg-white border border-slate-200 p-8 rounded-2xl text-center shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Learn more about Quantara</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/about" className="px-6 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">About Us</Link>
            <Link href="/features" className="px-6 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">Explore Features</Link>
            <Link href="/contact-sales" className="px-6 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-colors">Contact Sales</Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
`;

fs.writeFileSync(path.join(gccIndexFolder, 'page.tsx'), gccIndexContent, 'utf8');

console.log('Phase 5 scaffolding complete.');
