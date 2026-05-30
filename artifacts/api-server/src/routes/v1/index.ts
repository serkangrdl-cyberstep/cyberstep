import { Router } from "express";
import scoreRouter from "./score";
import certificateRouter from "./certificate";
import scanRouter from "./scan";
import benchmarkRouter from "./benchmark";

const router = Router();

router.use(scoreRouter);
router.use(certificateRouter);
router.use(scanRouter);
router.use(benchmarkRouter);

export default router;
