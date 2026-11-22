# Bauton LV

Angebotswerkstatt für Leistungsverzeichnisse. Bauton importiert ein LV pro Projekt, zeigt prüfbare Auffälligkeiten an den Originalpositionen und führt vom Lieferantenvergleich bis zum freigegebenen Angebot.

## Start

Voraussetzungen sind Node.js 22.13+ und Poppler für PDFs mit Textschicht. Poppler lässt sich auf macOS mit `brew install poppler` und auf Debian/Ubuntu mit `sudo apt-get install poppler-utils` installieren.

```sh
npm ci
npm run dev
```

Unter [localhost:3000](http://127.0.0.1:3000) öffnet **Beispiel öffnen** das sofort nutzbare Beispiel. Für ein eigenes Projekt ein PDF, eine Excel-Datei (.xlsx) oder ein GAEB-LV hochladen. SQLite speichert Projekte und Originaldateien lokal in `.data/bauton.sqlite`. Die Anwendung bindet standardmäßig an die lokale Adresse und hat keine Benutzeranmeldung.

## Geteilte Testvorschau

Für eine Vorschau über HTTPS mit getrennten Projekten pro Browser `BAUTON_PREVIEW=1` setzen und über `BAUTON_DB` eine separate, leere SQLite-Datei verwenden. Der Modus ordnet Projekte, Originaldateien und gespeicherte Kolonnen einem Browser-Cookie zu. Er eignet sich für einen Testlink, bei dem jede Person mit einem eigenen Übungsprojekt startet.

## Ablauf

1. **Importieren.** PDF mit Textschicht, XLSX mit Spalten für OZ, Beschreibung, Menge und Einheit oder GAEB XML (.x81, .x83–.x86, .xml) und GAEB 90 (.d81, .d83–.d86). Tabelle durchsuchen oder nach Abschnitt, Prüffall, Preisstatus und Herkunft filtern. Bei PDFs bringt die Positionsansicht zur Originalseite.
2. **Prüfen.** Regeln markieren fehlende Positionsverweise, formale Felder, Rechenabweichungen, mögliche Dubletten und widersprüchliche Einbauorte. Ein Hinweis zeigt Beleg und Rückfrage zur Klärung. Bei einer bestätigten Dublette bleibt die Originalzeile sichtbar und die ausgeschlossene Zeile wird nicht berechnet.
3. **Kalkulieren.** Eigene Material-, Lohn- oder Kolonnenzeilen ergänzen. Vorgeschlagene Zeilen sind gekennzeichnet und werden erst nach Bestätigung berechnet. Einzelpreise stammen aus einer übernommenen Preisangabe, den eingegebenen Kosten oder einem gewählten Lieferanten. Vergleichbare Lieferangebote werden nach Nettokosten der benötigten Packungen einschließlich Versand sortiert. Unklare Packungsgrößen oder Lieferkosten brauchen eine Bestätigung.
4. **Zuschläge vergleichen.** Der Ausgangswert ist 25 % auf erfasste direkte Kosten. Eine bestätigte Vergleichsquelle für dieselbe Leistung und Einheit kann einen zweiten Verkaufspreis begründen. Der Vergleich zeigt Kosten, Verkaufspreise und Mehrerlös bei Zuschlag. Der Kalkulator entscheidet und kann jeden Vorschlag ablehnen.
5. **Freigeben.** Offene Prüfpunkte und fehlende Preise der aktiven Positionen vor der Freigabe klären. Danach ist das Angebot im Archiv lesbar und als PDF verfügbar. Eine Kolonne, die in zwei freigegebenen Projekten verwendet wurde, wird für passende neue Projekte als Vorschlag übernommen.

## Preise und KI

Der Standardmodus funktioniert ohne Schlüssel. Übungswerte sind als Übungsdaten ausgewiesen. Bei einem identifizierten Katalogartikel stehen gegebenenfalls verlinkte Preisbeispiele für eine manuelle Prüfung zur Verfügung. Der Lohnwert für Elektro-Vorschläge ist der von Destatis veröffentlichte Durchschnitt der Arbeitskosten im deutschen Baugewerbe 2025 (39,60 €/h). Stunden und konkrete Kolonnenpreise lassen sich eingeben oder korrigieren. [Destatis](https://genesis.destatis.de/datenbank/online/statistic/62431/table/62431-0001)

Für Online-Preise oder GPT `.env.example` nach `.env.local` kopieren oder die Werte in der Serverumgebung hinterlegen. Die Positionsansicht bietet für unterstützte WC-Positionen auch technische Herstellerlinks und eine anhand der LV-Maße erstellte Suchanfrage.

- `SERPAPI_API_KEY` aktiviert die Google-Shopping-Suche aus der Positionsansicht. Beim Import kann die Suche für bis zu acht erkannte Artikelnummern gestartet werden. Es werden Artikelanfragen und gegebenenfalls die Postleitzahl gesendet. Suchergebnisse sind Momentaufnahmen. [Google Shopping API](https://serpapi.com/google-shopping-api)
- `OPENAI_API_KEY` startet die KI-Prüfung automatisch beim Import. Als Modell dient standardmäßig `gpt-5-mini`; `OPENAI_MODEL` erlaubt einen anderen Modellnamen. Die Anwendung sendet Auszüge von bis zu 240 Positionen an OpenAI und verlangt Belege aus dem LV. Die Oberfläche zeigt, wie viele Positionen geprüft wurden. Regelprüfungen laufen für alle importierten Positionen. Für erkennbare Schnittstellen startet zusätzlich der Prüfagent. Er wählt bis zu fünf Startpositionen, durchsucht das gesamte importierte LV nach verwandten Leistungen und liest die passenden Langtexte. Die Oberfläche zeigt offene Klärungsfragen, Widersprüche oder belegte Zuordnungen. Jede Meldung verweist auf die gelesenen Originalstellen.

## Gespeicherte Marktpreise

Für den Hintergrundimport müssen die Migrationen unter `supabase/migrations` angewendet und `SUPABASE_URL` sowie `SUPABASE_SECRET_KEY` oder `SUPABASE_SERVICE_ROLE_KEY` serverseitig gesetzt sein. `npm run scrape:prices` lädt optional `.env.local` und startet den wöchentlichen Import. Die Query-Liste mit deutschen Bauprodukten und Kategorien steht in `src/lib/scraper/query-catalog.json`.

Mit `SERPAPI_API_KEY` sucht der Import für jede Kataloganfrage in Google Shopping und der Websuche. Shopping-Angebote werden direkt ausgewertet; pro Lauf werden höchstens 12 gefundene Händlerseiten und 40 Händlerdomains registriert bzw. geprüft. Neue Händler werden in `public.price_sources` als `discovered` gespeichert. Der Provider ist über `SearchProvider` austauschbar. Ohne SerpApi-Schlüssel laufen weiterhin ausdrücklich konfigurierte Feed-Quellen; die Suche wird als übersprungen im Laufprotokoll ausgewiesen.

HTML wird ohne JavaScript-Ausführung und ohne Link-Crawling untersucht. Unterstützt werden JSON-LD Product/Offer/AggregateOffer, OpenGraph-Preisfelder, Microdata und ein generischer Euro-/Einheiten-Fallback. Fehlende Währung/Einheit, nicht positive Preise, irrelevante Produkte, blockierte Seiten und Zeitüberschreitungen werden verworfen oder als Quellenfehler protokolliert. Abrufe sind auf HTTPS, öffentliche IP-Adressen, same-host redirects, 8 Sekunden und 1,5 MB pro Seite beschränkt. Nur Quellen abrufen, für die die Nutzung erlaubt ist; blockierende Seiten werden übersprungen und nicht umgangen.

Ergebnisse werden auf EUR, Preis, Einheit und Packungsgröße normalisiert und wöchentlich pro normalisiertem Produkt und Händler dedupliziert. Migration `006_dedupe_supplier_weekly_prices.sql` räumt bestehende Duplikate auf und sichert den eindeutigen Wochenindex. Gespeicherte Euro-Preise der letzten 30 Tage werden bei der Lieferantensuche neben Google-Shopping-Ergebnissen angeboten, sofern die Einheit zur LV-Position passt; sie werden nicht automatisch ausgewählt.

Die GitHub-Actions-Planung ruft den geschützten Endpunkt `/api/cron/scrape-prices` mit `Authorization: Bearer <CRON_SECRET>` auf. Sie benötigt `APP_URL` und `CRON_SECRET` als Workflow-Secrets sowie Supabase- und SerpApi-Konfiguration in der laufenden App. Die Route plant keine Läufe selbst.

## Übergabe und Nachweis

Die Abgabe-Kurzfassung enthält Bieter- und Projektangaben, Netto/Steuer/Brutto, Abschnittssummen und die Positionen mit OZ, Menge, ME, EP und GP. In der Angebotsansicht stehen auch eine Langfassung mit den importierten Beschreibungen und eine interne PDF mit Kosten und Prüfprotokoll bereit. Die Struktur orientiert sich am Datensatz. Bei einer Ausschreibung mit verbindlichen VHB-Formblättern bleiben die geforderten Originalformulare und Anlagen zusätzlich auszufüllen. Scans ohne Textschicht brauchen vor dem Import OCR.

```sh
npm test
npm run typecheck
npm run build
npm run benchmark -- "/Pfad/zu/Challenge A Dataset"
```

Der Datensatz wird für den Benchmark lokal eingelesen. GAEB-Dateien dienen dort als Referenz für den PDF-Import. Der Datensatz ist nicht Bestandteil des Repositories. Details und Vorführablauf stehen in [DEMO.md](DEMO.md).