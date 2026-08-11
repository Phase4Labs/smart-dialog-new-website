// @ts-nocheck - Disable TypeScript checks for Deno environment compatibility
// Supabase Edge Function: contact-form
// Receives contact form submissions from smartdialog-ai.com, stores them in
// the smart_dialog_contact_submissions table, notifies the team, and sends the visitor a
// SendGrid dynamic-template confirmation email.
//
// Required secrets (set via `supabase secrets set KEY=value`):
//   SENDGRID_API_KEY   — your SendGrid API key (Mail Send permission)
//
// Optional secrets (defaults shown below):
//   SD_CONTACTUS_SENDGRID_TEMPLATE_ID — confirmation template (default: d-4905597838124b31ae5737b2544cc68d)
//   SD_CONTACT_TO           — where notifications go (default: contact@smartdialog-ai.com)
//   SD_FROM_EMAIL           — verified sender (default: contact@smartdialog-ai.com)
//   SD_ALLOWED_ORIGIN       — comma-separated CORS origins (default: www + apex smartdialog-ai.com)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Deploy:  supabase functions deploy contact-form --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") ?? "";
const TEMPLATE_ID = Deno.env.get("SD_CONTACTUS_SENDGRID_TEMPLATE_ID") ?? "d-4905597838124b31ae5737b2544cc68d";
const SD_CONTACT_TO = Deno.env.get("SD_CONTACT_TO") ?? "contact@smartdialog-ai.com";
const SD_FROM_EMAIL = Deno.env.get("SD_FROM_EMAIL") ?? "contact@smartdialog-ai.com";
// Comma-separated list of allowed origins, e.g.
// "https://www.smartdialog-ai.com,https://smartdialog-ai.com"
// The CORS header itself only accepts ONE origin, so we echo back whichever
// allowed origin the request came from. "*" allows all (testing only).
const SD_ALLOWED_ORIGIN = Deno.env.get("SD_ALLOWED_ORIGIN") ??
  "https://www.smartdialog-ai.com,https://smartdialog-ai.com";
const ALLOWED_ORIGINS = SD_ALLOWED_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes("*")
    ? "*"
    : ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0]; // fallback: browser will block non-allowed origins
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });

interface Submission {
  name: string;
  email: string;
  phone?: string;
  interest?: string;
  message: string;
  source?: string;
}

function validate(data: Partial<Submission>): string | null {
  if (!data.name?.trim()) return "Name is required.";
  if (!data.email?.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "Email looks invalid.";
  if (!data.message?.trim()) return "Message is required.";
  if (data.name.length > 200 || data.email.length > 320) return "Field too long.";
  if (data.message.length > 5000) return "Message too long (5000 chars max).";
  return null;
}

async function sendgrid(payload: unknown): Promise<{ ok: boolean; detail?: string }> {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (res.ok) return { ok: true };
  return { ok: false, detail: `${res.status} ${await res.text()}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });

  let data: Partial<Submission>;
  try {
    data = await req.json();
  } catch {
    return json(req, 400, { error: "Invalid JSON body" });
  }

  const error = validate(data);
  if (error) return json(req, 400, { error });

  const submission: Submission = {
    name: data.name!.trim(),
    email: data.email!.trim().toLowerCase(),
    phone: data.phone?.trim() || null as unknown as string,
    interest: data.interest?.trim() || "Not specified",
    message: data.message!.trim(),
    source: data.source ?? "unknown",
  };

  // 1) Store first — emails can fail, the lead must not.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: row, error: dbError } = await supabase
    .from("smart_dialog_contact_submissions")
    .insert(submission)
    .select("id")
    .single();

  if (dbError) {
    console.error("DB insert failed:", dbError.message);
    return json(req, 500, { error: "Could not save your message. Please try again." });
  }

  // 2) Internal notification to the team.
  const notification = await sendgrid({
    personalizations: [{ to: [{ email: SD_CONTACT_TO }] }],
    from: { email: SD_FROM_EMAIL, name: "Smart Dialog Website" },
    reply_to: { email: submission.email, name: submission.name },
    subject: `[Lead · ${submission.interest}] ${submission.name}`,
    content: [{
      type: "text/plain",
      value: [
        `New contact form submission (#${row.id})`,
        ``,
        `Name:     ${submission.name}`,
        `Email:    ${submission.email}`,
        `Phone:    ${submission.phone || "—"}`,
        `Interest: ${submission.interest}`,
        `Source:   ${submission.source}`,
        ``,
        `Message:`,
        submission.message,
      ].join("\n"),
    }],
  });
  if (!notification.ok) console.error("Notification email failed:", notification.detail);

  // 3) Confirmation to the visitor via dynamic template.
  const confirmation = await sendgrid({
    personalizations: [{
      to: [{ email: submission.email, name: submission.name }],
      dynamic_template_data: {
        name: submission.name,
        interest: submission.interest,
        message: submission.message,
      },
    }],
    from: { email: SD_FROM_EMAIL, name: "Smart Dialog AI" },
    reply_to: { email: SD_CONTACT_TO },
    template_id: TEMPLATE_ID,
  });
  if (!confirmation.ok) console.error("Confirmation email failed:", confirmation.detail);

  // Stored successfully → success for the visitor, even if an email hiccuped.
  return json(req, 200, {
    ok: true,
    id: row.id,
    notification_sent: notification.ok,
    confirmation_sent: confirmation.ok,
  });
});
