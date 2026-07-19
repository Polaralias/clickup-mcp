# Design

## Principle

Design in this repository means integration design, not visual design.

The design goal is a ClickUp MCP server whose tool surface is:

- explicit
- validated
- composable
- repairable

## Design Constraints

- Public docs must not overstate what the runtime does.
- Tool semantics must map to validated ClickUp behaviour.
- Unsupported bulk behaviour should be expressed as composition if composition is the validated path.
- Every write path should have a clear safety model.

## Current Design Focus

- convert inferred findings into durable engineering principles
- document desired end states before implementation changes
- use design docs to define target behaviour for repaired domains
