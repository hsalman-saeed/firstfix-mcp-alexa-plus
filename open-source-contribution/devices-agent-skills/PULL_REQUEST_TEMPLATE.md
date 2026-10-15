# Pull Request: Add `alexa-plus-mcp-ucp-local-booking` Agent Skill

## Target Repository
`https://github.com/AmazonAppDev/devices-agent-skills`

## Title
`feat(skills): add alexa-plus-mcp-ucp-local-booking architecture & implementation skill`

---

## Description
This pull request contributes the **`alexa-plus-mcp-ucp-local-booking`** Agent Skill to the official Amazon Devices Agent Skills repository.

Developed during the **Amazon Developer Hackathon 2026** by the **FirstFix MCP** team, this skill encapsulates the complete architectural reference, code patterns, and friction-point solutions for building production-grade **Alexa+ Add-Ons** combining:
1. **Model Context Protocol (MCP 2025-11-25 Streamable HTTP)**
2. **Interactive Multimodal MCP Apps (`text/html;profile=mcp-app` with JSON-RPC 2.0 `postMessage`)**
3. **Universal Commerce Protocol (UCP 2026-01-11) Checkout Lifecycle with 24h Idempotency**
4. **Alexa+ Local Booking SPI with End-to-End Correlation Tokens**

---

## What Problem Does This Solve?
Building an Alexa+ Add-On that links conversational AI with physical services requires coordinating multiple emerging specifications. Developers frequently encounter:
- 406 Not Acceptable errors in Streamable HTTP proxies lacking negotiated `Accept` headers.
- UCP state inconsistencies during retried payment calls without RFC-compliant `Idempotency-Key` fingerprinting.
- Sandboxed iframe communication failures when triggering Alexa+ host checkout.
- Validation rejections due to non-standard asset dimensions in `addon.json`.

This skill provides AI coding assistants (Claude Code, Cursor, Google Antigravity, Kiro) with immediate, zero-friction guidance to generate correct, compliant implementations on the first try.

---

## Reference Implementation
- Live Repository: [https://github.com/firstfix-mcp/firstfix-mcp-alexa-plus](https://github.com/firstfix-mcp/firstfix-mcp-alexa-plus)
- Standalone SDK: `alexa-plus-ucp-mcp-kit`
- Live Demo: AWS Lambda Function URL (`https://*.lambda-url.us-east-1.on.aws`)

---

## Validation Checklist
- [x] Conforms to `agentskills.io` YAML frontmatter specifications.
- [x] Includes friction log resolutions and production code snippets.
- [x] Verified with 50 automated tests in the FirstFix MCP test suite.
- [x] Released under MIT License.
