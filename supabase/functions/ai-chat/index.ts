import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function gradeName(grade: string): string {
  const names: Record<string, string> = {
    p6: 'السادس الابتدائي', prep3: 'الثالث الإعدادي', sec1: 'الأولى الثانوي',
    sec2: 'الثانية الثانوي', sec3: 'الثالثة الثانوي (الثانوية العامة)',
    uni3: 'الثالثة الجامعة', uni4: 'الرابعة الجامعة',
  };
  return names[grade] || 'المرحلة الدراسية';
}

function normalizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 20) {
    throw new Error('أرسل من رسالة واحدة إلى 20 رسالة فقط.');
  }
  let total = 0;
  const messages: ChatMessage[] = [];
  for (const item of input) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') continue;
    const content = item.content.trim();
    if (!content) continue;
    if (content.length > 3_000) throw new Error('الحد الأقصى لطول الرسالة 3000 حرف.');
    total += content.length;
    messages.push({ role: item.role, content });
  }
  if (!messages.length || total > 12_000) throw new Error('إجمالي طول المحادثة أكبر من الحد المسموح.');
  if (messages[messages.length - 1].role !== 'user') throw new Error('آخر رسالة لازم تكون سؤال الطالب.');
  return messages;
}

function systemPrompt(profile: { name: string; grade: string }) {
  return `أنت مساعد تعليمي داخل تطبيق مينا ستودنت AI. اسم الطالب ${profile.name || 'الطالب'}، والمرحلة الدراسية ${gradeName(profile.grade)}. اشرح بالعربية الواضحة وبالعامية المصرية البسيطة عند الحاجة. ابدأ بالفكرة الأساسية، ثم مثال مناسب للمرحلة، ثم سؤال تدريبي قصير. لا تدّعِ أنك تحققت من مصادر مباشرة ما لم تستخدم أداة بحث فعلية. كن صريحًا عند عدم التأكد. لا تطلب كلمات مرور أو أرقامًا قومية أو جوازات سفر أو بيانات مالية. لا تقدم محتوى خطرًا أو غير مناسب لعمر الطالب. اجعل الإجابة مركزة ولا تتجاوز تقريبًا 1000 كلمة.`;
}

async function callGemini(messages: ChatMessage[], prompt: string) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('خدمة Gemini غير مضبوطة على الخادم بعد.');
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.5, maxOutputTokens: 1400 },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Do not return provider headers or the API key to the client.
    const detail = payload?.error?.message;
    throw new Error(detail ? `Gemini: ${String(detail).slice(0, 300)}` : `تعذر على Gemini الرد (HTTP ${response.status}).`);
  }
  const answer = (payload?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('').trim();
  if (!answer) throw new Error('النموذج لم يرجع إجابة نصية. جرّب السؤال مرة أخرى.');
  return answer.slice(0, 12_000);
}

async function callOpenAI(messages: ChatMessage[], prompt: string) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('خدمة ChatGPT غير مفعّلة على الخادم. استخدم Gemini أو تواصل مع الأدمن.');
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 1400, messages: [{ role: 'system', content: prompt }, ...messages] }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ? `ChatGPT: ${String(payload.error.message).slice(0, 300)}` : `تعذر على ChatGPT الرد (HTTP ${response.status}).`);
  const answer = payload?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('النموذج لم يرجع إجابة نصية.');
  return answer.slice(0, 12_000);
}

async function callClaude(messages: ChatMessage[], prompt: string) {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('خدمة Claude غير مفعّلة على الخادم. استخدم Gemini أو تواصل مع الأدمن.');
  const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-haiku-4-5-20251001';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 1400, system: prompt, messages }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message ? `Claude: ${String(payload.error.message).slice(0, 300)}` : `تعذر على Claude الرد (HTTP ${response.status}).`);
  const answer = (payload?.content || []).map((p: { text?: string }) => p.text || '').join('').trim();
  if (!answer) throw new Error('النموذج لم يرجع إجابة نصية.');
  return answer.slice(0, 12_000);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const declaredLength = Number(req.headers.get('content-length') || '0');
  if (declaredLength > 30_000) return json({ error: 'حجم الطلب أكبر من الحد المسموح.' }, 413);

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'سجّل الدخول أولًا.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'إعداد الخادم غير مكتمل.' }, 500);

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'جلسة الدخول غير صالحة. سجّل الدخول مرة أخرى.' }, 401);
  const user = authData.user;
  if (!user.email_confirmed_at) return json({ error: 'أكد بريدك الإلكتروني قبل استخدام التطبيق.' }, 403);
  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await adminClient.from('profiles').select('id,email,name,grade,role,status').eq('id', user.id).maybeSingle();
  if (profileError || !profile) return json({ error: 'لم يتم العثور على ملف الحساب.' }, 403);
  if (profile.status !== 'approved') {
    const msg = profile.status === 'rejected' ? 'تم رفض الحساب. تواصل مع الدعم إذا كان الرفض بالخطأ.' : profile.status === 'deleted' ? 'الحساب موقوف ولا يمكنه استخدام الخدمة.' : 'حسابك ما زال ينتظر موافقة الأدمن.';
    return json({ error: msg }, 403);
  }

  let body: { provider?: string; messages?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'صيغة الطلب غير صحيحة.' }, 400); }
  const provider = String(body.provider || 'gemini').toLowerCase();
  if (!['gemini', 'openai', 'claude'].includes(provider)) return json({ error: 'المزوّد غير مدعوم.' }, 400);
  let messages: ChatMessage[];
  try { messages = normalizeMessages(body.messages); }
  catch (e) { return json({ error: e instanceof Error ? e.message : 'رسائل غير صالحة.' }, 400); }

  if (provider === 'gemini' && !Deno.env.get('GEMINI_API_KEY')) return json({ error: 'خدمة Gemini غير مضبوطة على الخادم بعد.' }, 503);
  if (provider === 'openai' && !Deno.env.get('OPENAI_API_KEY')) return json({ error: 'خدمة ChatGPT غير مفعّلة على الخادم. استخدم Gemini أو تواصل مع الأدمن.' }, 503);
  if (provider === 'claude' && !Deno.env.get('ANTHROPIC_API_KEY')) return json({ error: 'خدمة Claude غير مفعّلة على الخادم. استخدم Gemini أو تواصل مع الأدمن.' }, 503);

  const { error: quotaError } = await adminClient.rpc('reserve_usage', { p_user_id: user.id, p_usage_type: 'ai' });
  if (quotaError) {
    const text = `${quotaError.message || ''} ${quotaError.details || ''}`;
    if (text.includes('DAILY_LIMIT')) return json({ error: `استهلكت حد الذكاء الاصطناعي اليومي (${profile.role === 'admin' ? 100 : 20} طلبًا). جرّب غدًا.` }, 429);
    if (text.includes('ACCOUNT_NOT_APPROVED')) return json({ error: 'حسابك غير مفعّل لاستخدام الذكاء الاصطناعي.' }, 403);
    return json({ error: 'تعذر التحقق من حد الاستخدام. جرّب بعد قليل.' }, 500);
  }

  try {
    const prompt = systemPrompt(profile);
    const reply = provider === 'gemini' ? await callGemini(messages, prompt) : provider === 'openai' ? await callOpenAI(messages, prompt) : await callClaude(messages, prompt);
    return json({ reply, provider, model: provider === 'gemini' ? (Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash') : 'server-configured' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'حدث خطأ غير معروف في خدمة الذكاء الاصطناعي.';
    return json({ error: message }, 502);
  }
});
