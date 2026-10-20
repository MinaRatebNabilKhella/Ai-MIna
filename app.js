'use strict';
// ===== التشغيل: الراوتر، الأزرار، النماذج =====
function route() { return (location.hash || '').replace(/^#\/?/, '') || 'home'; }

async function refreshUser() {
  const sb = initSupabase();
  CURRENT = null; UD = null;
  if (!sb) return;
  const profile = await fetchMyProfile();
  if (!profile) return;
  CURRENT = profile;
  if (CURRENT.status === 'approved') {
    loadUD(CURRENT.id);
    if (CURRENT.role === 'student') {
      try { await loadCloudUserData(CURRENT.id); }
      catch (e) { console.error('Cloud data load failed:', e); toast('تعذر تحميل البيانات السحابية؛ هتظهر آخر نسخة محفوظة على الجهاز.', 'err'); }
    }
  }
}

let ADMIN_LOADING = false, ADMIN_LOADED = false, ADMIN_USAGE = {}, ADMIN_LOAD_ERROR = '';
async function loadAdminUsers() {
  const sb = initSupabase();
  if (!sb || !CURRENT || CURRENT.role !== 'admin' || ADMIN_LOADING) return;
  ADMIN_LOADING = true; ADMIN_LOAD_ERROR = '';
  try {
    const { data, error } = await sb.from('profiles').select('id,email,name,school,grade,phone,governorate,address,role,status,created_at,updated_at').neq('role', 'admin').order('created_at', { ascending: false });
    if (error) throw error;
    saveUsers((data || []).map(mapProfile));
    const cairoParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
    const cairoDate = `${cairoParts.year}-${cairoParts.month}-${cairoParts.day}`;
    const { data: usageRows, error: usageError } = await sb.from('usage_daily').select('user_id,usage_type,requests').eq('usage_date', cairoDate);
    if (!usageError) {
      ADMIN_USAGE = {};
      for (const row of (usageRows || [])) {
        ADMIN_USAGE[row.user_id] ||= { ai: 0, youtube: 0 };
        ADMIN_USAGE[row.user_id][row.usage_type] = row.requests;
      }
    }
    ADMIN_LOADED = true;
  } catch (e) {
    ADMIN_LOAD_ERROR = 'تعذر تحميل قائمة الطلاب: ' + (e.message || e);
    ADMIN_LOADED = true;
    toast(ADMIN_LOAD_ERROR, 'err');
  } finally { ADMIN_LOADING = false; }
}

function render() {
  const app = $('#app'), r = route();
  if (!cloudConfigured() || !initSupabase()) {
    app.innerHTML = viewCloudSetup(); return;
  }
  if (PASSWORD_RECOVERY || !CURRENT) { app.innerHTML = viewAuth(); return; }
  if (CURRENT.status !== 'approved') { app.innerHTML = viewPending(); return; }
  const pages = { home: viewHome, schedule: viewSchedule, notebook: viewNotebook, help: viewHelp, chat: viewChat, achievements: viewAch, setup: viewSetup, settings: viewSettings, admin: viewAdmin };
  const page = pages[r] ? r : 'home';
  if (page === 'admin' && CURRENT.role === 'admin' && !ADMIN_LOADED) {
    app.innerHTML = shell(page, '<div class="card">جاري تحميل لوحة الأدمن والطلاب…</div>');
    loadAdminUsers().then(() => render()); return;
  }
  app.innerHTML = shell(page, pages[page]());
  const box = $('#chatBox'); if (box) box.scrollTop = box.scrollHeight;
}
function refreshIfHome() { if (CURRENT && route() === 'home' || route() === 'notebook') render(); }
window.addEventListener('hashchange', () => { AUTH_ERR = ''; render(); window.scrollTo(0, 0); });

async function enterApp() {
  try { await refreshUser(); }
  catch (e) { CURRENT = null; UD = null; AUTH_ERR = 'تعذر الاتصال بالخادم: ' + (e.message || e); }
  if (CURRENT && CURRENT.status === 'approved') {
    if (!UD) loadUD(CURRENT.id);
    const t = todayStr();
    if (CURRENT.role === 'student' && UD.streak.last !== t) {
      UD.streak.count = UD.streak.last === addDays(t, -1) ? UD.streak.count + 1 : 1;
      UD.streak.last = t; UD.points += 5;
      toast(`🔥 ${UD.streak.count} يوم ورا بعض! +5 نقطة`, 'good');
      checkBadges(); saveUD();
    }
    NB_DATE = t;
  }
  render();
}

// ----- الأزرار -----
const ACT = {
  authTab(el) { AUTH_TAB = el.dataset.tab; AUTH_ERR = ''; AUTH_INFO = ''; render(); },
  async logout() { const sb = initSupabase(); if (sb) await sb.auth.signOut(); stopCloudDataSubscription(); CLOUD_DIRTY = false; CURRENT = null; UD = null; CLOUD_USERS = []; ADMIN_LOADED = false; ADMIN_LOAD_ERROR = ''; ADMIN_CODES = {}; AUTH_TAB = 'login'; AUTH_INFO = ''; location.hash = '#/'; render(); },
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
    CHAT_PROVIDER = 'gemini'; location.hash = '#/chat'; setTimeout(() => sendChat(el.dataset.q), 50);
  },
  exportData() {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(UD)], { type: 'application/json' }));
    a.download = `mina-backup-${todayStr()}.json`; a.click();
  },
  resetData() { if (confirm('هتمسح كل جدولك ونقطك ومهامك من الأجهزة المتزامنة. متأكد؟')) { store.set(LS.data(CURRENT.id), {}); loadUD(CURRENT.id); saveUD(); render(); toast('اتمسحت البيانات'); } },
  // أدمن
  async setStatus(el) { await adminSet(el.dataset.id, el.dataset.s); },
  async showCode(el) {
    const sb = initSupabase(); if (!sb) return;
    if (ADMIN_CODES[el.dataset.id]) return;
    const { data, error } = await sb.rpc('generate_approval_code', { p_user_id: el.dataset.id });
    if (error) return toast('تعذر إنشاء رمز الموافقة: ' + error.message, 'err');
    ADMIN_CODES[el.dataset.id] = data; render();
  },
  async copyApprovalCode(el) {
    const code = ADMIN_CODES[el.dataset.id];
    if (!code) return toast('أنشئ رمز الموافقة أولًا.', 'err');
    await copy(code); toast('تم نسخ رمز الموافقة. أرسله للطالب عبر واتساب.', 'good');
  },
  async resetPw(el) {
    const u = getUsers().find(x => x.id === el.dataset.id); if (!u) return;
    const sb = initSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(u.email, { redirectTo: location.origin + location.pathname });
    if (error) return toast('تعذر إرسال رابط تعيين كلمة المرور: ' + error.message, 'err');
    toast('تم إرسال رابط تغيير كلمة المرور إلى بريد الطالب ✅', 'good');
  },
  async exportStudentData(el) {
    const sb = initSupabase(); if (!sb || !CURRENT || CURRENT.role !== 'admin') return;
    const u = getUsers().find(x => x.id === el.dataset.id); if (!u) return;
    const { data, error } = await sb.from('student_data').select('data,updated_at').eq('user_id', u.id).maybeSingle();
    if (error) return toast('تعذر قراءة بيانات الطالب: ' + error.message, 'err');
    const payload = { student: { name: u.name, email: u.email, grade: u.grade, status: u.status }, data: data?.data || {}, updated_at: data?.updated_at || null };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    a.download = `mina-student-${String(u.email).replace(/[^a-z0-9.-]/gi, '_')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  async delUser(el) {
    if (!confirm('إيقاف الحساب؟ سيظهر للطالب أن الحساب أُوقف، ولن يُسمح له بالدخول للبيانات.')) return;
    await adminSet(el.dataset.id, 'deleted');
  }
};
async function adminSet(id, status) {
  if (!['approved', 'rejected', 'pending', 'deleted'].includes(status)) return;
  const sb = initSupabase(), u = getUsers().find(x => x.id === id);
  if (!sb || !u) return;
  const { error } = await sb.from('profiles').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return toast('تعذر تحديث الحساب: ' + error.message, 'err');
  u.status = status; delete ADMIN_CODES[id]; saveUsers(getUsers());
  toast(status === 'approved' ? `تم قبول ${u.name} ✅` : status === 'rejected' ? `تم رفض ${u.name}` : status === 'deleted' ? `تم إيقاف حساب ${u.name}` : 'تم تحديث الحالة');
  render();
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
    f.text().then(t => { try { const d = JSON.parse(t); if (!d.schedule) throw 0; store.set(LS.data(CURRENT.id), d); loadUD(CURRENT.id); saveUD(); render(); toast('اتسترجعت النسخة ✅', 'good'); } catch { toast('الملف مش نسخة صحيحة', 'err'); } });
  }
};

// ----- النماذج -----
async function sendChat(text) {
  const p = CHAT_PROVIDER; if (CHAT_BUSY || !text) return;
  const hist = UD.chat[p] = UD.chat[p] || [];
  hist.push({ role: 'user', content: text }); UD.stats.chats++; checkBadges(); saveUD();
  CHAT_BUSY = true; render();
  try {
    const reply = await callAI(p, hist.slice(-20).filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.content })));
    hist.push({ role: 'assistant', content: reply });
  } catch (e) {
    hist.push({ role: 'sys', content: e.message === 'NO_KEY' ? 'مفيش مفتاح API. ضيفه من الإعدادات.' : 'حصل خطأ: ' + (e.message || e) + (String(e.message).includes('fetch') ? ' (اتأكد من النت)' : '') });
  }
  CHAT_BUSY = false; saveUD(); render();
}
const FORMS = {
  async updatePassword(f) {
    const sb = initSupabase();
    if (!sb) { AUTH_ERR = 'إعداد الاتصال السحابي غير مكتمل.'; return render(); }
    const d = new FormData(f), pw = String(d.get('pw') || ''), pw2 = String(d.get('pw2') || '');
    if (pw.length < 8) { AUTH_ERR = 'كلمة المرور لازم تكون 8 أحرف على الأقل.'; return render(); }
    if (pw !== pw2) { AUTH_ERR = 'كلمتا المرور غير متطابقتين.'; return render(); }
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) { AUTH_ERR = 'تعذر تحديث كلمة المرور: ' + error.message; return render(); }
    PASSWORD_RECOVERY = false; AUTH_ERR = ''; AUTH_INFO = 'تم تغيير كلمة المرور. سجّل الدخول باستخدام كلمة المرور الجديدة.';
    await sb.auth.signOut(); CURRENT = null; UD = null; stopCloudDataSubscription(); CLOUD_DIRTY = false; AUTH_TAB = 'login'; render();
  },
  async login(f) {
    const sb = initSupabase();
    if (!sb) { AUTH_ERR = 'إعداد الاتصال السحابي غير مكتمل.'; return render(); }
    const d = new FormData(f), email = String(d.get('email') || '').trim().toLowerCase();
    const { error } = await sb.auth.signInWithPassword({ email, password: String(d.get('pw') || '') });
    if (error) { AUTH_ERR = 'تعذر تسجيل الدخول: ' + error.message; return render(); }
    AUTH_ERR = ''; AUTH_INFO = '';
    ADMIN_LOADED = false; await enterApp();
  },
  async register(f) {
    const sb = initSupabase();
    if (!sb) { AUTH_ERR = 'إعداد الاتصال السحابي غير مكتمل.'; return render(); }
    const d = new FormData(f), email = String(d.get('email') || '').trim().toLowerCase();
    if (d.get('pw') !== d.get('pw2')) { AUTH_ERR = 'الباسوردين مش متطابقين.'; return render(); }
    const metadata = {
      name: String(d.get('name') || '').trim(),
      school: String(d.get('school') || '').trim(),
      grade: String(d.get('grade') || 'sec3'),
      phone: String(d.get('phone') || '').trim(),
      governorate: String(d.get('governorate') || '').trim(),
      address: String(d.get('address') || '').trim()
    };
    if (!metadata.name || !metadata.school || !metadata.phone || !metadata.governorate || !metadata.address) {
      AUTH_ERR = 'من فضلك املى كل بيانات الحساب المطلوبة.'; return render();
    }
    const { data, error } = await sb.auth.signUp({ email, password: String(d.get('pw') || ''), options: { data: metadata } });
    if (error) { AUTH_ERR = 'تعذر إنشاء الحساب: ' + error.message; return render(); }
    AUTH_ERR = '';
    if (!data.session) {
      AUTH_TAB = 'login';
      AUTH_INFO = 'تم إنشاء الطلب. افتح رسالة تأكيد البريد الإلكتروني أولًا، ثم سجّل الدخول لمتابعة حالة موافقة الأدمن.';
      return render();
    }
    ADMIN_LOADED = false; await enterApp();
  },
  async approvalCode(f) {
    const sb = initSupabase(), code = String(new FormData(f).get('code') || '').trim();
    if (!sb || !CURRENT || !code) return;
    const { data, error } = await sb.rpc('redeem_approval_code', { p_code: code });
    if (error) { AUTH_ERR = 'تعذر التحقق من الرمز: ' + error.message; return render(); }
    if (data === true) { AUTH_ERR = ''; await enterApp(); }
    else { AUTH_ERR = 'رمز الموافقة غير صحيح أو انتهت صلاحيته.'; render(); }
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
  async help(f) {
    const d = new FormData(f);
    const subject = String(d.get('subject') || '').trim(), topic = String(d.get('topic') || '').trim();
    if (!subject || !topic) return;
    HELP_RESULT = { subject, topic, videos: [] };
    UD.stats.helps++; checkBadges(); saveUD(); render();
    const sb = initSupabase();
    if (!sb) return;
    const { data, error } = await sb.functions.invoke('youtube-recommendations', { body: { subject, topic } });
    if (HELP_RESULT?.subject !== subject || HELP_RESULT?.topic !== topic) return;
    if (error || data?.error) {
      console.warn('YouTube recommendation issue:', error?.message || data?.error);
      toast(data?.error || 'تعذر تحميل فيديوهات محددة؛ استخدم روابط البحث البديلة.', 'err');
      return;
    }
    HELP_RESULT.videos = Array.isArray(data?.videos) ? data.videos : [];
    render();
  },
  chat(f) { const q = new FormData(f).get('q').trim(); sendChat(q); },
  settings(f) {
    const d = new FormData(f), s = UD.settings;
    s.lead = Math.max(0, parseInt(d.get('lead')) || 0); s.morning = d.get('morning') || ''; s.evening = d.get('evening') || '';
    // مفاتيح النماذج لا تدخل إلى المتصفح؛ مسؤول الخادم يضبطها في Secrets.
    s.keys = { openai: '', gemini: '', claude: '' };
    s.fahhimni = String(d.get('fahhimni') || '').trim(); saveUD(); toast('اتحفظت الإعدادات ✅', 'good');
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

async function refreshAccountStatus() {
  if (!CURRENT || !initSupabase()) return;
  try {
    const latest = await fetchMyProfile();
    if (!latest) return;
    if (latest.status !== CURRENT.status || latest.role !== CURRENT.role) {
      CURRENT = latest;
      if (CURRENT.status === 'approved') {
        loadUD(CURRENT.id);
        if (CURRENT.role === 'student') await loadCloudUserData(CURRENT.id);
      } else {
        stopCloudDataSubscription(); CLOUD_DIRTY = false; UD = null;
      }
      render();
    }
  } catch (e) { console.warn('Account status refresh failed:', e); }
}
window.addEventListener('focus', refreshAccountStatus);

// ----- تشغيل -----
const appSupabase = initSupabase();
if (appSupabase) appSupabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') { PASSWORD_RECOVERY = true; CURRENT = null; UD = null; AUTH_ERR = ''; AUTH_INFO = ''; render(); }
});
enterApp();
setInterval(tickReminders, 30000);
setInterval(refreshAccountStatus, 60000);
setTimeout(tickReminders, 1500);
