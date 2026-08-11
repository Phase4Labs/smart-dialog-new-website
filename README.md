# Smart Dialog AI — Website

Marketing site for [Smart Dialog AI](https://www.smartdialog-ai.com), a product development company building conversational products that unify voice, SMS, WhatsApp, and social messaging.

Static HTML/CSS — no build step, no framework. Open `index.html` in a browser or deploy the folder to any static host.

## Structure

```
smartdialog-site/
├── index.html          Home — products overview, value prop, CTA
├── rango.html          Rango — flagship AI front desk / lead-capture platform
├── cancha.html         Cancha — WhatsApp booking platform for courts & fields
├── services.html       Platform services — IVR, alerts, identity verification
├── about.html          Mission, vision, how we work
├── contact.html        Contact form (submits to Supabase Edge Function)
├── styles.css          Shared stylesheet (design tokens in :root)
├── assets/
│   └── logo.png        Brand logo
├── email/
│   └── sendgrid-confirmation-template.html
│                       SendGrid dynamic template for the confirmation email
└── supabase/
    ├── functions/contact-form/index.ts
    │                   Edge Function: stores lead + sends emails via SendGrid
    ├── migrations/20260811_contact_submissions.sql
    │                   smart_dialog_contact_submissions table
    └── README-contact-backend.md
                        Backend setup & deploy guide
```

## Contact form backend

The form on `contact.html` POSTs to a Supabase Edge Function that:

1. Validates and stores the submission in `smart_dialog_contact_submissions` (store-first: a lead is never lost to an email failure)
2. Emails a notification to contact@smartdialog-ai.com (reply-to set to the visitor)
3. Sends the visitor a confirmation via SendGrid dynamic template

Setup, secrets (`SENDGRID_API_KEY`, `SD_*` overrides), and test commands: see [`supabase/README-contact-backend.md`](supabase/README-contact-backend.md).

## Deploying the site

Any static host works (Netlify, Vercel, Cloudflare Pages, S3, nginx). Checklist:

- Set `CONTACT_ENDPOINT` in `contact.html` to the deployed Edge Function URL
- Enable clean URLs on the host so `/contact` serves `contact.html`
- Redirect apex → www (or vice versa); both origins are in the function's default CORS allow-list
- After deploy: submit a test through the form and confirm the DB row + both emails

## Editing

- Colors, spacing, and type live as CSS variables at the top of `styles.css` (`--orange`, `--ink`, etc.)
- Nav and footer are duplicated per page — a change there means updating all six HTML files
- Conversation "demo" widgets use the `.demo` / `.msg` classes; example businesses in them are fictional

---

© Smart Dialog AI. All rights reserved.
