import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import chatsRouter from "./chats";
import githubRouter from "./github";
import statusRouter from "./status";
import uploadRouter from "./upload";
import memoryRouter from "./memory";
import toolsRouter from "./tools";
import ragRouter from "./rag";
import greetingRouter from "./greeting";
import imagesRouter from "./images";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/status", statusRouter);
router.use("/chat", chatRouter);
router.use("/chats", chatsRouter);
router.use("/github", githubRouter);
router.use("/upload", uploadRouter);
router.use("/memory", memoryRouter);
router.use("/tools", toolsRouter);
router.use("/rag", ragRouter);
router.use("/greeting", greetingRouter);
router.use("/images", imagesRouter);

export default router;
