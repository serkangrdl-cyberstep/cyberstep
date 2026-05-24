import { Router, type IRouter } from "express";
import healthRouter from "./health";
import assessmentsRouter from "./assessments/index";
import geminiRouter from "./gemini/index";
import adminRouter from "./admin/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use(assessmentsRouter);
router.use(geminiRouter);
router.use(adminRouter);

export default router;
