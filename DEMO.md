# Bauton LV · Hackathon

## Problem

An incorrect item reference, a service calculated twice, or an overlooked electrical connection can distort an entire quotation. The error is often found between an item, its description, and another section.

## Solution · What makes it fundamentally different?

**A verifiable calculation based on the original BOQ.** Every flagged discrepancy shows the location, evidence, and next question. The decision remains linked to the affected line. A confirmed decision can change the calculated quantity, supplier selection, or price. The verifiable original, proposal, and released version remain retrievable.

**One sentence for the jury:** Bauton turns a bill of quantities into a verifiable quotation in which every major change can be traced back to its source.

## 90-Second Demo

| Time | Action | What the jury sees |
| --- | --- | --- |
| 0:00–0:20 | Upload `LV_12_Dachabdichtung.pdf` and open **Review**. | 33 original items. At **6.1.80**, the evidence links to the original. Item **6.2.180** also specifies an installation location that differs from the section. |
| 0:20–0:45 | **Projects → Open Example**. Click the price for **6.2.150** and select the second supplier. | EUR 622.80 or EUR 643.50 for four units, including shipping. The quotation is recalculated immediately. Both prices are marked as practice data. |
| 0:45–1:05 | Open the surcharge suggestion for **6.1.40**. In the **Suggestions** filter, view the electrical line. | 25% remains preset. The example reference allows comparison with 30%. The electrical connection is suggested and confirmed before calculation. |
| 1:05–1:30 | Open the prepared, released practice project in the archive and load **Submission BOQ**. | Completed price lines, cost overview, final total, and documented review points. |

## Proof

Measured against the provided Challenge A dataset. Four PDFs were matched against GAEB files from the same project. Item-number formatting and equivalent units were normalized before comparison.

| Test | Result |
| --- | --- |
| Item numbers, quantities, and units | 731/731 per field |
| Unit prices and total prices in the priced PDF/GAEB pair | 274/274 items |
| Sum of imported total prices from `Abgabe LV.pdf` | EUR 835,804.22 net, identical to the printed summary line |
| Control cases in the real roof BOQ | Detected two references to missing item number 6.1.80 and one differing installation location |
| Broad import run without complete reference annotations | 34/34 PDFs opened, 2,360 items extracted, and three quantities or units marked as incomplete |

The comparison measures import accuracy across the four referenced pairs. Three example test cases demonstrate the traceability of the rules. Separately annotated test cases across multiple trades are required to determine the risk-review hit rate.

## Structure of the Original Files

**Abgabe LV.pdf** contains 91 PDF pages. Pages 1–2 contain special contractual terms. Pages 3–6 show the pricing determination in forms 221 and 222. The offer letter, suitability declaration, and subcontractor list follow on pages 7–13. The BOQ's own numbering begins on PDF page 14, with units, preliminary notes, section titles, and numbered services. PDF page 91 is the summary: EUR 835,804.22 net, EUR 158,802.80 VAT, and EUR 994,607.02 gross.

**LV_12_Dachabdichtung.pdf** is an unpriced BOQ with ten service pages and a summary on page 11. A section describes the building component. An item number identifies the individual service. Short and long text define execution and responsibilities. Quantity and unit are the basis for the unit price and total price. The two references to 6.1.80 appear on pages 1 and 2. The differing installation location for 6.2.180 appears on page 8.

Preliminary notes and dependencies deserve particular attention during professional review. A service described as included may be calculated twice if an additional price line is added. A stated preceding or subsequent service may belong to a different trade. The original file remains attached to the project for this clarification.
