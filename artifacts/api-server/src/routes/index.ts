import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import postsRouter from "./posts";
import libraryRouter from "./library";
import notificationsRouter from "./notifications";
import adminRouter from "./admin";
import dailyWordRouter from "./dailyWord";
import uploadsRouter from "./uploads";
import searchRouter from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(uploadsRouter);
router.use(usersRouter);
router.use(searchRouter);
router.use(postsRouter);
router.use(libraryRouter);
router.use(notificationsRouter);
router.use(dailyWordRouter);
router.use(adminRouter);

export default router;
