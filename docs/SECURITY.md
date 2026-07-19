# Security

## Principle

Security in this repository is primarily about:

- access control
- auth correctness
- safe write behaviour
- avoiding undocumented behaviour in production integrations

## Current Security Posture

The current auth model is:

- static bearer auth for MCP access
- env-driven ClickUp API token for upstream access
- explicit documentation of enabled and disabled auth modes

## Highest-Risk Boundary

Selective write remains the highest-risk security boundary.

That risk is narrower than during the repair phase, but changes here still require matching harness coverage because permission inference depends on runtime context.

## Supporting Security Docs

Auth and write-safety policy should stay anchored to these design references:

- [docs/design-docs/auth-principles.md](design-docs/auth-principles.md)
- [docs/design-docs/write-safety-principles.md](design-docs/write-safety-principles.md)
- [docs/configuration.md](configuration.md)
