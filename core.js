'use strict';
// ===== الأساسيات: تخزين، تواريخ، جدول، نقاط، إشعارات، ذكاء اصطناعي =====
const CFG = window.MINA_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const GRADES = [
  { id: 'p6', name: 'السادس الابتدائي', stage: 'school' },
  { id: 'prep3', name: 'الثالث الإعدادي', stage: 'school' },
  { id: 'sec1', name: 'الأولى الثانوي', stage: 'school' },
  { id: 'sec2', name: 'الثانية الثانوي', stage: 'school' },
  { id: 'sec3', name: 'الثالثة الثانوي (الثانوية العامة)', stage: 'school' },
  { id: 'uni3', name: 'الثالثة الجامعة', stage: 'uni' },
  { id: 'uni4', name: 'الرابعة الجامعة', stage: 'uni' }
];
const gradeOf = id => GRADES.find(g => g.id === id) || GRADES[0];

// ----- اتصال آمن بالخادم -----
const LS = { data: id => 'mina_data_' + id };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast('المتصفح منع حفظ البيانات محليًا.', 'err'); return false; } }
};
let SUPABASE = null;
let CLOUD_USERS = [];
let CLOUD_SAVE_TIMER = null;
let CLOUD_DIRTY = false;
let CLOUD_DATA_CHANNEL = null;
function cloudConfigured() {
  return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && /^https:\/\//.test(CFG.SUPABASE_URL) && !String(CFG.SUPABASE_URL).includes('YOUR_PROJECT') && !String(CFG.SUPABASE_ANON_KEY).includes('YOUR_'));
}
function initSupabase() {
  if (SUPABASE) return SUPABASE;
  if (!cloudConfigured() || !window.supabase?.createClient) return null;
  SUPABASE = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return SUPABASE;
}
const getUsers = () => CLOUD_USERS;
const saveUsers = users => { CLOUD_USERS = Array.isArray(users) ? users : []; };
const hasAdmin = () => !!initSupabase(); // لا يوجد إعداد أدمن من المتصفح؛ صلاحيات الأدمن يحددها الخادم فقط.

// ----- أدوات مساعدة -----
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  if (window.crypto && crypto.subtle) {
    const h = await crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('هذا المتصفح لا يدعم التشفير المطلوب. افتح التطبيق بمتصفح حديث.');
}
const rnd = () => crypto.getRandomValues(new Uint32Array(2)).join('').slice(0, 12);
const mapProfile = row => row ? ({
  id: row.id, name: row.name || '', school: row.school || '', grade: row.grade || 'sec3',
  email: row.email || '', role: row.role || 'student', status: row.status || 'pending',
  phone: row.phone || '', governorate: row.governorate || '', address: row.address || '',
  createdAt: row.created_at || row.createdAt || ''
}) : null;
async function fetchMyProfile() {
  const sb = initSupabase();
  if (!sb) return null;
  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) return null;
  const { data, error } = await sb.from('profiles').select('id,email,name,school,grade,phone,governorate,address,role,status,created_at,updated_at').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return mapProfile(data);
}

// ----- تواريخ -----
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };
const dowOf = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]; // السبت أولاً
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtDate = s => { const [y, m, d] = s.split('-').map(Number); return `${DAYS_AR[dowOf(s)]} ${d}/${m}/${y}`; };

// ----- قراءة الجدول من الإكسل -----
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function norm(v) {
  return String(v ?? '').trim().toLowerCase()
    .replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d))
    .replace(/[ً-ْـ]/g, '')
    .replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
}
const HEADERS = {
  day: ['اليوم', 'day'], date: ['التاريخ', 'date'], subject: ['المادة', 'subject', 'course'],
  topic: ['الدرس', 'الموضوع', 'topic', 'lesson'], from: ['من', 'start', 'from', 'البدايه', 'بدايه'],
  to: ['الي', 'الى', 'end', 'to', 'النهايه', 'نهايه'], type: ['النوع', 'type'], notes: ['ملاحظات', 'notes', 'note']
};
function headerKey(h) {
  const n = norm(h); if (!n) return null;
  for (const k in HEADERS) for (const x of HEADERS[k]) {
    const nx = norm(x);
    if (n === nx || (nx.length > 3 && n.startsWith(nx))) return k;
  }
  return null;
}
const DAY_MAP = {
  'الاحد': 0, 'احد': 0, 'sunday': 0, 'sun': 0, 'الاثنين': 1, 'الاتنين': 1, 'اثنين': 1, 'monday': 1, 'mon': 1,
  'الثلاثاء': 2, 'التلات': 2, 'الثلاثا': 2, 'tuesday': 2, 'tue': 2, 'الاربعاء': 3, 'الاربعا': 3, 'wednesday': 3, 'wed': 3,
  'الخميس': 4, 'thursday': 4, 'thu': 4, 'الجمعه': 5, 'friday': 5, 'fri': 5, 'السبت': 6, 'saturday': 6, 'sat': 6
};
function parseDay(v) { const n = norm(v); if (n in DAY_MAP) return DAY_MAP[n]; for (const k in DAY_MAP) if (n && n.includes(k) && k.length > 3) return DAY_MAP[k]; return null; }
function parseDate(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') { if (v < 20000) return null; const d = new Date(Math.round((v - 25569) * 86400000)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
  const s = norm(v);
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/); if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/); if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
}
function parseTime(v) {
  if (v === '' || v == null) return '';
  if (typeof v === 'number') { const frac = v >= 1 ? v - Math.floor(v) : v; const mins = Math.round(frac * 1440) % 1440; return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`; }
  const s = norm(v);
  const m = s.match(/(\d{1,2})\s*(?:[:.]\s*(\d{2}))?\s*(am|pm|ص|م)?/);
  if (!m) return '';
  let h = parseInt(m[1]); const mi = parseInt(m[2] || '0');
  if (m[3] === 'pm' || m[3] === 'م') { if (h < 12) h += 12; }
  if ((m[3] === 'am' || m[3] === 'ص') && h === 12) h = 0;
  if (h > 23 || mi > 59) return '';
  return `${pad(h)}:${pad(mi)}`;
}
function rowsToSchedule(rows) {
  let hi = rows.findIndex(r => r.filter(c => headerKey(c)).length >= 2);
  let map = {};
  if (hi >= 0) rows[hi].forEach((c, i) => { const k = headerKey(c); if (k && !(k in map)) map[k] = i; });
  else { hi = -1; ['day', 'date', 'subject', 'topic', 'from', 'to', 'type', 'notes'].forEach((k, i) => map[k] = i); }
  const items = []; let skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const g = k => (k in map ? r[map[k]] : '');
    const subject = String(g('subject') ?? '').trim();
    const topic = String(g('topic') ?? '').trim();
    if (!subject && !topic) { if (r.some(c => String(c).trim())) skipped++; continue; }
    let day = parseDay(g('day')); let date = parseDate(g('date'));
    if (date == null) date = parseDate(g('day'));
    if (day == null && date) day = dowOf(date);
    if (day == null && !date) { skipped++; continue; }
    items.push({
      id: rnd(), day, date: date || null, subject, topic,
      start: parseTime(g('from')), end: parseTime(g('to')),
      type: String(g('type') ?? '').trim(), notes: String(g('notes') ?? '').trim()
    });
  }
  return { items, skipped };
}
function itemsFor(date) {
  const dow = dowOf(date);
  return UD.schedule.filter(i => i.date ? i.date === date : i.day === dow)
    .sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
}

// ----- بيانات المستخدم -----
let UD = null;
function defaultData() {
  return {
    schedule: [], tasks: {}, notes: {}, done: {}, awarded: {}, points: 0,
    stats: { tasksDone: 0, lessonsDone: 0, perfectDays: 0, chats: 0, helps: 0 },
    badges: {}, streak: { count: 0, last: '' }, fired: {},
    settings: {
      lead: 15, morning: '08:00', evening: '20:00', fahhimni: '',
      keys: { openai: '', gemini: '', claude: '' },
      models: { openai: 'gpt-4.1-mini', gemini: 'gemini-3.8-flash', claude: 'claude-haiku-4-5' }
    },
    chat: { openai: [], gemini: [], claude: [] }
  };
}
function applyUserData(s = {}) {
  const base = defaultData();
  UD = Object.assign(base, s || {});
  UD.settings = Object.assign(defaultData().settings, (s || {}).settings || {});
  // لا تحفظ مفاتيح API في المتصفح؛ كل استدعاءات الذكاء الاصطناعي تمر عبر الخادم.
  UD.settings.keys = { openai: '', gemini: '', claude: '' };
  UD.settings.models = Object.assign(defaultData().settings.models, (s || {}).settings?.models || {});
  UD.stats = Object.assign(defaultData().stats, (s || {}).stats || {});
  UD.chat = Object.assign(defaultData().chat, (s || {}).chat || {});
}
function loadUD(id) { applyUserData(store.get(LS.data(id), {})); }
function stopCloudDataSubscription() {
  if (CLOUD_DATA_CHANNEL && SUPABASE) { SUPABASE.removeChannel(CLOUD_DATA_CHANNEL); CLOUD_DATA_CHANNEL = null; }
}
let CURRENT = null; // المستخدم الحالي
const saveUD = () => {
  if (!CURRENT || CURRENT.role !== 'student' || CURRENT.status !== 'approved' || !UD) return;
  store.set(LS.data(CURRENT.id), UD);
  CLOUD_DIRTY = true;
  const sb = initSupabase();
  if (!sb) return;
  clearTimeout(CLOUD_SAVE_TIMER);
  const userId = CURRENT.id;
  const snapshot = JSON.parse(JSON.stringify(UD));
  CLOUD_SAVE_TIMER = setTimeout(async () => {
    CLOUD_SAVE_TIMER = null;
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user || user.id !== userId) return;
      const { error } = await sb.from('student_data').upsert({ user_id: userId, data: snapshot, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) console.error('Cloud save failed:', error.message);
      else if (CURRENT?.id === userId && JSON.stringify(UD) === JSON.stringify(snapshot)) CLOUD_DIRTY = false;
    } catch (e) { console.error('Cloud save failed:', e); }
  }, 600);
};
async function loadCloudUserData(id) {
  const sb = initSupabase();
  if (!sb || !CURRENT || CURRENT.role !== 'student' || CURRENT.status !== 'approved') return;
  const { data, error } = await sb.from('student_data').select('data').eq('user_id', id).maybeSingle();
  if (error) throw error;
  const local = store.get(LS.data(id), {});
  if (data?.data) {
    applyUserData(data.data);
    store.set(LS.data(id), UD);
    CLOUD_DIRTY = false;
  } else {
    applyUserData(local);
    const { error: saveError } = await sb.from('student_data').upsert({ user_id: id, data: UD, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (saveError) throw saveError;
    CLOUD_DIRTY = false;
  }
  stopCloudDataSubscription();
  CLOUD_DATA_CHANNEL = sb.channel(`mina-student-data-${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'student_data', filter: `user_id=eq.${id}` }, payload => {
      if (!CURRENT || CURRENT.id !== id || CURRENT.status !== 'approved' || CLOUD_DIRTY || !payload.new?.data) return;
      if (JSON.stringify(payload.new.data) === JSON.stringify(UD)) return;
      applyUserData(payload.new.data);
      store.set(LS.data(id), UD);
      if (typeof render === 'function') render();
    })
    .subscribe();
}

// ----- نقاط وإنجازات -----
const BADGES = [
  { id: 'start', ic: '🚀', name: 'البداية', desc: 'ارفع جدولك لأول مرة', test: u => u.schedule.length > 0 },
  { id: 'task1', ic: '✅', name: 'أول مهمة', desc: 'خلّص مهمة واحدة', test: u => u.stats.tasksDone >= 1 },
  { id: 'task10', ic: '💪', name: 'عشر مهام', desc: 'خلّص 10 مهام', test: u => u.stats.tasksDone >= 10 },
  { id: 'task50', ic: '🏆', name: 'خمسين مهمة', desc: 'خلّص 50 مهمة', test: u => u.stats.tasksDone >= 50 },
  { id: 'lesson5', ic: '📚', name: 'مواظب', desc: 'علّم على 5 دروس/مواعيد من جدولك إنك خلصتها', test: u => u.stats.lessonsDone >= 5 },
  { id: 'perfect', ic: '🌟', name: 'يوم مثالي', desc: 'خلّص كل مهام يوم كامل', test: u => u.stats.perfectDays >= 1 },
  { id: 'streak3', ic: '🔥', name: '3 أيام ورا بعض', desc: 'افتح التطبيق 3 أيام متتالية', test: u => u.streak.count >= 3 },
  { id: 'streak7', ic: '⚡', name: 'أسبوع كامل', desc: '7 أيام متتالية', test: u => u.streak.count >= 7 },
  { id: 'pts100', ic: '💯', name: '100 نقطة', desc: 'اجمع 100 نقطة', test: u => u.points >= 100 },
  { id: 'pts500', ic: '👑', name: '500 نقطة', desc: 'اجمع 500 نقطة', test: u => u.points >= 500 },
  { id: 'chat', ic: '💬', name: 'سأل واتعلم', desc: 'ابعت أول سؤال في الشات', test: u => u.stats.chats >= 1 },
  { id: 'help', ic: '🧠', name: 'مش فاهم؟ مفيش مشكلة', desc: 'اطلب ترشيحات لدرس مش فاهمه', test: u => u.stats.helps >= 1 }
];
function checkBadges() {
  let any = false;
  for (const b of BADGES) if (!UD.badges[b.id] && b.test(UD)) { UD.badges[b.id] = todayStr(); toast(`🎉 إنجاز جديد: ${b.name}`, 'good'); any = true; }
  return any;
}
function addPoints(n) { UD.points += n; toast(`+${n} نقطة ⭐`, 'good'); }
const level = () => Math.floor(UD.points / 100) + 1;

const MOTIVATION = [
  'خطوة صغيرة النهاردة أحسن من خطة كبيرة مبتبدأش. ابدأ بأسهل حاجة!',
  'مش لازم تكون متحمس عشان تبدأ، ابدأ والحماس هييجي.',
  'ساعة مذاكرة مركزة أحسن من 4 ساعات مشتتة. اقفل الموبايل وركّز.',
  'كل درس بتخلصه النهاردة هو حمل أقل عليك بكرة.',
  'الاستمرار بيغلب الموهبة. حافظ على سلسلة أيامك!',
  'استريح 5 دقايق كل 25 دقيقة مذاكرة، ده مش كسل ده تكتيك.',
  'اشرب مياه وخد نفس عميق. إنت قدها 💪',
  'غلطة النهاردة هي معلومة مش هتنساها في الامتحان.',
  'قارن نفسك بنفسك إمبارح، مش بحد تاني.'
];
const GRADE_MOTIVATION = {
  sec3: 'الثانوية العامة ماراثون مش سباق سرعة. انتظامك أهم من أي ليلة سهر.',
  prep3: 'الإعدادية بتبني أساس الثانوي. كل درس دلوقتي بيسهّل عليك سنين جاية.',
  sec1: 'أولى ثانوي بداية قوية بتفرق. اتعود على الانتظام من دلوقتي.',
  sec2: 'تانية ثانوي هي سنة الأساس الحقيقية للتالتة. ذاكر بفهم مش بحفظ.',
  p6: 'شاطر! كل يوم شوية بتعمل فرق كبير. 🌟',
  uni3: 'مذاكرة الجامعة بالفهم والتطبيق. حل أمثلة أكتر من القراءة بس.',
  uni4: 'سنة التخرج. نظّم وقتك بين المذاكرة والمشروع وخلّص خطوة خطوة.'
};
function motivation() {
  const seed = [...todayStr()].reduce((a, c) => a + c.charCodeAt(0), 0);
  const list = [GRADE_MOTIVATION[CURRENT.grade], ...MOTIVATION].filter(Boolean);
  return list[(seed + new Date().getHours()) % list.length];
}
function dailyBrief(date = todayStr()) {
  const its = itemsFor(date), tasks = UD.tasks[date] || [];
  const doneL = its.filter(i => UD.done[date + '|' + i.id]).length, doneT = tasks.filter(t => t.done).length;
  const parts = [];
  if (its.length) parts.push(`عندك ${its.length} ${its.length === 1 ? 'موعد' : 'مواعيد'} (خلصت ${doneL})`);
  if (tasks.length) parts.push(`${tasks.length} ${tasks.length === 1 ? 'مهمة' : 'مهام'} في النوتبوك (خلصت ${doneT})`);
  if (!parts.length) return 'مفيش حاجة متسجلة النهاردة. ضيف مهامك في النوتبوك عشان نظبط يومك.';
  const left = (its.length - doneL) + (tasks.length - doneT);
  return parts.join(' و') + (left ? `. فاضل ${left} — يلا نخلّصهم!` : '. خلصت كل حاجة، برافو عليك! 🎉');
}

// ----- إشعارات -----
function toast(msg, kind = '') {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg; box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 4000);
}
function notify(title, body) {
  toast(`${title} — ${body}`);
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, lang: 'ar', dir: 'rtl' }); } catch { }
}
function tickReminders() {
  if (!CURRENT || CURRENT.status !== 'approved' || !UD) return;
  const today = todayStr(), now = nowMin(); let changed = false;
  for (const it of itemsFor(today)) {
    const s = toMin(it.start); if (s == null) continue;
    const key = `i|${today}|${it.id}`;
    if (!UD.fired[key] && now >= s - UD.settings.lead && now < s + 5 && !UD.done[today + '|' + it.id]) {
      UD.fired[key] = 1; changed = true;
      const diff = s - now;
      notify(diff > 0 ? `بعد ${diff} دقيقة: ${it.subject}` : `دلوقتي: ${it.subject}`, it.topic || 'يلا ابدأ!');
    }
  }
  const m = toMin(UD.settings.morning), e = toMin(UD.settings.evening);
  if (m != null && now >= m && !UD.fired['m' + today]) { UD.fired['m' + today] = 1; changed = true; notify('صباح الخير ☀️', dailyBrief()); }
  if (e != null && now >= e && !UD.fired['e' + today]) {
    UD.fired['e' + today] = 1; changed = true;
    notify('مراجعة اليوم 🌙', dailyBrief() + ' — حدّث النوتبوك بإللي خلصته.');
  }
  if (changed) { saveUD(); if (typeof refreshIfHome === 'function') refreshIfHome(); }
}

// ----- الذكاء الاصطناعي -----
const PROVIDERS = {
  openai: { name: 'ChatGPT', api: true, link: 'https://chatgpt.com/' },
  gemini: { name: 'Gemini', api: true, link: 'https://gemini.google.com/' },
  claude: { name: 'Claude', api: true, link: 'https://claude.ai/' },
  notebooklm: { name: 'NotebookLM', api: false, link: 'https://notebooklm.google.com/' },
  fahhimni: { name: 'فهمني (وزارة التربية والتعليم)', api: false, link: '' }
};
function chatSystemPrompt() {
  const today = todayStr();
  const sched = itemsFor(today).map(i => `${i.start || ''} ${i.subject} ${i.topic}`.trim()).join(' | ') || 'مفيش مواعيد';
  return `أنت "مساعد مينا" داخل تطبيق مينا ستودنت AI. بتشرح للطالب بالعامية المصرية المبسطة وبأسلوب صبور ومشجّع. الطالب اسمه ${CURRENT.name} في ${gradeOf(CURRENT.grade).name}. ` +
    `ابدأ بالشرح المبسط ثم مثال ثم سؤال تدريبي صغير. لو مش متأكد من معلومة قول كده بصراحة. جدول الطالب النهاردة: ${sched}.`;
}
async function callAI(provider, messages) {
  const sb = initSupabase();
  if (!sb) throw new Error('CLOUD_NOT_CONFIGURED');
  const { data, error } = await sb.functions.invoke('ai-chat', { body: { provider, messages } });
  if (error) {
    const context = error.context;
    if (context && typeof context.json === 'function') {
      try {
        const body = await context.json();
        throw new Error(body.error || body.message || error.message || 'تعذر الاتصال بخدمة الذكاء الاصطناعي.');
      } catch (e) { if (e instanceof Error && e.message && !e.message.includes('Unexpected')) throw e; }
    }
    throw new Error(error.message || 'تعذر الاتصال بخدمة الذكاء الاصطناعي.');
  }
  if (data?.error) throw new Error(data.error);
  return data?.reply || 'مفيش رد من النموذج.';
}
