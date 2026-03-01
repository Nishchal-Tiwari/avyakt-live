import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { recordJoin, recordLeave } from "../controllers/attendanceController.js";

const router = Router();

router.use(authMiddleware);

router.post("/join", recordJoin);
router.post("/leave", recordLeave);

export default router;
