// Language switcher (enhances a native <details>, so it works without JS too)
// and – on the German start page only – a quiet one-time "also in your language" hint.
(() => {
  const KEY = 'td-lang';
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } },
  };

  /* an explicit pick in the switcher counts as "has chosen" */
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('.lang-pop a[data-lang]');
    if (a) store.set(a.dataset.lang);
  });

  for (const d of document.querySelectorAll('details.lang')) {
    const summary = d.querySelector('summary');
    const items = () => [...d.querySelectorAll('.lang-pop a')];
    const close = (focus) => { if (!d.open) return; d.open = false; if (focus) summary.focus(); };
    document.addEventListener('pointerdown', (e) => { if (!d.contains(e.target)) close(false); });
    d.addEventListener('focusout', (e) => { if (e.relatedTarget && !d.contains(e.relatedTarget)) close(false); });
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (d.open) { e.preventDefault(); close(true); } return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const list = items();
      if (!d.open) { if (e.key === 'ArrowDown') { e.preventDefault(); d.open = true; (d.querySelector('[aria-current]') || list[0]).focus(); } return; }
      e.preventDefault();
      const i = list.indexOf(document.activeElement);
      const n = e.key === 'ArrowDown' ? (i + 1) % list.length : (i <= 0 ? list.length - 1 : i - 1);
      list[n].focus();
    });
  }

  /* --- suggestion hint (German root only: the table is only in that page) --- */
  const table = document.getElementById('lang-suggest');
  if (!table) return;
  const data = JSON.parse(table.textContent);
  const forced = new URLSearchParams(location.search).get('suggest'); // QA: ?suggest=en
  if (!forced && store.get()) return;

  function pick() {
    if (forced) return data[forced] ? forced : null;
    for (const raw of navigator.languages || [navigator.language || '']) {
      const l = String(raw).toLowerCase();
      if (l.startsWith('de')) return null;          // German comes first – nothing to suggest
      if (l.startsWith('pt')) return 'pt-br';
      const base = l.split('-')[0];
      if (data[base]) return base;
    }
    return null;
  }
  const k = pick();
  if (!k) return;
  const t = data[k];

  const el = document.createElement('div');
  el.className = 'lang-hint';
  el.lang = t.lang;
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', t.q);
  el.innerHTML = '<p></p><a class="lang-hint-go"></a><button class="lang-hint-x" type="button">' +
    '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>';
  el.querySelector('p').textContent = t.q;
  const go = el.querySelector('a');
  go.textContent = t.yes; go.href = t.url; go.hreflang = t.lang;
  const x = el.querySelector('button');
  x.setAttribute('aria-label', t.no);
  go.addEventListener('click', () => store.set(k));
  x.addEventListener('click', () => {
    store.set('de');
    el.classList.remove('is-on');
    setTimeout(() => el.remove(), 200);
  });
  document.body.append(el);
  // let the page settle first; it should feel like a quiet offer, not a pop-up
  setTimeout(() => requestAnimationFrame(() => el.classList.add('is-on')), forced ? 50 : 1400);
})();
