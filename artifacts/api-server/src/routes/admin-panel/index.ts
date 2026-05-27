import { Router } from "express";
import authRouter from "./auth";
import settingsRouter from "./settings";
import analyticsRouter from "./analytics";
import paymentRouter from "./payment";
import setupRouter from "./setup";
import contentRouter from "./content";
import blogRouter from "./blog";
import specialMessagesRouter from "./special-messages";
import questionsAdminRouter from "./questions-admin";

const router = Router();
router.use(authRouter);
router.use(settingsRouter);
router.use(analyticsRouter);
router.use(paymentRouter);
router.use(setupRouter);
router.use(contentRouter);
router.use(blogRouter);
router.use(specialMessagesRouter);
router.use(questionsAdminRouter);

export default router;
