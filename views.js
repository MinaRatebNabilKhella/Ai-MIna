'use strict';
// ===== الشاشات =====
let AUTH_TAB = 'login', AUTH_ERR = '', AUTH_INFO = '';
let NB_DATE = todayStr(), CHAT_PROVIDER = 'openai', CHAT_BUSY = false, HELP_RESULT = null, PENDING_IMPORT = null;

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

// ---------- دخول / تسجيل ----------
function viewAuth() {
  const gradeOpts = GRADES.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
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
      <div class="field"><label>الإيميل</label><input type="email" name="email" required autocomplete="username"></div>
      <div class="field"><label>الباسورد (6 حروف على الأقل)</label><input type="password" name="pw" required minlength="6" autocomplete="new-password"></div>
      <div class="field"><label>أكّد الباسورد</label><input type="password" name="pw2" required minlength="6" autocomplete="new-password"></div>
      <button class="btn primary" style="width:100%">إنشاء حساب</button>
      <p class="muted small" style="margin-top:.7rem">بعد التسجيل الحساب بيستنى موافقة الأدمن قبل ما تدخل.</p></form>`;
  return `<div class="auth-wrap"><div class="auth-card">
    <div class="logo">${esc(CFG.APP_NAME_AR)}</div><p class="muted">مساعدك الذكي للمذاكرة وتنظيم الوقت</p>
    <div class="tabs"><button data-act="authTab" data-tab="login" class="${AUTH_TAB === 'login' ? 'on' : ''}">دخول</button><button data-act="authTab" data-tab="register" class="${AUTH_TAB === 'register' ? 'on' : ''}">حساب جديد</button></div>
    ${form}
    ${hasAdmin() ? '' : `<p class="small" style="margin-top:1rem"><a href="#/owner-setup">إعداد حساب الأدمن (أول مرة)</a></p>`}
  </div></div>`;
}
function viewOwnerSetup() {
  return `<div class="auth-wrap"><div class="auth-card"><div class="logo">إعداد الأدمن</div>
    <p class="muted">أنشئ حساب صاحب التطبيق. الحساب ده بيشوف طلبات التسجيل ويوافق عليها أو يرفضها.</p>
    ${AUTH_ERR ? `<div class="err">${esc(AUTH_ERR)}</div>` : ''}
    <form data-form="ownerSetup">
      <div class="field"><label>الاسم</label><input type="text" name="name" required></div>
      <div class="field"><label>إيميل الأدمن</label><input type="email" name="email" required autocomplete="username"></div>
      <div class="field"><label>باسورد الأدمن (6 حروف على الأقل)</label><input type="password" name="pw" required minlength="6" autocomplete="new-password"></div>
      <button class="btn primary" style="width:100%">إنشاء الأدمن</button></form>
    <p class="small"><a href="#/">رجوع</a></p></div></div>`;
}
function viewPending(approvalCode) {
  const u = CURRENT;
  const reqCode = btoa(unescape(encodeURIComponent(JSON.stringify({ id: u.id, name: u.name, school: u.school, grade: u.grade, email: u.email, salt: u.salt, ph: u.ph, at: u.createdAt }))));
  const rejected = u.status === 'rejected';
  return `<div class="auth-wrap"><div class="auth-card stack">
    <div class="logo">${esc(CFG.APP_NAME_AR)}</div>
    ${rejected ? `<div class="err">تم رفض طلب تسجيلك. تواصل مع صاحب التطبيق.</div>` :
      `<h2>طلبك قيد المراجعة ⏳</h2><p>أهلاً ${esc(u.name)}، حسابك مستني موافقة الأدمن. أول ما يوافق تقدر تدخل.</p>
      <div class="card soft stack"><strong>لو النسخة دي شغالة على جهازك أنت (مش جهاز الأدمن):</strong>
        <p class="small muted">ابعت "رمز الطلب" ده للأدمن، وهو هيرد عليك برمز موافقة تكتبه تحت.</p>
        <div class="code">${esc(reqCode)}</div>
        <button class="btn sm" data-act="copyText" data-text="${esc(reqCode)}">نسخ رمز الطلب</button>
        <form data-form="approvalCode"><label>رمز الموافقة</label><div class="row"><input type="text" name="code" class="grow" style="direction:ltr" required><button class="btn primary">تفعيل</button></div></form>
      </div>`}
    ${AUTH_ERR ? `<div class="err">${esc(AUTH_ERR)}</div>` : ''}
    <div class="row"><button class="btn" data-act="recheck">تحقق من الموافقة</button><button class="btn" data-act="logout">خروج</button></div>
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
    { ic: '▶️', t: 'فيديوهات يوتيوب (الأعلى مشاهدة)', d: `شرح "${q}" مرتب بالأكثر مشاهدة`, u: `https://www.youtube.com/results?search_query=${enc('شرح ' + q + ' ' + g.name)}&sp=CAM%253D`, free: true },
    { ic: '▶️', t: 'فيديوهات يوتيوب (الأحدث)', d: 'لو المنهج اتغير، شوف أحدث شرح', u: `https://www.youtube.com/results?search_query=${enc('شرح ' + q + ' ' + g.name)}&sp=CAI%253D`, free: true },
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
      <p class="muted small">كلها مجانية. ترتيب يوتيوب بالأكثر مشاهدة (مفيش طريقة نعرف التقييم الحقيقي من غير سيرفر، ده هيتضاف في النسخة الجاية).</p>
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
    const hasKey = (UD.settings.keys[p] || '').trim();
    const msgs = UD.chat[p] || [];
    body = `${hasKey ? '' : `<div class="info">محتاج مفتاح API لـ ${esc(P.name)}. <a href="#/settings">حطه في الإعدادات</a> (بيتحفظ على جهازك بس). أو افتح <a target="_blank" rel="noopener" href="${P.link}">${esc(P.name)}</a> مباشرة.</div>`}
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

مهم جداً: سلّم الناتج كملف Excel (.xlsx) قابل للتحميل، شيت واحد، وأول صف عناوين بالأسماء دي بالظبط وبالترتيب ده:
اليوم | التاريخ | المادة | الدرس/الموضوع | من | إلى | النوع | ملاحظات

القواعد:
- اليوم: اسم عربي (السبت، الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس، الجمعة) للمواعيد الأسبوعية المتكررة.
- التاريخ: سيبه فاضي للمواعيد الأسبوعية، واكتبه بصيغة YYYY-MM-DD للامتحانات أو المواعيد لمرة واحدة.
- من / إلى: توقيت 24 ساعة بصيغة HH:MM (مثال 16:30).
- النوع: واحد من (حصة، مذاكرة، مراجعة، امتحان، راحة).
- لو مش قادر تعمل ملف Excel، اطبع الجدول بصيغة CSV بنفس الأعمدة.`;
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
      <p class="muted small">التنبيهات بتشتغل والتطبيق مفتوح في المتصفح (تاب مفتوح). الإشعارات وهو مقفول محتاجة النسخة اللي فيها سيرفر.</p>
      <div class="row">حالة إشعارات المتصفح: <span class="pill ${notif === 'granted' ? 'ok' : 'warn'}">${notif === 'granted' ? 'مفعّلة' : notif === 'denied' ? 'محظورة من المتصفح' : notif === 'unsupported' ? 'غير مدعومة' : 'غير مفعّلة'}</span>${notif === 'default' ? `<button type="button" class="btn sm primary" data-act="enableNotif">تفعيل</button>` : ''}</div>
      <div class="grid three"><div><label>نبّهني قبل الموعد بـ (دقيقة)</label><input type="number" name="lead" min="0" max="120" value="${s.lead}"></div>
      <div><label>ملخص الصبح الساعة</label><input type="time" name="morning" value="${s.morning}"></div>
      <div><label>مراجعة المساء الساعة</label><input type="time" name="evening" value="${s.evening}"></div></div></div>
    <div class="card stack"><h3>🤖 مفاتيح الذكاء الاصطناعي (للشات)</h3>
      <p class="muted small">المفاتيح بتتحفظ في متصفحك بس ومبتتبعتش لأي مكان غير الشركة نفسها. ماتحطش مفتاح على جهاز مش بتاعك.</p>
      ${['openai', 'gemini', 'claude'].map(k => `<div class="grid two"><div><label>مفتاح ${PROVIDERS[k].name}</label><input type="password" name="key_${k}" value="${esc(s.keys[k])}" autocomplete="off" style="direction:ltr"></div><div><label>اسم الموديل</label><input type="text" name="model_${k}" value="${esc(s.models[k])}" style="direction:ltr"></div></div>`).join('')}
      <div><label>رابط منصة فهمني (الرابط الرسمي من وزارة التربية والتعليم)</label><input type="text" name="fahhimni" value="${esc(s.fahhimni)}" placeholder="https://..." style="direction:ltr"></div></div>
    <div><button class="btn primary">حفظ الإعدادات</button></div></form>
    <div class="card stack"><h3>💾 بياناتي</h3><div class="row"><button class="btn" data-act="exportData">تصدير نسخة احتياطية</button><label class="btn" style="margin:0;color:inherit">استيراد نسخة<input type="file" accept=".json" data-change="importData" style="display:none"></label><button class="btn bad" data-act="resetData">مسح كل بياناتي</button></div></div></div>`;
}

// ---------- الأدمن ----------
let ADMIN_CODES = {};
function viewAdmin() {
  if (CURRENT.role !== 'admin') return '<div class="err">للأدمن فقط.</div>';
  const users = getUsers().filter(u => u.role !== 'admin').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const pend = users.filter(u => u.status === 'pending').length;
  const pill = s => s === 'approved' ? '<span class="pill ok">مقبول</span>' : s === 'rejected' ? '<span class="pill bad">مرفوض</span>' : '<span class="pill warn">في الانتظار</span>';
  return `<div class="stack"><h1>🛡️ لوحة الأدمن</h1>
    <div class="grid three"><div class="card"><h3>${users.length}</h3><p class="muted small">إجمالي الطلبات</p></div><div class="card"><h3>${pend}</h3><p class="muted small">في الانتظار</p></div><div class="card"><h3>${users.filter(u => u.status === 'approved').length}</h3><p class="muted small">مقبولين</p></div></div>
    <div class="card stack"><h3>استيراد طلب تسجيل من رمز</h3><p class="muted small">لو طالب سجّل على نسخته هو وبعتلك "رمز الطلب"، الصقه هنا.</p>
      <form data-form="importRequest" class="row"><input type="text" name="code" class="grow" style="direction:ltr" required placeholder="رمز الطلب"><button class="btn primary">استيراد</button></form></div>
    <div class="card"><h3>الطلبات والمستخدمين</h3>
      <p class="muted small">الباسورد متخزن مشفّر ومش بيتعرض لأي حد (ولا ليك) — ده الأمان الصحيح. لو طالب نسي باسورده اعمله "تعيين باسورد جديد".</p>
      <div class="scroll-x"><table><thead><tr><th>الاسم</th><th>المدرسة</th><th>السنة</th><th>الإيميل</th><th>الحالة</th><th>رمز الموافقة</th><th></th></tr></thead><tbody>
      ${users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.school)}</td><td>${esc(gradeOf(u.grade).name)}</td><td style="direction:ltr;text-align:right">${esc(u.email)}</td><td>${pill(u.status)}</td>
        <td><button class="btn sm" data-act="showCode" data-id="${u.id}">${ADMIN_CODES[u.id] ? `<span class="code" style="padding:0">${ADMIN_CODES[u.id]}</span>` : 'إظهار'}</button></td>
        <td><div class="row">${u.status !== 'approved' ? `<button class="btn sm ok" data-act="setStatus" data-id="${u.id}" data-s="approved">قبول</button>` : ''}${u.status !== 'rejected' ? `<button class="btn sm bad" data-act="setStatus" data-id="${u.id}" data-s="rejected">رفض</button>` : ''}<button class="btn sm" data-act="resetPw" data-id="${u.id}">باسورد جديد</button><button class="btn sm bad" data-act="delUser" data-id="${u.id}">حذف</button></div></td></tr>`).join('') || '<tr><td colspan="7" class="muted">مفيش طلبات لسه.</td></tr>'}
      </tbody></table></div></div></div>`;
}
