# idea2thesis Design Spec

## Overview

`idea2thesis` is a local single-user web application that accepts a `Word (.docx)` graduation thesis design brief and runs a one-click multi-agent pipeline to generate:

- a runnable software or data-analysis project
- repository documentation and delivery materials
- a first-draft thesis document
- local verification evidence from executed commands

The product is intended for computer software and data analysis / algorithm graduation projects. It should be open-source on GitHub and deployable locally by any user who can provide an `API key`, `base URL`, and model configuration.

## Goals

- Provide a one-click workflow from design brief upload to deliverable generation.
- Use a supervisor-led multi-agent architecture that resembles Codex-style task decomposition and self-checking.
- Execute generated code locally for validation instead of only producing static files.
- Support provider-agnostic LLM access through `API key + base URL + model`.
- Make the project itself easy to clone and run locally.

## Non-Goals

- Multi-user accounts or remote team collaboration in v1.
- A hosted SaaS deployment in v1.
- Broad coverage across all academic disciplines in v1.
- Guaranteed final-paper quality suitable for direct submission without human review.
- Full GitHub repository creation and publishing automation as a required v1 flow.

## Primary User Flow

1. User opens the local web application.
2. User configures model access with `API key`, `base URL`, and default model.
3. User uploads a `Word (.docx)` thesis design brief.
4. User clicks a single "generate" action.
5. The system extracts structured requirements from the brief.
6. The supervisor agent creates a task graph and success criteria.
7. Specialized agents generate code, repository docs, and thesis draft materials.
8. Reviewer and evaluation agents inspect outputs, request retries, and trigger fixes.
9. The application presents the final workspace, generation log, validation results, and output files.
10. The generated workspace is stored locally as a Git repository with staged commits representing major milestones.

## Architecture

The application uses a local web UI plus a backend orchestration service. The backend owns job state, file management, agent execution, command execution, and artifact packaging. The UI focuses on configuration, upload, job monitoring, and result browsing.

The core design is a supervisor-centered agent graph:

- `advisor / supervisor agent`
  - reads the parsed brief
  - determines project type
  - selects a likely technical stack
  - breaks the work into subtasks
  - sets review criteria
  - routes retries and fixes
- `coder agent`
  - generates project structure, source code, config files, scripts, and tests
- `writer agent`
  - generates README, design explanation, usage guides, progress materials, and thesis first draft
- `reviewer agents x3`
  - `requirements reviewer`: checks alignment to the brief
  - `engineering reviewer`: checks code quality and project structure
  - `delivery reviewer`: checks whether outputs are sufficient for a graduation project handoff
- `code-eval agent`
  - executes local commands such as dependency installation, tests, build commands, and limited startup checks
- `doc-check agent`
  - validates thesis draft completeness, chapter structure, terminology consistency, and alignment with the original brief

## System Components

### 1. Web Application Shell

Responsibilities:

- accept `.docx` uploads
- collect model configuration
- create and track generation jobs
- render real-time status by stage and by agent
- show logs, outputs, validation results, and file download links

UI sections:

- settings panel
- upload panel
- one-click generation trigger
- job timeline
- agent status board
- artifact explorer
- validation report viewer

### 2. Brief Ingestion and Parsing

Responsibilities:

- accept `Word (.docx)` input
- extract plain text, headings, tables, and bullet content
- normalize the brief into structured fields

Target extracted fields:

- project title
- project background and objectives
- functional requirements
- non-functional constraints
- suggested technologies
- milestone or timeline notes
- expected thesis chapters or writing hints

Output:

- normalized JSON record used by downstream agents
- raw extraction snapshot for traceability

### 3. Supervisor-Orchestrated Agent Runtime

Responsibilities:

- convert parsed brief into a task graph
- create agent prompts and handoff packets
- maintain job state and retries
- decide when a stage passes or requires rework

The supervisor should keep a bounded retry policy and avoid infinite loops. For v1, retries should be configurable per stage with conservative defaults.

### 4. Workspace and Artifact Manager

Responsibilities:

- create a unique local job workspace
- maintain structured directories for code, docs, prompts, logs, and generated thesis assets
- preserve intermediate artifacts for debugging
- initialize Git and create milestone commits

Suggested workspace layout:

- `jobs/<job-id>/input/`
- `jobs/<job-id>/parsed/`
- `jobs/<job-id>/workspace/`
- `jobs/<job-id>/artifacts/`
- `jobs/<job-id>/logs/`

### 5. Code Execution and Verification Layer

Responsibilities:

- inspect generated project metadata
- determine safe validation commands
- run commands in the local environment
- capture stdout, stderr, exit codes, and timings
- feed failures back to the supervisor

Expected validation categories:

- dependency install
- test execution
- build verification
- optional startup smoke check

This layer is critical because the product promise includes Codex-like "generate then execute and fix" behavior.

### 6. Document Generation and Checking

Responsibilities:

- generate repository docs
- generate software design documents
- generate thesis first draft content
- check document completeness and consistency

Expected document outputs:

- `README.md`
- project overview / design explanation
- run instructions
- API or module summary when relevant
- thesis first draft in markdown, with later export hooks for `.docx`

### 7. Model Provider Abstraction

Responsibilities:

- store runtime config for `API key`, `base URL`, `model`, and optional organization fields
- wrap chat / reasoning / tool-call requests behind a provider-neutral interface
- allow different OpenAI-compatible providers without changing core orchestration logic

v1 assumption:

- first implementation targets OpenAI-compatible chat APIs with configurable endpoint URL

## Data Flow

1. Upload `.docx` file.
2. Parse document into raw text plus structured JSON.
3. Supervisor analyzes structured JSON and drafts the execution plan.
4. Supervisor dispatches code and writing tasks to specialized agents.
5. Generated outputs are written into the job workspace.
6. Reviewer agents inspect outputs.
7. Code-eval agent runs local verification commands.
8. Doc-check agent validates written materials.
9. Supervisor either:
   - accepts outputs
   - requests targeted fixes
   - marks the job failed with diagnostic reasons
10. Final artifacts and logs are presented in the UI.

## Stack Selection Strategy

The generated target project should be selected dynamically from the brief instead of hardcoding a single framework.

The supervisor should infer likely categories such as:

- web business system
- management platform
- algorithm experiment project
- data analysis project
- lightweight full-stack application

For v1, stack selection should be bounded to a curated set of templates or generation policies so the system stays predictable. The selection policy should prefer:

- `Python + FastAPI + React` for general full-stack software projects
- `Python` data-analysis layouts for analytics / modeling projects
- other stacks only when explicitly justified by the brief and supported by validation logic

## Error Handling

The system must surface failures clearly rather than silently continuing.

Failure classes:

- invalid upload or parse failure
- missing model configuration
- model request failure
- malformed generated files
- execution failure during install, test, build, or startup
- document quality failure
- review loop exhaustion

For each failure, the UI should show:

- stage name
- responsible agent
- last failing action
- key error output
- whether the system retried
- final resolution or stop reason

## Security and Safety Constraints

Because the application can execute generated commands locally, v1 must keep execution conservative.

Constraints:

- local single-user only
- execution confined to per-job workspace
- deny destructive shell operations by policy
- cap command duration and log size
- expose executed commands to the user in logs
- require explicit configuration for any future GitHub push automation

## Testing Strategy

The implementation should be designed for strong automated test coverage.

Test layers:

- parser tests for `.docx` extraction
- provider abstraction tests with mocked API responses
- supervisor orchestration tests
- agent handoff and retry logic tests
- workspace manager tests
- command execution policy tests
- web API tests
- selective end-to-end job tests with mocked models

Manual verification should cover:

- uploading a realistic design brief
- running one-click generation
- observing live job status
- inspecting generated repository and thesis files
- confirming Git initialization and commit history

## Open Questions Resolved for v1

- Product type: local single-user web app
- Input format: `Word (.docx)`
- Workflow: one-click, AI-led gating
- Domain focus: computer software plus data-analysis / algorithm projects
- Model access: `API key + base URL + model`
- Core architecture: supervisor plus specialized agents
- Code execution: included in v1
- Open-source goal: repository published to GitHub for local deployment by others

## Implementation Notes

The first implementation should favor a pragmatic local stack with:

- backend orchestration service
- lightweight frontend
- file-based local job storage
- clear internal module boundaries
- minimal external dependencies beyond document parsing, web serving, and LLM access

The UI does not need to become a full IDE in v1. It only needs enough affordances to configure, launch, observe, and inspect the generated outputs.
