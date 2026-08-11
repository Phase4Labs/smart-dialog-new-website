# Contact form backend — setup

One-time setup, ~5 minutes. Run these from the `smartdialog-site` folder (or wherever your Supabase project lives).

## 1. Create the table

Run `migrations/20260811_contact_submissions.sql` in the Supabase SQL editor (or `supabase db push` if you use migrations locally).

## 2. Set secrets

```bash
supabase secrets set SENDGRID_API_KEY=SG.xxxxxxxx
```

Optional overrides (defaults are already correct for you):

```bash
supabase secrets set SD_CONTACTUS_SENDGRID_TEMPLATE_ID=d-4905597838124b31ae5737b2544cc68d
supabase secrets set SD_CONTACT_TO=contact@smartdialog-ai.com
supabase secrets set SD_FROM_EMAIL=contact@smartdialog-ai.com
supabase secrets set SD_ALLOWED_ORIGIN="https://www.smartdialog-ai.com,https://smartdialog-ai.com"
```

⚠️ `SD_FROM_EMAIL` must be a **verified sender** in SendGrid (Settings → Sender Authentication). Authenticate the smartdialog-ai.com domain if you haven't — it's also what keeps these emails out of spam.

## 3. Deploy the function

```bash
supabase functions deploy contact-form --no-verify-jwt
```

`--no-verify-jwt` lets the public form post without a Supabase session. Abuse is mitigated by the form's honeypot, validation, and CORS locked to your domain.

## 4. Point the form at it

In `contact.html`, set:

```js
const CONTACT_ENDPOINT = "https://YOUR-PROJECT-REF.supabase.co/functions/v1/contact-form";
const SUPABASE_ANON_KEY = ""; // leave empty — deployed with --no-verify-jwt
```

## 5. SendGrid template

The confirmation email design lives in `../email/sendgrid-confirmation-template.html`. Paste it into template `d-4905597838124b31ae5737b2544cc68d` (Code Editor), and set the template **subject** to:

```
We got your message, {{name}} — talking soon ✓
```

It uses `{{name}}`, `{{interest}}`, and `{{message}}`.

## Test

Bash / Git Bash / WSL:

```bash
curl -X POST https://YOUR-PROJECT-REF.supabase.co/functions/v1/contact-form \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"you@example.com","interest":"Rango","message":"Hello!"}'
```

Windows PowerShell (`curl` there is an alias for Invoke-WebRequest, so use this instead):

```powershell
Invoke-RestMethod -Method Post -Uri "https://YOUR-PROJECT-REF.supabase.co/functions/v1/contact-form" -ContentType "application/json" -Body '{"name":"Test","email":"you@example.com","interest":"Rango","message":"Hello!"}'
```

Expected: `{"ok":true,"id":1,"notification_sent":true,"confirmation_sent":true}` — plus a row in `smart_dialog_contact_submissions`, a notification at contact@, and the templated confirmation in the test inbox.

Note: while testing locally (opening contact.html from disk), temporarily set `SD_ALLOWED_ORIGIN=*` or the browser will block the request; switch it back to your domain for production.
