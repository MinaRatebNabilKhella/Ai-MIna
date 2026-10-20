'use strict';
// ===== الشاشات =====
let AUTH_TAB = 'login', AUTH_ERR = '', AUTH_INFO = '', PASSWORD_RECOVERY = false;
let NB_DATE = todayStr(), CHAT_PROVIDER = 'gemini', CHAT_BUSY = false, HELP_RESULT = null, PENDING_IMPORT = null;

const NAV = [
  ['home', '🏠', 'الرئيسية'], ['schedule', '📅', 'الجدول'], ['notebook', '📝', 'النوتبوك'],
  ['help', '🧠', 'افهم الدرس'], ['chat', '💬', 'الشات'], ['achievements', '🏆', 'إنجازاتي'],
  ['setup', '📥', 'رفع الجدول'], ['settings', '⚙️', 'الإعدادات']
];

function shell(route, inner) {
  const nav = [...NAV]; if (CURRENT.role === 'admin') nav.push(['admin', '🛡️', 'الأدمن']);
  return `<div class="shell">
    <aside class="side"><span class="logo">${esc(CFG.APP_NAME_AR || 'مينا')}</span>
      <nav class="nav">${nav.map(([r, ic, l]) => `<a href="#/${r}" class="${r === route ? 'on' : ''}"><span class="ic">${ic}</span><span class="lbl">${l}</span></a>`).join('')}</nav>
    </aside>
    <main class="main">
      <div class="top"><div class="grow"><strong>أهلاً ${esc(CURRENT.name)}</strong> <span class="muted small">· ${esc(gradeOf(CURRENT.grade).name)}</span></div>
        <span class="chip">⭐ ${UD.points} نقطة · مستوى ${level()}</span><span class="chip">🔥 ${UD.streak.count} يوم</span>
        <button class="btn sm" data-act="logout">خروج</button></div>
      ${inner}
    </main></div>`;
}

// ---------- إعداد الخادم ----------
function viewCloudSetup() {
  return `<div class="auth-wrap"><div class="auth-card stack"><div class="logo">${esc(CFG.APP_NAME_AR || 'مينا ستودنت AI')}</div>
    <h2>التطبيق محتاج إعداد الاتصال السحابي</h2>
    <p class="muted">النسخة الآمنة دي لا تستخدم حسابات محلية أو إعداد أدمن من المتصفح. لازم تضيف رابط مشروع Supabase ومفتاح anon العام في config.js، ثم تطبّق ملف قاعدة البيانات الموجود داخل مجلد supabase.</p>
    <div class="info">ما تحطش Gemini API Key أو Service Role Key داخل config.js أو GitHub. المفاتيح السرية مكانها إعدادات الخادم فقط.</div>
    <p class="small muted">بعد إكمال إعداد الخادم، حدّث الصفحة لعرض شاشة الدخول.</p>
  </div></div>`;
}

// ---------- دخول / تسجيل ----------
function viewAuth() {
  if (PASSWORD_RECOVERY) {
    return `<div class="auth-wrap"><div class="auth-card stack"><div class="logo">${esc(CFG.APP_NAME_AR || 'مينا ستودنت AI')}</div><h2>تعيين كلمة مرور جديدة</h2>
      <p class="muted">اكتب كلمة مرور جديدة لحسابك.</p>${AUTH_ERR ? `<div class="err">${esc(AUTH_ERR)}</div>` : ''}
      <form data-form="updatePassword" class="stack"><div class="field"><label>كلمة المرور الجديدة</label><input type="password" name="pw" required minlength="8" autocomplete="new-password"></div>
      <div class="field"><label>تأكيد كلمة المرور</label><input type="password" name="pw2" required minlength="8" autocomplete="new-password"></div><button class="btn primary">حفظ كلمة المرور</button></form></div></div>`;
  }
  const gradeOpts = GRADES.map(g => `<option value="${g.id}" ${g.id === 'sec3' ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
  const err = AUTH_ERR ? `<div class="err">${esc(AUTH_ERR)}</div>` : '';
  const info = AUTH_INFO ? `<div class="info">${esc(AUTH_INFO)}</div>` : '';
  const form = AUTH_TAB === 'login' ? `
    <form data-form="login">${err}${info}
      <div class="field"><label>الإيميل</label><input type="email" name="email" required autocomplete="username"></div>
      <div class="field"><label>الباسورد</label><input type="password" name="pw" required autocomplete="current-password"></div>
      <button class="btn primary" style="width:100%">دخول</button></form>` : `
    <form data-form="register">${err}
      <div class="field"><label>الاسم بالكامل</label><input type="text" name="name" required></div>
      <div class="field"><label>اسم المدرسة / الكلية</label><input type="text" name="school" required></div>
      <div class="field"><label>السنة الدراسية</label><select name="grade">${gradeOpts}</select></div>
      <div class="field"><label>رقم الهاتف</label><input type="tel" name="phone" required autocomplete="tel" inputmode="tel" placeholder="01xxxxxxxxx"></div>
      <div class="field"><label>المحافظة</label><input type="text" name="governorate" required autocomplete="address-level1"></div>
      <div class="field"><label>العنوان</label><input type="text" name="address" required autocomplete="street-address"></div>
      <div class="field"><label>الإيميل</label><input type="email" name="email" required autocomplete="username"></div>
      <div class="field"><label>الباسورد (6 حروف على الأقل)</label><input type="password" name="pw" required minlength="6" autocomplete="new-password"></div>
      <div class="field"><label>أكّد الباسورد</label><input type="password" name="pw2" required minlength="6" autocomplete="new-password"></div>
      <button class="btn primary" style="width:100%">إنشاء حساب</button>
      <p class="muted small" style="margin-top:.7rem">بعد التسجيل الحساب بيستنى موافقة الأدمن قبل ما تدخل.</p></form>`;
  return `<div class="auth-wrap"><div class="auth-card">
    <div class="logo">${esc(CFG.APP_NAME_AR)}</div><p class="muted">مساعدك الذكي للمذاكرة وتنظيم الوقت</p>
    <div class="tabs"><button data-act="authTab" data-tab="login" class="${AUTH_TAB === 'login' ? 'on' : ''}">دخول</button><button data-act="authTab" data-tab="register" class="${AUTH_TAB === 'register' ? 'on' : ''}">حساب جديد</button></div>
    ${form}
  </div></div>`;
}
function viewPending() {
  const u = CURRENT;
  const status = u.status;
  const rejected = status === 'rejected';
  const deleted = status === 'deleted';
  const phone = String(CFG.SUPPORT_WHATSAPP || '').replace(/\D/g, '');
  const whatsAppUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(`مرحبًا، أنا ${u.name}، وبريدي ${u.email}. أستفسر عن حالة حسابي في ${CFG.APP_NAME_AR}.`)}` : '';
  const heading = rejected ? 'تم رفض طلب الحساب' : deleted ? 'الحساب موقوف' : 'طلبك قيد المراجعة ⏳';
  const message = rejected ? 'الأدمن رفض طلب التسجيل. لو شايف إن ده حصل بالخطأ، تواصل مع الدعم.' :
    deleted ? 'الحساب ده تم إيقافه، ومش هتقدر تدخل بياناته. تواصل مع الدعم للمراجعة.' :
    `أهلًا ${u.name}، حسابك مستني موافقة الأدمن. تقدر تتواصل معاه على واتساب، وهيبعت لك رمز الموافقة بعد المراجعة.`;
  return `<div class="auth-wrap"><div class="auth-card stack">
    <div class="logo">${esc(CFG.APP_NAME_AR)}</div><h2>${heading}</h2><p>${esc(message)}</p>
    ${status === 'pending' ? `<div class="card soft stack"><strong>رمز الموافقة</strong><p class="small muted">بعد ما تستلم الرمز من الأدمن، اكتبه هنا لتفعيل الحساب.</p>
      <form data-form="approvalCode"><label>رمز الموافقة</label><div class="row"><input type="text" name="code" class="grow" style="direction:ltr" inputmode="text" autocapitalize="characters" autocomplete="one-time-code" required maxlength="10"><button class="btn primary">تفعيل</button></div></form></div>` : ''}
    ${whatsAppUrl ? `<a class="btn primary" target="_blank" rel="noopener" href="${esc(whatsAppUrl)}">تواصل مع الدعم على واتساب</a>` : `<p class="muted small">رقم الدعم لم يتم ضبطه بعد.</p>`}
    ${AUTH_ERR ? `<div class="err">${esc(AUTH_ERR)}</div>` : ''}
    <div class="row"><button class="btn" data-act="recheck">تحقق من الحالة</button><button class="btn" data-act="logout">خروج</button></div>
  </div></div>`;
}

// ---------- الرئيسية ----------
function lessonRow(date, it) {
  const done = !!UD.done[date + '|' + it.id];
  return `<div class="item ${done ? 'done' : ''}"><input type="checkbox" ${done ? 'checked' : ''} data-act="toggleLesson" data-date="${date}" data-id="${it.id}">
    <span class="time" dir="ltr">${it.start || '--:--'}${it.end ? ' - ' + it.end : ''}</span>
    <div class="grow t"><strong>${esc(it.subject)}</strong>${it.topic ? ' — ' + esc(it.topic) : ''}${it.type ? ` <span class="pill">${esc(it.type)}</span>` : ''}${it.notes ? `<div class="muted small">${esc(it.notes)}</div>` : ''}</div></div>`;
}
function viewHome() {
  const today = todayStr(), tom = addDays(today, 1);
  const tIts = itemsFor(today), mIts = itemsFor(tom), tasks = UD.tasks[today] || [];
  const pct = Math.round((UD.points % 100));
  const notifyBtn = ('Notification' in window && Notification.permission === 'default') ? `<button class="btn sm primary" data-act="enableNotif">فعّل إشعارات المتصفح</button>` : '';
  return `<div class="stack">
    <div class="card soft"><h2>${esc(motivation())}</h2><p class="muted" style="margin:0">${esc(dailyBrief())}</p><div class="row" style="margin-top:.7rem">${notifyBtn}</div></div>
    ${UD.schedule.length ? '' : `<div class="card"><h3>ابدأ برفع جدولك 📥</h3><p class="muted">اطلب من ChatGPT يعملك جدول (هنديك البرومبت) وارفعه هنا.</p><a class="btn primary" href="#/setup">رفع الجدول</a></div>`}
    <div class="grid two">
      <div class="card"><h3>📅 النهاردة — ${fmtDate(today)}</h3>${tIts.length ? tIts.map(i => lessonRow(today, i)).join('') : '<p class="muted">مفيش مواعيد في الجدول النهاردة.</p>'}</div>
      <div class="card"><h3>🌅 بكرة — ${fmtDate(tom)}</h3>${mIts.length ? mIts.map(i => `<div class="item"><span class="time" dir="ltr">${i.start || '--:--'}</span><div class="grow"><strong>${esc(i.subject)}</strong>${i.topic ? ' — ' + esc(i.topic) : ''}</div></div>`).join('') : '<p class="muted">مفيش مواعيد بكرة.</p>'}</div>
    </div>
    <div class="grid two">
      <div class="card"><h3>📝 مهام النهاردة</h3>${tasks.length ? `<p class="muted small">${tasks.filter(t => t.done).length} من ${tasks.length} خلصت</p><div class="bar ok"><i style="width:${Math.round(tasks.filter(t => t.done).length / tasks.length * 100)}%"></i></div>` : '<p class="muted">لسه مفيش مهام.</p>'}<p style="margin-top:.8rem"><a class="btn sm" href="#/notebook">افتح النوتبوك</a></p></div>
      <div class="card"><h3>⭐ مستواك ${level()}</h3><p class="muted small">${100 - pct} نقطة للمستوى الجاي</p><div class="bar"><i style="width:${pct}%"></i></div><p style="margin-top:.8rem"><a class="btn sm" href="#/achievements">إنجازاتي</a></p></div>
    </div></div>`;
}

// ---------- الجدول ----------
function viewSchedule() {
  const byDay = WEEK_ORDER.map(d => ({ d, its: UD.schedule.filter(i => !i.date && i.day === d).sort((a, b) => (a.start || '').localeCompare(b.start || '')) }));
  const dated = UD.schedule.filter(i => i.date).sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
  const row = i => `<div class="item"><span class="time" dir="ltr">${i.start || '--:--'}${i.end ? ' - ' + i.end : ''}</span><div class="grow"><strong>${esc(i.subject)}</strong>${i.topic ? ' — ' + esc(i.topic) : ''}${i.type ? ` <span class="pill">${esc(i.type)}</span>` : ''}${i.notes ? `<div class="muted small">${esc(i.notes)}</div>` : ''}</div><button class="btn sm bad" data-act="delItem" data-id="${i.id}">حذف</button></div>`;
  const dayOpts = WEEK_ORDER.map(d => `<option value="${d}">${DAYS_AR[d]}</option>`).join('');
  return `<div class="stack"><h1>📅 جدولي</h1>
    ${UD.schedule.length ? '' : `<div class="info">الجدول فاضي. <a href="#/setup">ارفع جدولك من الإكسل</a> أو ضيف مواعيد بإيدك تحت.</div>`}
    ${byDay.filter(x => x.its.length).map(x => `<div class="card"><h3 class="day-title" style="margin-top:0">${DAYS_AR[x.d]}</h3>${x.its.map(row).join('')}</div>`).join('')}
    ${dated.length ? `<div class="card"><h3>مواعيد بتواريخ محددة (امتحانات وغيره)</h3>${dated.map(i => `<div class="muted small" style="margin-top:.5rem">${fmtDate(i.date)}</div>${row(i)}`).join('')}</div>` : ''}
    <div class="card"><h3>➕ إضافة موعد</h3>
      <form data-form="addItem" class="grid three">
        <div><label>اليوم</label><select name="day">${dayOpts}</select></div>
        <div><label>أو تاريخ محدد (اختياري)</label><input type="date" name="date"></div>
        <div><label>المادة</label><input type="text" name="subject" required></div>
        <div><label>الدرس / الموضوع</label><input type="text" name="topic"></div>
        <div><label>من</label><input type="time" name="from"></div>
        <div><label>إلى</label><input type="time" name="to"></div>
        <div><button class="btn primary">إضافة</button></div></form></div>
    ${UD.schedule.length ? `<button class="btn bad" data-act="clearSchedule">مسح الجدول كله</button>` : ''}
  </div>`;
}

// ---------- النوتبوك ----------
function viewNotebook() {
  const tasks = UD.tasks[NB_DATE] || [], done = tasks.filter(t => t.done).length;
  const its = itemsFor(NB_DATE);
  return `<div class="stack"><h1>📝 النوتبوك</h1>
    <div class="row"><button class="btn sm" data-act="nbDay" data-n="-1">◀ اليوم اللي قبله</button><input type="date" id="nbDate" value="${NB_DATE}" style="width:auto" data-change="nbDate"><button class="btn sm" data-act="nbDay" data-n="1">اليوم اللي بعده ▶</button>${NB_DATE !== todayStr() ? `<button class="btn sm" data-act="nbToday">النهاردة</button>` : ''}</div>
    <div class="card soft"><strong>🤖 مساعد التنبيهات:</strong> ${esc(dailyBrief(NB_DATE))}</div>
    ${its.length ? `<div class="card"><h3>من الجدول</h3>${its.map(i => lessonRow(NB_DATE, i)).join('')}</div>` : ''}
    <div class="card"><h3>مهامي — ${fmtDate(NB_DATE)}</h3>
      ${tasks.length ? `<div class="bar ok" style="margin-bottom:.6rem"><i style="width:${Math.round(done / tasks.length * 100)}%"></i></div>` : ''}
      ${tasks.map(t => `<div class="item ${t.done ? 'done' : ''}"><input type="checkbox" ${t.done ? 'checked' : ''} data-act="toggleTask" data-id="${t.id}"><div class="grow t">${esc(t.text)}</div><button class="btn sm bad" data-act="delTask" data-id="${t.id}">✕</button></div>`).join('') || '<p class="muted">اكتب اللي عايز تنجزه النهاردة 👇</p>'}
      <form data-form="addTask" class="row" style="margin-top:.8rem"><input type="text" name="text" class="grow" placeholder="مثال: أحل 20 مسألة تفاضل" required><button class="btn primary">إضافة</button></form>
      <p style="margin-top:.6rem"><button class="btn sm" data-act="carryOver">ترحيل غير المنجز من اليوم اللي فات</button></p></div>
    <div class="card"><h3>ملاحظات اليوم</h3><textarea data-change="saveNote" placeholder="اكتب أي ملاحظة: إيه اللي صعب؟ إيه اللي اتعلمته؟">${esc(UD.notes[NB_DATE] || '')}</textarea></div></div>`;
}

// ---------- افهم الدرس ----------
function helpLinks(subject, topic) {
  const g = gradeOf(CURRENT.grade), q = [subject, topic].filter(Boolean).join(' ');
  const enc = encodeURIComponent;
  const aiq = `اشرحلي ${q} بالعامية المصرية المبسطة لطالب في ${g.name}. ابدأ بالفكرة الأساسية، ثم مثال محلول، ثم 3 أسئلة تدريب بإجاباتها.`;
  const L = [
    { ic: '▶️', t: 'بحث يوتيوب عن شرح الدرس', d: `نتائج فيديوهات لعبارة "${q}" والمرحلة ${g.name}`, u: `https://www.youtube.com/results?search_query=${enc('شرح ' + q + ' ' + g.name)}`, free: true },
    { ic: '▶️', t: 'بحث يوتيوب عن أحدث شرح', d: 'مفيد لو المنهج اتغير حديثًا', u: `https://www.youtube.com/results?search_query=${enc('شرح ' + q + ' ' + g.name + ' المنهج الجديد')}&sp=CAI`, free: true },
    { ic: '🤖', t: 'ChatGPT (النسخة المجانية)', d: 'السؤال جاهز ومتكتب جواه', u: `https://chatgpt.com/?q=${enc(aiq)}`, free: true },
    { ic: '✨', t: 'Gemini', d: 'انسخ السؤال والصقه هناك', u: 'https://gemini.google.com/', free: true, copy: aiq },
    { ic: '📓', t: 'NotebookLM', d: 'ارفع المحاضرة/الملخص PDF واطلب منه ملخص وأسئلة', u: 'https://notebooklm.google.com/', free: true },
    { ic: '🏛️', t: 'بنك المعرفة المصري', d: 'محتوى مجاني معتمد', u: 'https://www.ekb.eg/', free: true },
    { ic: '🎓', t: 'خان أكاديمي بالعربي', d: 'شروحات مجانية للرياضيات والعلوم', u: 'https://ar.khanacademy.org/', free: true }
  ];
  const fh = (UD.settings.fahhimni || CFG.FAHHIMNI_URL || '').trim();
  L.push({ ic: '🇪🇬', t: 'فهمني — وزارة التربية والتعليم', d: fh ? 'منصة الوزارة' : 'حط رابط المنصة في الإعدادات', u: fh || `https://www.google.com/search?q=${enc('فهمني وزارة التربية والتعليم المصرية')}`, free: true });
  if (g.stage === 'uni') { L.push({ ic: '🏫', t: 'MIT OpenCourseWare', d: 'محاضرات جامعية مجانية', u: `https://ocw.mit.edu/search/?q=${enc(q)}`, free: true }); }
  L.push({ ic: '🔎', t: 'بحث جوجل عن ملخص', d: 'ملخصات ومذكرات', u: `https://www.google.com/search?q=${enc('ملخص ' + q + ' ' + g.name)}`, free: true });
  return { L, aiq };
}
function viewHelp() {
  let res = '';
  if (HELP_RESULT) {
    const { L, aiq } = helpLinks(HELP_RESULT.subject, HELP_RESULT.topic);
    res = `<div class="card"><h3>ترشيحات لـ "${esc([HELP_RESULT.subject, HELP_RESULT.topic].filter(Boolean).join(' - '))}"</h3>
      <p class="muted small">الفيديوهات التالية تُجلب من YouTube حسب المادة والدرس والمرحلة، وليست ضمانًا لجودة المدرّس. راجع عنوان الفيديو والقناة قبل الاعتماد عليه.</p>
      ${Array.isArray(HELP_RESULT.videos) && HELP_RESULT.videos.length ? `<h3>🎯 فيديوهات محددة للدرس</h3><div class="grid two">${HELP_RESULT.videos.map(v => `<div class="card stack">${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy" style="width:100%;border-radius:12px;object-fit:cover;max-height:200px">` : ''}<strong>${esc(v.title)}</strong><p class="muted small">القناة: ${esc(v.channel || 'غير معروف')}${v.publishedAt ? ` · ${esc(String(v.publishedAt).slice(0,10))}` : ''}</p><a class="btn sm primary" target="_blank" rel="noopener" href="${esc(v.url)}">شاهد الفيديو المحدد</a></div>`).join('')}</div>` : `<div class="info">لو لم تظهر فيديوهات محددة، تأكد أن الأدمن أضاف مفتاح YouTube Data API إلى Secrets في الخادم. تظل روابط البحث البديلة متاحة أدناه.</div>`}
      <div class="grid two">${L.map(l => `<div class="card"><h3>${l.ic} ${esc(l.t)} <span class="pill ok">مجاني</span></h3><p class="muted small">${esc(l.d)}</p>
        <div class="row"><a class="btn sm primary" target="_blank" rel="noopener" href="${esc(l.u)}">افتح</a>${l.copy ? `<button class="btn sm" data-act="copyText" data-text="${esc(l.copy)}">نسخ السؤال</button>` : ''}</div></div>`).join('')}</div>
      <p style="margin-top:1rem"><button class="btn primary" data-act="askInChat" data-q="${esc(aiq)}">اسأل الشات اللي جوه التطبيق دلوقتي 💬</button></p></div>`;
  }
  return `<div class="stack"><h1>🧠 مش فاهم درس؟</h1>
    <div class="card"><form data-form="help">
      <div class="grid two"><div><label>المادة</label><input type="text" name="subject" placeholder="مثال: فيزياء" value="${esc(HELP_RESULT?.subject || '')}" required></div>
      <div><label>الدرس / الفصل / المحاضرة</label><input type="text" name="topic" placeholder="مثال: قانون أوم" value="${esc(HELP_RESULT?.topic || '')}" required></div></div>
      <button class="btn primary" style="margin-top:.8rem">رشّحلي مصادر شرح</button></form></div>${res}</div>`;
}

// ---------- الشات ----------
function fmtMsg(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }
function viewChat() {
  const p = CHAT_PROVIDER, P = PROVIDERS[p];
  const tabs = `<div class="row">${Object.entries(PROVIDERS).map(([k, v]) => `<button class="btn sm ${k === p ? 'primary' : ''}" data-act="chatProv" data-p="${k}">${esc(v.name)}</button>`).join('')}</div>`;
  let body;
  if (P.api) {
    const msgs = UD.chat[p] || [];
    body = `<div class="info">الرسائل بتمر على الخادم، ومفتاح API مش موجود في كود الموقع. الحد الافتراضي للطالب 20 طلب ذكاء اصطناعي يوميًا. لو الخدمة مش مفعّلة للمزوّد ده، استخدم الرابط الخارجي: <a target="_blank" rel="noopener" href="${P.link}">${esc(P.name)}</a>.</div>
      <div class="chat-box" id="chatBox">${msgs.length ? msgs.map(m => `<div class="msg ${m.role}">${fmtMsg(m.content)}</div>`).join('') : '<div class="msg sys">اسألني عن أي درس. ممكن أشرحه، أديك أمثلة، أو أختبرك.</div>'}${CHAT_BUSY ? '<div class="msg sys">بيكتب...</div>' : ''}</div>
      <form data-form="chat" class="row"><input type="text" name="q" class="grow" placeholder="اكتب سؤالك هنا..." autocomplete="off" required ${CHAT_BUSY ? 'disabled' : ''}><button class="btn primary" ${CHAT_BUSY ? 'disabled' : ''}>إرسال</button><button type="button" class="btn" data-act="clearChat">مسح</button></form>`;
  } else {
    const url = p === 'fahhimni' ? (UD.settings.fahhimni || CFG.FAHHIMNI_URL || '') : P.link;
    body = `<div class="card stack"><h3>${esc(P.name)}</h3>
      <p class="muted">${p === 'notebooklm' ? 'NotebookLM من جوجل ملوش API مفتوح، فبتفتحه في تاب جديد وترفع فيه ملخصاتك وتسأله عنها.' : 'منصة فهمني بتاعة الوزارة بتتفتح في تاب جديد. حط رابطها الرسمي في الإعدادات.'}</p>
      ${url ? `<a class="btn primary" target="_blank" rel="noopener" href="${esc(url)}">افتح ${esc(P.name)}</a>` : `<div class="info">لسه مفيش رابط محفوظ. <a href="#/settings">ضيفه من الإعدادات</a>.</div>`}</div>`;
  }
  return `<div class="stack"><h1>💬 الشات</h1>${tabs}${body}</div>`;
}

// ---------- الإنجازات ----------
function viewAch() {
  const n = Object.keys(UD.badges).length;
  return `<div class="stack"><h1>🏆 إنجازاتي</h1>
    <div class="grid three"><div class="card"><h3>⭐ ${UD.points}</h3><p class="muted small">نقطة</p></div><div class="card"><h3>🎖️ مستوى ${level()}</h3><div class="bar"><i style="width:${UD.points % 100}%"></i></div></div><div class="card"><h3>🔥 ${UD.streak.count} يوم</h3><p class="muted small">أيام متتالية</p></div></div>
    <p class="muted">فتحت ${n} من ${BADGES.length} إنجاز. المهمة = 10 نقط، الموعد من الجدول = 15، اليوم المثالي = 20، وكل يوم تفتح فيه = 5.</p>
    <div class="grid three">${BADGES.map(b => `<div class="badge ${UD.badges[b.id] ? 'on' : ''}"><div class="ic">${b.ic}</div><strong>${esc(b.name)}</strong><div class="muted small">${esc(b.desc)}</div>${UD.badges[b.id] ? `<div class="small" style="color:var(--ok)">✔ ${UD.badges[b.id]}</div>` : ''}</div>`).join('')}</div></div>`;
}

// ---------- رفع الجدول ----------
function aiPrompt() {
  const g = gradeOf(CURRENT.grade).name;
  return `أنت مساعد تنظيم مذاكرة لطالب في ${g}. اسمه ${CURRENT.name}.

اسألني الأسئلة دي واحد واحد (سؤال في كل رسالة وانتظر إجابتي):
1) المواد اللي بدرسها.
2) أيام ومواعيد الحصص والسناتر والمحاضرات والمدرسة/الكلية (اليوم + من الساعة كام لكام).
3) الفصول أو الأجزاء اللي محتاج أذاكرها من كل مادة.
4) مواعيد الامتحانات أو الاختبارات القريبة (لو فيه).
5) الأوقات اللي أقدر أذاكر فيها، وميعاد النوم، وأي التزامات تانية (رياضة، شغل، مواصلات).
6) أنهي مواد أضعف فيها وعايز أركّز عليها أكتر.

بعد ما أخلص إجاباتي، اعمل لي جدول أسبوعي واقعي يشمل الحصص + وقت مذاكرة + مراجعة + راحة، وراعي إن المواد الأصعب تتذاكر في وقت تركيزي العالي.

مهم جداً: الناتج الأساسي لازم يكون ملف CSV قابلًا للتحميل بترميز UTF-8 مع BOM (UTF-8-SIG)، وليس مجرد جدول داخل المحادثة. ملف CSV ده هو المطلوب الأساسي للتطبيق. استخدم شيت واحد منطقيًا، وأول صف عناوين يحتوي على 8 خلايا منفصلة بهذه الأسماء بالضبط وبالترتيب التالي، مع فاصلة إنجليزية بين كل خلية (ولا تكتب علامة | داخل الخلايا):
اليوم,التاريخ,المادة,الدرس/الموضوع,من,إلى,النوع,ملاحظات

القواعد:
- اليوم: اسم عربي (السبت، الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس، الجمعة) للمواعيد الأسبوعية المتكررة.
- التاريخ: سيبه فاضي للمواعيد الأسبوعية، واكتبه بصيغة YYYY-MM-DD للامتحانات أو المواعيد لمرة واحدة.
- من / إلى: توقيت 24 ساعة بصيغة HH:MM (مثال 16:30).
- النوع: واحد من (حصة، مذاكرة، مراجعة، امتحان، راحة).
- احفظ الملف باسم جدول-المذاكرة-UTF8.csv، بترميز UTF-8 مع BOM (UTF-8-SIG)، وفاصل فاصلة إنجليزية (,) وعلامات اقتباس حول الخلايا التي تحتوي فواصل.
- لا تستخدم CSV العادي بترميز Windows/ANSI. يجب أن تظل الحروف العربية سليمة عند فتح الملف في Excel.
- لو قدرت أيضًا إنشاء XLSX كملف إضافي فمسموح، لكن ملف CSV UTF-8 هو الملف الأساسي المطلوب للتطبيق.`;
}
function viewSetup() {
  return `<div class="stack"><h1>📥 رفع الجدول</h1>
    <div class="card stack"><h3>1) انسخ البرومبت وادّيه لـ ChatGPT</h3>
      <p class="muted">ChatGPT هيسألك عن دروسك ومواعيدك، وفي الآخر هيدّيك ملف Excel. (ممكن تستخدم Gemini أو Claude بنفس الطريقة).</p>
      <textarea readonly style="min-height:220px;direction:rtl">${esc(aiPrompt())}</textarea>
      <div class="row"><button class="btn primary" data-act="copyPrompt">📋 نسخ البرومبت</button><a class="btn" target="_blank" rel="noopener" href="https://chatgpt.com/">فتح ChatGPT</a><button class="btn" data-act="downloadTemplate">⬇️ تحميل نموذج CSV</button></div></div>
    <div class="card stack"><h3>2) ارفع الملف</h3>
      <input type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" data-change="uploadSchedule">
      <div id="preview"></div></div></div>`;
}
function previewHtml(res) {
  if (!res) return '';
  if (res.error) return `<div class="err">${esc(res.error)}</div>`;
  const { items, skipped } = res;
  if (!items.length) return `<div class="err">مقدرتش ألاقي مواعيد في الملف. اتأكد إن فيه عمود "اليوم" وعمود "المادة".</div>`;
  return `<div class="info">لقيت ${items.length} موعد${skipped ? ` (وتجاهلت ${skipped} صف ناقص)` : ''}. راجعهم قبل الاستيراد:</div>
    <div class="scroll-x"><table><thead><tr><th>اليوم/التاريخ</th><th>المادة</th><th>الموضوع</th><th>من</th><th>إلى</th><th>النوع</th></tr></thead><tbody>
    ${items.slice(0, 60).map(i => `<tr><td>${i.date ? i.date : DAYS_AR[i.day]}</td><td>${esc(i.subject)}</td><td>${esc(i.topic)}</td><td>${i.start}</td><td>${i.end}</td><td>${esc(i.type)}</td></tr>`).join('')}</tbody></table></div>
    ${items.length > 60 ? `<p class="muted small">وغيرهم ${items.length - 60}...</p>` : ''}
    <div class="row" style="margin-top:.8rem"><button class="btn primary" data-act="importSchedule" data-mode="replace">استيراد (استبدال الجدول الحالي)</button><button class="btn" data-act="importSchedule" data-mode="merge">إضافة للجدول الحالي</button></div>`;
}

// ---------- الإعدادات ----------
function viewSettings() {
  const s = UD.settings, notif = 'Notification' in window ? Notification.permission : 'unsupported';
  return `<div class="stack"><h1>⚙️ الإعدادات</h1>
    <form data-form="settings" class="stack">
    <div class="card stack"><h3>🔔 التنبيهات</h3>
      <p class="muted small">التنبيهات المحلية تعمل أثناء فتح التطبيق. الإشعارات أثناء إغلاقه تحتاج إلى خدمة Push على الخادم.</p>
      <div class="row">حالة إشعارات المتصفح: <span class="pill ${notif === 'granted' ? 'ok' : 'warn'}">${notif === 'granted' ? 'مفعّلة' : notif === 'denied' ? 'محظورة من المتصفح' : notif === 'unsupported' ? 'غير مدعومة' : 'غير مفعّلة'}</span>${notif === 'default' ? `<button type="button" class="btn sm primary" data-act="enableNotif">تفعيل</button>` : ''}</div>
      <div class="grid three"><div><label>نبّهني قبل الموعد بـ (دقيقة)</label><input type="number" name="lead" min="0" max="120" value="${s.lead}"></div>
      <div><label>ملخص الصبح الساعة</label><input type="time" name="morning" value="${s.morning}"></div>
      <div><label>مراجعة المساء الساعة</label><input type="time" name="evening" value="${s.evening}"></div></div></div>
    <div class="card stack"><h3>🤖 الذكاء الاصطناعي</h3>
      <p>مفاتيح الذكاء الاصطناعي محفوظة في أسرار الخادم، وليست في المتصفح أو حساب الطالب. النموذج الافتراضي لـ Gemini هو <code dir="ltr">gemini-3.8-flash</code>.</p>
      <p class="muted small">الحد الافتراضي 20 طلبًا لكل طالب يوميًا، مع حد لطول الرسالة والإجابة. الأرقام قابلة للتغيير في إعدادات الخادم.</p>
      <div class="info">لا تكتب API Key في هذه الصفحة. إذا ظهرت مشكلة، اطلب من الأدمن مراجعة إعدادات الخدمة.</div>
      <div><label>رابط منصة فهمني (اختياري)</label><input type="url" name="fahhimni" value="${esc(s.fahhimni)}" placeholder="https://..." style="direction:ltr"></div></div>
    <div><button class="btn primary">حفظ الإعدادات</button></div></form>
    <div class="card stack"><h3>💾 بياناتي</h3><div class="row"><button class="btn" data-act="exportData">تصدير نسخة احتياطية</button><label class="btn" style="margin:0;color:inherit">استيراد نسخة<input type="file" accept=".json" data-change="importData" style="display:none"></label><button class="btn bad" data-act="resetData">مسح كل بياناتي</button></div><p class="muted small">البيانات متزامنة عبر حسابك على الخادم، والتصدير نسخة احتياطية إضافية فقط.</p></div></div>`;
}

// ---------- الأدمن ----------
let ADMIN_CODES = {};
function normalizePhoneForWhatsApp(raw) {
  let phone = String(raw || '').replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  else if (phone.startsWith('0')) phone = '20' + phone.slice(1);
  return phone.length >= 10 ? phone : '';
}
function viewAdmin() {
  if (CURRENT.role !== 'admin') return '<div class="err">للأدمن فقط.</div>';
  const users = getUsers().filter(u => u.role !== 'admin').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const pend = users.filter(u => u.status === 'pending').length;
  const pill = s => s === 'approved' ? '<span class="pill ok">مقبول</span>' : s === 'rejected' ? '<span class="pill bad">مرفوض</span>' : s === 'deleted' ? '<span class="pill bad">موقوف</span>' : '<span class="pill warn">في الانتظار</span>';
  return `<div class="stack"><h1>🛡️ لوحة الأدمن</h1>${ADMIN_LOAD_ERROR ? `<div class="err">${esc(ADMIN_LOAD_ERROR)} <button class="btn sm" onclick="location.reload()">إعادة تحميل</button></div>` : ''}
    <div class="grid three"><div class="card"><h3>${users.length}</h3><p class="muted small">إجمالي حسابات الطلاب</p></div><div class="card"><h3>${pend}</h3><p class="muted small">في الانتظار</p></div><div class="card"><h3>${users.filter(u => u.status === 'approved').length}</h3><p class="muted small">مقبولين</p></div></div>
    <div class="card"><h3>الطلاب والحسابات</h3>
      <p class="muted small">التحكم في الصلاحيات يتم من الخادم. الإيقاف يحتفظ بسجل الحالة، لذلك سيظهر للطالب أن الحساب موقوف بدلًا من السماح له باستخدام بياناته.</p>
      <div class="scroll-x"><table><thead><tr><th>الاسم</th><th>المدرسة</th><th>السنة</th><th>الإيميل</th><th>الهاتف</th><th>المحافظة / العنوان</th><th>الحالة</th><th>استخدام اليوم (AI / YouTube)</th><th>رمز الموافقة</th><th>إجراءات</th></tr></thead><tbody>
      ${users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.school)}</td><td>${esc(gradeOf(u.grade).name)}</td><td style="direction:ltr;text-align:right">${esc(u.email)}</td><td dir="ltr">${esc(u.phone)}</td><td>${esc([u.governorate, u.address].filter(Boolean).join(' — '))}</td><td>${pill(u.status)}</td><td>${(ADMIN_USAGE[u.id]?.ai || 0)} / 20 AI · ${(ADMIN_USAGE[u.id]?.youtube || 0)} / 10 فيديو</td>
        <td>${u.status === 'pending' ? (ADMIN_CODES[u.id] ? `<div class="stack"><code class="code" dir="ltr">${esc(ADMIN_CODES[u.id])}</code><button class="btn sm" data-act="copyApprovalCode" data-id="${u.id}">نسخ الرمز</button>${normalizePhoneForWhatsApp(u.phone) ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(`https://wa.me/${normalizePhoneForWhatsApp(u.phone)}?text=${encodeURIComponent(`مرحبًا ${u.name}، رمز الموافقة لتفعيل حسابك في ${CFG.APP_NAME_AR} هو: ${ADMIN_CODES[u.id]}. الرمز صالح لمدة 30 دقيقة، وبعدها يلزم إصدار رمز جديد.`)}`)}">إرسال عبر واتساب</a>` : ''}</div>` : `<button class="btn sm" data-act="showCode" data-id="${u.id}">إنشاء رمز</button>`) : '—'}</td>
        <td><div class="row">${u.status !== 'approved' && u.status !== 'deleted' ? `<button class="btn sm ok" data-act="setStatus" data-id="${u.id}" data-s="approved">قبول</button>` : ''}${u.status !== 'rejected' && u.status !== 'deleted' ? `<button class="btn sm bad" data-act="setStatus" data-id="${u.id}" data-s="rejected">رفض</button>` : ''}${u.status === 'rejected' || u.status === 'deleted' ? `<button class="btn sm ok" data-act="setStatus" data-id="${u.id}" data-s="approved">إعادة تفعيل</button>` : ''}<button class="btn sm" data-act="exportStudentData" data-id="${u.id}">تنزيل بيانات الطالب</button><button class="btn sm" data-act="resetPw" data-id="${u.id}">إرسال رابط تغيير الباسورد</button><button class="btn sm bad" data-act="delUser" data-id="${u.id}">إيقاف</button></div></td></tr>`).join('') || '<tr><td colspan="10" class="muted">مفيش حسابات طلاب لسه.</td></tr>'}
      </tbody></table></div></div></div>`;
}
