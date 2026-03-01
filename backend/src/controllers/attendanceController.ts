import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export async function recordJoin(req: Request, res: Response): Promise<void> {
  try {
    const { classId, email } = req.body as { classId?: string; email?: string };

    if (!classId?.trim() || !email?.trim()) {
      res.status(400).json({ error: "classId and email are required" });
      return;
    }

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const record = await prisma.attendance.create({
      data: {
        classId: classId.trim(),
        email: email.trim().toLowerCase(),
      },
    });

    res.status(201).json({
      id: record.id,
      classId: record.classId,
      email: record.email,
      joinTime: record.joinTime,
    });
  } catch (err) {
    console.error("Attendance join error:", err);
    res.status(500).json({ error: "Failed to record join" });
  }
}

export async function recordLeave(req: Request, res: Response): Promise<void> {
  try {
    const { classId, email } = req.body as { classId?: string; email?: string };

    if (!classId?.trim() || !email?.trim()) {
      res.status(400).json({ error: "classId and email are required" });
      return;
    }

    const latest = await prisma.attendance.findFirst({
      where: {
        classId: classId.trim(),
        email: email.trim().toLowerCase(),
        leaveTime: null,
      },
      orderBy: { joinTime: "desc" },
    });

    if (!latest) {
      res.status(404).json({ error: "No active attendance record found" });
      return;
    }

    const leaveTime = new Date();
    const duration = Math.floor(
      (leaveTime.getTime() - latest.joinTime.getTime()) / 1000
    );

    const updated = await prisma.attendance.update({
      where: { id: latest.id },
      data: { leaveTime, duration },
    });

    res.json({
      id: updated.id,
      email: updated.email,
      joinTime: updated.joinTime,
      leaveTime: updated.leaveTime,
      duration: updated.duration,
    });
  } catch (err) {
    console.error("Attendance leave error:", err);
    res.status(500).json({ error: "Failed to record leave" });
  }
}
