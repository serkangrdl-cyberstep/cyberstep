---
name: NOC Servisi
description: AI-powered passive NOC implementation — schema imports, field names, type quirks
---

## Schema import paths (noc.ts)
- SOC cases: `import { socCasesTable } from "./soc"` (NOT "./soc-cases")
- Fabric events: `import { fabricEventsTable } from "./fortinet"` (NOT "./fabric")

## Customers table
- NO `sector` field on customers table — only `email`, `companyName`, `passwordHash`, etc.
- Remove any reference to `customer.sector` in NOC service prompts

## SOC cases field name
- SOC cases table uses `category` not `caseType`
- When accessing SOC case fields in templates: `c.category` not `c.caseType`

## Auth middleware pattern (NOC routes)
- Customer routes: `requireCustomer` + `getCustomerId(req) as number`
- Admin routes: `requireAdmin`
- Both from: `import { requireCustomer, getCustomerId, requireAdmin } from "../../middleware/auth"`
- `getCustomerId()` returns `number | undefined` — always cast `as number` after `requireCustomer` middleware

## Express params type
- `req.params.token` is `string | string[]` in Express types
- Always use `String(req.params.token)` or `const token = req.params.token as string`

## Frontend JSX unknown type patterns
- `{unknown && <JSX/>}` → use `{!!booleanCast && <JSX/>}`
- `{c.root_cause_analysis && (...)}` → `{!!c.root_cause_analysis && (...)}`
- `{c.sla_deadline && (...)}` → `{!!c.sla_deadline && (...)}`
- `Record<string, unknown>` map items: wrap in `String()` or `Number()` for ReactNode
- `STATUS_ICON[key]` returns `unknown` → cast `as React.ReactNode`

## AdminLayout
- Named export: `import { AdminLayout } from "../../components/admin-layout"`
- Required props: `title` (string) + optional `description`

## useRequireCustomer hook
- Correct import: `import { useRequireCustomer } from "@/hooks/use-customer"`

## 4 NOC crons (all confirmed working in server logs)
1. NOC FortiGate poll — every 5 min
2. NOC availability — every 5 min
3. NOC triage — every 15 min
4. NOC baseline check — every hour

**Why:** Multiple wrong module paths, missing field names, and type quirks caused 13+ TS errors during sprint integration. These are the canonical fixes.
