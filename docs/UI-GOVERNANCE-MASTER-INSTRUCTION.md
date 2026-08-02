# PROJECT: Quantara AI BOQ

# MASTER UI GOVERNANCE INSTRUCTION

PURPOSE:
Protect, preserve, and control the complete visual system of Quantara AI while backend, database, authentication, document generation, extraction, AI, and enterprise features are added.

This instruction is the permanent source of truth for:

- Dashboard design
- Application shell
- Navigation
- Light mode
- Dark mode
- System mode
- Theme persistence
- BOQ workspace appearance
- Tables
- Forms
- Modals
- Responsive behavior
- Accessibility
- Visual regression protection
- UI status reporting

This instruction overrides casual visual changes made during backend development.

==================================================
1. LOCKED CURRENT UI STATE
==================================================

The current application already contains a working visual foundation.

The following are considered LOCKED unless a verified defect requires a targeted fix:

- Quantara AI brand identity
- Quantity Intelligence Workspace positioning
- Current application shell
- Current dashboard layout
- Current project dashboard
- Current industry navigation
- Current project navigation
- Current BOQ workspace
- Current verification page
- Current revision history interface
- Current Light mode
- Current Dark mode
- Current System mode
- Current appearance selector
- Current theme persistence
- Current data-theme architecture
- Current responsive foundation
- Current card and table visual language

Do not redesign the product from zero.

Do not replace the dashboard with a new template.

Do not replace the current theme system merely because another library exists.

Do not convert the application into a generic SaaS template.

Do not change the brand direction without explicit approval.

==================================================
2. PRIMARY UI PRINCIPLE
==================================================

Quantara AI is a professional enterprise estimation and quantity-intelligence platform.

The UI must feel suitable for:

- Quantity surveyors
- Construction companies
- Interior fit-out companies
- Furniture suppliers
- MEP contractors
- Electrical contractors
- HVAC contractors
- Plumbing contractors
- Fire-fighting contractors
- Joinery companies
- Landscaping companies
- Consultants
- Procurement teams
- Commercial departments

The product must communicate:

- Precision
- Authority
- Clarity
- Technical control
- Commercial intelligence
- Reliability
- Auditability
- Professionalism

It must not resemble:

- A gaming dashboard
- A cryptocurrency dashboard
- A social-media app
- A generic startup landing page
- A decorative AI website
- A consumer shopping app
- A playful mobile app
- A neon control panel
- A marketing website

==================================================
3. NON-NEGOTIABLE VISUAL RULES
==================================================

1. No gradients.
2. No neon glow.
3. No animated backgrounds.
4. No glassmorphism-heavy design.
5. No oversized marketing headings.
6. No unnecessary illustrations.
7. No decorative AI graphics inside working screens.
8. No random accent colours.
9. No excessive rounded cards.
10. No playful visual language.
11. No unnecessary motion.
12. No large empty areas.
13. No low-density dashboard design.
14. No hidden critical data.
15. No oversized buttons.
16. No full-page horizontal overflow.
17. No dark-only hardcoded components.
18. No light-only hardcoded components.
19. No invisible focus states.
20. No colour-only status communication.
21. No UI rewrite during backend tasks.
22. No visual claim that a planned module is complete.
23. No replacing working components unless necessary.
24. No silent visual regression.

==================================================
4. THEME ARCHITECTURE
==================================================

The application currently supports:

- light
- dark
- system

Theme selection must continue to use the existing working architecture based on:

- document.documentElement.dataset.theme
- localStorage persistence
- prefers-color-scheme for system mode

Do not migrate away from this system unless a documented defect proves it cannot satisfy requirements.

Use the existing theme functions where available:

- loadThemeMode
- saveThemeMode
- applyThemeMode

Theme values must remain exactly:

- light
- dark
- system

Do not introduce conflicting values such as:

- default
- auto
- device
- system-default
- automatic

unless they are mapped internally and never stored as separate preferences.

==================================================
5. THEME STORAGE
==================================================

Use one stable storage key:

quantara-theme

Expected values:

quantara-theme = light
quantara-theme = dark
quantara-theme = system

Do not create duplicate theme keys.

Do not store resolved dark or light mode when the selected preference is system.

System mode must remain stored as system.

Do not clear unrelated user preferences when changing theme.

Handle unavailable localStorage safely.

==================================================
6. LIGHT MODE REQUIREMENTS
==================================================

Light mode must look professional, structured, and enterprise-ready.

Recommended semantic palette:

Background:
#F5F7FA

Primary surface:
#FFFFFF

Elevated surface:
#FFFFFF

Muted surface:
#F1F5F9

Sidebar:
#FFFFFF

Sidebar hover:
#F1F5F9

Primary text:
#0F172A

Secondary text:
#475569

Muted text:
#64748B

Border:
#E2E8F0

Strong border:
#CBD5E1

Input:
#FFFFFF

Primary action:
#1D4ED8

Primary hover:
#1E40AF

Primary foreground:
#FFFFFF

Success:
#047857

Success background:
#ECFDF5

Warning:
#B45309

Warning background:
#FFFBEB

Danger:
#B91C1C

Danger background:
#FEF2F2

Information:
#0369A1

Information background:
#F0F9FF

Table header:
#F8FAFC

Table row hover:
#F8FAFC

Selected table row:
#EFF6FF

Light mode must not:

- look washed out
- use excessive grey
- lose table borders
- hide input boundaries
- reduce contrast
- make buttons disappear
- show white-on-white cards
- show pale unreadable text
- keep dark-only surfaces

==================================================
7. DARK MODE REQUIREMENTS
==================================================

Dark mode must remain technical and professional without using pure black everywhere.

Recommended semantic palette:

Background:
#07111F

Primary surface:
#0B1726

Elevated surface:
#102033

Muted surface:
#13243A

Sidebar:
#081421

Sidebar hover:
#102239

Primary text:
#F8FAFC

Secondary text:
#CBD5E1

Muted text:
#94A3B8

Border:
#24364D

Strong border:
#334A67

Input:
#0D1C2D

Primary action:
#3B82F6

Primary hover:
#60A5FA

Primary foreground:
#FFFFFF

Success:
#34D399

Success background:
#062E25

Warning:
#FBBF24

Warning background:
#3A2805

Danger:
#F87171

Danger background:
#3A1116

Information:
#38BDF8

Information background:
#082F49

Table header:
#0D1C2D

Table row hover:
#12253C

Selected table row:
#102A4C

Dark mode must not:

- use pure black for every surface
- rely on glow
- make borders invisible
- use weak grey text
- hide disabled controls
- use excessive transparency
- create a gaming appearance

==================================================
8. SYSTEM MODE REQUIREMENTS
==================================================

System mode must:

- follow prefers-color-scheme
- update when the device appearance changes
- remain selected as system in Settings
- preserve system after refresh
- not save the resolved appearance as the preference
- not create a visible flash during initial load

When system is selected:

- stored preference remains system
- resolved appearance may be light or dark
- UI selection must still show System

==================================================
9. SEMANTIC DESIGN TOKENS
==================================================

All major UI components must use semantic variables or semantic utility classes.

Required tokens:

--background
--foreground
--surface
--surface-elevated
--surface-muted
--sidebar
--sidebar-hover
--card
--popover
--border
--border-strong
--input
--input-hover
--primary
--primary-hover
--primary-foreground
--secondary
--secondary-foreground
--muted
--muted-foreground
--accent
--accent-foreground
--success
--success-background
--warning
--warning-background
--danger
--danger-background
--info
--info-background
--table-header
--table-row-hover
--table-row-selected
--focus-ring
--shadow-color

Avoid direct colour values inside React components unless required for specialized charts or document previews.

Refactor hardcoded colour classes gradually and safely.

Do not perform a dangerous global replacement without reviewing each component.

==================================================
10. APPLICATION SHELL
==================================================

The application shell must contain:

- Main navigation
- Current workspace context
- Search
- Theme control
- Notifications placeholder
- User control
- Main content area
- Breadcrumb or route context where useful

Desktop:

- Stable sidebar or navigation
- Compact header
- Clear content hierarchy
- No excessive vertical height
- No oversized top banner
- No repeated navigation elements unless responsive behavior requires it

Tablet:

- Collapsible navigation
- Compact header
- No clipped controls
- No page overflow

Mobile:

- Drawer or compact navigation
- Theme control remains reachable
- Main actions remain visible
- No broken table layout
- No off-screen dialogs

==================================================
11. DASHBOARD STRUCTURE
==================================================

The dashboard is a working operational interface, not a marketing page.

Required dashboard areas:

1. Page title
2. Supporting context
3. Primary action
4. Key metrics
5. Industry engine summary
6. Recent projects
7. Verification summary
8. Development status
9. Recent activity

Primary title:

Quantity Intelligence Workspace

Dashboard metrics may include:

- Active Projects
- BOQs in Review
- Total Quoted Value
- Pending Approvals
- Average Confidence
- Enabled Industry Engines

Metric cards must be:

- Compact
- Consistent
- Data-focused
- Easy to scan
- Free of decorative illustrations
- Free of oversized icons
- Free of unnecessary charts

==================================================
12. DASHBOARD DEVELOPMENT STATUS
==================================================

The dashboard must visually distinguish:

- Complete
- Active
- Planned
- Not Connected
- Blocked

Do not mark a module complete merely because a page exists.

Examples:

Foundation:
Complete

Industry Engines:
Complete

Project UI:
Complete

BOQ UI:
Complete

Verification UI:
Complete

Theme Controls:
Complete only when tested

Database:
Active or Complete based on real state

Authentication:
Planned or Active

OCR:
Planned

Drawing Intelligence:
Planned

Email:
Planned or Active

Client Portal:
Planned or Active

Document Generation:
Planned or Active

The status display must reflect real implementation state.

==================================================
13. NAVIGATION GROUPS
==================================================

Use clear enterprise navigation groups.

WORKSPACE

- Dashboard
- Industry Engines
- Projects
- Clients

ESTIMATION

- BOQ Workspace
- Rate Catalogue
- Verification Centre

OUTPUT

- Documents
- Templates
- Client Proposals

ADMINISTRATION

- Company Settings
- Users
- Appearance

Use clear active states.

Do not show inactive links as functional without status labels.

==================================================
14. BOQ WORKSPACE
==================================================

The BOQ workspace is the most important interface.

It must feel like professional estimation software.

Required visual hierarchy:

1. Project header
2. BOQ revision
3. BOQ status
4. Main toolbar
5. Section rows
6. Item rows
7. Calculation summary
8. Revision history
9. Verification state
10. Lock state

Toolbar actions may include:

- Add Section
- Add Item
- Duplicate
- Bulk Margin
- Apply VAT
- Recalculate
- Save Draft
- Create Revision
- Lock Revision

Desktop table columns:

- Item
- Code
- Description
- Specification
- Quantity
- Unit
- Unit Cost
- Landed Cost
- Margin
- Selling Rate
- Total
- Confidence
- Status
- Actions

Requirements:

- Sticky header
- Right-aligned numeric values
- Left-aligned descriptions
- Tabular numbers
- Clear section rows
- Clear selected rows
- Horizontal scrolling inside table container only
- No full-page horizontal overflow
- Read-only locked-state appearance
- Compact action menu
- Clear warnings
- Clear editable fields
- No card-per-row layout on desktop

==================================================
15. REVISION HISTORY UI
==================================================

Revision history must show:

- Revision number
- Status
- Created date
- Locked date
- Created by
- Current revision indicator
- Locked indicator
- Selection action

Rules:

- Previous locked revisions appear read-only
- Current editable revision is clear
- Switching revision must not alter data unexpectedly
- Revision selection must preserve theme and layout
- No hidden revision state

==================================================
16. VERIFICATION PAGE
==================================================

Verification UI must include:

- Project identity
- Active BOQ revision
- Critical count
- Warning count
- Resolved count
- Verification exceptions
- Severity
- Affected item
- Current value
- Suggested value
- Resolution action
- Resolution note
- Lock eligibility

Use clear status colours:

- Critical: danger
- Warning: warning
- Resolved: success
- Information: info

Do not rely on colour alone.

Each exception must include readable text labels.

Critical unresolved issues must clearly block lock or issue actions.

==================================================
17. RATE CATALOGUE UI
==================================================

Catalogue UI must support:

- Search
- Industry filter
- Category filter
- Supplier filter
- Expired filter
- Add rate
- Edit rate
- Deactivate rate
- Apply rate to BOQ

Table columns may include:

- Code
- Industry
- Category
- Description
- Unit
- Supplier
- Cost
- Margin
- Selling Rate
- Currency
- Effective Date
- Expiry Date
- Status
- Actions

Expired rates must have a visible warning state.

==================================================
18. INDUSTRY ENGINE UI
==================================================

Industry engine cards must show:

- Industry name
- Description
- Status
- Enabled state
- Project count
- BOQ count
- Supported units
- Core sections
- Open workspace action

Supported engines:

- Construction
- Interior Fit-Out
- Furniture
- MEP
- Electrical
- HVAC
- Plumbing
- Fire Fighting
- Joinery
- Landscaping

Do not use separate visual systems per industry.

Use one design system with specialized content.

==================================================
19. FORM DESIGN
==================================================

Form standards:

- Label above input
- Required indicator
- Supporting text where useful
- Error below field
- Visible focus ring
- Consistent height
- Clear disabled state
- Clear read-only state
- Light and dark support

Recommended input height:

36px to 40px

Desktop layout:

- One or two columns
- Maximum three fields in one row only where practical

Mobile layout:

- Single column

Do not create oversized fields.

Do not place labels inside fields without visible external labels.

==================================================
20. BUTTON SYSTEM
==================================================

Required variants:

- Primary
- Secondary
- Outline
- Ghost
- Danger
- Success

Rules:

- One main primary action per region
- Not every button should be blue
- Destructive actions use danger
- Icon-only buttons require tooltip or accessible label
- Loading state should preserve width
- Disabled state remains readable
- Buttons should be compact
- No unnecessary large button blocks

==================================================
21. STATUS BADGES
==================================================

Project statuses:

- Draft
- Active
- Needs Review
- Internally Approved
- Sent
- Client Approved
- Revision Requested
- Rejected
- Archived

BOQ statuses:

- Draft
- Calculated
- Needs Verification
- Locked
- Issued
- Approved

Confidence:

- High
- Medium
- Low
- Manual

Development:

- Complete
- Active
- Planned
- Not Connected
- Blocked

Every badge must contain text.

==================================================
22. TABLE SYSTEM
==================================================

Use one reusable table visual system for:

- Projects
- BOQ items
- Verification
- Catalogue
- Clients
- Revision history
- Activity logs
- Documents
- Proposals

Support:

- Sticky headers
- Compact density
- Comfortable density
- Search
- Filters
- Sorting indicators
- Empty state
- Loading skeleton
- Selection state
- Hover state
- Responsive scroll container
- Tabular numbers

Do not create visually unrelated table implementations.

==================================================
23. MODALS AND DRAWERS
==================================================

Use modals for:

- Add item
- Edit item
- Delete confirmation
- Create revision
- Lock revision
- Add client
- Add rate

Use drawers for:

- Item inspector
- Formula details
- Verification details
- Catalogue matching
- File metadata

Requirements:

- Accessible focus behavior
- Escape handling
- Clear title
- Clear primary and secondary actions
- Mobile support
- No hidden overflow
- Light and dark compatibility

==================================================
24. RESPONSIVE RULES
==================================================

Test widths:

- 375px
- 430px
- 768px
- 1024px
- 1280px
- 1440px

Desktop:

- Full operational layout
- Dense tables
- Sidebar or full navigation
- Multiple columns

Tablet:

- Collapsible navigation
- Two-column dashboard
- Scrollable tables
- Compact toolbar

Mobile:

- Single-column dashboard
- Drawer navigation
- Compact header
- Structured BOQ cards only when table is unusable
- No clipped modal
- No body-level horizontal overflow
- Accessible theme control

==================================================
25. RTL READINESS
==================================================

The UI must remain structurally ready for Arabic.

Use logical properties where practical:

- margin-inline
- padding-inline
- inset-inline
- text-start
- text-end

Avoid unnecessary hardcoded left/right positioning.

Tables must remain readable in RTL.

Numeric values must remain clear.

Do not activate full Arabic unless explicitly requested.

==================================================
26. ACCESSIBILITY
==================================================

Required:

- Semantic headings
- Correct heading order
- Keyboard navigation
- Visible focus
- Accessible labels
- Accessible dialogs
- Accessible dropdowns
- Status text
- Sufficient contrast
- Screen-reader labels for icons
- Reduced motion support

Use:

@media (prefers-reduced-motion: reduce)

Do not remove focus outlines without replacement.

==================================================
27. MOTION RULES
==================================================

Allowed transitions:

- Theme colour change
- Hover
- Sidebar collapse
- Dropdown
- Modal
- Drawer

Duration:

150ms to 220ms

Do not add:

- Floating animations
- Pulsing cards
- Animated backgrounds
- Continuous movement
- Decorative page transitions
- Scale animation on every card

==================================================
28. UI PREFERENCE STORAGE
==================================================

Allowed local preferences:

- Theme
- Sidebar state
- Dashboard density
- Table density

Recommended keys:

quantara-theme
quantara-sidebar
quantara-density
quantara-table-density

Do not store sensitive or business data in localStorage after backend migration.

Do not store:

- Projects
- BOQs
- Clients
- Rates
- Sessions
- Tokens
- Proposal links
- Email information

after backend migration is complete.

==================================================
29. VISUAL REGRESSION PROTECTION
==================================================

Before changing UI:

1. Capture the current route appearance.
2. Identify the target component.
3. Make the smallest change.
4. Verify Light mode.
5. Verify Dark mode.
6. Verify System mode.
7. Verify desktop.
8. Verify tablet.
9. Verify mobile.
10. Verify build.
11. Verify no other route changed unexpectedly.

Do not perform broad global CSS edits without reviewing all major routes.

==================================================
30. ROUTES TO PROTECT
==================================================

Always verify these routes after UI changes:

/
 /dashboard
 /industries
 /projects
 /projects/new
 /projects/project-construction-001
 /projects/project-construction-001/boq
 /projects/project-construction-001/verification
 /projects/project-construction-001/documents
 /projects/project-construction-001/client-preview
 /catalogue
 /templates
 /settings
 /settings/appearance

As new routes are added, include them in this protection list.

==================================================
31. REQUIRED THEME TEST
==================================================

Perform this exact test:

1. Select Light.
2. Refresh.
3. Confirm Light remains active.
4. Open dashboard.
5. Open projects.
6. Open BOQ.
7. Open verification.
8. Open settings.
9. Confirm readable light interface.

10. Select Dark.
11. Refresh.
12. Confirm Dark remains active.
13. Repeat key route checks.

14. Select System.
15. Refresh.
16. Confirm System remains selected.
17. Change operating-system appearance.
18. Confirm the app follows the system.

19. Check localStorage:
quantara-theme

20. Confirm no other theme storage key conflicts.

==================================================
32. UI BUILD STATUS PANEL
==================================================

Maintain one visible internal development status panel.

It should show real status for:

- UI Foundation
- Dashboard
- Industry Engines
- Project Workspace
- BOQ Workspace
- Verification
- Theme System
- Responsive UI
- Accessibility
- Backend
- Authentication
- Catalogue
- Documents
- Email
- Client Portal
- File Extraction
- Drawing Intelligence

Do not mark a module complete without verification.

==================================================
33. NO BACKEND-DRIVEN UI DRIFT
==================================================

When backend features are added:

- Preserve page structure
- Preserve theme support
- Preserve route hierarchy
- Preserve spacing
- Preserve card design
- Preserve table design
- Preserve navigation
- Preserve responsive behavior

Backend work may introduce:

- Loading states
- Empty states
- Error states
- Real data
- Permissions
- Disabled actions
- Status changes

Backend work must not introduce:

- New unrelated colours
- New visual framework
- Duplicate component libraries
- New page layout system
- New theme provider
- New sidebar without approval
- New dashboard template
- Mixed design language

==================================================
34. COMPONENT GOVERNANCE
==================================================

Prefer reusable components.

Maintain or create:

src/components/ui/
  button.tsx
  card.tsx
  badge.tsx
  input.tsx
  textarea.tsx
  select.tsx
  checkbox.tsx
  switch.tsx
  tabs.tsx
  dropdown-menu.tsx
  dialog.tsx
  drawer.tsx
  tooltip.tsx
  table.tsx
  empty-state.tsx
  skeleton.tsx
  page-header.tsx
  section-header.tsx
  status-badge.tsx

Do not create multiple button systems.

Do not create multiple table systems.

Do not duplicate components just to change colour.

==================================================
35. UI ERROR STATES
==================================================

Every major page must support:

- Loading
- Empty
- Error
- Permission denied
- Not found
- Locked
- Disabled
- Offline or unavailable backend

Error messages must be readable in Light and Dark modes.

Do not show raw technical errors directly to normal users.

==================================================
36. UI SUCCESS CRITERIA
==================================================

The visual system is considered stable only when:

- Light works
- Dark works
- System works
- Theme persists
- Dashboard is readable
- BOQ is readable
- Verification is readable
- Tables are usable
- Forms are usable
- Mobile is usable
- No full-page overflow exists
- No hardcoded theme conflict exists
- No invisible content exists
- No inconsistent component system exists
- No backend feature breaks the UI
- Build passes

==================================================
37. REQUIRED VALIDATION
==================================================

After any meaningful UI change run:

npm run lint
npm run build

If tests exist:

npm test

Also manually inspect key routes.

Fix:

- TypeScript errors
- ESLint errors
- Hydration warnings
- Theme mismatch
- Invisible content
- Broken table layout
- Mobile overflow
- Missing focus
- Incorrect status contrast
- Broken settings selection

==================================================
38. UI CHANGE REPORT
==================================================

Every UI task must end with a report containing:

1. Objective
2. Files inspected
3. Files changed
4. Components changed
5. Routes affected
6. Light mode result
7. Dark mode result
8. System mode result
9. Desktop result
10. Tablet result
11. Mobile result
12. Accessibility result
13. Lint result
14. Build result
15. Known visual issues
16. Backend behavior deliberately unchanged

Never say "UI fixed" without listing what was tested.

==================================================
39. EMERGENCY UI RECOVERY
==================================================

If a future change breaks the visual system:

1. Stop adding new features.
2. Identify the exact commit or file.
3. Do not rewrite the full UI.
4. Revert only the failing visual change.
5. Restore:
   - theme behavior
   - dashboard
   - navigation
   - BOQ table
   - verification page
6. Run Light, Dark, and System checks.
7. Run build.
8. Document the cause.

Do not use emergency recovery as an excuse to remove working backend features.

==================================================
40. FINAL RULE
==================================================

Quantara AI must evolve through:

Stable UI
→ Real backend
→ Real data
→ Real documents
→ Real client workflow
→ Structured extraction
→ Advanced drawing intelligence

The UI must remain stable throughout all phases.

Never redesign the product casually while implementing backend functionality.

STOP after the requested UI task is complete.
Do not begin unrelated work.
