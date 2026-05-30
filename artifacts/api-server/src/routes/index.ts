import { Router, type IRouter } from "express";
import healthRouter from "./health";
import assessmentsRouter from "./assessments/index";
import geminiRouter from "./gemini/index";
import adminRouter from "./admin/index";
import customerAuthRouter from "./customer-auth/index";
import domainScanRouter from "./domain-scan/index";
import advisoriesRouter from "./advisories/index";
import kvkkRouter from "./kvkk/index";
import partnerAuthRouter from "./partner-auth/index";
import workPackagesRouter from "./work-packages/index";
import breachMonitorRouter from "./breach-monitor/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use(assessmentsRouter);
router.use(geminiRouter);
router.use(adminRouter);
router.use(customerAuthRouter);
router.use(domainScanRouter);
router.use(advisoriesRouter);
router.use(kvkkRouter);
router.use(partnerAuthRouter);
router.use(workPackagesRouter);
router.use(breachMonitorRouter);

export default router;
