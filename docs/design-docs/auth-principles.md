# Auth Principles

## Desired End State

The repository should support a simple, explicit auth model:

- upstream ClickUp auth is env-driven
- MCP client auth is static bearer auth unless intentionally disabled
- auth configuration is documented as a contract, not as folklore

## Repository Reality

The current auth model is present and broadly understandable, but it is documented alongside other invalidated assumptions.

## Design Requirements

- auth docs must distinguish MCP auth from ClickUp auth
- health and operator docs must explain effective auth mode
- auth-disabled operation must be explicit and intentional
- broken tools must not be described as auth problems when the real issue is route or payload shape
