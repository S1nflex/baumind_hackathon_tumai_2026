# BauMind · Hackathon

## Problem

Ein falscher Positionsverweis, eine doppelt kalkulierte Leistung oder ein übersehener Elektroanschluss kann ein ganzes Angebot verzerren. Der Fehler steckt häufig zwischen der Position, ihrer Leistungsbeschreibung und einem anderen Abschnitt.

## Solution · What makes it fundamentally different?

**Eine prüfbare Kalkulation aus dem Original-LV.** Jede markierte Abweichung zeigt Stelle, Beleg und nächste Frage. Die Entscheidung bleibt mit der betroffenen Zeile verknüpft. Eine bestätigte Entscheidung kann die kalkulierte Menge, Lieferantenauswahl oder den Preis ändern. Das prüfbare Original, der Vorschlag und der freigegebene Stand bleiben wiederauffindbar.

**Ein Satz für die Jury:** BauMind macht aus einem Leistungsverzeichnis ein überprüfbares Angebot, in dem sich jede wesentliche Änderung bis zur Quelle zurückverfolgen lässt.

## 90 Sekunden Demo

| Zeit | Aktion | Was die Jury sieht |
| --- | --- | --- |
| 0:00–0:20 | `LV_12_Dachabdichtung.pdf` hochladen und **Prüfung** öffnen. | 33 Originalpositionen. Bei **6.1.80** führt der Beleg zum Original. Außerdem nennt die Position **6.2.180** einen Einbauort, der vom Abschnitt abweicht. |
| 0:20–0:45 | **Projekte → Beispiel öffnen**. Bei **6.2.150** auf den Preis klicken und den zweiten Lieferanten wählen. | 622,80 € bzw. 643,50 € für vier Stück inkl. Versand. Das Angebot wird sofort neu berechnet. Beide Preise sind als Übung gekennzeichnet. |
| 0:45–1:05 | Bei **6.1.40** den Zuschlagsvorschlag öffnen. Im Filter **Vorschläge** die Elektro-Zeile ansehen. | 25 % bleiben voreingestellt. Die Beispielreferenz erlaubt den Vergleich mit 30 %. Der Elektro-Anschluss wird vorgeschlagen und vor der Berechnung bestätigt. |
| 1:05–1:30 | Das vorbereitete freigegebene Übungsprojekt aus dem Archiv öffnen und **Abgabe LV** laden. | Ausgefüllte Preiszeilen, Kostenübersicht, Endsumme und dokumentierte Prüfpunkte. |

## Proof

Gemessen auf dem übergebenen Challenge-A-Datensatz. Vier PDFs wurden anhand von GAEB-Dateien desselben Projekts abgeglichen. OZ-Formatierung und gleichbedeutende Einheiten wurden vor dem Vergleich normalisiert.

| Prüfung | Ergebnis |
| --- | --- |
| OZ, Mengen und Einheiten | 731/731 je Feld |
| Einheitspreise und Gesamtpreise im bepreisten PDF/GAEB-Paar | 274/274 Positionen |
| Summe der importierten GP aus `Abgabe LV.pdf` | 835.804,22 € netto, identisch mit der gedruckten Summenzeile |
| Kontrollfälle im realen Dach-LV | Zwei Verweise auf die fehlende OZ 6.1.80 und ein abweichender Einbauort erkannt |
| Breiter Importlauf ohne vollständige Referenzannotation | 34/34 PDFs geöffnet, 2.360 Positionen extrahiert, drei Mengen oder Einheiten als unvollständig markiert |

Der Abgleich misst Importgenauigkeit in den vier referenzierten Paaren. Drei exemplarische Prüffälle zeigen die Nachvollziehbarkeit der Regeln. Für eine Trefferquote der Risikoprüfung braucht es separat annotierte Prüffälle über mehrere Gewerke.

## Aufbau der Originaldateien

**Abgabe LV.pdf** besteht aus 91 PDF-Seiten. Auf Seite 1–2 stehen besondere Vertragsbedingungen. Seite 3–6 zeigen die Preisermittlung in den Formblättern 221 und 222. Es folgen Angebotsschreiben, Eignungserklärung und Nachunternehmerverzeichnis auf Seite 7–13. Ab PDF-Seite 14 beginnt die eigene Nummerierung des LV mit Einheiten, Vorbemerkungen, Abschnittstiteln und nummerierten Leistungen. PDF-Seite 91 ist die Zusammenstellung mit 835.804,22 € netto, 158.802,80 € Umsatzsteuer und 994.607,02 € brutto.

**LV_12_Dachabdichtung.pdf** ist ein unbepreistes LV mit zehn Leistungsseiten und einer Zusammenstellung auf Seite 11. Ein Abschnitt beschreibt den Gebäudeteil. Eine OZ identifiziert die Einzelleistung. Kurz- und Langtext bestimmen Ausführung und Zuständigkeiten. Menge und Mengeneinheit sind die Grundlage für EP und GP. Die beiden Verweise auf 6.1.80 stehen auf den Seiten 1 und 2. Der abweichende Einbauort bei 6.2.180 steht auf Seite 8.

Vorbemerkungen und Abhängigkeiten verdienen bei der fachlichen Prüfung eigene Aufmerksamkeit. Eine als enthalten beschriebene Leistung kann bei einer zusätzlichen Preiszeile doppelt kalkuliert werden. Eine genannte Vor- oder Folgeleistung kann zu einem anderen Gewerk gehören. Die Originaldatei bleibt für diese Klärung am Projekt erhalten.
