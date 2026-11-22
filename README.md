<div align="center">

<img src="./public/brand/mountain-mark.png" alt="BauMind mountain logo" width="100" />

# BauMind

### AI-Powered Construction Estimation & BoQ Analysis

**From complex construction documents to structured estimates, explainable findings, and better-informed bids.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![AI](https://img.shields.io/badge/AI-OpenAI%20%2F%20Anthropic-315D47)](#ai-and-market-integrations) [![License](https://img.shields.io/badge/License-Non--Commercial%20%7C%20Permission%20Required-6B7542)](LICENSE)

**[Live Vercel Preview](https://baumind-hackathon-tumai-2026.vercel.app/)** · **[GitHub Repository](https://github.com/S1nflex/baumind_hackathon_tumai_2026)**

*Hackathon 2026 · Challenge A — AI-Powered Cost Estimation and Bill of Quantities Analysis*

</div>

---

## Overview

BauMind is a working hackathon prototype for reviewing and pricing construction **Bills of Quantities (BoQs / Leistungsverzeichnisse, LV)**. It turns supported construction documents into editable line items, checks them for inconsistencies, generates indicative unit-cost estimates, and helps an estimator examine suppliers and prepare a draft bid.

The application combines deterministic calculations with AI-assisted analysis. **AI-generated price estimates are useful starting values, not verified market quotations.** The source document stays unchanged while work is carried out on the editable project copy.

## The problem

Construction tenders contain detailed quantities, technical specifications, many line items, and requirements spread across different sections. Manually extracting the data, identifying conflicting descriptions, and assigning realistic prices takes considerable time. Missing information can lead to costly bidding mistakes.

BauMind gives an estimator one workspace for the document, its calculation, evidence-backed review findings, and available market references.

## Implemented features

The features below are present in the **BauMind v6.8 source code**. External integrations and some PDF capabilities require additional software or credentials.

| Area | What is implemented |
|---|---|
| **Document import** | PDF with a text layer, GAEB XML/GAEB 90, and XLSX import; extraction of position numbers (OZ), descriptions, quantities, units, and available prices. Optional OCR fallback for supported scans. |
| **Project workspace** | Project list, search, open, archive, restore and delete; editable project snapshots with revision checking. |
| **BoQ editor** | Search and filter positions, navigate imported sections, edit quantities and units, add positions, and adjust manual prices and cost components. |
| **Source traceability** | Original document references and a PDF source viewer with page navigation and text highlighting where available. |
| **Automated review** | Rule-based checks for missing data, possible duplicates, quantity/price inconsistencies, contradictory locations, and related scope issues. |
| **AI-assisted review** | Optional semantic review and scope analysis with findings linked to position references and source excerpts. |
| **Cost estimation** | EP/GP calculations, markups and VAT; AI-generated indicative **net unit-price ranges** and a provisional unit price using the lower end of the range when no stronger price source exists. |
| **Supplier research** | Google Shopping searches through **SerpAPI** when configured, supplier cards, source links when provided, and comparisons by compatible units, package quantities and known delivery cost. |
| **Market-price catalog** | Optional Supabase-backed price records, scraper/adapters, catalog matching, and a protected price-collection endpoint. |
| **AI assistant** | Contextual conversation about the current project; clarification questions and suggested edits shown for approval before changes are applied. |
| **Review & reporting** | Step-by-step finding resolution, an offer summary, and PDF export of the draft or finalized calculation. |
| **Interface** | German, English and Russian UI localization, responsive desktop/mobile layouts and a nature-inspired BauMind visual identity. |

### What a typical session looks like

See the [demo walkthrough](DEMO.md) for a quick tour of the prototype.

1. **Upload a BoQ** in PDF, GAEB, or XLSX format (up to 24 MB).
2. **Parse and structure** the positions and run rule-based checks.
3. Optionally run **AI review and indicative price estimation** with a configured AI provider and market source.
4. Inspect each position, supporting document excerpt, and any available supplier offers.
5. Edit the working estimate, resolve review findings, and inspect total costs.
6. Export a PDF draft; final approval is restricted while required reviews or prices are still incomplete.

The UI includes a **local-only import mode** for using the parser and rule-based calculation without external API credentials.

## AI and market integrations

BauMind supports the following server-side integrations:

- **OpenAI or Anthropic:** semantic review, AI-assisted market-cost ranges, and the contextual AI assistant. `OPENAI_MODEL` defaults to `gpt-5-mini` when OpenAI is configured.
- **SerpAPI:** live Google Shopping searches for possible supplier products and current offer pages.
- **Supabase:** optional market-price catalog, price-source records, and scraper results. **Project documents and project state are not stored in Supabase in this version.**

A complete AI-assisted import requires an AI provider and at least one configured market source. The application checks integration readiness; local-only import remains available without keys. A configured provider does **not** guarantee a matching supplier quote for every LV position.

**Price provenance matters:**

- An **AI estimate** is a provisional calculation reference. The lower estimate may appear in EP/GP until replaced by a more specific price; it must not be described as a verified dealer quote.
- A **supplier result** is shown only when an actual result is returned or a source record is available. Product prices may exclude installation, shipping or other scope items.
- **Confirmed, comparable offers** require appropriate unit and package matching plus known delivery information before they are used as confirmed supplier costs.

## Architecture

```text
User uploads PDF / GAEB / XLSX
                |
       Parsing & normalization
                |
      Structured BoQ project
                |
       +--------+---------+
       |                  |
  Rule-based checks   AI semantic / scope analysis (opt-in)
       |                  |
       +--------+---------+
                |
   Pricing & market enrichment
      |          |          |
   Manual     AI ranges   SerpAPI / Supabase offers
      +----------+----------+
                |
      Review, assistant, export
                |
   SQLite project snapshots / source PDFs
```

### Technology stack

| Layer | Technology |
|---|---|
| Application | Next.js 16 App Router, React 19, TypeScript |
| UI | CSS, Lucide icons, locally packaged brand assets, Manrope / Inter |
| Calculations | Decimal.js |
| Import | Poppler `pdftotext`, `exceljs`, `fast-xml-parser`; optional Tesseract OCR |
| PDF output | `pdf-lib` |
| AI | Vercel AI SDK, OpenAI and Anthropic providers |
| Price discovery | SerpAPI, custom scraper adapters and product matching |
| Market data | Supabase PostgreSQL (catalog only) |
| Projects / original files | Local SQLite (`node:sqlite`) |
| Testing | Node test runner, TypeScript type checking, integration and regression tests |

## Getting started locally

### Requirements

- **Node.js 22.13+** and npm.
- **Poppler** for extracting text from PDF files (`pdftotext`; `pdfinfo` is also useful).
- **Tesseract OCR**, optionally, for the supported OCR fallback on scanned PDFs.

```bash
# Clone the project
git clone https://github.com/S1nflex/baumind_hackathon_tumai_2026.git
cd baumind_hackathon_tumai_2026

# Install dependencies
npm ci

# Set server-side keys, only if using AI or live market sources
cp .env.example .env.local

# Launch locally
npm run dev
```

Open **http://127.0.0.1:3000**. On Debian/Ubuntu, `npm run setup:pdf` can install the PDF tools; `npm run setup:ocr` provides the optional OCR setup. See the shell scripts before running them on your own system.

### Environment variables

Set only the integrations you need in `.env.local` or your deployment provider's **server-side** environment settings:

```dotenv
# Choose a provider (Anthropic requires ANTHROPIC_MODEL as well)
BAUMIND_AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5-mini
# ANTHROPIC_API_KEY=
# ANTHROPIC_MODEL=

# Live retailer search
SERPAPI_API_KEY=your_serpapi_api_key

# Optional existing market catalog
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_server_side_secret

# Optional protected scheduled scraping
# CRON_SECRET=your_random_secret
```

Never commit `.env.local` or expose secret keys using `NEXT_PUBLIC_`. The Supabase catalog requires the matching SQL migrations in `supabase/migrations/`; an empty database does not provide real supplier offers. A PostgreSQL database password is **not** required by the current Supabase REST catalog integration.

For local integration diagnostics, use **Integrationen** in the application and `npm run doctor`. On supported private local deployments, `npm run setup:integrations` configures the protected local settings flow.

### Test and verify

```bash
npm run doctor
npm run typecheck
npm test
npm run build
# Or run all checks in sequence:
npm run verify
```

Tests cover parsing, BoQ calculations, rule findings, supplier comparison, scraper adapters, integration readiness, and responsive-layout rules. Successful unit tests do not guarantee that paid third-party APIs are reachable or that a production deployment supports all local system dependencies.

## Live preview and deployment

**Live preview:** **https://baumind-hackathon-tumai-2026.vercel.app/**

The public Vercel address is provided for demonstration. **This does not mean the complete local workflow is production-ready on Vercel.** The current implementation uses a writable **local SQLite database** for projects and originals, and the PDF importer invokes a system-installed Poppler binary.

Important deployment constraints:

- Vercel functions do **not** provide a persistent shared filesystem suitable for this SQLite project store. An ephemeral `/tmp` database can lose projects between invocations.
- The current preview option (`BAUMIND_PREVIEW=1`) uses a browser cookie to separate temporary workspaces; **it is not a full authentication and authorization system**.
- Production is deliberately locked by default unless the configured access mode allows it. `BAUMIND_SINGLE_USER=1` is **not appropriate for a publicly accessible shared site**.
- Poppler/Tesseract availability and long-running AI import limits must be addressed separately for a robust serverless deployment.

For durable, multi-user production use, the project store and source-file storage would need a persistent backend and appropriate authentication. These are **not implemented** as part of v6.8.

## Known limitations

- PDF extraction depends on document structure; some layouts, scans, and unusual tables may fail or require OCR.
- Supplier searches may return zero relevant results, and no minimum number of vendors is guaranteed.
- AI-generated prices are estimates based on supplied scope, **not validated quotations**; some positions may be omitted or have uncertain units and scope.
- Integrations can fail due to API credentials, permissions, credits, response format or rate limits.
- Project data currently uses local SQLite; there is no finished team-account, role-based-access, or durable multi-tenant hosting system.
- The software is a hackathon prototype, not a replacement for contractual, engineering, or professional estimation review.

## Challenge and team

Developed for **Hackathon 2026 — Challenge A: AI-Powered Cost Estimation and BoQ Analysis**.

BauMind was built collaboratively. Individual technical contributions and their authorship can be inspected in the [repository's Git history](https://github.com/S1nflex/baumind_hackathon_tumai_2026/commits). No individual author's rights are transferred by this README.

The challenge's dataset may be available separately from the organizers: [Challenge A dataset](https://drive.google.com/drive/folders/1wS4UMVghBL8T5opmZ2UBmBu0kr6U8zIB?usp=sharing). Dataset content is **not** included in this repository by default and remains subject to its own terms.

## License and commercial use

**BauMind is source-available for non-commercial purposes; it is not released under an OSI-approved open-source license.** Commercial use requires **prior express written permission from the applicable copyright holder(s)**. See **[LICENSE](LICENSE)** for the complete conditions and the permission process.

This project contains third-party libraries, fonts and potentially third-party visual materials governed by their respective licenses. The BauMind license does not override those rights. Before applying the license to team-owned work, all relevant contributors should agree to its terms.

---

<div align="center">

**BauMind — Smarter Estimates. Fewer Risks. Better Bids.**

</div>
