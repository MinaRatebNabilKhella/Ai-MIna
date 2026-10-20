import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const gradeName: Record<string, string> = { p6: 'السادس الابتدائي', prep3: 'الثالث الإعدادي', sec1: 'الأولى الثانوي', sec2: 'الثانية الثانوي', sec3: 'الثالثة الثانوية العامة مصر', uni3: 'الجامعة', uni4: 'الجامعة' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const declaredLength = Number(req.headers.get('content-length') || '0');
  if (declaredLength > 5_000) return json({ error: 'حجم الطلب أكبر من الحد المسموح.' }, 413);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'سجّل الدخول أولًا.' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL'), anonKey = Deno.env.get('SUPABASE_ANON_KEY'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'إعداد الخادم غير مكتمل.' }, 500);
  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: 'جلسة الدخول غير صالحة.' }, 401);
  if (!authData.user.email_confirmed_at) return json({ error: 'أكد بريدك الإلكتروني قبل استخدام التطبيق.' }, 403);
  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await adminClient.from('profiles').select('id,grade,status,role').eq('id', authData.user.id).maybeSingle();
  if (!profile || profile.status !== 'approved') return json({ error: profile?.status === 'rejected' ? 'الحساب مرفوض.' : profile?.status === 'deleted' ? 'الحساب موقوف.' : 'الحساب ما زال ينتظر الموافقة.' }, 403);
  let body: { subject?: unknown; topic?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'صيغة الطلب غير صحيحة.' }, 400); }
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 120) : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 160) : '';
  if (!subject || !topic) return json({ error: 'اكتب المادة والدرس أولًا.' }, 400);
  const key = Deno.env.get('YOUTUBE_API_KEY');
  if (!key) return json({ error: 'ترشيح فيديوهات محددة يحتاج إضافة YOUTUBE_API_KEY إلى أسرار الخادم. تقدر تستخدم روابط البحث المؤقتة لحد ما يتم إعداد المفتاح.' }, 503);
  const { error: quotaError } = await adminClient.rpc('reserve_usage', { p_user_id: authData.user.id, p_usage_type: 'youtube' });
  if (quotaError) {
    if (`${quotaError.message || ''} ${quotaError.details || ''}`.includes('DAILY_LIMIT')) return json({ error: `وصلت للحد اليومي لترشيحات الفيديو (${profile.role === 'admin' ? 100 : 10} طلبات). جرّب غدًا.` }, 429);
    return json({ error: 'تعذر التحقق من حد استخدام ترشيحات الفيديو.' }, 500);
  }
  const query = `شرح ${subject} ${topic} ${gradeName[profile.grade] || 'مصر'} مدرس مصري`;
  const url = new URL('https://youtube.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet'); url.searchParams.set('type', 'video'); url.searchParams.set('maxResults', '5');
  url.searchParams.set('order', 'relevance'); url.searchParams.set('relevanceLanguage', 'ar'); url.searchParams.set('regionCode', 'EG');
  url.searchParams.set('safeSearch', 'strict'); url.searchParams.set('q', query); url.searchParams.set('key', key);
  try {
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: 'YouTube لم يوفّر النتائج حاليًا. تأكد من تفعيل YouTube Data API v3 في مشروع Google Cloud.' }, 502);
    const videos = (payload.items || []).filter((v: any) => v?.id?.videoId && v?.snippet?.title).map((v: any) => ({
      id: String(v.id.videoId), title: String(v.snippet.title).slice(0, 300), channel: String(v.snippet.channelTitle || '').slice(0, 160),
      description: String(v.snippet.description || '').slice(0, 500), publishedAt: v.snippet.publishedAt || null,
      thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || null,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(v.id.videoId)}`,
    }));
    return json({ query, videos });
  } catch {
    return json({ error: 'تعذر الوصول إلى YouTube. تأكد من الاتصال وحاول مرة أخرى.' }, 502);
  }
});
