# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-03-26

First public local-deployment release.

### Added

- Local single-user web app flow for uploading `.docx` thesis briefs and creating durable jobs.
- Persistent history workbench with search, filtering, sorting, detail view, event timeline, rerun, soft delete, and workspace ZIP export.
- Multi-agent execution chain covering `advisor`, `coder`, `writer`, three reviewer agents, `code_eval`, and `doc_check`.
- Generated artifact preview support, including generated `.docx` thesis draft preview.
- Frontend default Chinese UI with one-click English toggle and remembered locale selection.
- Product screenshots in the README.
- Contributor guide for local development and safe contribution workflow.

### Changed

- Improved homepage quick-start flow and local startup guidance.
- Improved runtime timeline and status guidance, including legacy stage mapping.
- Improved delivery readiness, delivery confidence, and interrupted-job signal handling in the history workbench.
- Improved agent board readability and grouped terminal outcome presentation.

### Security

- Runtime `API Key` values remain runtime-only and are not persisted in saved settings.
- Added git ignore rules for local Playwright output and generated debug artifacts.
- README now documents the safe push boundary for local-only runtime data.

### Documentation

- Rewrote README for Chinese-first local deployment onboarding.
- Added screenshots and contribution guidance for open-source collaborators.
