<div align="center">

# BauMind — AI-Powered Construction Intelligence

### Intelligent Estimation, Tender Management & Risk Analysis

*An AI-powered construction management platform for smarter bidding, automated Bill of Quantities analysis, and intelligent project workflows.*

<p>
  <img src="https://img.shields.io/badge/Status-In%20Development-F59E0B" alt="Development Status">
  <img src="https://img.shields.io/badge/Next.js-App%20Router-black?logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/React-Frontend-149ECA?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-Language-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/AI-Powered%20Intelligence-8B5CF6" alt="AI">
  <img src="https://img.shields.io/badge/Industry-Construction-2563EB" alt="Construction">
</p>

**Smarter Estimates. Fewer Risks. Better Bids.**

*Hackathon 2026 — Challenge A: AI-Powered Cost Estimation and BoQ Analysis*

</div>

---

## Contents

- [About the Project](#about-the-project)
- [Problem Statement](#problem-statement)
- [Our Solution](#our-solution)
- [Product Capabilities](#product-capabilities)
- [AI-Powered BoQ Intelligence](#ai-powered-boq-intelligence)
- [Core Features](#core-features)
- [How It Works](#how-it-works)
- [Target Users](#target-users)
- [Challenge Milestones](#challenge-milestones)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Dataset](#dataset)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Team](#team)
- [License](#license)

---

## About the Project

**BauMind** is an AI-powered construction intelligence platform designed to simplify and optimize construction estimation, tender management, and project workflows.

Construction companies regularly process large volumes of technical documentation, Bills of Quantities (BoQs), pricing information, and project specifications.

These documents often contain thousands of individual positions, multiple cost groups, complex dependencies, and potentially costly inconsistencies.

Traditional estimation workflows require significant manual effort and leave limited time for systematic risk analysis.

BauMind combines **construction project management, intelligent document processing, automated validation, and AI-assisted analysis** in a unified digital workspace.

The platform aims to help construction professionals:

- Organize construction projects and tender documentation.
- Import and manage complex Bills of Quantities.
- Automate repetitive estimation workflows.
- Detect errors and inconsistencies before bidding.
- Identify potential financial and contractual risks.
- Recognize change order opportunities.
- Improve collaboration and decision-making.
- Generate structured, actionable risk reports.

The project is being developed as part of **Challenge A: AI-Powered Cost Estimation and BoQ Analysis**.

> **Development Status:** BauMind is currently under development. The capabilities described in this README represent the intended product scope and planned architecture. Individual features may not yet be implemented.

---

## Problem Statement

Construction estimation is a complex, document-intensive process.

A single tender can include thousands of line items distributed across multiple trades, specifications, drawings, and pricing documents.

Estimators must manually analyze quantities, descriptions, dependencies, and contractual requirements before preparing competitive offers.

This process introduces several challenges:

| Challenge | Business Impact |
|---|---|
| **Large Document Volumes** | Thousands of BoQ positions require extensive manual review. |
| **Fragmented Information** | Documents, estimates, and project information are distributed across different systems. |
| **Calculation Errors** | Incorrect quantities, units, or calculations can distort project costs. |
| **Ambiguous Specifications** | Unclear scope descriptions increase uncertainty and contractual risk. |
| **Cross-Trade Dependencies** | Contradictions between different construction trades may remain unnoticed. |
| **Missed Change Orders** | Potential additional work and cost recovery opportunities are overlooked. |
| **Limited Historical Insights** | Knowledge from previous projects is not systematically reused. |
| **Inefficient Collaboration** | Estimators and project teams lack a unified review environment. |

### The Central Challenge

**How can construction companies transform complex tender documentation into reliable estimates, actionable insights, and better bidding decisions?**

BauMind addresses this challenge by connecting structured construction data with intelligent automation and AI-assisted risk detection.

---

## Our Solution

BauMind provides a centralized workspace for managing construction tenders, analyzing Bills of Quantities, and supporting estimation decisions.

Rather than treating BoQs as static documents, the platform aims to transform them into structured, searchable, and analyzable project information.

The system is designed around five fundamental principles.

### 01 — Centralized Construction Workspace

Bring projects, tenders, documents, estimates, and related workflows together in one environment.

### 02 — Intelligent Document Processing

Convert complex PDF, GAEB, and Excel documents into normalized, machine-readable construction data.

### 03 — Automated Quality Assurance

Detect missing information, calculation errors, contradictory specifications, and unusual quantities before they affect project execution.

### 04 — AI-Powered Risk Intelligence

Identify potentially problematic scope descriptions, financial risks, and opportunities for change orders.

### 05 — Human-Centered Decision Support

Provide estimators with transparent findings, evidence, severity assessments, and recommended next actions.

**BauMind is designed to assist construction professionals, not replace their expertise.**

---

## Product Capabilities

BauMind is envisioned as an integrated construction management and estimation platform.

Its primary capabilities are organized into interconnected workspaces.

### 1. Project Management

A centralized environment for organizing construction projects and their related information.

Planned capabilities include:

- Project overview and status tracking.
- Project-specific documentation.
- Centralized tender information.
- Project organization and categorization.
- Access to associated estimates and BoQs.
- Collaboration across project teams.

### 2. Tender Management

A structured workspace for managing construction bidding processes.

Planned capabilities include:

- Tender creation and organization.
- Tender document management.
- Bid preparation workflows.
- Deadline and status tracking.
- Structured review of tender requirements.
- Consolidated estimation information.

### 3. Bill of Quantities Management

A dedicated workspace for importing, navigating, and analyzing construction BoQs.

Target capabilities include:

- PDF, GAEB, and XLSX import.
- Structured extraction of BoQ positions.
- Hierarchical organization of cost groups and trades.
- Quantity and unit management.
- Position-based document navigation.
- Search, filtering, and categorization.
- Source-document traceability.

### 4. Estimation & Cost Management

Tools for supporting construction cost estimation and bid preparation.

Planned capabilities include:

- Quantity and unit-price management.
- Cost calculations and summaries.
- Position-level pricing information.
- Markup and pricing adjustments.
- Cost-group aggregation.
- Estimation review and validation.
- Optional historical price comparisons.

### 5. AI Risk Intelligence

An intelligent analysis environment for detecting errors and identifying potential financial exposure.

Core objectives include:

- Automated error detection.
- Quantity plausibility checks.
- Semantic analysis of construction descriptions.
- Cross-position contradiction detection.
- Risk scoring and prioritization.
- Change order potential identification.
- AI-assisted explanations and recommendations.

### 6. Reporting & Collaboration

A unified interface for reviewing findings and supporting team decisions.

Planned capabilities include:

- Prioritized risk reports.
- Position-specific findings.
- Review status management.
- Structured issue tracking.
- Evidence-based recommendations.
- Collaborative review workflows.
- Exportable analysis summaries.

---

## AI-Powered BoQ Intelligence

The central intelligence component of BauMind focuses on automated analysis of construction Bills of Quantities.

Its purpose is to identify potential errors, inconsistencies, and financial risks before an offer is submitted.

### 01 — Intelligent Document Parsing

Construction documents may contain extensive hierarchical structures, inconsistent formatting, complex tables, and technical descriptions.

BauMind aims to support three primary input formats:

| Format | Description |
|---|---|
| **PDF** | Extract structured information from construction tender documents. |
| **GAEB** | Read standardized German construction exchange formats. |
| **Excel** | Import spreadsheet-based Bills of Quantities and pricing information. |

The extraction process aims to identify:

- Position numbers.
- Item descriptions.
- Quantities.
- Measurement units.
- Unit prices, when available.
- Total prices, when available.
- Cost groups.
- Trade classifications.
- Document hierarchy.
- Source references.

### 02 — Automated Error Detection

**Error detection is the highest-priority objective of the hackathon challenge.**

BauMind aims to identify several categories of potential errors.

| Error Category | Description |
|---|---|
| **Missing Information** | Incomplete positions, missing quantities, or unspecified requirements. |
| **Ambiguous Descriptions** | Vague or insufficiently defined construction work. |
| **Contradictions** | Conflicting requirements across positions or trades. |
| **Typographical Errors** | Suspicious terminology, inconsistent wording, or potential typing mistakes. |
| **Quantity Anomalies** | Unusual or implausible quantities requiring verification. |
| **Calculation Errors** | Inconsistent arithmetic, prices, or totals. |
| **Unit Inconsistencies** | Potentially incorrect or incompatible measurement units. |

The system should distinguish between confirmed rule-based inconsistencies and potential issues requiring professional review.

### 03 — Risk Assessment

Not every detected issue represents the same level of risk.

BauMind aims to evaluate findings according to their potential impact and uncertainty.

Possible risk indicators include:

- Incomplete scope definitions.
- Unusual quantities.
- Contradictory requirements.
- Missing technical specifications.
- Cross-trade dependencies.
- Unclear contractual obligations.
- Potential pricing uncertainty.

Findings may be organized into severity categories:

| Severity | Meaning |
|---|---|
| **Low** | Minor inconsistency or informational warning. |
| **Medium** | Potential issue requiring estimator verification. |
| **High** | Significant uncertainty or potentially costly inconsistency. |
| **Critical** | Serious issue requiring immediate attention before bidding. |

Risk assessments are intended as decision-support signals rather than definitive contractual or financial conclusions.

### 04 — Change Order Intelligence

Construction projects frequently encounter additional costs when the original scope of work is incomplete, ambiguous, or inconsistent.

BauMind aims to identify potential **Nachtragspotenzial** during the bidding process.

Analysis may consider:

- Missing scope descriptions.
- Unclear execution requirements.
- Contradictions between BoQ positions.
- Potentially omitted work.
- Quantity discrepancies.
- Dependencies across construction trades.

The objective is to highlight situations that may require clarification or further contractual assessment.

### 05 — AI-Assisted Findings

Each detected issue should be presented as a structured, explainable finding.

| Field | Description |
|---|---|
| **Position Reference** | Identifies the affected BoQ position. |
| **Issue Category** | Classifies the detected problem. |
| **Severity** | Indicates the estimated risk level. |
| **Description** | Explains the potential inconsistency. |
| **Source Evidence** | References the relevant document content. |
| **Recommendation** | Suggests an appropriate follow-up action. |
| **Review Status** | Tracks whether the issue has been reviewed. |

This approach prioritizes transparency and practical usefulness over opaque AI-generated conclusions.

### 06 — Historical Cost Intelligence

Optional future functionality may incorporate historical construction project data.

Potential applications include:

- Comparing estimated and actual costs.
- Identifying historical pricing patterns.
- Reviewing previous change orders.
- Suggesting unit-price benchmarks.
- Supporting markup decisions.

These capabilities depend on the availability and quality of suitable historical datasets.

### 07 — What-if Analysis

BauMind may support scenario-based estimation analysis.

Potential scenarios include:

- Changes in material prices.
- Alternative construction methods.
- Quantity adjustments.
- Different markup strategies.
- Changes in estimated project costs.

The goal is to help estimators understand how different assumptions affect overall bidding decisions.

---

## Core Features

| Module | Functionality | Priority |
|---|---|---|
| **Project Workspace** | Centralized project and tender organization. | Product Foundation |
| **Tender Management** | Bid preparation and document workflows. | Product Foundation |
| **BoQ Import** | PDF, GAEB, and XLSX document ingestion. | Essential |
| **Structured Extraction** | Normalize positions, quantities, units, and descriptions. | Essential |
| **Error Detection Engine** | Identify missing information, contradictions, and suspicious values. | **Highest** |
| **Plausibility Validation** | Perform arithmetic, structural, and quantity checks. | High |
| **Risk Assessment** | Classify and prioritize potential project risks. | High |
| **Change Order Detection** | Identify possible additional-work opportunities. | High |
| **Risk Dashboard** | Display findings, severity levels, and source references. | Essential |
| **Review Workflow** | Support human verification and issue tracking. | High |
| **Historical Data Analysis** | Use previous projects for estimation insights. | Optional |
| **What-if Simulation** | Evaluate alternative pricing and cost scenarios. | Optional |

---

## How It Works

BauMind is designed around a structured processing pipeline.

```text
                 CONSTRUCTION PROJECT
                          |
              +-----------v-----------+
              |   BauMind Workspace   |
              |   Projects & Tenders  |
              +-----------+-----------+
                          |
              +-----------v-----------+
              |    Document Import    |
              |    PDF / GAEB / XLSX  |
              +-----------+-----------+
                          |
              +-----------v-----------+
              | Parsing & Extraction  |
              | Positions / Quantities|
              | Units / Descriptions  |
              +-----------+-----------+
                          |
              +-----------v-----------+
              | Data Normalization    |
              | Structured BoQ Model  |
              +-----------+-----------+
                          |
             +------------+------------+
             |                         |
  +----------v----------+   +----------v----------+
  | Deterministic       |   | AI-Assisted         |
  | Validation Engine   |   | Semantic Analysis   |
  |                     |   |                     |
  | Arithmetic          |   | Ambiguous Scope     |
  | Units               |   | Contradictions      |
  | Structural Checks   |   | Contextual Risks    |
  +----------+----------+   +----------+----------+
             |                         |
             +------------+------------+
                          |
              +-----------v-----------+
              | Risk Classification   |
              | & Findings Engine     |
              +-----------+-----------+
                          |
              +-----------v-----------+
              | Estimator Dashboard   |
              | Findings / Evidence   |
              | Recommendations       |
              +-----------+-----------+
                          |
              +-----------v-----------+
              | Review & Risk Report  |
              +-----------------------+
```

The architecture separates deterministic validation from AI-assisted semantic analysis.

This is particularly important for construction estimation, where numerical correctness, source traceability, and explainability are essential.

---

## Target Users

BauMind is designed for professionals involved in construction estimation, bidding, and project management.

| User | Primary Benefit |
|---|---|
| **Construction Estimators (Kalkulatoren)** | Reduce manual BoQ review and identify estimation risks. |
| **Bid Managers** | Coordinate tender preparation and improve offer quality. |
| **Project Managers** | Identify scope uncertainty and potential execution disputes. |
| **Construction Companies** | Centralize estimation workflows and project information. |
| **Commercial Teams** | Improve visibility into project costs and financial exposure. |

### Example Workflow

An estimator receives a tender containing several thousand BoQ positions.

Instead of manually reviewing every position from the beginning, the estimator can use BauMind to:

1. Upload the tender documentation.
2. Convert the BoQ into structured data.
3. Run automated validation and AI-assisted analysis.
4. Review prioritized errors and risk indicators.
5. Inspect the original evidence for each finding.
6. Clarify questionable positions.
7. Prepare a more informed bid.

**The intended result is a faster, more transparent, and more reliable estimation process.**

---

## Challenge Milestones

The development roadmap follows the official hackathon requirements.

| Phase | Milestone | Objective |
|---|---|---|
| **01** | BoQ Parsing | Import and structure complex construction documents. |
| **02** | Error Detection | Identify missing items, contradictions, typos, and unclear descriptions. |
| **03** | Risk Intelligence | Evaluate risk levels and detect potential change orders. |
| **04** | Historical Data | Integrate previous project information where available. |
| **05** | What-if Analysis | Evaluate material price changes and alternative scenarios. |

### Hackathon Priorities

The initial prototype prioritizes:

**1. Reliable Document Extraction**

Ensure construction BoQs can be transformed into structured information without silently losing critical fields.

**2. Meaningful Error Detection**

Demonstrate the ability to identify realistic problems in actual BoQ positions.

**3. Explainable Risk Analysis**

Provide evidence-based findings that estimators can verify and act upon.

**4. Practical User Experience**

Deliver a functional web application with document upload, structured navigation, and a clear risk report.

### Expected Deliverable

A working prototype demonstrating:

**Document Upload → Structured BoQ → Automated Analysis → Risk Report**

The final presentation should explain the product from an estimator's perspective and demonstrate how BauMind improves the bidding process.

---

## System Architecture

BauMind is designed around a modular application architecture.

The system separates six primary responsibilities.

### 1. Application Layer

Provides the user interface for construction projects, tenders, estimates, documents, and analysis results.

### 2. Document Processing Layer

Handles document ingestion and format-specific extraction for PDF, GAEB, and XLSX files.

### 3. Structured Data Layer

Normalizes extracted information into a consistent internal representation of Bills of Quantities.

### 4. Validation Layer

Executes deterministic checks for arithmetic, structural consistency, quantities, and measurement units.

### 5. AI Intelligence Layer

Performs contextual analysis of construction descriptions, ambiguous requirements, contradictions, and potential project risks.

### 6. Reporting Layer

Transforms validation results and AI findings into structured, reviewable risk reports.

### Architectural Principles

| Principle | Implementation Goal |
|---|---|
| **Modularity** | Separate document processing, validation, AI analysis, and presentation. |
| **Data Integrity** | Preserve original document values and source references. |
| **Deterministic Calculations** | Use explicit algorithms for arithmetic and unit validation. |
| **Explainable AI** | Associate findings with supporting evidence and clear explanations. |
| **Human Oversight** | Require professional review for uncertain or consequential findings. |
| **Scalability** | Support large BoQs containing thousands of positions. |
| **Maintainability** | Keep processing components independently testable. |

---

## Technology Stack

The initial technology foundation includes:

| Category | Technology |
|---|---|
| **Framework** | Next.js (App Router) |
| **Frontend** | React |
| **Language** | TypeScript |
| **Styling** | To be determined |
| **Document Processing** | To be determined |
| **AI Integration** | To be determined |
| **Database** | To be determined |
| **File Storage** | To be determined |
| **Deployment** | To be determined |
| **Testing** | To be determined |

Additional technologies and integrations will be documented as implementation decisions are finalized.

---

## Dataset

The challenge provides anonymized construction Bills of Quantities covering different trades and project sizes.

### Official Challenge Dataset

[Google Drive — Challenge A Dataset](https://drive.google.com/drive/folders/1wS4UMVghBL8T5opmZ2UBmBu0kr6U8zIB?usp=sharing)

The challenge describes several potential data categories:

- Construction Bills of Quantities.
- GAEB files.
- PDF and Excel documents.
- Historical project data, if available.
- Examples of faulty BoQ positions.
- Unit-price catalogs or benchmarks, if available.

The availability and exact structure of individual files must be verified during development.

### Data Quality

Reliable BoQ analysis depends on preserving the relationship between extracted information and its original source.

The system should aim to maintain:

- Document identifiers.
- Original position numbers.
- Hierarchical BoQ structure.
- Quantities and measurement units.
- Original item descriptions.
- Pricing information, where available.
- References to source files.
- Traceability of detected findings.

---

## Getting Started

This branch includes the Bauton LV prototype. See the [prototype guide](BAUTON.md) for requirements and [demo notes](DEMO.md) for the walkthrough and validation results. Uploads accept PDF, Excel (.xlsx), and GAEB. The PDF importer requires Poppler, and the application requires Node.js 22.13 or newer.

### Prerequisites

- Node.js
- npm
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. Install Dependencies

```bash
npm ci
```

### 3. Configure Environment Variables

Create a local environment file when required by the implementation:

```bash
cp .env.example .env.local
```

Configure the necessary values according to the project's environment template.

Never commit credentials or private API keys to the repository.

### 4. Start the Development Server

```bash
npm run dev
```

Open:

**http://localhost:3000**

The development server uses this address by default unless a different port is configured.

---

## Development Workflow

BauMind follows a feature-branch development workflow to support parallel implementation.

### Create a Feature Branch

```bash
git checkout -b feature/your-feature
```

### Commit Changes

```bash
git add .
git commit -m "feat: describe your changes"
```

### Push the Branch

```bash
git push -u origin feature/your-feature
```

### Pull Request Workflow

Contributors should:

1. Implement features in dedicated branches.
2. Keep commits focused and descriptive.
3. Test changes before submission.
4. Open a pull request targeting `main`.
5. Review changes before merging.

### Commit Naming

Recommended commit prefixes:

| Prefix | Purpose |
|---|---|
| `feat:` | New functionality |
| `fix:` | Bug fixes |
| `refactor:` | Code restructuring |
| `docs:` | Documentation updates |
| `test:` | Tests |
| `chore:` | Maintenance and configuration |

---

## Team

BauMind is developed by a collaborative hackathon team.

Team members, responsibilities, and individual contributions will be documented as development progresses.

---

## License

See the [LICENSE](LICENSE) file for the applicable licensing terms.

All third-party libraries, frameworks, and external resources remain subject to their respective licenses.

---

<div align="center">

# BauMind

### Smarter Estimates. Fewer Risks. Better Bids.

**AI-Powered Construction Intelligence**

*Transforming construction complexity into actionable intelligence.*

**Hackathon 2026**

</div>
