# ADR-0001: Freeze the V1 safety baseline

- Status: Accepted
- Date: 2026-08-16

## Context

The project has a working end-to-end path for one well-defined Microsoft Sentinel scheduled rule:
proposal, typed contract validation, review artifact creation, explicit approval, preview, and
deployment through the existing PowerShell script. Expanding detection coverage and the KQL
validator now would change the safety boundary while the deployment integration is still being
validated.

## Decision

Freeze V1 as a password-spray reference implementation. Cosmetic improvements, documentation,
test coverage, error messages, and release hygiene are allowed. New detection families, generalized
KQL semantics, and production web hosting are deferred to V2.

V1 always keeps generated rules disabled and requires an exact human `APPROVE` before deployment.
Entity mappings remain in the review artifact but are not sent by the supplied deployment script.

## Consequences

- V1 is predictable and easy to test end to end.
- The offline mode is a repeatable fixture rather than a broad capability claim.
- Users must use the supported password-spray request for the offline demo.
- V2 will need a generalized rule schema and detection-specific validator plug-ins.
- The CLI is the supported V1 interface; a web interface is explicitly deferred.
