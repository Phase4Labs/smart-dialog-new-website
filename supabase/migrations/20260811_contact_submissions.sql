-- Contact form submissions from smartdialog-ai.com
create table if not exists public.smart_dialog_contact_submissions (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name       text not null,
  email      text not null,
  phone      text,
  interest   text,
  message    text not null,
  source     text
);

-- Lock it down: no anon/authenticated access. The Edge Function uses the
-- service role key, which bypasses RLS.
alter table public.smart_dialog_contact_submissions enable row level security;

comment on table public.smart_dialog_contact_submissions is
  'Website contact form leads. Written only by the contact-form Edge Function.';
