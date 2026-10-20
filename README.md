# Mina Student AI

Arabic-first study planner PWA with Supabase authentication, centrally synchronized student data, server-side AI requests, daily quotas, admin approval/rejection, approval codes, and YouTube video recommendations.

## Release status

This archive contains deployment automation and release checks, but it is **not live yet**. A project owner must create a Supabase project and add its own credentials to GitHub. No passwords, API keys, or access tokens belong in the source files or in this chat.

## Automated free-tier deployment

1. Create a Supabase project on the Free plan. The expected website URL for this repository is `https://minaratebnabilkhella.github.io/Ai-MIna/`.
2. In the existing repository on GitHub, open **Settings → Secrets and variables → Actions** and add repository **Variables**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF`. Optionally set `SUPPORT_WHATSAPP` and `MINA_APP_URL`.
3. Add repository **Secrets**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `GEMINI_API_KEY`. Add `YOUTUBE_API_KEY` to enable specific video recommendations.
4. In **Settings → Pages**, choose **GitHub Actions** as the publishing source.
5. Extract this archive on Windows and double-click `رفع-النسخة-إلى-GitHub.bat`. After reviewing the warning, type `PUBLISH` to replace tracked files on `main`. It uses your normal GitHub sign-in; it never asks for an access token in chat. The two backend/site workflows and release checks then run automatically.
6. In Supabase **Authentication → URL Configuration**, set the Site URL and Redirect URLs to `https://minaratebnabilkhella.github.io/Ai-MIna/` and enable email confirmation.
7. After a successful Pages deployment, the same workflow automatically builds a Windows EXE and uploads it as the `Mina-Student-AI-Windows-Installer` artifact (available for 30 days). Android and iPhone use the installable PWA.

The initial schema is stored in `supabase/migrations/20261020000000_initial_schema.sql`; `supabase/schema.sql` is also provided for manual reference. If the schema was already applied manually, the migration is designed to be rerunnable, but check the Supabase migration history before running the automated deployment.

## Devices

The PWA can be installed from the HTTPS website on Android, iPhone (Safari → Share → Add to Home Screen), and desktop browsers. This archive does not include a native APK or iOS IPA. The Windows EXE is built by GitHub Actions after the web app is deployed.

## Safety

- The admin email is allowlisted in the database; the browser cannot grant itself admin rights.
- API keys and the Supabase service-role key stay on the server as Supabase secrets.
- Student profiles and synchronized data use row-level security policies.
- The phone/address fields are personal data; collect only what the app genuinely needs and restrict access.
- Free hosting/API plans have quotas and service limitations; do not promise unlimited usage.

For full Arabic instructions, see [`اقرأني.txt`](./اقرأني.txt).
