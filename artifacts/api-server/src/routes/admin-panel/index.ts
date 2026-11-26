import { Router } from "express";
import authRouter from "./auth";
import tenantsRouter from "./tenants";
import settingsRouter from "./settings";
import analyticsRouter from "./analytics";
import paymentRouter from "./payment";
import setupRouter from "./setup";
import contentRouter from "./content";
import blogRouter from "./blog";
import specialMessagesRouter from "./special-messages";
import questionsAdminRouter from "./questions-admin";
import customersAdminRouter from "./customers-admin";
import domainScansAdminRouter from "./domain-scans-admin";
import emailTemplatesRouter from "./email-templates";
import serviceCatalogAdminRouter from "./service-catalog";
import serviceOnboardingRouter from "./service-onboarding";
import leadDiscoveryRouter from "./lead-discovery";
import cronRouter from "./cron";
import cveAdminRouter from "./cve-admin";
import musteriProvizyonRouter from "./musteri-provizyon";
import adminsRouter from "./admins";
import iocControlsRouter from "./ioc-controls";
import supportAccessRouter from "./support-access";
import indexReportsRouter from "./index-reports";
import badgeAdminRouter from "./badge-admin";
import kvkkLeadsRouter from "./kvkk-leads";
import sourceStatsRouter from "./source-stats";

const router = Router();
router.use(authRouter);
router.use(supportAccessRouter);
router.use(tenantsRouter);
router.use(settingsRouter);
router.use(analyticsRouter);
router.use(paymentRouter);
router.use(setupRouter);
router.use(contentRouter);
router.use(blogRouter);
router.use(specialMessagesRouter);
router.use(questionsAdminRouter);
router.use(customersAdminRouter);
router.use(domainScansAdminRouter);
router.use(emailTemplatesRouter);
router.use(serviceCatalogAdminRouter);
router.use(serviceOnboardingRouter);
router.use(leadDiscoveryRouter);
router.use(cronRouter);
router.use(cveAdminRouter);
router.use(musteriProvizyonRouter);
router.use(adminsRouter);
router.use(iocControlsRouter);
router.use(indexReportsRouter);
router.use(badgeAdminRouter);
router.use(kvkkLeadsRouter);
router.use(sourceStatsRouter);
// ─── POST /api/admin-panel/reports/annual/generate ────────────────────────────
router.post("/reports/annual/generate", async (req, res) => {
  try {
    const year: number = Number(req.body?.year) || new Date().getFullYear() - 1;
    const domain: string | undefined = req.body?.domain ?? undefined;
    const { generateAnnualReports } = await import("../../lib/reports/annualReportSvg.js");
    const sent = await generateAnnualReports(year, domain);
    res.json({ success: true, sent, year, domain: domain ?? "all" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
