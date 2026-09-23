# 🎓 FUTA Freshers' Survival Guide

A complete academic guide for FUTA 100-level students, with real-time updates, admin controls, and a Supabase backend.

**Live site:** https://futafreshersguide.vercel.app
**Admin:** https://futafreshersguide.vercel.app/admin.html
**Session:** 2026/2027
**Version:** 2.0.0

---

## 📁 Project Files


**Database schema files** (run once in Supabase SQL Editor, not saved in repo):
- `supabase-schema.sql` — Main schema
- `supabase-schema-1c.sql` — Notifications, sessions, activity log
- `supabase-schema-1d.sql` — Content blocks
- `supabase-schema-3.5.sql` — CCMAS awareness

---

## 🔧 Making Changes

### Content edits (no code needed)
Log into `/admin.html` and use:
- **Content Editor** — change dates, fees, contact info
- **Courses** — add/edit/remove courses
- **Calendar** — add/edit events
- **Notifications** — send broadcasts
- **Sessions** — switch active academic session

### Code edits
1. Edit the file
2. Commit + push
3. Vercel auto-deploys

---

## 🔄 New Academic Session (e.g., 2027/2028)

No code changes needed:
1. Admin → **Sessions** → Add → `2027/2028` → Activate
2. Admin → **Calendar** → Add new events
3. Admin → **Content Editor** → Update dates
4. Old CCMAS notification auto-expires `2027-10-01`

---

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- Anon key is safe to expose (protected by RLS)
- Service role key is NOT used in frontend

---

## 📞 Contact

**Project Owner:** Abideen Yakub Opeyemi (Ó'YẸMÍ)
**Email:** abideenyakub08@gmail.com
**Phone:** +2347050376975

---

## 📜 License

Independent student project. Not officially affiliated with FUTA.
