// Start page UI: chapter reveals, Android beta guide, 3D stage bootstrap with poster fallback.
const root = document.documentElement;
const params = new URLSearchParams(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('reduced');
const posterMode = params.has('poster') ? Number(params.get('poster')) : null;
const chapters = [...document.querySelectorAll('.chapter')];
const canvas = document.querySelector('.scene');
const hint = document.querySelector('.poke-hint');

/* chapter copy + strike-through reveal: once each */
const reveal = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); }
}, { rootMargin: '0px 0px -25% 0px' });
chapters.forEach((c) => reveal.observe(c));
document.querySelectorAll('.nope dl').forEach((d) => reveal.observe(d));
if (posterMode !== null) chapters.forEach((c) => c.classList.add('is-in'));

/* Android beta: the button opens a small three-step guide (Google Group -> become tester -> Play Store) */
const betaBtn = document.querySelector('[aria-controls="beta-android"]');
const betaPanel = document.getElementById('beta-android');
function setBeta(open) {
  betaBtn.setAttribute('aria-expanded', String(open));
  betaPanel.hidden = !open;
  if (open) {
    betaPanel.classList.remove('is-in'); void betaPanel.offsetWidth; betaPanel.classList.add('is-in');
    const r = betaPanel.getBoundingClientRect();
    if (r.bottom > innerHeight) betaPanel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }
}
if (betaBtn && betaPanel) {
  betaBtn.addEventListener('click', () => setBeta(betaPanel.hidden));
  betaPanel.querySelector('.beta-close').addEventListener('click', () => { setBeta(false); betaBtn.focus(); });
  if (location.hash === '#beta-android') setBeta(true);
}

/* scroll anchors: scrollY at which each chapter's top meets the viewport top */
function anchors() {
  return chapters.map((c) => c.getBoundingClientRect().top + window.scrollY);
}

/* poster fallback: show the still that belongs to the chapter in view */
function usePosters() {
  root.classList.remove('has-3d');
  // the other stills are only fetched when there is no 3D
  const wrap = document.querySelector('.posters');
  for (const i of [1, 2, 3]) {
    const pic = document.createElement('picture');
    pic.className = 'poster';
    pic.dataset.station = String(i);
    pic.innerHTML = `<source media="(max-aspect-ratio: 9/10)" srcset="/img/poster-m-${i}.webp"><img src="/img/poster-d-${i}.webp" alt="" loading="lazy" decoding="async">`;
    wrap.append(pic);
  }
  const posters = [...wrap.querySelectorAll('.poster')];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const s = e.target.dataset.station;
      posters.forEach((p) => p.classList.toggle('is-on', p.dataset.station === s));
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  chapters.forEach((c) => io.observe(c));
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

const saveData = navigator.connection && navigator.connection.saveData;
if (!webglAvailable() || saveData || params.has('no3d')) {
  usePosters();
} else {
  import('./stage.js')
    .then(({ createStage }) => createStage({ canvas, hint, reduceMotion: reduce, poster: posterMode }))
    .then((stage) => {
      root.classList.add('has-3d');
      if (stage.setAnchors) {
        const update = () => stage.setAnchors(anchors());
        update();
        addEventListener('resize', update);
        new ResizeObserver(update).observe(document.querySelector('.chapters'));
      }
      window.__stage = stage;
      window.__stageReady = true;
    })
    .catch((err) => {
      console.warn('3D stage unavailable, using stills', String(err && err.stack || err));
      usePosters();
    });
}
