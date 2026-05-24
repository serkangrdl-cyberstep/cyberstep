import { Router, type IRouter } from "express";
import healthRouter from "./health";
import assessmentsRouter from "./assessments/index";
import geminiRouter from "./gemini/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use(assessmentsRouter);
router.use(geminiRouter);

export default router;
