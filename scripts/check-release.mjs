import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const mustExist = [
  'index.html', 'config.js', 'app.js', 'core.js', 'views.js', 'styles.css',
  'manifest.webmanifest', 'sw.js', 'supabase/schema.sql',
  'supabase/migrations/20261020000000_initial_schema.sql',
  'supabase/functions/ai-chat/index.ts',
  'supabase/functions/youtube-recommendations/index.ts',
  '.github/workflows/deploy-pages.yml',
  '.github/workflows/deploy-supabase.yml',
  '.github/workflows/build-windows-exe.yml',
];
const errors = [];
for (const file of mustExist) if (!fs.existsSync(path.join(root, file))) errors.push(`Missing required file: ${file}`);

try {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  if (!manifest.name || !manifest.start_url || !Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    errors.push('manifest.webmanifest must include name, start_url, and icons.');
  }
} catch (e) { errors.push(`Invalid manifest.webmanifest JSON: ${e.message}`); }

const schema = fs.existsSync(path.join(root, 'supabase/schema.sql'))
  ? fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8') : '';
for (const required of [
  'admin_allowlist', 'public.is_app_admin()', "status in ('pending', 'approved', 'rejected', 'deleted')",
  'alter table public.profiles enable row level security', 'public.reserve_usage',
  'public.generate_approval_code', 'public.redeem_approval_code',
]) if (!schema.includes(required)) errors.push(`Schema security guardrail missing: ${required}`);

const frontend = ['app.js', 'core.js', 'views.js', 'config.js'].map(f => fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), 'utf8') : '').join('\n');
if (/AIza[0-9A-Za-z_-]{20,}/.test(frontend)) errors.push('Potential Google API key found in frontend files.');
if (/sk-[0-9A-Za-z]{20,}/.test(frontend)) errors.push('Potential OpenAI secret key found in frontend files.');
if (/SUPABASE_SERVICE_ROLE_KEY\s*:\s*['"]/.test(frontend)) errors.push('A Supabase service-role key assignment must never exist in frontend files.');

const migration = fs.existsSync(path.join(root, 'supabase/migrations/20261020000000_initial_schema.sql'))
  ? fs.readFileSync(path.join(root, 'supabase/migrations/20261020000000_initial_schema.sql'), 'utf8') : '';
if (schema && migration !== schema) errors.push('The initial migration must match supabase/schema.sql.');

if (errors.length) {
  console.error('Release checks failed:');
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}
console.log('Release checks passed: required files, manifest, schema guardrails, frontend secret scan, migration sync.');
