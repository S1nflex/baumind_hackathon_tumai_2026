# Bauton LV

An estimate workshop for bills of quantities. Bauton imports one BOQ per project, displays verifiable anomalies on the original items, and guides users from supplier comparison to a released quotation.

## Start

Prerequisites are Node.js 22.13+ and Poppler for PDFs with a text layer. On macOS, install Poppler with `brew install poppler`; on Debian/Ubuntu, use `sudo apt-get install poppler-utils`.

```sh
npm ci
npm run dev
```

At [localhost:3000](http://127.0.0.1:3000), **Open Example** opens the immediately usable example. For a custom project, upload a PDF, GAEB, or XLSX file. SQLite stores projects and original files locally in `.data/bauton.sqlite`. By default, the application binds to the local address and does not require a user login.

## Shared Test Preview

For an HTTPS preview with separate projects per browser, set `BAUTON_PREVIEW=1` and use `BAUTON_DB` to specify a separate, empty SQLite file. This mode assigns projects, original files, and saved crews to a browser cookie. It is suitable for a test link where each person starts with an individual practice project.

## Workflow

1. **Import.** Use a text-based PDF, GAEB XML (.x81, .x83–.x86, .xml), GAEB 90 (.d81, .d83–.d86), or XLSX with columns for item number, description, quantity, and unit. Search the table or filter by section, test case, price status, and source. For PDFs, the item view links back to the original page.
2. **Review.** Rules flag missing item references, formal fields, calculation discrepancies, possible duplicates, and contradictory installation locations. An alert shows the evidence and a clarification question. When a duplicate is confirmed, the original line remains visible and the excluded line is not calculated.
3. **Calculate.** Add custom material, labor, or crew lines. Suggested lines are marked and are not calculated until confirmed. Unit prices come from an existing quotation, entered costs, or a selected supplier. Comparable supplier offers are sorted by the net cost of the required packages, including shipping. Unclear package sizes or delivery costs require confirmation.
4. **Compare surcharges.** The default is a 25% surcharge on recorded direct costs. An item with an applicable, documented market reference may suggest a higher surcharge. The estimator decides and may reject any suggestion.
5. **Release.** Resolve open review points and missing prices for active items before release. The quotation is then available in the archive and as a PDF. A crew used in two released projects is suggested for suitable new projects.

## Prices and AI

The default mode works without keys. Practice values are identified as training data. For an identified catalog item, linked price examples may be available for manual review. The labor value used for electrical suggestions is the average labor cost in the German construction industry in 2025, published by Destatis (EUR 39.60/hour). Hours and specific crew prices can be entered or corrected. [Destatis](https://genesis.destatis.de/datenbank/online/statistic/62431/table/62431-0001)

For online prices or semantic review, copy `.env.example` to `.env.local` and configure the relevant options.

- `SERPAPI_API_KEY` enables Google Shopping search from the item view. During import, search can be started for up to eight recognized article numbers. Article queries and, if applicable, the postal code are sent. Search results are snapshots. [Google Shopping API](https://serpapi.com/google-shopping-api)
- `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` enable additional semantic review. The import option sends descriptions of up to 240 items to Anthropic and requests citation-ready evidence. Rule-based checks run for all imported items.

## Handover and Evidence

The submission BOQ export contains bidder and project information, net/tax/gross amounts, a cost overview, priced items with item number, unit, unit price, and total price, and the review note. The structure follows the dataset. For a tender with binding VHB forms, the required original forms and appendices must also be completed. Scans without a text layer require OCR before import.

```sh
npm test
npm run typecheck
npm run build
npm run benchmark -- "/Path/to/Challenge A Dataset"
```

For the benchmark, the dataset is read locally and is not included in the repository. Details and the presentation procedure are available in [DEMO.md](DEMO.md).
