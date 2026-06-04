---
name: improve-codebase-architecture
description: Find deepening opportunities in a codebase, informed by the domain language in CONTEXT.md and the decisions in docs/adr/. Use when the user wants to improve architecture, find refactoring opportunities, consolidate tightly-coupled modules, or make a codebase more testable and AI-navigable.
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

**Glossary terms used:** Module, Interface, Implementation, Depth, Seam, Adapter, Leverage, Locality.

**Key concepts:**
- **Deletion test**: If deleting a module makes complexity vanish, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- The interface is the test surface.
- One adapter = hypothetical seam. Two adapters = real seam.

**Process (3 steps):**
1. **Explore** — Read CONTEXT.md + ADRs first, then use an Explore sub-agent to walk the codebase organically, looking for shallow modules, poor locality, tight coupling, and hard-to-test interfaces.
2. **Present candidates as an HTML report** — Written to `$TMPDIR/architecture-review-<timestamp>.html`, using Tailwind + Mermaid CDN, with before/after diagrams for each candidate. Each card includes: files, problem, solution, benefits (locality/leverage), before/after diagram, and recommendation strength (`Strong` / `Worth exploring` / `Speculative`). Ends with a "Top recommendation" section. Does NOT propose interfaces yet — asks the user which to explore.
3. **Grilling loop** — Conversational design walk-through once the user picks a candidate. Side effects: update `CONTEXT.md` with new terms, offer ADRs when a rejection has a load-bearing reason.

**Referenced files:** `LANGUAGE.md`, `HTML-REPORT.md`, `INTERFACE-DESIGN.md`, `CONTEXT-FORMAT.md`, `ADR-FORMAT.md`.
