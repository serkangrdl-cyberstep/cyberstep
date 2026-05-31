---
name: Admin tenant auto-provision
description: How requireAdmin guarantees session.tenantId so tenant-scoped admin routes don't 403
---

# Admin tenant auto-provision

Tenant-scoped admin features (e-posta şablonları, bildirim merkezi, ISR/teknoloji ortakları, and anything behind `requireTenant`) need `session.tenantId`. Admin login historically only set `session.adminId`, and the `tenants` table could be empty, so these routes returned `403 { code: "NO_TENANT" }` — which then cascaded into frontend white-screens.

## Rule
`requireAdmin` is **async** and self-heals the session: if `session.tenantId` is missing it picks the admin's first `tenant_users` membership, else auto-provisions a default tenant (slug `workspace-${adminId}`, name "CyberStep") and an `owner` membership, then sets `session.tenantId`. Call sites are unchanged — every route guarded by `requireAdmin` gets a tenant for free.

**Why:** avoids per-route NO_TENANT handling and makes a fresh admin account usable immediately without a separate "create workspace" step.

**How to apply:**
- The tenant insert uses `tenants.slug` unique + `onConflictDoNothing` (race-safe).
- The membership insert relies on a composite unique index `tenant_users_tenant_admin_uq` on `(tenant_id, admin_user_id)` so concurrent first-load requests can't create duplicate memberships. If you ever recreate the table, keep that unique index or `onConflictDoNothing` becomes a no-op.
- `ensureTenantForAdmin` failures are swallowed (non-fatal) — downstream `requireTenant` still guards. Don't make it throw fatally.
- This is multi-tenant by design: tenant-scoped data must be filtered by `getTenantId(req)`, not global.
