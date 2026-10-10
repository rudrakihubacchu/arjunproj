(() => {
  const $ = id => document.getElementById(id);
  const csrf = () => document.querySelector('meta[name="csrf-token"]')?.content || '';
  const setCsrf = value => { const node = document.querySelector('meta[name="csrf-token"]'); if (node && value) node.content = value; };
  const setMessage = (node, message, type = 'error') => {
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('error', type === 'error' && !!message);
    node.classList.toggle('success', type === 'success' && !!message);
  };
  const setBusy = (button, busy, busyText = 'Please wait…') => {
    if (!button) return;
    if (busy) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      const label = button.querySelector('.btn-label');
      if (label) label.textContent = busyText;
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    }
  };
  async function request(url, body) {
    const response = await fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
      body: JSON.stringify(body)
    });
    let result = {};
    try { result = await response.json(); } catch (_) { result = {}; }
    if (result.csrfToken) setCsrf(result.csrfToken);
    if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
    return result;
  }

  document.querySelectorAll('[data-password-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const input = $(button.dataset.passwordToggle);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
      input.focus({ preventScroll: true });
    });
  });

  const loginForm = $('loginForm');
  if (loginForm) loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = $('loginMessage');
    const button = loginForm.querySelector('button[type="submit"]');
    setMessage(message, ''); setBusy(button, true, 'Signing in…');
    try {
      const result = await request(loginForm.dataset.endpoint, {
        email: $('loginEmail').value.trim(), password: $('loginPassword').value
      });
      setMessage(message, result.message || 'Signed in. Opening your workspace…', 'success');
      window.location.assign(result.redirect || '/overview');
    } catch (error) { setMessage(message, error.message); setBusy(button, false); }
  });

  const registerForm = $('registerForm');
  if (registerForm) registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = $('registerMessage');
    const button = registerForm.querySelector('button[type="submit"]');
    const password = $('registerPassword').value;
    if (password !== $('registerConfirmPassword').value) { setMessage(message, 'Your passwords do not match.'); return; }
    if (!$('acceptTerms').checked) { setMessage(message, 'Please acknowledge the account information before continuing.'); return; }
    setMessage(message, ''); setBusy(button, true, 'Creating account…');
    try {
      const result = await request(registerForm.dataset.endpoint, {
        name: $('registerName').value.trim(), email: $('registerEmail').value.trim(),
        course: $('registerCourse').value.trim(), password
      });
      setMessage(message, result.message || 'Account created. Opening your workspace…', 'success');
      window.location.assign(result.redirect || '/overview');
    } catch (error) { setMessage(message, error.message); setBusy(button, false); }
  });

  const forgotForm = $('forgotForm');
  if (forgotForm) forgotForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = $('forgotMessage'); const button = forgotForm.querySelector('button[type="submit"]');
    setMessage(message, ''); setBusy(button, true, 'Sending…');
    try {
      const result = await request(forgotForm.dataset.endpoint, { email: $('forgotEmail').value.trim() });
      setMessage(message, result.message, 'success');
      button.disabled = false; const label = button.querySelector('.btn-label'); if (label) label.textContent = 'Send another link';
    } catch (error) { setMessage(message, error.message); setBusy(button, false); }
  });

  const resetForm = $('resetForm');
  if (resetForm) resetForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = $('resetMessage'); const button = resetForm.querySelector('button[type="submit"]');
    const password = $('resetPassword').value;
    if (password !== $('resetConfirmPassword').value) { setMessage(message, 'Your passwords do not match.'); return; }
    setMessage(message, ''); setBusy(button, true, 'Updating…');
    try {
      const result = await request(resetForm.dataset.endpoint, { token: resetForm.querySelector('[name="token"]').value, password });
      setMessage(message, result.message, 'success');
      window.setTimeout(() => window.location.assign(result.redirect || '/login'), 1400);
    } catch (error) { setMessage(message, error.message); setBusy(button, false); }
  });

  const progress = document.querySelector('#motionProgress span');
  const updateProgress = () => {
    if (!progress) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = `${max > 0 ? Math.min(100, window.scrollY / max * 100) : 0}%`;
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
})();
