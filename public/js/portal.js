(() => {
  const $ = id => document.getElementById(id);
  const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || '';
  const showToast = message => {
    const toast = $('toast'); if (!toast) return;
    toast.textContent = message; toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3000);
  };
  async function api(url, method = 'GET', body) {
    const options = { method, credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf() } };
    if (body !== undefined) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    const response = await fetch(url, options);
    let result = {}; try { result = await response.json(); } catch (_) { }
    if (response.status === 401) { window.location.assign(result.redirect || '/login'); throw new Error('Please sign in again.'); }
    if (!response.ok) { const error = new Error(result.error || 'Request failed.'); error.payload = result; throw error; }
    return result;
  }
  const setStatus = (id, message, success = false) => {
    const node = $(id); if (!node) return;
    node.textContent = message; node.style.color = success ? '#278565' : '#c14e55';
  };

  const progress = document.querySelector('#motionProgress span');
  const updateProgress = () => {
    if (!progress) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = `${max > 0 ? Math.min(100, window.scrollY / max * 100) : 0}%`;
  };
  window.addEventListener('scroll', updateProgress, { passive: true }); updateProgress();
  if ($('year')) $('year').textContent = new Date().getFullYear();
  if ($('todayLabel')) $('todayLabel').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  if ($('datePill')) $('datePill').textContent = new Date().toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

  const sidebar = $('sidebar');
  if ($('menuBtn')) $('menuBtn').addEventListener('click', () => {
    const open = sidebar.classList.toggle('open'); $('menuBtn').setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.sidebar .nav-link,.sidebar .help-card a').forEach(link => link.addEventListener('click', () => sidebar?.classList.remove('open')));
  if ($('logoutBtn')) $('logoutBtn').addEventListener('click', async () => {
    const button = $('logoutBtn'); button.disabled = true;
    try { const result = await api('/api/auth/logout', 'POST', {}); window.location.assign(result.redirect || '/login'); }
    catch (error) { button.disabled = false; showToast(error.message); }
  });

  // Reveal content in a staggered sequence, while respecting reduced-motion preferences.
  const revealSelector = '.stat-card,.panel,.notice-card,.material-card,.event-card,.quick-item,.page-title-row,.hero-banner';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const observer = !reduceMotion && 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); } });
  }, { threshold: .12, rootMargin: '0px 0px -26px 0px' }) : null;
  document.querySelectorAll(revealSelector).forEach((node, index) => {
    node.classList.add('reveal'); node.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 55}ms`);
    if (observer) observer.observe(node); else node.classList.add('in-view');
  });
  document.addEventListener('pointermove', event => {
    const card = event.target.closest('.stat-card,.notice-card,.material-card,.event-card,.quick-item');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
  }, { passive: true });

  // Notice and study-resource filters.
  function filterCards(inputId, selectId, cardSelector, emptyId, textAttr, categoryAttr) {
    const input = $(inputId), select = $(selectId);
    if (!input && !select) return;
    const apply = () => {
      const query = (input?.value || '').trim().toLowerCase();
      const category = select?.value || 'all'; let visible = 0;
      document.querySelectorAll(cardSelector).forEach(card => {
        const text = card.dataset[textAttr] || '';
        const cat = card.dataset[categoryAttr] || '';
        const match = text.includes(query) && (category === 'all' || cat === category);
        card.classList.toggle('hidden', !match); if (match) visible++;
      });
      if ($(emptyId)) $(emptyId).classList.toggle('hidden', visible !== 0);
    };
    input?.addEventListener('input', apply); select?.addEventListener('change', apply);
    const q = new URLSearchParams(location.search).get('search');
    if (q && input) { input.value = q; apply(); }
  }
  filterCards('noticeFilter', 'noticeCategory', '#allNotices .notice-card', 'noticeEmpty', 'search', 'category');
  filterCards('materialFilter', 'materialType', '#materialsGrid .material-card', 'materialEmpty', 'search', 'subject');

  if ($('globalSearch')) $('globalSearch').addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const query = $('globalSearch').value.trim(); if (!query) return;
    const lower = query.toLowerCase(); let target = '/overview';
    if (/notice|announcement|exam|placement/.test(lower)) target = '/notices';
    else if (/material|notes|sql|python|database|study|javascript|resource/.test(lower)) target = '/materials';
    else if (/class|time|schedule|timetable|lecture/.test(lower)) target = '/timetable';
    else if (/event|workshop|career|activity/.test(lower)) target = '/events';
    else if (/profile|account|password/.test(lower)) target = '/profile';
    else if (/feedback|help|support/.test(lower)) target = '/feedback';
    window.location.assign(`${target}${target === '/notices' || target === '/materials' ? `?search=${encodeURIComponent(query)}` : ''}`);
  });

  if ($('feedbackForm')) $('feedbackForm').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true; setStatus('feedbackStatus', 'Saving your message…', true);
    try {
      const result = await api('/api/feedback', 'POST', { topic: $('feedbackTopic').value, message: $('feedbackMessage').value.trim() });
      setStatus('feedbackStatus', result.message, true); $('feedbackMessage').value = ''; showToast('Feedback submitted successfully.');
    } catch (error) { setStatus('feedbackStatus', error.message); }
    finally { button.disabled = false; }
  });

  document.querySelectorAll('.interest-btn[data-event-id]').forEach(button => button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true; const oldText = button.textContent; button.textContent = 'Saving…';
    try {
      const result = await api(`/api/events/${encodeURIComponent(button.dataset.eventId)}/interest`, 'POST', {});
      button.textContent = '✓ Interest saved'; showToast(result.message || 'Your interest has been saved.');
    } catch (error) {
      if (error.payload?.interested) { button.textContent = '✓ Interest saved'; }
      else { button.disabled = false; button.textContent = oldText; showToast(error.message); }
    }
  }));

  if ($('profileForm')) $('profileForm').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true;
    setStatus('profileStatus', 'Saving profile…', true);
    try {
      const result = await api('/api/profile', 'PUT', { name: $('profileName').value.trim(), course: $('profileCourse').value.trim() });
      setStatus('profileStatus', result.message, true); showToast(result.message);
      const user = result.user;
      document.querySelectorAll('.profile-button strong').forEach(n => n.textContent = user.name);
      document.querySelectorAll('.student-mini strong').forEach(n => n.textContent = user.name);
      document.querySelectorAll('.student-mini small').forEach(n => n.textContent = user.course);
      const initials = user.name.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
      document.querySelectorAll('.profile-button .avatar,.student-mini .avatar').forEach(n=>n.textContent=initials);
      if ($('welcomeName')) $('welcomeName').textContent = user.name.split(/\s+/)[0];
    } catch (error) { setStatus('profileStatus', error.message); }
    finally { button.disabled = false; }
  });

  if ($('passwordForm')) $('passwordForm').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.currentTarget.querySelector('button[type="submit"]');
    if ($('newPassword').value !== $('confirmPassword').value) { setStatus('passwordStatus', 'Your new passwords do not match.'); return; }
    button.disabled = true; setStatus('passwordStatus', 'Updating password…', true);
    try {
      const result = await api('/api/profile/password', 'PUT', { currentPassword: $('currentPassword').value, newPassword: $('newPassword').value });
      setStatus('passwordStatus', result.message, true); $('passwordForm').reset(); showToast(result.message);
    } catch (error) { setStatus('passwordStatus', error.message); }
    finally { button.disabled = false; }
  });
})();
