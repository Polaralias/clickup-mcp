# Glossary

This glossary defines the product-language for rebuilding the repository into a trustworthy public ClickUp MCP server and the validation system around it.

## Language

**Product**:
The ClickUp MCP server itself, including the manifest-declared tool surface and its runtime behaviour.
_Avoid_: Platform, harness

**Platform**:
The validation harness, status model, and reporting system used to prove and communicate product truth.
_Avoid_: Product, runtime

**Capability**:
A stable user-meaningful behaviour the platform verifies, even if implementation changes between direct endpoints and composed flows.
_Avoid_: Raw endpoint, raw tool name

**Full Support**:
The target product state where every manifest-declared tool is runtime-available and backed by validated behaviour, with no remaining intended-only or unsupported tools.
_Avoid_: Narrowed scope, partial availability, perpetual intended state

**Current Validation State**:
The platform's present-tense assessment of where a tool or capability stands during the repair journey towards Full Support.
_Avoid_: Final acceptance, end-state promise

**Full-Manifest Enumeration**:
The requirement that the platform's authoritative status output includes every manifest-declared tool from the start, not only the subset already deeply probed.
_Avoid_: Partial inventory, sampled status output

**Capability Mapping Incomplete**:
A temporary platform condition where a tool is fully enumerated in status output but not yet exhaustively decomposed into validated capabilities.
_Avoid_: Hidden unknowns, fake completeness

**Evidence-Backed Authority**:
The rule that the first authoritative platform status source may be manually curated, provided every classification is traceable to checked-in evidence.
_Avoid_: Automation theatre, untraceable status

**End-State Compliant**:
A tool-level signal that is true only when the tool has reached the validated state required for Full Support.
_Avoid_: Transitional progress, internal refactor note

**Stale Evidence**:
Previously useful validation evidence that can no longer be treated as current because a relevant runtime or manifest change has invalidated its freshness.
_Avoid_: Current proof, active validation

**Primary Next Action**:
The single highest-value next step needed to move a non-validated tool closer to Full Support.
_Avoid_: Full dependency graph, passive observation

**Canonical Status Artefact**:
The single authoritative machine-readable platform file that records per-tool validation state, acceptance, evidence, and next action.
_Avoid_: Bucket-only summary, duplicated status sources

## Relationships

- The **Platform** validates and reports on the **Product**
- The **Platform** evaluates the **Product** primarily through **Capabilities**
- The **Product** is the thing being repaired towards full manifest-backed availability
- **Full Support** is achieved when the **Product** satisfies all manifest-declared tool commitments with validated behaviour
- **Current Validation State** describes progress towards **Full Support** but does not redefine the end state
- **Full-Manifest Enumeration** prevents unknown tools from disappearing from platform reporting while validation is still incomplete
- **Capability Mapping Incomplete** is acceptable temporarily if **Full-Manifest Enumeration** is preserved and the incompleteness is explicit
- **Evidence-Backed Authority** allows the platform to become authoritative before deep automation exists, as long as classifications remain traceable
- **End-State Compliant** is the simple acceptance signal for whether a tool has reached **Full Support**
- **Stale Evidence** keeps the platform from treating old classifications as current truth after relevant change
- **Primary Next Action** makes non-validated status operational by tying it to the next concrete closure step
- The **Canonical Status Artefact** is tool-keyed first and should not pretend to be generated before automation actually exists

## Example dialogue

> **Dev:** "Is fixing `task_create_bulk` a product change or a platform change?"
> **Domain expert:** "Product change. The platform is the harness that proves whether that repair is true and how it should be reported."

> **Dev:** "If the harness is capability-first, are we weakening the promise to support every tool in the manifest?"
> **Domain expert:** "No. Capability-first is how the platform measures truth. Full Support still means the product delivers every manifest-declared tool."

## Flagged ambiguities

- "platform" was being used to mean both the ClickUp MCP server and the validation system — resolved: **Product** is the server, **Platform** is the harness and status/reporting system.
- "full support" could be confused with capability-only coverage — resolved: **Full Support** still means every manifest-declared tool is supported in the **Product**, even though the **Platform** validates primarily at the **Capability** level.
- "validated/intended/unsupported" could be read as permanent product tiers — resolved: they may describe the current transition state, but the final **Full Support** end state allows only validated tools.
- current reporting versus final acceptance was blurred — resolved: **Current Validation State** is transitional reporting; **Full Support** is the final acceptance bar.
- status output scope was ambiguous — resolved: **Full-Manifest Enumeration** requires the authoritative platform output to include every manifest-declared tool, including not-yet-deeply-validated tools.
- capability decomposition timing was ambiguous — resolved: complete decomposition is not required before first status publication, but incomplete mappings must be explicit via **Capability Mapping Incomplete**.
- authority versus automation was ambiguous — resolved: **Evidence-Backed Authority** permits a manually curated authoritative source before deeper automation is built.
- tool-level versus capability-level acceptance was ambiguous — resolved: **End-State Compliant** is surfaced at the tool level; capability-level compliance is an internal refactor aid, not final product output.
- evidence freshness was ambiguous — resolved: the platform distinguishes never-tested from stale evidence, and relevant runtime or manifest changes make prior evidence stale.
- actionability was ambiguous — resolved: each non-validated tool should carry one **Primary Next Action** in the authoritative status source.
- artefact shape and location were ambiguous — resolved: the **Canonical Status Artefact** should replace the current bucket-first trust matrix, be tool-keyed first, and not live under generated output until it is actually generated.
