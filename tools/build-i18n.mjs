// tamdotti.de – multilingual static build.
// One template per page type + one strings file per language (tools/i18n/locales/*.json).
// Usage (from the website folder):  node tools/build-i18n.mjs
// Edits go into the JSON / legal fragments – never into the generated *.html files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tools/i18n');
const ORIGIN = 'https://tamdotti.de';
const ORDER = ['de', 'en', 'es', 'fr', 'it', 'pt-br', 'nl', 'pl', 'tr', 'ja', 'ko', 'zh'];
const CJK = new Set(['ja', 'ko', 'zh']);
const EXT_LATIN = new Set(['tr', 'pl']); // need Nunito latin-ext (Fredoka has no ş ğ İ ą ę …)
const TODAY = new Date().toISOString().slice(0, 10);

const L = Object.fromEntries(ORDER.map((k) => [k, JSON.parse(fs.readFileSync(path.join(SRC, 'locales', `${k}.json`), 'utf8'))]));
const legal = (f) => fs.readFileSync(path.join(SRC, 'legal', f), 'utf8');

/* ---------- helpers ---------- */
const esc = (s) => String(s).replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = (s) => String(s).replace(/<[^>]+>/g, '');
const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const mail = '<a href="mailto:info@vidofood.de">info@vidofood.de</a>';
// Company contact (Vidomedia UG): footer + the beta-test section on the start page. Legal pages and konto-loeschen keep `mail`.
const footerMail = '<a href="mailto:info@vidomedia.de">info@vidomedia.de</a>';
// Beta test (start page). iPhone: TestFlight public link. Android: closed test = Google Group -> opt-in -> Play Store.
const BETA = {
  ios: 'https://testflight.apple.com/join/ZPDdyCGJ',
  android: ['https://groups.google.com/g/tamdotti-tester', 'https://play.google.com/apps/testing/de.vidomedia.tamdotti', 'https://play.google.com/store/apps/details?id=de.vidomedia.tamdotti'],
};
const prefix = (k) => (k === 'de' ? '' : `/${L[k].dir}`);

// page types → url per language (null = no version in that language)
const PAGES = {
  home: (k) => `${prefix(k)}/`,
  konto: (k) => `${prefix(k)}/konto-loeschen.html`,
  privacy: (k) => ({ de: '/datenschutz.html', en: '/en/privacy.html' })[k] || null,
  imprint: (k) => ({ de: '/impressum.html', en: '/en/imprint.html' })[k] || null,
};
const langsOf = (page) => ORDER.filter((k) => PAGES[page](k));
// where a visitor's privacy/imprint link goes: own language if it exists, else English
const legalUrl = (page, k) => PAGES[page](k) || PAGES[page]('en');

/* ---------- shared pieces ---------- */
function head(k, page, { title, description, ogTitle, ogDescription, extra = '' }) {
  const loc = L[k];
  const url = ORIGIN + PAGES[page](k);
  const alts = langsOf(page);
  const hreflang = alts.length > 1
    ? alts.map((a) => `<link rel="alternate" hreflang="${L[a].hreflang}" href="${ORIGIN}${PAGES[page](a)}">`).join('\n') +
      `\n<link rel="alternate" hreflang="x-default" href="${ORIGIN}${PAGES[page]('de')}">\n`
    : '';
  const ogAlt = alts.filter((a) => a !== k).map((a) => `<meta property="og:locale:alternate" content="${L[a].ogLocale}">`).join('\n');
  const fonts = [
    '<link rel="preload" href="/fonts/fredoka-latin.woff2" as="font" type="font/woff2" crossorigin>',
    page === 'home' && !CJK.has(k) ? '<link rel="preload" href="/fonts/nunito-latin.woff2" as="font" type="font/woff2" crossorigin>' : '',
    EXT_LATIN.has(k) ? '<link rel="preload" href="/fonts/nunito-latin-ext.woff2" as="font" type="font/woff2" crossorigin>' : '',
  ].filter(Boolean).join('\n');
  return `<!doctype html>
<html lang="${loc.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
${hreflang}<meta name="theme-color" content="#fff4e8">
<meta property="og:type" content="website">
<meta property="og:locale" content="${loc.ogLocale}">
${ogAlt ? ogAlt + '\n' : ''}<meta property="og:site_name" content="Tamdotti">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(ogDescription || description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ORIGIN}/img/og-image.jpg">
<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png">
<link rel="icon" type="image/png" sizes="64x64" href="/img/favicon-64.png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
${fonts}
<link rel="stylesheet" href="/css/site.css">
${extra}<script src="/js/lang.js" defer></script>
</head>`;
}

const GLOBE = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.9 10h14.2M10 2.8c2 2.1 2.9 4.5 2.9 7.2s-.9 5.1-2.9 7.2c-2-2.1-2.9-4.5-2.9-7.2s.9-5.1 2.9-7.2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const CHEVRON = '<svg class="lang-chev" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function switcher(k, page) {
  const c = L[k].common;
  const items = ORDER.map((a) => {
    const href = PAGES[page](a) || PAGES.home(a);
    const cur = a === k ? ' aria-current="true"' : '';
    return `<li><a href="${href}" hreflang="${L[a].hreflang}" lang="${L[a].htmlLang}" data-lang="${a}"${cur}>${L[a].name}</a></li>`;
  }).join('');
  return `<details class="lang">
    <summary class="lang-btn" aria-label="${esc(fill(c.langCurrent, { lang: L[k].name }))}">${GLOBE}<span>${L[k].short}</span>${CHEVRON}</summary>
    <div class="lang-pop"><p class="lang-title">${c.langTitle}</p><ul>${items}</ul></div>
  </details>`;
}

// legal links: own language where it exists, otherwise English with a small "EN" tag
function legalLink(k, page, label, current) {
  const own = PAGES[page](k);
  const href = legalUrl(page, k);
  const tag = own ? '' : ` hreflang="en"`;
  const badge = own ? '' : `<span class="tag" lang="en">EN</span>`;
  return `<a href="${href}"${tag}${current === page ? ' aria-current="page"' : ''}>${label}${badge}</a>`;
}

function legalNav(k, current, { withStart = false } = {}) {
  const c = L[k].common;
  return (withStart ? `<a href="${PAGES.home(k)}">${c.start}</a>` : '') +
    legalLink(k, 'privacy', c.privacy, current) +
    legalLink(k, 'imprint', c.imprint, current) +
    `<a href="${PAGES.konto(k)}"${current === 'konto' ? ' aria-current="page"' : ''}>${c.deleteAccount}</a>`;
}

function footer(k, page) {
  const c = L[k].common;
  const originals = k === 'de' ? '' :
    `\n    <p class="foot-legal">${c.legalOriginals} <a href="/datenschutz.html" hreflang="de" lang="de">Datenschutz</a> · <a href="/impressum.html" hreflang="de" lang="de">Impressum</a></p>`;
  return `<footer class="foot">
  <div class="wrap">
    <div class="foot-text"><p>${c.footerAbout} ${footerMail}</p>${originals}</div>
    <nav aria-label="${esc(c.navLegal)}">${legalNav(k, null, { withStart: page !== 'home' })}</nav>
  </div>
</footer>`;
}

function masthead(k, page, nav) {
  const c = L[k].common;
  return `<header class="masthead wrap">
  <a class="wordmark" href="${PAGES.home(k)}"${page === 'home' ? ` aria-label="${esc(c.homeLabel)}"` : ''}><img src="/img/icon-320.webp" alt="" width="34" height="34">Tamdotti</a>
  ${nav}
  ${switcher(k, page)}
</header>`;
}

/* ---------- page: home ---------- */
const STORE_APPLE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M16.37 12.67c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79-1.54.02-2.96.9-3.76 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.51 1.25-2.58-.03-.01-2.4-.92-2.42-3.65zM14.1 5.9c.63-.77 1.06-1.83.94-2.9-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.27z"/></svg>';
const STORE_GOOGLE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M4.5 2.6c-.3.2-.5.6-.5 1.1v16.6c0 .5.2.9.5 1.1l9.3-9.4zM15 13.1l2.6 2.6-11 6.3zM6.6 2l11 6.3L15 10.9zM18.9 9.1l3 1.7c.9.5.9 1.9 0 2.4l-3 1.7-2.9-2.9z"/></svg>';

function suggestData() {
  // compact table for the "view in your language?" hint on the German root
  const out = {};
  for (const k of ORDER) if (k !== 'de') out[k] = { url: PAGES.home(k), lang: L[k].htmlLang, ...L[k].suggest };
  return JSON.stringify(out);
}

function home(k) {
  const loc = L[k], h = loc.home, c = loc.common;
  const extra = `<link rel="stylesheet" href="/css/home.css">
<script type="importmap">{"imports":{"three":"/vendor/three/three.module.min.js","three/addons/":"/vendor/three/addons/"}}</script>
<link rel="modulepreload" href="/js/home.js">
`;
  const chapters = h.chapters.map((ch, i) => `
      <article class="chapter" data-station="${i + 1}">
        <div class="copy">
          <p class="kicker">${ch.kicker}</p>
          <h2>${ch.title}</h2>
          <p>${ch.text}</p>
        </div>
      </article>
`).join('');
  const nope = h.nope.map(([dt, dd]) => `      <div><dt><s>${dt}</s></dt><dd>${dd}</dd></div>`).join('\n');
  const shots = ['zimmer', 'garten', 'einrichten', 'kampf'].map((s, i) =>
    `      <figure><img src="/img/screen-${s}.webp" width="540" height="1168" loading="lazy" decoding="async" alt="${esc(h.screens[i][0])}"><figcaption>${h.screens[i][1]}</figcaption></figure>`).join('\n');
  const suggest = k === 'de' ? `<script type="application/json" id="lang-suggest">${suggestData()}</script>\n` : '';
  return `${head(k, 'home', { title: h.title, description: h.description, ogTitle: h.title, ogDescription: h.ogDescription, extra })}
<body class="home">
${masthead(k, 'home', `<nav aria-label="${esc(h.navLabel)}"><a href="#beta">${h.navSoon}</a></nav>`)}

<main>
  <section class="story" id="story">
    <div class="stage" aria-hidden="true">
      <div class="posters">
        <picture class="poster is-on" data-station="0"><source media="(max-aspect-ratio: 9/10)" srcset="/img/poster-m-0.webp"><img src="/img/poster-d-0.webp" alt="" fetchpriority="high" decoding="async"></picture>
      </div>
      <canvas class="scene"></canvas>
      <span class="poke-hint" hidden>${h.poke}</span>
    </div>

    <div class="chapters">
      <article class="chapter chapter--intro" data-station="0">
        <div class="copy">
          <h1>${h.h1}</h1>
          <p class="lead">${h.lead}</p>
          <p class="meta">${h.meta}</p>
        </div>
      </article>
${chapters}    </div>
  </section>

  <section class="nope wrap" aria-labelledby="nope-title">
    <h2 id="nope-title">${h.nopeTitle}</h2>
    <dl>
${nope}
    </dl>
  </section>

  <section class="screens wrap" aria-labelledby="screens-title">
    <div class="screens-head">
      <h2 id="screens-title">${h.screensTitle}</h2>
      <p>${h.screensSub}</p>
    </div>
    <div class="screens-row">
${shots}
    </div>
  </section>

  <section class="soon wrap" id="beta" aria-labelledby="soon-title">
    <h2 id="soon-title">${h.soonTitle}</h2>
    <p>${fill(h.soonText, { email: footerMail })}</p>
    <div class="stores">
      <a class="btn store" href="${BETA.ios}" target="_blank" rel="noopener">
        ${STORE_APPLE}
        <span><small>${h.beta} · TestFlight</small>iPhone</span>
      </a>
      <button class="btn store" type="button" aria-expanded="false" aria-controls="beta-android">
        ${STORE_GOOGLE}
        <span><small>${h.beta} · Google Play</small>Android</span>
      </button>
    </div>
    <div class="beta-steps" id="beta-android" role="region" aria-labelledby="beta-android-title" hidden>
      <div class="beta-steps-head">
        <h3 id="beta-android-title">${h.androidTitle}</h3>
        <button class="beta-close" type="button" aria-label="${esc(h.androidClose)}"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
      </div>
      <ol class="steps">
${h.androidSteps.map(([t, a, hint], i) => `        <li><b>${t}</b> <a href="${BETA.android[i]}" target="_blank" rel="noopener">${a}</a><span>${hint}</span></li>`).join('\n')}
      </ol>
    </div>
  </section>
</main>

${footer(k, 'home')}
${suggest}<script type="module" src="/js/home.js"></script>
</body>
</html>
`;
}

/* ---------- page: konto löschen ---------- */
function konto(k) {
  const loc = L[k], t = loc.konto, c = loc.common;
  const subject = t.mailSubject;
  const href = `mailto:info@vidofood.de?subject=${encodeURIComponent(subject)}&amp;body=${encodeURIComponent(t.mailBody.join('\n'))}`;
  const vars = { email: mail, subject: `<code>${subject}</code>`,
    privacy: `<a href="${legalUrl('privacy', k)}"${PAGES.privacy(k) ? '' : ' hreflang="en"'}>${t.privacyLinkText}</a>` };
  const steps = t.steps.map((s) => `  <li>${fill(s, vars)}</li>`).join('\n');
  // In-app path: names must match the app's UI exactly (konto.appUi mirrors the app's
  // tabs.settings / settings.title / settings.delete* / settings.logout strings).
  const ui = Object.fromEntries(Object.entries(t.appUi).map(([key, v]) => [key, esc(v)]));
  const appSteps = t.appSteps.map((s) => `  <li>${fill(s, ui)}</li>`).join('\n');
  const list = t.deleted.map((s) => `  <li>${s}</li>`).join('\n');
  return `${head(k, 'konto', { title: t.title, description: t.description })}
<body>
${masthead(k, 'konto', `<nav aria-label="${esc(c.navLegal)}">${legalNav(k, 'konto')}</nav>`)}
<main>

<section class="legal-head"><div class="wrap">
  <h1>${t.h1}</h1>
  <p>${t.intro}</p>
</div></section>
<section class="legal-body"><div class="wrap">
<article>
<h2>${t.appTitle}</h2>
<p>${t.appText}</p>
<ol class="steps">
${appSteps}
</ol>
<p>${fill(t.appNote, ui)}</p>

<h2>${t.altTitle}</h2>
<p>${t.requestText}</p>
<ol class="steps">
${steps}
</ol>
<div class="mailbox"><a class="btn" href="${href}">${t.mailButton}</a></div>

<h2>${t.deletedTitle}</h2>
<p>${t.deletedIntro}</p>
<ul>
${list}
</ul>
<p>${t.retention}</p>
<div class="boxed">${t.notice}</div>

<h2>${t.deviceTitle}</h2>
<p>${fill(t.deviceText, ui)}</p>

<h2>${t.partialTitle}</h2>
<p>${fill(t.partialText, vars)}</p>
<p>${fill(t.more, vars)}</p>
</article>
</div></section>
</main>
${footer(k, 'konto')}
</body>
</html>
`;
}

/* ---------- pages: privacy / imprint (de original, en translation) ---------- */
function legalPage(k, page) {
  const loc = L[k], c = loc.common, t = loc.legal[page];
  const body = legal(`${page === 'privacy' ? (k === 'de' ? 'datenschutz' : 'privacy') : (k === 'de' ? 'impressum' : 'imprint')}.${k}.html`);
  const binding = k === 'de' ? '' :
    `\n  <p class="binding" role="note">${fill(c.translationNote, { original: `<a href="${PAGES[page]('de')}" hreflang="de" lang="de">${page === 'privacy' ? 'Datenschutzerklärung' : 'Impressum'}</a>` })}</p>`;
  return `${head(k, page, { title: t.title, description: t.description })}
<body>
${masthead(k, page, `<nav aria-label="${esc(c.navLegal)}">${legalNav(k, page)}</nav>`)}
<main>

<section class="legal-head"><div class="wrap">
  <h1>${t.h1}</h1>
  <p>${t.sub}</p>${binding}
</div></section>
<section class="legal-body"><div class="wrap">
<article>
${body}</article>
</div></section>
</main>
${footer(k, page)}
</body>
</html>
`;
}

/* ---------- write ---------- */
const written = [];
function write(rel, html) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  written.push(rel);
}
const fileFor = (url) => (url.endsWith('/') ? url + 'index.html' : url).slice(1);

for (const k of ORDER) {
  write(fileFor(PAGES.home(k)), home(k));
  write(fileFor(PAGES.konto(k)), konto(k));
  for (const p of ['privacy', 'imprint']) if (PAGES[p](k)) write(fileFor(PAGES[p](k)), legalPage(k, p));
}

/* sitemap with hreflang alternates */
const urls = [];
for (const page of Object.keys(PAGES)) for (const k of langsOf(page)) {
  const alts = langsOf(page);
  const links = alts.length > 1 ? alts.map((a) => `    <xhtml:link rel="alternate" hreflang="${L[a].hreflang}" href="${ORIGIN}${PAGES[page](a)}"/>`).join('\n') +
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${PAGES[page]('de')}"/>\n` : '';
  urls.push(`  <url>\n    <loc>${ORIGIN}${PAGES[page](k)}</loc>\n    <lastmod>${TODAY}</lastmod>\n${links}  </url>`);
}
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *\nDisallow: /tools/\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);

console.log(`wrote ${written.length} files:\n` + written.join('\n'));
