# Tool Availability Policy

## Policy

All tools declared in [tool_manifest_clickup.json](../../tool_manifest_clickup.json) are part of the intended product surface.

The policy is not to reduce the tool catalogue by default.
The policy is to keep the declared catalogue true.

## Implications

- a broken tool is still a product commitment unless explicitly removed by decision
- harness work should track trust and correctness, not erase intended availability
- manifest-driven registration remains a production concern and should be handled during engineering, not documentation cleanup

## Current Trust Tracking

Current machine-readable trust and availability reference:

- [docs/status/tool-validation-status.json](../status/tool-validation-status.json)

Supporting human-readable references:

- [docs/tool-reference.md](../tool-reference.md)
- [docs/refactor-repair-plan.md](../refactor-repair-plan.md)
