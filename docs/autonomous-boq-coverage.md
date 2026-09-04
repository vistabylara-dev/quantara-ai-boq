# Autonomous drawing-to-BOQ policy coverage

Phase 1 defines a deterministic, unpriced BOQ domain contract. It does not change persistence, TAYQAN entitlements, uploads, authentication, pricing, finalization, or document generation.

Every accepted quantity must use a formula registered in `required-dimensions-registry.ts`, cite a page inside the frozen source scope, be positive, and use an allowed industry unit. Exact duplicate measurements collapse; conflicting duplicates, mixed revisions, and unreconciled cross-source evidence block technical completion. Accepted items have system-validated quantity provenance and rate `0`, so a technically complete draft has only unit rates outstanding.

## Enabled-engine matrix

| Engine | Deterministic policy rules | BOQ units | Explicitly blocked or delegated |
| --- | --- | --- | --- |
| `construction` | Concrete and excavation volume; reinforcement weight; formwork and measured wall area | `m3`, `kg`, `m2` | Preliminaries, lump sums, unregistered generic blockwork formula, and design assumptions |
| `interior-fitout` | Floor, ceiling, wall, partition and paint area; skirting length; evidence count | `m2`, `lm`, `nos` | Demolition/lump-sum quantities without explicit evidence |
| `furniture` | Verified unit and set counts | `pcs`, `sets` | `optionSelection` is a design/commercial decision |
| `mep` | Pipe and cable routes; duct surface; equipment count | `m`, `m2`, `nos` | Capacity, flow and load design; testing/lump sums without schedules |
| `electrical` | Cable routes; circuit and point counts | `m`, `nos`, `points` | `loadEstimate` |
| `hvac` | Duct surface; pipe routes; equipment counts | `m2`, `m`, `nos` | `capacityLoad` |
| `plumbing` | Pipe routes; fixture counts | `m`, `nos` | `flowEstimate` |
| `firefighting` | Pipe routes; sprinkler counts | `m`, `nos` | `pumpSizing` |
| `joinery` | Verified unit multiplicity as a registered count input | `pcs` | Canonical panel, sheet, edge and hardware quantities remain delegated to `SPECIALIZED_JOINERY` |
| `landscaping` | Irrigation routes; scheduled plant counts | `m`, `nos` | `plantSpacing`; `coverageArea` until generic `AREA` is registered |

Count output `nr` is deterministically assigned an evidence-backed configured unit such as `nos`, `pcs`, `sets`, `units`, or `points`. Linear `m` becomes `lm` only where the selected engine requires that exact configured unit. Quantity calculation and BOQ provenance must persist the same normalized unit.

## Family routing

| Requested family | Real enabled policy | Bounded scope |
| --- | --- | --- |
| `architectural` / `architectural-finishes` | `interior-fitout` | Measured internal finishes and partitions only; no facade, envelope, or roofing inference |
| `civil` / `civil-works` | `construction` | Excavation, concrete, and measured wall scope |
| `structural` | `construction` | Concrete, reinforcement, and formwork |
| `infrastructure` / `site-infrastructure` | `construction` | Measured excavation and concrete only; no road build-up or utility design |
| `facilities-management` | none | Blocked: no enabled autonomous measurement policy |

The project-selected canonical engine remains authoritative. Family labels narrow its formula rules; drawing text cannot silently switch the project industry.

## Contract evidence

The operation identity hashes the contract version, tenant, project, target BOQ, requested and canonical industry, industry configuration, exact policy, policy version, allowed rules, and sorted frozen file IDs/checksums/revisions/pages. This makes a source, revision, engine, or policy change a new operation rather than an invisible retry.

Unsupported sizing is represented as an evidence-linked blocking exception. It is never converted into a quantity. A deliberate manual override retains the original system quantity and calculation fingerprint, records the previous value, accountable user, timestamp, and non-empty reason.
