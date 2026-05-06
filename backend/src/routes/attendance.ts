import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import {
  recordJoin,
  recordLeave,
  recordAttendanceTick,
  listMyAttendanceSummary,
  getStudentMyAttendanceDetail,
  getStudentClassStreak,
  getStudentMyStreaks,
  getTeacherStreakBoard,
  listTeacherAttendanceRoster,
  getTeacherStudentAttendanceView,
} from "../controllers/attendanceController.js";

const router = Router();

router.use(authMiddleware);

router.post("/join", recordJoin);
router.post("/leave", recordLeave);
router.post("/tick", recordAttendanceTick);
router.get("/my/streaks", requireRole("STUDENT"), getStudentMyStreaks);
router.get("/my/detail", requireRole("STUDENT"), getStudentMyAttendanceDetail);
router.get("/my", listMyAttendanceSummary);
router.get("/streak", requireRole("STUDENT"), getStudentClassStreak);
router.get("/teacher/streak-board", requireRole("TEACHER"), getTeacherStreakBoard);
router.get("/teacher/roster", requireRole("TEACHER"), listTeacherAttendanceRoster);
router.get("/teacher/student", requireRole("TEACHER"), getTeacherStudentAttendanceView);

export default router;
