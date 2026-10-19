'use strict';
// ===== التشغيل: الراوتر، الأزرار، النماذج =====
function route() { return (location.hash || '').replace(/^#\/?/, '') || 'home'; }

function refreshUser() {
  const sid = store.get(LS.session, null);
  CURRENT = sid ? getUsers().find(u => u.id === sid) || null : null;
  if (CURRENT && CURRENT.status === 'approved') loadUD(CURRENT.id); else UD = null;
}

function render() {
  const app = $('#app'), r = route();
  if (r === 'owner-setup' && !hasAdmin()) { app.innerHTML = viewOwnerSetup(); return; }
  if (!CURRENT) { app.innerHTML = viewAuth(); return; }
  if (CURRENT.status !== 'approved') { app.innerHTML = viewPending(); return; }
  const pages = { home: viewHome, schedule: viewSchedule, notebook: viewNotebook, help: viewHelp, chat: viewChat, achievements: viewAch, setup: viewSetup, settings: viewSettings, admin: viewAdmin };
  const page = pages[r] ? r : 'home';
  app.innerHTML = shell(page, pages[page]());
  const box = $('#chatBox'); if (box) box.scrollTop = box.scrollHeight;
}
function refreshIfHome() { if (CURRENT && route() === 'home' || route() === 'notebook') render(); }
window.addEventListener('hashchange', () => { AUTH_ERR = ''; render(); window.scrollTo(0, 0); });

function enterApp() {
  refreshUser();
  if (CURRENT && CURRENT.status === 'approved') {
    // السلسلة اليومية
    const t = todayStr();
    if (UD.streak.last !== t) {
      UD.streak.count = UD.streak.last === addDays(t, -1) ? UD.streak.count + 1 : 1;
      UD.streak.last = t; UD.points += 5;
      toast(`🔥 ${UD.streak.count} يوم ورا بعض! +5 نقطة`, 'good');
    }
    checkBadges(); saveUD();
    NB_DATE = t;
  }
  AUTH_ERR = '';
  render();
}

// ----- الأزرار -----
const ACT = {
  authTab(el) { AUTH_TAB = el.dataset.tab; AUTH_ERR = ''; AUTH_INFO = ''; render(); },
  logout() { store.set(LS.session, null); CURRENT = null; UD = null; AUTH_TAB = 'login'; location.hash = '#/'; render(); },
  recheck() { enterApp(); },
  async copyText(el) { await copy(el.dataset.text); toast('اتنسخ ✅', 'good'); },
  async copyPrompt() { await copy(aiPrompt()); toast('اتنسخ البرومبت ✅ الصقه في ChatGPT', 'good'); },
  async enableNotif() {
    if (!('Notification' in window)) return toast('المتصفح مش بيدعم الإشعارات', 'err');
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'الإشعارات اتفعّلت ✅' : 'مفيش صلاحية إشعارات. هتوصلك التنبيهات جوه التطبيق بس.');
    render();
  },
  toggleLesson(el) {
    const key = el.dataset.date + '|' + el.dataset.id;
    if (el.checked) {
      UD.done[key] = true;
      if (!UD.awarded[key]) { UD.awarded[key] = 1; UD.stats.lessonsDone++; addPoints(15); }
    } else delete UD.done[key];
    checkBadges(); saveUD(); render();
  },
  toggleTask(el) {
    const list = UD.tasks[NB_DATE] || [], t = list.find(x => x.id === el.dataset.id); if (!t) return;
    t.done = el.checked;
    if (t.done && !UD.awarded['t' + t.id]) {
      UD.awarded['t' + t.id] = 1; UD.stats.tasksDone++; addPoints(10);
      if (list.length && list.every(x => x.done) && !UD.awarded['p' + NB_DATE]) { UD.awarded['p' + NB_DATE] = 1; UD.stats.perfectDays++; addPoints(20); toast('🌟 يوم مثالي! خلصت كل مهامك', 'good'); }
    }
    checkBadges(); saveUD(); render();
  },
  delTask(el) { UD.tasks[NB_DATE] = (UD.tasks[NB_DATE] || []).filter(t => t.id !== el.dataset.id); saveUD(); render(); },
  nbDay(el) { NB_DATE = addDays(NB_DATE, parseInt(el.dataset.n)); render(); },
  nbToday() { NB_DATE = todayStr(); render(); },
  carryOver() {
    const prev = addDays(NB_DATE, -1), left = (UD.tasks[prev] || []).filter(t => !t.done);
    if (!left.length) return toast('مفيش مهام متبقية من اليوم اللي فات 👌');
    UD.tasks[NB_DATE] = [...(UD.tasks[NB_DATE] || []), ...left.map(t => ({ id: rnd(), text: t.text, done: false }))];
    saveUD(); render(); toast(`اترحّلت ${left.length} مهمة`);
  },
  delItem(el) { UD.schedule = UD.schedule.filter(i => i.id !== el.dataset.id); saveUD(); render(); },
  clearSchedule() { if (confirm('تمسح الجدول كله؟')) { UD.schedule = []; saveUD(); render(); } },
  importSchedule(el) {
    if (!PENDING_IMPORT || !PENDING_IMPORT.items) return;
    UD.schedule = el.dataset.mode === 'replace' ? PENDING_IMPORT.items : [...UD.schedule, ...PENDING_IMPORT.items];
    const n = PENDING_IMPORT.items.length; PENDING_IMPORT = null;
    checkBadges(); saveUD(); toast(`تم استيراد ${n} موعد ✅`, 'good'); location.hash = '#/schedule';
  },
  downloadTemplate() {
    const csv = '﻿اليوم,التاريخ,المادة,الدرس/الموضوع,من,إلى,النوع,ملاحظات\nالسبت,,الفيزياء,الكهربية,16:00,18:00,حصة,السنتر\nالأحد,,الكيمياء,الاتزان الكيميائي,19:00,20:30,مذاكرة,\n,2026-11-20,الرياضيات,امتحان شهر,09:00,11:00,امتحان,المدرسة\n';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'نموذج-الجدول.csv'; a.click();
  },
  chatProv(el) { CHAT_PROVIDER = el.dataset.p; render(); },
  clearChat() { UD.chat[CHAT_PROVIDER] = []; saveUD(); render(); },
  askInChat(el) {
    const p = ['openai', 'claude', 'gemini'].find(k => (UD.settings.keys[k] || '').trim());
    if (!p) { toast('ضيف مفتاح API في الإعدادات الأول عشان الشات يشتغل'); location.hash = '#/settings'; return; }
    CHAT_PROVIDER = p; location.hash = '#/chat'; setTimeout(() => sendChat(el.dataset.q), 50);
  },
  exportData() {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(UD)], { type: 'application/json' }));
    a.download = `mina-backup-${todayStr()}.json`; a.click();
  },
  resetData() { if (confirm('هتمسح كل جدولك ونقطك ومهامك. متأكد؟')) { store.set(LS.data(CURRENT.id), {}); loadUD(CURRENT.id); render(); toast('اتمسحت البيانات'); } },
  // أدمن
  async setStatus(el) { await adminSet(el.dataset.id, el.dataset.s); },
  async showCode(el) { ADMIN_CODES[el.dataset.id] = await approvalCodeFor(el.dataset.id); render(); },
  async resetPw(el) {
    const pw = prompt('اكتب الباسورد الجديد (6 حروف على الأقل):'); if (!pw) return;
    if (pw.length < 6) return toast('الباسورد قصير', 'err');
    const us = getUsers(), u = us.find(x => x.id === el.dataset.id); if (!u) return;
    u.salt = rnd(); u.ph = await hashPw(pw, u.salt); saveUsers(us); toast('اتغيّر الباسورد ✅', 'good');
  },
  delUser(el) {
    if (!confirm('تحذف المستخدم وكل بياناته؟')) return;
    saveUsers(getUsers().filter(u => u.id !== el.dataset.id)); try { localStorage.removeItem(LS.data(el.dataset.id)); } catch { } render();
  }
};
async function adminSet(id, status) {
  const us = getUsers(), u = us.find(x => x.id === id); if (!u) return;
  u.status = status; saveUsers(us); toast(status === 'approved' ? `تم قبول ${u.name} ✅` : `تم رفض ${u.name}`); render();
}
async function copy(text) { try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } }

// ----- تغيّر قيم (change) -----
const CHG = {
  nbDate(el) { if (el.value) { NB_DATE = el.value; render(); } },
  saveNote(el) { UD.notes[NB_DATE] = el.value; saveUD(); },
  async uploadSchedule(el) {
    const f = el.files[0]; if (!f) return;
    const box = $('#preview'); box.innerHTML = '<p class="muted">بقرا الملف...</p>';
    try { PENDING_IMPORT = rowsToSchedule(await readSpreadsheetFile(f)); box.innerHTML = previewHtml(PENDING_IMPORT); }
    catch (e) { PENDING_IMPORT = null; box.innerHTML = previewHtml({ error: e.message || String(e) }); }
  },
  importData(el) {
    const f = el.files[0]; if (!f) return;
    f.text().then(t => { try { const d = JSON.parse(t); if (!d.schedule) throw 0; store.set(LS.data(CURRENT.id), d); loadUD(CURRENT.id); render(); toast('اتسترجعت النسخة ✅', 'good'); } catch { toast('الملف مش نسخة صحيحة', 'err'); } });
  }
};

// ----- النماذج -----
async function sendChat(text) {
  const p = CHAT_PROVIDER; if (CHAT_BUSY || !text) return;
  const hist = UD.chat[p] = UD.chat[p] || [];
  hist.push({ role: 'user', content: text }); UD.stats.chats++; checkBadges(); saveUD();
  CHAT_BUSY = true; render();
  try {
    const reply = await callAI(p, hist.slice(-20).map(m => ({ role: m.role, content: m.content })));
    hist.push({ role: 'assistant', content: reply });
  } catch (e) {
    hist.push({ role: 'sys', content: e.message === 'NO_KEY' ? 'مفيش مفتاح API. ضيفه من الإعدادات.' : 'حصل خطأ: ' + (e.message || e) + (String(e.message).includes('fetch') ? ' (اتأكد من النت)' : '') });
  }
  CHAT_BUSY = false; saveUD(); render();
}
const FORMS = {
  async login(f) {
    const d = new FormData(f), email = d.get('email').trim().toLowerCase();
    const u = getUsers().find(x => x.email === email);
    if (!u || (await hashPw(d.get('pw'), u.salt)) !== u.ph) { AUTH_ERR = 'الإيميل أو الباسورد غلط.'; return render(); }
    store.set(LS.session, u.id); enterApp();
  },
  async register(f) {
    const d = new FormData(f), email = d.get('email').trim().toLowerCase();
    if (d.get('pw') !== d.get('pw2')) { AUTH_ERR = 'الباسوردين مش متطابقين.'; return render(); }
    if (getUsers().some(x => x.email === email)) { AUTH_ERR = 'الإيميل ده متسجل قبل كده. جرّب تدخل.'; return render(); }
    const salt = rnd();
    const u = { id: 'u' + Date.now().toString(36) + rnd().slice(0, 3), name: d.get('name').trim(), school: d.get('school').trim(), grade: d.get('grade'), email, salt, ph: await hashPw(d.get('pw'), salt), role: 'student', status: 'pending', createdAt: new Date().toISOString() };
    const us = getUsers(); us.push(u); saveUsers(us); store.set(LS.session, u.id); enterApp();
  },
  async ownerSetup(f) {
    if (hasAdmin()) { location.hash = '#/'; return; }
    const d = new FormData(f), email = d.get('email').trim().toLowerCase(), salt = rnd();
    const us = getUsers().filter(x => x.email !== email);
    const u = { id: 'admin' + rnd(), name: d.get('name').trim(), school: '-', grade: 'sec3', email, salt, ph: await hashPw(d.get('pw'), salt), role: 'admin', status: 'approved', createdAt: new Date().toISOString() };
    us.push(u); saveUsers(us); store.set(LS.session, u.id); location.hash = '#/home'; enterApp();
  },
  async approvalCode(f) {
    const code = new FormData(f).get('code').trim();
    if (code === await approvalCodeFor(CURRENT.id)) { const us = getUsers(), u = us.find(x => x.id === CURRENT.id); u.status = 'approved'; saveUsers(us); enterApp(); }
    else { AUTH_ERR = 'رمز الموافقة غلط.'; render(); }
  },
  async importRequest(f) {
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(new FormData(f).get('code').trim()))));
      if (!o.id || !o.email || !o.ph) throw 0;
      const us = getUsers();
      if (us.some(u => u.id === o.id || u.email === o.email)) return toast('الطلب ده موجود بالفعل');
      us.push({ id: o.id, name: o.name, school: o.school, grade: o.grade, email: o.email, salt: o.salt, ph: o.ph, role: 'student', status: 'pending', createdAt: o.at || new Date().toISOString() });
      saveUsers(us); toast('تم استيراد الطلب ✅', 'good'); render();
    } catch { toast('الرمز ده مش صحيح', 'err'); }
  },
  addTask(f) {
    const t = new FormData(f).get('text').trim(); if (!t) return;
    (UD.tasks[NB_DATE] = UD.tasks[NB_DATE] || []).push({ id: rnd(), text: t, done: false }); saveUD(); render();
  },
  addItem(f) {
    const d = new FormData(f), date = d.get('date') || null;
    UD.schedule.push({ id: rnd(), day: date ? dowOf(date) : parseInt(d.get('day')), date, subject: d.get('subject').trim(), topic: d.get('topic').trim(), start: d.get('from') || '', end: d.get('to') || '', type: '', notes: '' });
    checkBadges(); saveUD(); render(); toast('اتضاف الموعد ✅', 'good');
  },
  help(f) {
    const d = new FormData(f); HELP_RESULT = { subject: d.get('subject').trim(), topic: d.get('topic').trim() };
    UD.stats.helps++; checkBadges(); saveUD(); render();
  },
  chat(f) { const q = new FormData(f).get('q').trim(); sendChat(q); },
  settings(f) {
    const d = new FormData(f), s = UD.settings;
    s.lead = Math.max(0, parseInt(d.get('lead')) || 0); s.morning = d.get('morning') || ''; s.evening = d.get('evening') || '';
    for (const k of ['openai', 'gemini', 'claude']) { s.keys[k] = d.get('key_' + k).trim(); s.models[k] = d.get('model_' + k).trim() || s.models[k]; }
    s.fahhimni = d.get('fahhimni').trim(); saveUD(); toast('اتحفظت الإعدادات ✅', 'good');
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !ACT[el.dataset.act]) return;
  if (el.tagName === 'INPUT') return; // الشيك بوكس بيتعالج في change
  ACT[el.dataset.act](el);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.matches('input[type=checkbox][data-act]')) return ACT[el.dataset.act](el);
  if (el.dataset && el.dataset.change && CHG[el.dataset.change]) CHG[el.dataset.change](el);
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault(); const fn = FORMS[f.dataset.form]; if (fn) fn(f);
});

// ----- تشغيل -----
enterApp();
setInterval(tickReminders, 30000);
setTimeout(tickReminders, 1500);
