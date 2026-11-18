(() => {
  const stage = document.getElementById('exhibit');
  const still = document.getElementById('still');
  const movie = document.getElementById('movie');
  const info = document.getElementById('info');
  const infoLink = document.getElementById('infoLink');
  const caption = document.getElementById('caption');
  const counter = document.getElementById('counter');
  const toggle = document.getElementById('toggle');
  const emptyState = document.getElementById('emptyState');
  const stillOnlyMs = 50000;
  const imageHoldMs = 50000;
  const fadeMs = 1200;
  const pauseAfterVideoMs = 1600;
  let index = 0;
  let renderToken = 0;
  let timers = [];
  let automatic = true;
  let muted = false;
  let gesture = null;
  let suppressClickUntil = 0;
  const imagePreloads = new Map();

  function later(fn, ms, token = renderToken) {
    timers.push(setTimeout(() => { if (token === renderToken && automatic) fn(); }, ms));
  }
  function reset() {
    timers.forEach(clearTimeout);
    timers = [];
    movie.onended = null;
    movie.onerror = null;
    movie.pause();
    movie.removeAttribute('src');
    movie.load();
    movie.classList.remove('visible');
    still.classList.remove('visible');
    info.hidden = true;
  }
  function preload(src) {
    if (!src) return Promise.resolve(false);
    if (!imagePreloads.has(src)) imagePreloads.set(src, new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = src;
    }));
    return imagePreloads.get(src);
  }
  function finish() {
    if (!automatic) return;
    still.classList.remove('visible');
    movie.classList.remove('visible');
    later(() => show(index + 1), pauseAfterVideoMs + fadeMs);
  }
  function playVideo(item, token) {
    if (token !== renderToken || !automatic) return;
    movie.src = item.video;
    movie.muted = muted;
    const fallback = () => {
      if (token !== renderToken || !automatic) return;
      movie.classList.remove('visible');
      still.classList.add('visible');
      later(finish, pauseAfterVideoMs, token);
    };
    movie.onended = () => { if (token === renderToken) finish(); };
    movie.onerror = fallback;
    const reveal = () => {
      if (token !== renderToken || !automatic) return;
      movie.classList.add('visible');
      still.classList.remove('visible');
    };
    movie.play().then(reveal).catch(() => {
      if (token !== renderToken || !automatic) return;
      muted = true;
      movie.muted = true;
      movie.play().then(reveal).catch(fallback);
    });
    // A damaged or stalled video must not trap an unattended exhibit.
    later(finish, 120000, token);
  }
  function show(requested) {
    const token = ++renderToken;
    reset();
    if (!items.length) { emptyState.hidden = false; return; }
    emptyState.hidden = true;
    index = (requested % items.length + items.length) % items.length;
    const item = items[index];
    still.hidden = movie.hidden = item.type === 'info';
    counter.textContent = `${index + 1} / ${items.length}`;
    stage.setAttribute('aria-label', `Slide ${index + 1} of ${items.length}: ${item.title}`);
    caption.textContent = item.type === 'info' ? '' : [item.title, item.date].filter(Boolean).join(', ');
    if (item.type === 'info') {
      infoLink.textContent = item.title;
      infoLink.href = item.url;
      info.hidden = false;
      if (automatic) later(() => show(index + 1), stillOnlyMs, token);
    } else {
      still.alt = item.title;
      still.src = item.image;
      still.classList.add('visible');
      preload(items[(index + 1) % items.length]?.image);
      if (automatic) {
        if (item.video) later(() => playVideo(item, token), imageHoldMs, token);
        else later(finish, stillOnlyMs, token);
      }
    }
  }
  function navigate(delta) { show(index + delta); }
  function toggleAutomatic() {
    automatic = !automatic;
    toggle.textContent = automatic ? 'Ⅱ' : '▶';
    toggle.setAttribute('aria-label', automatic ? 'Pause slideshow' : 'Play slideshow');
    toggle.setAttribute('aria-pressed', String(!automatic));
    // Pause on the artwork, and restart its full viewing time on resume.
    show(index);
  }
  document.getElementById('previous').addEventListener('click', () => navigate(-1));
  document.getElementById('next').addEventListener('click', () => navigate(1));
  toggle.addEventListener('click', toggleAutomatic);
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.isContentEditable) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); navigate(event.key === 'ArrowRight' ? 1 : -1);
    } else if (event.key === ' ' && !event.target.closest('a, button, input, textarea, select')) {
      event.preventDefault(); toggleAutomatic();
    }
  });
  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) { gesture = null; return; }
    suppressClickUntil = 0;
    gesture = {id: event.pointerId, x: event.clientX, y: event.clientY};
  });
  stage.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture = null;
    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      suppressClickUntil = Date.now() + 400;
      navigate(dx < 0 ? 1 : -1);
    }
  });
  stage.addEventListener('pointercancel', () => { gesture = null; });
  stage.addEventListener('click', event => {
    if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  stage.addEventListener('dragstart', event => event.preventDefault());
  show(0);

  let lastVersion = null;
  setInterval(async () => {
    try {
      const response = await fetch('version.txt?_=' + Date.now(), {cache: 'no-store'});
      if (!response.ok) return;
      const version = await response.text();
      if (lastVersion !== null && version !== lastVersion) location.reload();
      lastVersion = version;
    } catch { /* Keep the exhibit running while offline. */ }
  }, 15000);
})();
