import { Router } from "express";
import authRouter from "./auth";
import settingsRouter from "./settings";
import analyticsRouter from "./analytics";
import paymentRouter from "./payment";
import setupRouter from "./setup";

const router = Router();
router.use(authRouter);
router.use(settingsRouter);
router.use(analyticsRouter);
router.use(paymentRouter);
router.use(setupRouter);

export default router;
