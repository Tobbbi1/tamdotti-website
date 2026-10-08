# tamdotti.de – Mehrsprachigkeit

Alle HTML-Seiten (außer den Assets) werden erzeugt – **nicht** die .html-Dateien direkt bearbeiten.

    node tools/build-i18n.mjs      # im Ordner website/, ohne Abhängigkeiten (Node ≥ 18)

- `tools/i18n/locales/<lang>.json` – alle Texte pro Sprache (Startseite, „Konto löschen“, Header/Footer, Sprach-Hinweis).
  Reihenfolge/Liste der Sprachen: `ORDER` in `build-i18n.mjs`.
- `tools/i18n/legal/` – Datenschutz + Impressum: deutsches Original (`*.de.html`, rechtlich verbindlich)
  und englische Übersetzung (`*.en.html`). Bei Änderungen am Original die Übersetzung mitziehen.
- Erzeugt: `/index.html`, `/datenschutz.html`, `/impressum.html`, `/konto-loeschen.html` (Deutsch),
  `/<lang>/index.html` + `/<lang>/konto-loeschen.html`, `/en/privacy.html`, `/en/imprint.html`,
  `sitemap.xml` (mit hreflang), `robots.txt`.
- Alle Asset-Pfade sind root-absolut (`/img/…`, `/3d/…`), die Seite muss also an der Domain-Wurzel laufen.
- „Konto löschen“: Der In-App-Weg nutzt `konto.appUi` – das sind die **exakten** App-Texte
  (`tabs.settings`, `settings.title`, `settings.deleteSection`, `settings.deleteButton`,
  `settings.deleteContinue`, `settings.deleteConfirmAction`, `settings.deleteDoneTitle`,
  `settings.deleteAlsoLocal`, `settings.logout` aus `app_src/src/i18n/locales/*.ts`).
  Ändert sich ein Menüname in der App, hier mitziehen.
