import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import {
  createClass,
  getClass,
  updateClass,
  inviteToClass,
  disinviteFromClass,
  joinMeeting,
  endMeeting,
  kickParticipant,
  listClasses,
  listParticipants,
  listAttendance,
} from "../controllers/classesController.js";

const router = Router();

router.use(authMiddleware);

router.get("/", listClasses);
router.post("/", requireRole("TEACHER"), createClass);
router.get("/:id", getClass);
router.patch("/:id", requireRole("TEACHER"), updateClass);
router.get("/:id/participants", requireRole("TEACHER"), listParticipants);
router.get("/:id/attendance", requireRole("TEACHER"), listAttendance);
router.post("/:id/invite", requireRole("TEACHER"), inviteToClass);
router.post("/:id/disinvite", requireRole("TEACHER"), disinviteFromClass);
router.post("/:id/join", joinMeeting);
router.post("/:id/end", requireRole("TEACHER"), endMeeting);
router.post("/:id/kick", requireRole("TEACHER"), kickParticipant);

export default router;
