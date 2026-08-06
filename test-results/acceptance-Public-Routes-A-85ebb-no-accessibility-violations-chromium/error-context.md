# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: acceptance.spec.ts >> Public Routes Acceptance >> Route / should load successfully and have no accessibility violations
- Location: tests\e2e\acceptance.spec.ts:16:9

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: frame.evaluate: Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "Quantara Home" [ref=e5] [cursor=pointer]:
          - /url: /
          - img "Quantara Logo" [ref=e6]
          - text: Quantara
        - generic [ref=e7]:
          - button "Platform" [ref=e9] [cursor=pointer]
          - button "Solutions" [ref=e13] [cursor=pointer]
          - button "Resources" [ref=e17] [cursor=pointer]
          - button "Comparisons" [ref=e21] [cursor=pointer]
          - button "Regional" [ref=e25] [cursor=pointer]
          - button "Company" [ref=e29] [cursor=pointer]
        - generic [ref=e32]:
          - link "Sign In" [ref=e33] [cursor=pointer]:
            - /url: /login
          - link "Request Early Access" [ref=e34] [cursor=pointer]:
            - /url: /register
    - main [ref=e35]:
      - generic [ref=e36]:
        - generic [ref=e38]:
          - heading "AI-Assisted BOQ Software for Structured, Traceable Project Workflows" [level=1] [ref=e39]
          - paragraph [ref=e40]: Create one controlled project workspace, bring in supported information through uploads, structured imports or authorized connected sources, review AI-assisted proposals and generate governed BOQs and technical reports.
          - generic [ref=e41]:
            - link "Request Early Access" [ref=e42] [cursor=pointer]:
              - /url: /register
            - link "Explore the Features" [ref=e45] [cursor=pointer]:
              - /url: /features
            - link "Contact Sales" [ref=e46] [cursor=pointer]:
              - /url: /contact-sales
          - generic [ref=e47]:
            - generic [ref=e48]: Structured BOQ workflows
            - generic [ref=e52]: Project-based access controls
            - generic [ref=e56]: Controlled templates
            - generic [ref=e60]: Professional document generation
            - generic [ref=e64]: Built for Dubai and UAE project teams
        - generic [ref=e69]:
          - heading "See Quantara Working" [level=2] [ref=e70]
          - paragraph [ref=e71]: Upload a supported PDF, XLSX or CSV file. Quantara organizes the source information into a structured BOQ workspace for professional review, revision control and document generation.
          - generic [ref=e72]:
            - link "Watch 90-second demo" [ref=e73] [cursor=pointer]:
              - /url: /register
            - link "Download sample BOQ" [ref=e74] [cursor=pointer]:
              - /url: /register
            - link "Request access" [ref=e75] [cursor=pointer]:
              - /url: /register
        - img "Workspace Preview" [ref=e81]
        - generic [ref=e83]:
          - heading "BOQ preparation becomes difficult when project information is scattered" [level=2] [ref=e84]
          - paragraph [ref=e85]: Project scope often arrives across PDFs, spreadsheets, specifications, client files and company templates. Repeated copying, inconsistent descriptions, missing units, disconnected revisions and uncontrolled pricing references can delay review and increase the risk of issuing incomplete documents.
          - generic [ref=e86]:
            - generic [ref=e87]: Disconnected project documents
            - generic [ref=e88]: Repeated manual entry
            - generic [ref=e89]: Inconsistent BOQ structures
            - generic [ref=e90]: Difficult revision tracking
        - generic [ref=e92]:
          - heading "Why Quantara" [level=2] [ref=e93]
          - generic [ref=e94]:
            - generic [ref=e95]:
              - heading "Traditional Methods" [level=3] [ref=e96]
              - list [ref=e97]:
                - listitem [ref=e98]:
                  - generic [ref=e103]:
                    - text: "Manual Spreadsheets:"
                    - paragraph [ref=e104]: High risk of formula errors, inconsistent formatting across teams, and time-consuming manual entry from project documents.
                - listitem [ref=e105]:
                  - generic [ref=e110]:
                    - text: "Generic OCR Tools:"
                    - paragraph [ref=e111]: Struggle with complex construction layouts, missing units, and failing to maintain the hierarchical BOQ section structure.
                - listitem [ref=e112]:
                  - generic [ref=e117]:
                    - text: "Traditional Document Management:"
                    - paragraph [ref=e118]: Files remain disconnected. Pricing updates require manual cross-referencing against outdated versions.
            - generic [ref=e119]:
              - heading "Quantara Workflows" [level=3] [ref=e120]
              - list [ref=e121]:
                - listitem [ref=e122]:
                  - generic [ref=e126]:
                    - text: "AI-Assisted Extraction:"
                    - paragraph [ref=e127]: Extract scope, item, quantity, and specification information from supported project documents for structured human review.
                - listitem [ref=e128]:
                  - generic [ref=e132]:
                    - text: "Structured BOQ Management:"
                    - paragraph [ref=e133]: Organize BOQs into sections, items, quantities, units, and project-specific hierarchies using controlled environments.
                - listitem [ref=e134]:
                  - generic [ref=e138]:
                    - text: "Professional Document Generation:"
                    - paragraph [ref=e139]: Use approved templates to create consistent proposals, BOQ documents, and technical project outputs automatically.
        - generic [ref=e141]:
          - heading "Who Should Use Quantara?" [level=2] [ref=e142]
          - generic [ref=e143]:
            - generic [ref=e144]: Contractors
            - generic [ref=e145]: Estimators
            - generic [ref=e146]: Quantity Surveyors
            - generic [ref=e147]: MEP Contractors
            - generic [ref=e148]: Interior Fit-Out Companies
            - generic [ref=e149]: Facilities Management
            - generic [ref=e150]: Civil Contractors
            - generic [ref=e151]: Consultants
        - generic [ref=e153]:
          - heading "Core Capabilities" [level=2] [ref=e154]
          - generic [ref=e155]:
            - generic [ref=e156]:
              - generic [ref=e157]: Live
              - heading "Hybrid-Source Projects" [level=3] [ref=e161]
              - paragraph [ref=e162]: Combine supported PDFs, spreadsheets and manually imported project data in one workspace.
            - generic [ref=e163]:
              - generic [ref=e164]: Live
              - heading "AI-Assisted Document Extraction" [level=3] [ref=e168]
              - paragraph [ref=e169]: Extract relevant scope, item, quantity, and specification information from supported project documents.
            - generic [ref=e170]:
              - generic [ref=e171]: Live
              - heading "Source Normalization" [level=3] [ref=e175]
              - paragraph [ref=e176]: Organize supported extracted or imported fields into a consistent, reviewable project structure.
            - generic [ref=e177]:
              - generic [ref=e178]: Live
              - heading "Structured BOQ Management" [level=3] [ref=e182]
              - paragraph [ref=e183]: Organize BOQs into sections, items, quantities, units, options, revisions, and project-specific hierarchies.
            - generic [ref=e184]:
              - generic [ref=e185]: In Development
              - heading "Governed AI Change Proposals" [level=3] [ref=e189]
              - paragraph [ref=e190]: Give Quantara spoken or typed instructions, review structured AI proposals and selectively approve changes.
            - generic [ref=e191]:
              - generic [ref=e192]: Live
              - heading "BOQ Revision History" [level=3] [ref=e196]
              - paragraph [ref=e197]: Track changes with ordinary BOQ revisions.
        - region [ref=e198]:
          - generic [ref=e200]:
            - generic [ref=e201]:
              - status [ref=e202]: In Development
              - generic [ref=e203]: Governed AI workflow
            - generic [ref=e204]:
              - generic [ref=e205]:
                - heading "Speak or Type Instructions, Then Approve the Changes" [level=2] [ref=e206]
                - paragraph [ref=e207]: After project data has been uploaded, imported or connected, users can give Quantara typed or spoken instructions. Quantara interprets the request and prepares a structured change proposal showing the affected BOQ items or report sections, assumptions, warnings and expected changes. The user reviews the proposal and decides which changes to approve before Quantara applies them and records a new revision.
                - paragraph [ref=e215]: AI instructions never silently alter a BOQ or technical report. Quantara applies only changes approved by the user and preserves the source instruction, proposal, approval decision and resulting revision.
                - generic [ref=e216]:
                  - article [ref=e217]:
                    - generic [ref=e218]: In Development
                    - heading "Voice and Typed AI Change Proposals" [level=3] [ref=e227]
                    - paragraph [ref=e228]: Give Quantara spoken or typed instructions after bringing project data into the workspace. Quantara prepares structured, reviewable changes for the BOQ or technical report and applies only the operations you approve.
                  - article [ref=e229]:
                    - heading "Review before anything changes" [level=3] [ref=e237]
                    - paragraph [ref=e238]: Proposals are designed to make affected records, before-and-after changes, assumptions, ambiguities and warnings visible before any decision is made.
              - generic "Concept preview of a structured AI change proposal" [ref=e239]:
                - generic [ref=e240]:
                  - generic [ref=e241]:
                    - paragraph [ref=e242]: Structured change proposal
                    - paragraph [ref=e243]: Illustrative review flow
                  - generic [ref=e244]: Not applied
                - generic [ref=e245]:
                  - generic [ref=e246]:
                    - generic [ref=e247]: Example instruction
                    - paragraph [ref=e252]: “Update the description to include testing and commissioning.”
                  - generic [ref=e253]:
                    - generic [ref=e254]: Proposed operation
                    - generic [ref=e262]:
                      - generic [ref=e263]:
                        - paragraph [ref=e264]: Before
                        - paragraph [ref=e265]: Supply and install butterfly valve.
                      - generic [ref=e266]:
                        - paragraph [ref=e267]: Proposed
                        - paragraph [ref=e268]: Supply, install, test and commission butterfly valve.
                    - generic [ref=e269]: Assumptions, ambiguities and warnings remain visible for review.
                  - generic [ref=e272]:
                    - paragraph [ref=e273]: User decision
                    - generic "Available proposal decisions where implemented" [ref=e274]:
                      - generic [ref=e275]: Approve All
                      - generic [ref=e276]: Approve Selected
                      - generic [ref=e277]: Edit Proposal
                      - generic [ref=e278]: Reject
                      - generic [ref=e279]: Request Reinterpretation
                  - generic [ref=e280]: Approved operations only → governed revision
        - generic [ref=e286]:
          - heading "How to Use Quantara" [level=2] [ref=e287]
          - paragraph [ref=e288]: Quantara follows a project-based workflow. Users create a project, choose data sources, and bring information into the workspace through upload, import, or connected applications. Where available, users can speak or type instructions. Quantara prepares structured proposed changes for review and applies only the operations the user approves.
          - list [ref=e289]:
            - listitem [ref=e290]:
              - generic [ref=e291]: "1"
              - heading "Create Project" [level=3] [ref=e293]
              - paragraph [ref=e294]: Start by creating a project and entering the relevant project information. The project becomes the controlled workspace.
            - listitem [ref=e295]:
              - generic [ref=e296]: "2"
              - heading "Choose Data Sources" [level=3] [ref=e298]
              - paragraph [ref=e299]: Select the types of sources that will contribute to this project.
            - listitem [ref=e300]:
              - generic [ref=e301]: "3"
              - heading "Upload, Import or Connect" [level=3] [ref=e303]
              - paragraph [ref=e304]: Bring data in via manual upload, structured import, or an authorized connected application.
            - listitem [ref=e305]:
              - generic [ref=e306]: "4"
              - heading "Normalize and Organize Source Data" [level=3] [ref=e308]
              - paragraph [ref=e309]: Quantara normalizes the incoming data into a structured format.
            - listitem [ref=e310]:
              - generic [ref=e311]: "5"
              - heading "Preview and Review" [level=3] [ref=e313]
              - paragraph [ref=e314]: Review the source data and extracted information for accuracy.
            - listitem [ref=e315]:
              - generic [ref=e316]: "6"
              - generic [ref=e317]:
                - heading "Speak or Type Instructions" [level=3] [ref=e318]
                - generic [ref=e319]: In Development
              - paragraph [ref=e320]: Where available, users can speak or type instructions.
            - listitem [ref=e321]:
              - generic [ref=e322]: "7"
              - generic [ref=e323]:
                - heading "AI Proposes Structured Changes" [level=3] [ref=e324]
                - generic [ref=e325]: In Development
              - paragraph [ref=e326]: Quantara prepares structured proposed changes for review.
            - listitem [ref=e327]:
              - generic [ref=e328]: "8"
              - heading "Review Assumptions, Warnings and Affected Records" [level=3] [ref=e330]
              - paragraph [ref=e331]: Check all proposed changes, assumptions, and potential warnings.
            - listitem [ref=e332]:
              - generic [ref=e333]: "9"
              - heading "Approve All, Approve Selected, Edit or Reject" [level=3] [ref=e335]
              - paragraph [ref=e336]: The user has full control to accept or discard proposed changes.
            - listitem [ref=e337]:
              - generic [ref=e338]: "10"
              - heading "Apply Only Approved Operations" [level=3] [ref=e340]
              - paragraph [ref=e341]: Quantara applies only the operations the user approves.
            - listitem [ref=e342]:
              - generic [ref=e343]: "11"
              - heading "Create or Update a Governed Revision" [level=3] [ref=e345]
              - paragraph [ref=e346]: A formal revision is recorded preserving history.
            - listitem [ref=e347]:
              - generic [ref=e348]: "12"
              - heading "Complete Professional Review" [level=3] [ref=e350]
              - paragraph [ref=e351]: A qualified professional must review all data and decisions.
            - listitem [ref=e352]:
              - generic [ref=e353]: "13"
              - heading "Generate a Traceable BOQ or Technical Report" [level=3] [ref=e355]
              - paragraph [ref=e356]: Generate professional outputs linked directly to their sources.
          - complementary "Professional review notice" [ref=e357]:
            - heading "Professional Review Required" [level=3] [ref=e358]
            - paragraph [ref=e359]: Uploading a drawing does not automatically confirm quantities, measurements, scope or technical accuracy. All BOQ information must be reviewed by an appropriately qualified estimator, quantity surveyor, engineer or responsible project professional before tender, procurement, contractual or construction use.
        - generic [ref=e361]:
          - heading "Practical Workflow Example" [level=2] [ref=e362]
          - paragraph [ref=e363]: How a Dubai or UAE MEP team can move from supported project data to an approved, professionally reviewed output.
          - generic [ref=e366]:
            - generic [ref=e367]:
              - heading "Practical MEP Workflow Example" [level=3] [ref=e368]
              - generic [ref=e369]: Hypothetical workflow
            - list [ref=e370]:
              - listitem [ref=e371]: Create the MEP project workspace.
              - listitem [ref=e372]: Upload consultant PDFs and import the supplier spreadsheet.
              - listitem [ref=e373]: Connect an authorized external source where available.
              - listitem [ref=e374]: Review source identity, revision and extracted information.
              - listitem [ref=e375]: Ask Quantara to organize the equipment and valve items.
              - listitem [ref=e376]: Review the structured AI proposal and its assumptions.
              - listitem [ref=e377]: Approve selected changes.
              - listitem [ref=e378]: Create a governed BOQ revision.
              - listitem [ref=e379]: Generate PDF and XLSX outputs.
              - listitem [ref=e380]: Complete professional sign-off.
        - generic [ref=e382]:
          - heading "Supported Inputs" [level=2] [ref=e383]
          - table [ref=e385]:
            - rowgroup [ref=e386]:
              - row [ref=e387]:
                - columnheader "Format" [ref=e388]
                - columnheader "Method" [ref=e389]
                - columnheader "Max Size" [ref=e390]
                - columnheader "Status" [ref=e391]
            - rowgroup [ref=e392]:
              - row [ref=e393]:
                - cell "PDF (Text-based)" [ref=e394]
                - cell "Layout analysis & text extraction" [ref=e395]
                - cell "10 MB" [ref=e396]
                - cell "Live" [ref=e397]
              - row [ref=e398]:
                - cell "PDF (Scanned)" [ref=e399]
                - cell "OCR" [ref=e400]
                - cell "20 MB" [ref=e401]
                - cell "Live" [ref=e402]
              - row [ref=e403]:
                - cell "XLSX / CSV" [ref=e404]
                - cell "Structural mapping" [ref=e405]
                - cell "5 MB" [ref=e406]
                - cell "Live" [ref=e407]
              - row [ref=e408]:
                - cell "CAD / BIM / IFC" [ref=e409]
                - cell "Model geometry extraction" [ref=e410]
                - cell "-" [ref=e411]
                - cell "Planned" [ref=e412]
        - generic [ref=e414]:
          - heading "Supported Outputs" [level=2] [ref=e415]
          - generic [ref=e416]:
            - generic [ref=e417]:
              - heading "PDF" [level=3] [ref=e421]
              - generic [ref=e422]: Live
            - generic [ref=e423]:
              - heading "XLSX" [level=3] [ref=e427]
              - generic [ref=e428]: Live
            - generic [ref=e429]:
              - heading "CSV" [level=3] [ref=e433]
              - generic [ref=e434]: Live
            - generic [ref=e435]:
              - heading "Client Proposal" [level=3] [ref=e439]
              - generic [ref=e440]: Live
            - generic [ref=e441]:
              - heading "Technical Report" [level=3] [ref=e445]
              - generic [ref=e446]: Live
            - generic [ref=e447]:
              - heading "BOQ Document" [level=3] [ref=e451]
              - generic [ref=e452]: Live
            - generic [ref=e453]:
              - heading "Revision Snapshot" [level=3] [ref=e457]
              - generic [ref=e458]: Live
        - generic [ref=e460]:
          - heading "Security & Data Handling" [level=2] [ref=e461]
          - paragraph [ref=e462]: Quantara enforces authenticated access controls. Additional security, compliance, and data-processing documentation is being finalized for the Early Access release.
          - link "View Security Documentation" [ref=e463] [cursor=pointer]:
            - /url: /security
        - generic [ref=e467]:
          - heading "Frequently Asked Questions" [level=2] [ref=e468]
          - generic [ref=e469]:
            - generic [ref=e470]:
              - heading "What is a Bill of Quantities (BOQ)?" [level=3] [ref=e471]
              - paragraph [ref=e472]: A Bill of Quantities is a structured document that lists project work items, descriptions, quantities, units and related information for estimating, tendering, procurement and commercial review.
            - generic [ref=e473]:
              - heading "What is BOQ software?" [level=3] [ref=e474]
              - paragraph [ref=e475]: BOQ software replaces manual spreadsheets by organizing project information, standardizing descriptions, structuring sections, and generating consistent, professional documents.
            - generic [ref=e476]:
              - heading "How do contractors prepare BOQs?" [level=3] [ref=e477]
              - paragraph [ref=e478]: Contractors extract scope from specifications and drawings, structure the items by trade or section, calculate quantities, apply approved rates, and compile the final document for submission.
            - generic [ref=e479]:
              - heading "What is the difference between an estimate and a BOQ?" [level=3] [ref=e480]
              - paragraph [ref=e481]: An estimate calculates the expected cost of a project, whereas a BOQ is a formalized, itemized list of materials, parts, and labor, often forming part of the contract.
            - generic [ref=e482]:
              - heading "What is Quantara?" [level=3] [ref=e483]
              - paragraph [ref=e484]: Quantara is an AI-assisted BOQ and construction-estimating platform that helps project teams organize supported documents into structured BOQ workflows, controlled project records and professional outputs.
            - generic [ref=e485]:
              - heading "Who is Quantara designed for?" [level=3] [ref=e486]
              - paragraph [ref=e487]: Quantara is built for general contractors, estimators, quantity surveyors, MEP contractors, interior fit-out companies, civil contractors, consultants, and developers.
            - generic [ref=e488]:
              - heading "Can Quantara process construction PDFs?" [level=3] [ref=e489]
              - paragraph [ref=e490]: Quantara supports verified text-based PDF workflows. Results depend on document quality, layout and available content, and all extracted information requires professional review.
            - generic [ref=e491]:
              - heading "Can Quantara process scanned PDFs?" [level=3] [ref=e492]
              - paragraph [ref=e493]: Scanned PDF support may use OCR. OCR can misread text, numbers, symbols or layouts, so extracted content must be checked carefully.
            - generic [ref=e494]:
              - heading "Can Quantara work with specification documents?" [level=3] [ref=e495]
              - paragraph [ref=e496]: Yes, text-based specifications can be processed to extract item descriptions and requirements, subject to the document's structure and readability.
            - generic [ref=e497]:
              - heading "Does Quantara support XLSX and CSV BOQs?" [level=3] [ref=e498]
              - paragraph [ref=e499]: Quantara supports verified XLSX and CSV workflows for structured data import or mapping, subject to file structure and product limits.
            - generic [ref=e500]:
              - heading "Does Quantara replace a quantity surveyor?" [level=3] [ref=e501]
              - paragraph [ref=e502]: No. Quantara assists with extraction, organization and document preparation. Qualified professionals must review quantities, rates, specifications, assumptions, exclusions and final documents.
            - generic [ref=e503]:
              - heading "How accurate is AI-assisted extraction?" [level=3] [ref=e504]
              - paragraph [ref=e505]: Extraction accuracy depends entirely on the clarity, formatting, and quality of the source document. The AI acts as an assistant, and human review is mandatory before utilizing the extracted data.
            - generic [ref=e506]:
              - heading "Can multiple users collaborate?" [level=3] [ref=e507]
              - paragraph [ref=e508]: Yes, Quantara supports project and client workspaces, allowing controlled, authenticated access for team members within a company.
            - generic [ref=e509]:
              - heading "Does Quantara support CAD, BIM or IFC?" [level=3] [ref=e510]
              - paragraph [ref=e511]: CAD, BIM and IFC workflows are planned. They must not be treated as currently available unless explicitly marked Live.
            - generic [ref=e512]:
              - heading "What does Controlled Early Access mean?" [level=3] [ref=e513]
              - paragraph [ref=e514]: Controlled Early Access means product access and feature availability may be limited while Quantara is tested, improved and prepared for broader commercial release.
            - generic [ref=e515]:
              - heading "Can I update a BOQ using voice instructions?" [level=3] [ref=e516]
              - paragraph [ref=e517]: Quantara is designed to accept spoken or typed instructions and convert them into structured change proposals. The user must review and approve the proposed operations before they are applied. Voice instructions do not silently alter the BOQ.
            - generic [ref=e518]:
              - heading "Can I approve only some AI changes?" [level=3] [ref=e519]
              - paragraph [ref=e520]: Where selective approval is available, users can approve individual proposed operations and reject the remaining changes. Quantara applies only the approved operations.
            - generic [ref=e521]:
              - heading "Can AI change an approved BOQ?" [level=3] [ref=e522]
              - paragraph [ref=e523]: An approved or locked BOQ should not be overwritten. Approved AI changes must create a new governed revision while preserving the previous version and its history.
            - generic [ref=e524]:
              - heading "Can the same workflow update a technical report?" [level=3] [ref=e525]
              - paragraph [ref=e526]: Yes, where implemented. Users may request additions, rewrites, observations, corrective actions, recommendations or summaries. Quantara presents the proposed report changes for approval and records the resulting revision.
        - generic [ref=e528]:
          - heading "Quantara Product Facts" [level=2] [ref=e529]
          - list [ref=e531]:
            - listitem [ref=e532]:
              - strong [ref=e533]: "Product name:"
              - text: Quantara
            - listitem [ref=e534]:
              - strong [ref=e535]: "Product category:"
              - text: AI-assisted BOQ and construction-estimating platform
            - listitem [ref=e536]:
              - strong [ref=e537]: "Status:"
              - text: Controlled Early Access
            - listitem [ref=e538]:
              - strong [ref=e539]: "Voice and typed AI change proposals:"
              - text: In Development
            - listitem [ref=e540]:
              - strong [ref=e541]: "Primary users:"
              - text: Contractors, estimators, quantity surveyors, MEP teams, fit-out companies, facilities management, civil contractors, consultants, developers
            - listitem [ref=e542]:
              - strong [ref=e543]: "Live inputs:"
              - text: Text-based PDF, scanned PDF, XLSX and CSV, subject to verified implementation limits
            - listitem [ref=e544]:
              - strong [ref=e545]: "Planned inputs:"
              - text: CAD, BIM and IFC workflows
            - listitem [ref=e546]:
              - strong [ref=e547]: "Human review:"
              - text: Required before commercial, contractual, tender or construction use
            - listitem [ref=e548]:
              - strong [ref=e549]: "Operator:"
              - text: Vista By Lara
            - listitem [ref=e550]:
              - strong [ref=e551]: "Email:"
              - link "solution@vistabylara.com" [ref=e552] [cursor=pointer]:
                - /url: mailto:solution@vistabylara.com
            - listitem [ref=e553]:
              - strong [ref=e554]: "Telephone:"
              - link "+971 50 799 4292" [ref=e555] [cursor=pointer]:
                - /url: tel:+971507994292
            - listitem [ref=e556]:
              - strong [ref=e557]: "Last reviewed:"
              - text: August 5, 2026
        - generic [ref=e559]:
          - heading "Developed and Operated by Vista By Lara" [level=2] [ref=e560]
          - paragraph [ref=e561]: Quantara is developed and operated by Vista By Lara, a technology business focused on AI-assisted tools for construction, project, design and business workflows. Quantara is currently available through Controlled Early Access.
          - generic [ref=e562]:
            - link "www.vistabylara.com" [ref=e563] [cursor=pointer]:
              - /url: https://www.vistabylara.com/
            - link "solution@vistabylara.com" [ref=e565] [cursor=pointer]:
              - /url: mailto:solution@vistabylara.com
            - link "+971 50 799 4292" [ref=e567] [cursor=pointer]:
              - /url: tel:+971507994292
        - generic [ref=e569]:
          - heading "BOQ Formulas and Quantity Calculator" [level=2] [ref=e570]
          - paragraph [ref=e571]: Review practical formulas for excavation, concrete, masonry, finishes, reinforcement, roofing and BOQ cost calculations, or use the free Vista By Lara BOQ Calculator.
          - generic [ref=e572]:
            - link "View BOQ Formulas" [ref=e573] [cursor=pointer]:
              - /url: /boq-calculation-formulas
            - link "Open Free BOQ Calculator" [ref=e574] [cursor=pointer]:
              - /url: https://www.vistabylara.com/ai-tools/boq-calculator-uae
        - generic [ref=e576]:
          - heading "Explore Quantara Resources" [level=2] [ref=e577]
          - generic [ref=e578]:
            - link [ref=e579] [cursor=pointer]:
              - /url: /resources
              - heading "BOQ Resources" [level=3] [ref=e580]
              - paragraph [ref=e581]: Knowledge base, definitions, and methodology guides.
            - link [ref=e582] [cursor=pointer]:
              - /url: /industries
              - heading "Industries" [level=3] [ref=e583]
              - paragraph [ref=e584]: Specific workflows for contractors and trades.
            - link [ref=e585] [cursor=pointer]:
              - /url: /gcc-boq-software
              - heading "GCC BOQ Software" [level=3] [ref=e586]
              - paragraph [ref=e587]: Regional information for the UAE, Saudi Arabia, and beyond.
            - link [ref=e588] [cursor=pointer]:
              - /url: /comparisons
              - heading "Workflow Comparisons" [level=3] [ref=e589]
              - paragraph [ref=e590]: Compare Quantara against spreadsheets, manual processes, and OCR.
        - generic [ref=e592]:
          - heading "Ready to streamline your BOQ workflows?" [level=2] [ref=e593]
          - generic [ref=e594]:
            - link "Request Early Access" [ref=e595] [cursor=pointer]:
              - /url: /register
            - link "Contact Sales" [ref=e596] [cursor=pointer]:
              - /url: /contact-sales
    - generic [ref=e598]:
      - generic [ref=e599]:
        - generic [ref=e600]:
          - link "Quantara Home" [ref=e601] [cursor=pointer]:
            - /url: /
            - img "Quantara Logo" [ref=e602]
            - text: Quantara
          - paragraph [ref=e603]: Quantara is developed and operated by Vista By Lara, a technology business focused on AI-assisted tools for construction, project, design and business workflows.
          - paragraph [ref=e604]: Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.
          - generic [ref=e605]:
            - paragraph [ref=e606]:
              - text: "Email:"
              - link "solution@vistabylara.com" [ref=e607] [cursor=pointer]:
                - /url: mailto:solution@vistabylara.com
            - paragraph [ref=e608]:
              - text: "Telephone:"
              - link "+971 50 799 4292" [ref=e609] [cursor=pointer]:
                - /url: tel:+971507994292
            - paragraph [ref=e610]:
              - text: "WhatsApp:"
              - link "+971 50 799 4292" [ref=e611] [cursor=pointer]:
                - /url: https://wa.me/971507994292
        - generic [ref=e612]:
          - heading "Platform" [level=3] [ref=e613]
          - list [ref=e614]:
            - listitem [ref=e615]:
              - link "Features" [ref=e616] [cursor=pointer]:
                - /url: /features
            - listitem [ref=e617]:
              - link "AI BOQ Software" [ref=e618] [cursor=pointer]:
                - /url: /ai-boq-software
            - listitem [ref=e619]:
              - link "BOQ Software" [ref=e620] [cursor=pointer]:
                - /url: /boq-software
            - listitem [ref=e621]:
              - link "Construction Estimating Software" [ref=e622] [cursor=pointer]:
                - /url: /construction-estimating-software
            - listitem [ref=e623]:
              - link "BOQ Management" [ref=e624] [cursor=pointer]:
                - /url: /boq-management
            - listitem [ref=e625]:
              - link "PDF BOQ Extraction" [ref=e626] [cursor=pointer]:
                - /url: /pdf-boq-extraction
            - listitem [ref=e627]:
              - link "Scanned PDF BOQ" [ref=e628] [cursor=pointer]:
                - /url: /scanned-pdf-boq
        - generic [ref=e629]:
          - heading "Solutions" [level=3] [ref=e630]
          - list [ref=e631]:
            - listitem [ref=e632]:
              - link "All Industries" [ref=e633] [cursor=pointer]:
                - /url: /industries
            - listitem [ref=e634]:
              - link "Contractors" [ref=e635] [cursor=pointer]:
                - /url: /boq-software-for-contractors
            - listitem [ref=e636]:
              - link "Quantity Surveyors" [ref=e637] [cursor=pointer]:
                - /url: /boq-software-for-quantity-surveyors
            - listitem [ref=e638]:
              - link "MEP Contractors" [ref=e639] [cursor=pointer]:
                - /url: /boq-software-for-mep-contractors
            - listitem [ref=e640]:
              - link "HVAC Contractors" [ref=e641] [cursor=pointer]:
                - /url: /boq-software-for-hvac-contractors
          - heading "Comparisons" [level=3] [ref=e642]
          - list [ref=e643]:
            - listitem [ref=e644]:
              - link "Comparison Hub" [ref=e645] [cursor=pointer]:
                - /url: /comparisons
            - listitem [ref=e646]:
              - link "Quantara vs Excel for BOQ" [ref=e647] [cursor=pointer]:
                - /url: /quantara-vs-excel-for-boq
            - listitem [ref=e648]:
              - link "BOQ Software vs Spreadsheets" [ref=e649] [cursor=pointer]:
                - /url: /boq-software-vs-spreadsheets
            - listitem [ref=e650]:
              - link "AI BOQ vs Manual BOQ Preparation" [ref=e651] [cursor=pointer]:
                - /url: /ai-boq-vs-manual-boq-preparation
            - listitem [ref=e652]:
              - link "OCR vs Structured BOQ Extraction" [ref=e653] [cursor=pointer]:
                - /url: /ocr-vs-structured-boq-extraction
        - generic [ref=e654]:
          - heading "Resources" [level=3] [ref=e655]
          - list [ref=e656]:
            - listitem [ref=e657]:
              - link "Resource Centre" [ref=e658] [cursor=pointer]:
                - /url: /resources
            - listitem [ref=e659]:
              - link "BOQ Calculation Formulas" [ref=e660] [cursor=pointer]:
                - /url: /boq-calculation-formulas
            - listitem [ref=e661]:
              - link "Free BOQ Calculator — External Vista By Lara Tool" [ref=e662] [cursor=pointer]:
                - /url: https://www.vistabylara.com/ai-tools/boq-calculator-uae
            - listitem [ref=e663]:
              - link "What Is a BOQ?" [ref=e664] [cursor=pointer]:
                - /url: /what-is-a-boq
            - listitem [ref=e665]:
              - link "How to Prepare a BOQ" [ref=e666] [cursor=pointer]:
                - /url: /how-to-prepare-a-boq
            - listitem [ref=e667]:
              - link "BOQ vs Construction Estimate" [ref=e668] [cursor=pointer]:
                - /url: /boq-vs-construction-estimate
            - listitem [ref=e669]:
              - link "BOQ vs Bill of Materials" [ref=e670] [cursor=pointer]:
                - /url: /boq-vs-bill-of-materials
            - listitem [ref=e671]:
              - link "BOQ Review Checklist" [ref=e672] [cursor=pointer]:
                - /url: /boq-review-checklist
        - generic [ref=e673]:
          - heading "Regional" [level=3] [ref=e674]
          - list [ref=e675]:
            - listitem [ref=e676]:
              - link "GCC BOQ Software" [ref=e677] [cursor=pointer]:
                - /url: /gcc-boq-software
            - listitem [ref=e678]:
              - link "UAE" [ref=e679] [cursor=pointer]:
                - /url: /boq-software-uae
            - listitem [ref=e680]:
              - link "Dubai" [ref=e681] [cursor=pointer]:
                - /url: /boq-software-dubai
            - listitem [ref=e682]:
              - link "Abu Dhabi" [ref=e683] [cursor=pointer]:
                - /url: /boq-software-abu-dhabi
            - listitem [ref=e684]:
              - link "UAE Construction Estimating" [ref=e685] [cursor=pointer]:
                - /url: /construction-estimating-software-uae
            - listitem [ref=e686]:
              - link "UAE MEP Estimating" [ref=e687] [cursor=pointer]:
                - /url: /mep-estimating-software-uae
            - listitem [ref=e688]:
              - link "Saudi Arabia" [ref=e689] [cursor=pointer]:
                - /url: /boq-software-saudi-arabia
        - generic [ref=e690]:
          - generic [ref=e691]:
            - heading "Enterprise Software" [level=3] [ref=e692]
            - paragraph [ref=e693]: Custom Quantara software implementation for companies requiring tailored workflows, integrations, branding, deployment, migration, onboarding or advanced operational requirements.
            - paragraph [ref=e694]: Custom implementation and onboarding starting from AED 15,000
            - paragraph [ref=e695]: Final scope and pricing are provided through a custom quotation following a requirements review.
            - link "Contact Sales →" [ref=e696] [cursor=pointer]:
              - /url: /contact-sales
          - generic [ref=e697]:
            - heading "Company" [level=3] [ref=e698]
            - list [ref=e699]:
              - listitem [ref=e700]:
                - link "About" [ref=e701] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e702]:
                - link "Contact Sales" [ref=e703] [cursor=pointer]:
                  - /url: /contact-sales
              - listitem [ref=e704]:
                - link "Request Early Access" [ref=e705] [cursor=pointer]:
                  - /url: /register
              - listitem [ref=e706]:
                - link "Security" [ref=e707] [cursor=pointer]:
                  - /url: /security
              - listitem [ref=e708]:
                - link "HTML Sitemap" [ref=e709] [cursor=pointer]:
                  - /url: /site-map
          - generic [ref=e710]:
            - heading "Legal" [level=3] [ref=e711]
            - list [ref=e712]:
              - listitem [ref=e713]:
                - link "Privacy" [ref=e714] [cursor=pointer]:
                  - /url: /privacy
              - listitem [ref=e715]:
                - link "Terms" [ref=e716] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e717]:
                - link "Cookie Policy" [ref=e718] [cursor=pointer]:
                  - /url: /cookie-policy
              - listitem [ref=e719]:
                - link "Data Processing" [ref=e720] [cursor=pointer]:
                  - /url: /data-processing
              - listitem [ref=e721]:
                - link "Acceptable Use" [ref=e722] [cursor=pointer]:
                  - /url: /acceptable-use
              - listitem [ref=e723]:
                - link "Subprocessors" [ref=e724] [cursor=pointer]:
                  - /url: /subprocessors
      - generic [ref=e725]: © 2026 Quantara. Operated by Vista By Lara. All rights reserved.
  - generic [ref=e731] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e732]
    - generic [ref=e736]:
      - button "Open issues overlay" [ref=e737]:
        - generic [ref=e738]:
          - generic [ref=e739]: "0"
          - generic [ref=e740]: "1"
        - generic [ref=e741]: Issue
      - button "Collapse issues badge" [ref=e742]
  - alert [ref=e745]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | 
  4  | const publicRoutes = [
  5  |   '/',
  6  |   '/features',
  7  |   '/privacy',
  8  |   '/terms',
  9  |   '/security',
  10 |   '/contact-sales',
  11 |   '/register',
  12 | ];
  13 | 
  14 | test.describe('Public Routes Acceptance', () => {
  15 |   for (const route of publicRoutes) {
  16 |     test(`Route ${route} should load successfully and have no accessibility violations`, async ({ page }) => {
  17 |       const response = await page.goto(route);
  18 |       
  19 |       // 1. Verify HTTP Status
  20 |       expect(response?.status()).toBe(200);
  21 |       
  22 |       // 2. Verify Authentication Bypass (should not redirect to /login)
  23 |       expect(page.url()).not.toContain('/login');
  24 |       if (route !== '/') {
  25 |         expect(page.url()).toContain(route);
  26 |       }
  27 |       
  28 |       // 3. Take screenshot
  29 |       await page.screenshot({ path: `screenshots/${route === '/' ? 'home' : route.replace('/', '')}.png`, fullPage: true });
  30 |       
  31 |       // 4. Verify Accessibility
> 32 |       const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
     |                                        ^ Error: frame.evaluate: Test timeout of 30000ms exceeded.
  33 |       expect(accessibilityScanResults.violations).toEqual([]);
  34 |     });
  35 |   }
  36 | });
  37 | 
  38 | test.describe('Contact Form Acceptance', () => {
  39 |   test('Should submit successfully and not touch Prisma', async ({ page, request }) => {
  40 |     // Intercept the API call to ensure it's made and check response
  41 |     await page.route('/api/contact', async route => {
  42 |       const request = route.request();
  43 |       expect(request.method()).toBe('POST');
  44 |       
  45 |       // Mock the response so we don't actually send emails or hit DB if there was one
  46 |       // Wait, the API already just returns success without Prisma. 
  47 |       // The requirement says: "The Playwright contact-form test must never create an uncontrolled record in the production database."
  48 |       // Since we know `/api/contact` doesn't use Prisma currently, we can let it pass, or mock it to be 100% safe.
  49 |       await route.fulfill({
  50 |         status: 200,
  51 |         contentType: 'application/json',
  52 |         body: JSON.stringify({ success: true })
  53 |       });
  54 |     });
  55 | 
  56 |     await page.goto('/contact-sales');
  57 |     await page.getByRole('textbox', { name: 'First Name' }).fill('Integration');
  58 |     await page.getByRole('textbox', { name: 'Last Name' }).fill('Test');
  59 |     await page.getByRole('textbox', { name: 'Work Email' }).fill('test@example.com');
  60 |     await page.getByRole('textbox', { name: 'Construction Discipline' }).fill('Civil');
  61 |     await page.getByRole('textbox', { name: 'Current BOQ Process' }).fill('Excel');
  62 |     
  63 |     // Check consent checkbox
  64 |     await page.getByRole('checkbox', { name: /consent/i }).check();
  65 |     
  66 |     await page.click('button[type="submit"]');
  67 |     
  68 |     await expect(page.locator('text=Thank you.')).toBeVisible();
  69 |     await page.screenshot({ path: 'screenshots/contact-sales-success.png' });
  70 |   });
  71 | });
  72 | 
```