# Status Artifacts

This directory is reserved for authoritative machine-readable platform status artifacts.

Current canonical artifact:

- `tool-validation-status.json`

This file replaces the archived bucket-based trust matrix stored at [docs/archive/2026-05-16-tool-trust-matrix.json](../archive/2026-05-16-tool-trust-matrix.json) as the authoritative machine-readable status source.

Until automation exists, the canonical artifact is allowed to be manually curated if every non-validated classification is traceable to checked-in evidence.

Current harness support:

- [scripts/validate_harness.py](../../scripts/validate_harness.py) validates shape, manifest coverage, and evidence-path integrity
- [tests/test_status_artifact.py](../../tests/test_status_artifact.py) checks narrative count drift against [docs/tool-reference.md](../tool-reference.md)
