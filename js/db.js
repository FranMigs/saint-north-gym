/* ==========================================================
   db.js - Member database (localStorage) and business rules.
   No DOM code here. Every function returns plain data.
   ========================================================== */
const DB = (() => {
  const KEY = 'sng_data_v2';

  // Official rates in PHP
  const RATES = { student: 80, nonStudent: 100, monthly: 1000 };
  const EXPIRING_DAYS = 5;

  // ---------- Date helpers (all dates are local "YYYY-MM-DD") ----------
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => toISO(new Date());
  const parse = s => new Date(s + 'T00:00:00');

  function addMonth(iso) {
    const d = parse(iso), day = d.getDate();
    d.setMonth(d.getMonth() + 1);
    if (d.getDate() !== day) d.setDate(0); // Jan 31 -> Feb 28
    return toISO(d);
  }
  const daysLeft = iso => Math.round((parse(iso) - parse(today())) / 86400000);
  const isValidDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parse(s));

  // ---------- Storage ----------
  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupted or blocked storage: start fresh */ }
    return { members: [], checkins: [], payments: [], seq: 0 };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage full/blocked */ }
  }

  // ---------- Rules ----------
  const isMonthly = m => m.plan === 'Monthly';
  const feeFor = m => (m.type === 'Student' ? RATES.student : RATES.nonStudent);
  const getMember = id => data.members.find(m => m.id === id);

  // Status shown in the directory
  function statusOf(m) {
    if (!isMonthly(m)) return { label: 'WALK-IN', css: 'neutral' };
    const d = daysLeft(m.expiry);
    if (d < 0) return { label: 'EXPIRED', css: 'bad' };
    if (d <= EXPIRING_DAYS) return { label: 'EXPIRING SOON', css: 'warn' };
    return { label: 'ACTIVE', css: 'ok' };
  }

  function recordPayment(memberId, amount, kind) {
    data.payments.push({ memberId, amount, kind, date: today() });
  }

  // ---------- Validation ----------
  function normalizePhone(p) { return String(p).replace(/[\s-]/g, ''); }

  function validateMember(input) {
    const errors = [];
    const name = input.name.trim();
    const phone = normalizePhone(input.phone);
    if (name.length < 2 || name.length > 60) errors.push('Full name must be 2 to 60 characters.');
    if (!/^(09\d{9}|\+639\d{9})$/.test(phone)) errors.push('Phone must look like 09171234567 or +639171234567.');
    if (!['Student', 'Non-Student'].includes(input.type)) errors.push('Choose a member type.');
    if (!['Daily', 'Monthly'].includes(input.plan)) errors.push('Choose a plan.');
    if (!isValidDate(input.start)) errors.push('Enter a valid start date.');
    if (data.members.some(m => normalizePhone(m.phone) === phone)) errors.push('A member with this phone number already exists.');
    return errors;
  }

  // ---------- Operations ----------
  function addMember(input) {
    const errors = validateMember(input);
    if (errors.length) return { ok: false, errors };

    data.seq += 1;
    const year = new Date().getFullYear();
    const member = {
      id: `SNG-${year}-${String(data.seq).padStart(3, '0')}`,
      name: input.name.trim(),
      phone: normalizePhone(input.phone),
      type: input.type,
      plan: input.plan,
      start: input.start,
      expiry: input.plan === 'Monthly' ? addMonth(input.start) : input.start,
      createdAt: today()
    };
    data.members.push(member);
    if (isMonthly(member)) recordPayment(member.id, RATES.monthly, 'monthly');
    save();
    return { ok: true, member };
  }

  // Extend from the current expiry if still valid, otherwise from today
  function renew(id) {
    const m = getMember(id);
    if (!m) return { ok: false, error: 'Member not found.' };
    const base = isMonthly(m) && daysLeft(m.expiry) >= 0 ? m.expiry : today();
    m.plan = 'Monthly';
    m.expiry = addMonth(base);
    recordPayment(m.id, RATES.monthly, 'monthly');
    save();
    return { ok: true, member: m };
  }

  function hasCheckedInToday(id) {
    return data.checkins.some(c => c.memberId === id && c.date === today());
  }

  function checkIn(id) {
    const m = getMember(id);
    if (!m) return { ok: false, error: 'Member not found.' };
    if (hasCheckedInToday(id)) return { ok: false, error: `${m.name} is already checked in today.` };
    if (isMonthly(m) && daysLeft(m.expiry) < 0) {
      return { ok: false, error: `${m.name}'s membership expired on ${m.expiry}. Please renew first.` };
    }
    const fee = isMonthly(m) ? 0 : feeFor(m);
    data.checkins.push({ memberId: id, fee, date: today(), time: new Date().toISOString() });
    if (fee > 0) recordPayment(id, fee, 'walk-in');
    save();
    return { ok: true, member: m, fee };
  }

  function search(query) {
    const q = query.trim().toLowerCase();
    return data.members.filter(m => !q || m.name.toLowerCase().includes(q));
  }

  function todaySummary() {
    const t = today();
    const sum = kind => data.payments
      .filter(p => p.date === t && p.kind === kind)
      .reduce((a, p) => a + p.amount, 0);
    const walkIn = sum('walk-in'), monthly = sum('monthly');
    return {
      checkins: data.checkins.filter(c => c.date === t).length,
      walkIn, monthly, total: walkIn + monthly
    };
  }

  // First run: a few sample members so the app can be tested immediately
  function seedIfEmpty() {
    if (data.members.length) return;
    const shift = n => { const d = new Date(); d.setDate(d.getDate() + n); return toISO(d); };
    const sample = [
      ['Juan Dela Cruz', '09171234501', 'Non-Student', 'Monthly', shift(-10), shift(20)],
      ['Maria Santos', '09171234502', 'Student', 'Monthly', shift(-27), shift(3)],
      ['Pedro Reyes', '09171234503', 'Non-Student', 'Monthly', shift(-45), shift(-15)],
      ['Ana Bautista', '09171234504', 'Student', 'Daily', shift(-2), shift(-2)]
    ];
    sample.forEach(([name, phone, type, plan, start, expiry]) => {
      data.seq += 1;
      data.members.push({
        id: `SNG-${new Date().getFullYear()}-${String(data.seq).padStart(3, '0')}`,
        name, phone, type, plan, start, expiry, createdAt: start
      });
    });
    save();
  }

  return { RATES, today, getMember, statusOf, isMonthly, feeFor, addMember, renew,
           checkIn, hasCheckedInToday, search, todaySummary, seedIfEmpty };
})();
