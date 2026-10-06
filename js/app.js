/* ==========================================================
   app.js - User interface. Reads the page, calls Auth and DB,
   and draws the results. No business rules live here.
   ========================================================== */
(() => {
  const $ = id => document.getElementById(id);
  const peso = n => '₱' + Number(n).toLocaleString('en-PH');
  const esc = s => String(s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Show a message in a notice box: kind is "ok", "warn" or "bad"
  function notice(id, kind, html) {
    $(id).innerHTML = html ? `<div class="notice ${kind}" role="status">${html}</div>` : '';
  }

  // ---------- Screens ----------
  function showScreen() {
    const user = Auth.currentUser();
    $('login-screen').hidden = !!user;
    $('app-screen').hidden = !user;
    $('user-label').textContent = user ? `Signed in as ${user}` : '';
    $('logout-btn').hidden = !user;
    if (user) refresh();
  }

  // ---------- Login / logout ----------
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const res = await Auth.login($('username').value, $('password').value);
    if (!res.ok) { notice('login-msg', 'bad', esc(res.error)); return; }
    $('password').value = '';
    notice('login-msg', 'ok', '');
    showScreen();
  });

  $('logout-btn').addEventListener('click', () => { Auth.logout(); showScreen(); });

  // ---------- Registration ----------
  $('start').value = DB.today();

  $('register-form').addEventListener('submit', e => {
    e.preventDefault();
    const res = DB.addMember({
      name: $('name').value, phone: $('phone').value, type: $('type').value,
      plan: $('plan').value, start: $('start').value
    });
    if (!res.ok) {
      notice('register-msg', 'bad', res.errors.map(esc).join('<br>'));
      return;
    }
    const m = res.member;
    notice('register-msg', 'ok',
      `Registered <b>${esc(m.name)}</b> (${m.id}).` +
      (DB.isMonthly(m) ? ` Collect ${peso(DB.RATES.monthly)}, valid until ${m.expiry}.` : ' Fee is collected at each check-in.'));
    $('register-form').reset();
    $('start').value = DB.today();
    refresh();
  });

  // ---------- Search ----------
  $('search').addEventListener('input', renderDirectory);

  // ---------- Directory actions (check-in / renew buttons) ----------
  $('directory-body').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.dataset.action === 'checkin') {
      const res = DB.checkIn(id);
      if (!res.ok) { notice('action-msg', 'bad', esc(res.error)); return; }
      const m = res.member;
      notice('action-msg', 'ok',
        res.fee
          ? `<b>${esc(m.name)}</b> checked in. Collect ${peso(res.fee)} (${m.type} rate).` +
            (m.type === 'Student' ? ' Verify a valid Student ID.' : '')
          : `<b>${esc(m.name)}</b> checked in (monthly member).`);
    }

    if (btn.dataset.action === 'renew') {
      const res = DB.renew(id);
      if (!res.ok) { notice('action-msg', 'bad', esc(res.error)); return; }
      notice('action-msg', 'ok',
        `Renewed <b>${esc(res.member.name)}</b>. Collect ${peso(DB.RATES.monthly)}, valid until ${res.member.expiry}.`);
    }
    refresh();
  });

  // ---------- Rendering ----------
  function renderSummary() {
    const s = DB.todaySummary();
    $('stat-checkins').textContent = s.checkins;
    $('stat-walkin').textContent = peso(s.walkIn);
    $('stat-monthly').textContent = peso(s.monthly);
    $('stat-total').textContent = peso(s.total);
  }

  function renderDirectory() {
    const members = DB.search($('search').value);
    if (!members.length) {
      $('directory-body').innerHTML = '<tr><td colspan="7" class="empty">No members found.</td></tr>';
      return;
    }
    $('directory-body').innerHTML = members.map(m => {
      const st = DB.statusOf(m);
      const done = DB.hasCheckedInToday(m.id);
      const fee = DB.isMonthly(m) ? 'Included' : peso(DB.feeFor(m));
      return `<tr>
        <td>${esc(m.id)}</td>
        <td>${esc(m.name)}<br><small>${esc(m.phone)}</small></td>
        <td>${esc(m.type)}</td>
        <td>${esc(m.plan)}</td>
        <td><span class="badge ${st.css}">${st.label}</span>${DB.isMonthly(m) ? `<br><small>until ${m.expiry}</small>` : ''}</td>
        <td>${fee}</td>
        <td class="actions">
          <button class="btn small" data-action="checkin" data-id="${m.id}" ${done ? 'disabled' : ''}>${done ? 'Checked in' : 'Check in'}</button>
          <button class="btn small ghost" data-action="renew" data-id="${m.id}">Renew</button>
        </td></tr>`;
    }).join('');
  }

  function refresh() { renderSummary(); renderDirectory(); }

  // ---------- Start ----------
  DB.seedIfEmpty();
  showScreen();
})();
