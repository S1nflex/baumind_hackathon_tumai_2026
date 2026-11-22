# BauMind

Angebotswerkstatt für Leistungsverzeichnisse. BauMind importiert ein LV pro Projekt, zeigt prüfbare Auffälligkeiten an den Originalpositionen und führt vom Lieferantenvergleich bis zum freigegebenen Angebot.

## Start

Voraussetzungen sind Node.js 22.13+ und Poppler für PDFs mit Textschicht. Poppler lässt sich auf macOS mit `brew install poppler` und auf Debian/Ubuntu mit `sudo apt-get install poppler-utils` installieren.

```sh
npm ci
npm run dev
```

Unter [localhost:3000](http://127.0.0.1:3000) öffnet **Beispiel öffnen** das sofort nutzbare Beispiel. Für ein eigenes Projekt eine PDF-, GAEB- oder XLSX-Datei hochladen. SQLite speichert Projekte und Originaldateien lokal in `.data/bauton.sqlite`. Die Anwendung bindet standardmäßig an die lokale Adresse und hat keine Benutzeranmeldung.

## Geteilte Testvorschau

Für eine Vorschau über HTTPS mit getrennten Projekten pro Browser `BAUTON_PREVIEW=1` setzen und über `BAUTON_DB` eine separate, leere SQLite-Datei verwenden. Der Modus ordnet Projekte, Originaldateien und gespeicherte Kolonnen einem Browser-Cookie zu. Er eignet sich für einen Testlink, bei dem jede Person mit einem eigenen Übungsprojekt startet.

## Ablauf

1. **Importieren.** PDF mit Textschicht, GAEB XML (.x81, .x83–.x86, .xml), GAEB 90 (.d81, .d83–.d86) oder XLSX mit Spalten für OZ, Beschreibung, Menge und Einheit. Tabelle durchsuchen oder nach Abschnitt, Prüffall, Preisstatus und Herkunft filtern. Bei PDFs bringt die Positionsansicht zur Originalseite.
2. **Prüfen.** Regeln markieren fehlende Positionsverweise, formale Felder, Rechenabweichungen, mögliche Dubletten und widersprüchliche Einbauorte. Ein Hinweis zeigt Beleg und Rückfrage zur Klärung. Bei einer bestätigten Dublette bleibt die Originalzeile sichtbar und die ausgeschlossene Zeile wird nicht berechnet.
3. **Kalkulieren.** Eigene Material-, Lohn- oder Kolonnenzeilen ergänzen. Vorgeschlagene Zeilen sind gekennzeichnet und werden erst nach Bestätigung berechnet. Einzelpreise stammen aus einer übernommenen Preisangabe, den eingegebenen Kosten oder einem gewählten Lieferanten. Vergleichbare Lieferangebote werden nach Nettokosten der benötigten Packungen einschließlich Versand sortiert. Unklare Packungsgrößen oder Lieferkosten brauchen eine Bestätigung.
4. **Zuschläge vergleichen.** Der Ausgangswert ist 25 % auf erfasste direkte Kosten. Eine Position mit anwendbarer, belegter Marktreferenz kann einen höheren Zuschlag vorschlagen. Der Kalkulator entscheidet und kann jeden Vorschlag ablehnen.
5. **Freigeben.** Offene Prüfpunkte und fehlende Preise der aktiven Positionen vor der Freigabe klären. Danach ist das Angebot im Archiv lesbar und als PDF verfügbar. Eine Kolonne, die in zwei freigegebenen Projekten verwendet wurde, wird für passende neue Projekte als Vorschlag übernommen.

## Preise und KI

Der Standardmodus funktioniert ohne Schlüssel. Übungswerte sind als Übungsdaten ausgewiesen. Bei einem identifizierten Katalogartikel stehen gegebenenfalls verlinkte Preisbeispiele für eine manuelle Prüfung zur Verfügung. Der Lohnwert für Elektro-Vorschläge ist der von Destatis veröffentlichte Durchschnitt der Arbeitskosten im deutschen Baugewerbe 2025 (39,60 €/h). Stunden und konkrete Kolonnenpreise lassen sich eingeben oder korrigieren. [Destatis](https://genesis.destatis.de/datenbank/online/statistic/62431/table/62431-0001)

Für Online-Preise oder semantische Prüfung `.env.example` nach `.env.local` kopieren und die jeweiligen Optionen konfigurieren.

- `SERPAPI_API_KEY` aktiviert die Google-Shopping-Suche aus der Positionsansicht. Beim Import kann die Suche für bis zu acht erkannte Artikelnummern gestartet werden. Es werden Artikelanfragen und gegebenenfalls die Postleitzahl gesendet. Suchergebnisse sind Momentaufnahmen. [Google Shopping API](https://serpapi.com/google-shopping-api)
- `ANTHROPIC_API_KEY` und `ANTHROPIC_MODEL` aktivieren die zusätzliche semantische Prüfung. Die Importoption sendet Beschreibungen von bis zu 240 Positionen an Anthropic und verlangt zitierfähige Belege. Regelprüfungen laufen für alle importierten Positionen.

## Übergabe und Nachweis

Der Abgabe-LV-Export enthält Bieter- und Projektangaben, Netto/Steuer/Brutto, Kostenübersicht, die bepreisten Positionen mit OZ, ME, EP und GP sowie den Prüfvermerk. Die Struktur orientiert sich am Datensatz. Bei einer Ausschreibung mit verbindlichen VHB-Formblättern bleiben die geforderten Originalformulare und Anlagen zusätzlich auszufüllen. Scans ohne Textschicht brauchen vor dem Import OCR.

```sh
npm test
npm run typecheck
npm run build
npm run benchmark -- "/Pfad/zu/Challenge A Dataset"
```

Der Datensatz wird für den Benchmark lokal eingelesen und ist nicht Bestandteil des Repositories. Details und Vorführablauf stehen in [DEMO.md](DEMO.md).


## Neues Nature Editorial Design

Die interaktive Startseite verwendet Fraunces als Serifenschrift (Browser-Fallback Georgia), den Berg als Logo und lokal gespeicherte Bildassets. Über die Schaltflächen **Wolken**, **Wind**, **Blumen** und **Licht** kannst du die Landschaft verändern. Die bestehende LV-Kalkulation, das Demo-Projekt und die API-Routen bleiben bestehen.

Zum Aktualisieren einer bereits laufenden Codespace-Instanz die Datei `BauMind_UI_Overwrite.zip` im Projektroot mit `unzip -o BauMind_UI_Overwrite.zip` entpacken, den laufenden Dev-Server stoppen, `.next` löschen und `npm run dev` erneut starten.
