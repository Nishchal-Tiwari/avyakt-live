import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { createLiveKitToken } from "../services/livekit.js";
import { RoomServiceClient } from "livekit-server-sdk";
import { env } from "../config/env.js";

function classIdParam(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] ?? "" : id ?? "";
}

const livekitHostRaw = env.LIVEKIT_INTERNAL_URL || env.LIVEKIT_URL;
const livekitHost =
  livekitHostRaw.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://") ||
  livekitHostRaw;

const roomService = new RoomServiceClient(
  livekitHost,
  env.LIVEKIT_API_KEY,
  env.LIVEKIT_API_SECRET
);

export async function listClasses(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const asTeacher = await prisma.class.findMany({
      where: { teacherId: userId },
      include: { teacher: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const invited = await prisma.classInvite.findMany({
      where: { email: req.user!.email },
      include: {
        class: {
          include: { teacher: { select: { email: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    type InviteWithClass = (typeof invited)[number];
    const invitedClasses = invited.map((i: InviteWithClass) => ({
      ...i.class,
      invitedAt: i.createdAt,
    }));
    res.json({
      asTeacher,
      invited: invitedClasses,
    });
  } catch (err) {
    console.error("List classes error:", err);
    res.status(500).json({ error: "Failed to list classes" });
  }
}

export async function createClass(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { name, description, redirectUrl } = req.body as {
      name?: string;
      description?: string;
      redirectUrl?: string;
    };

    if (!name?.trim()) {
      res.status(400).json({ error: "Class name is required" });
      return;
    }

    const roomName = `yoga-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const redirect = redirectUrl?.trim() || null;

    const cls = await prisma.class.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        teacherId: userId,
        roomName,
        redirectUrl: redirect,
      },
      include: { teacher: { select: { email: true, name: true } } },
    });

    res.status(201).json({
      id: cls.id,
      name: cls.name,
      description: cls.description,
      roomName: cls.roomName,
      redirectUrl: cls.redirectUrl,
      teacher: cls.teacher,
      createdAt: cls.createdAt,
    });
  } catch (err) {
    console.error("Create class error:", err);
    res.status(500).json({ error: "Failed to create class" });
  }
}

export async function getClass(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        teacher: { select: { id: true, email: true, name: true } },
        invites: { select: { email: true, createdAt: true } },
      },
    });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const isTeacher = req.user!.id === cls.teacherId;
    if (!isTeacher) {
      const invited = await prisma.classInvite.findFirst({
        where: { classId: id, email: req.user!.email },
      });
      if (!invited) {
        res.status(403).json({ error: "You are not invited to this class" });
        return;
      }
    }

    res.json({
      id: cls.id,
      name: cls.name,
      description: cls.description,
      roomName: cls.roomName,
      redirectUrl: cls.redirectUrl ?? undefined,
      teacher: cls.teacher,
      invites: cls.invites,
      createdAt: cls.createdAt,
    });
  } catch (err) {
    console.error("Get class error:", err);
    res.status(500).json({ error: "Failed to fetch class" });
  }
}

export async function updateClass(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const { redirectUrl } = req.body as { redirectUrl?: string };

    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can update the class" });
      return;
    }

    const updated = await prisma.class.update({
      where: { id },
      data: { redirectUrl: redirectUrl?.trim() || null },
      select: { id: true, name: true, redirectUrl: true },
    });

    res.json({
      id: updated.id,
      name: updated.name,
      redirectUrl: updated.redirectUrl ?? undefined,
    });
  } catch (err) {
    console.error("Update class error:", err);
    res.status(500).json({ error: "Failed to update class" });
  }
}

export async function inviteToClass(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const { emails } = req.body as { emails?: string[] };

    if (!Array.isArray(emails) || emails.length === 0) {
      res.status(400).json({ error: "Emails array is required" });
      return;
    }

    const cls = await prisma.class.findUnique({
      where: { id },
    });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can invite" });
      return;
    }

    const normalizedEmails = emails
      .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
      .filter(Boolean);

    await prisma.classInvite.createMany({
      data: normalizedEmails.map((email) => ({
        classId: id,
        email,
        invitedBy: req.user!.id,
      })),
      skipDuplicates: true,
    });

    const invites = await prisma.classInvite.findMany({
      where: { classId: id },
      select: { email: true, createdAt: true },
    });

    res.status(201).json({ invites });
  } catch (err) {
    console.error("Invite error:", err);
    res.status(500).json({ error: "Failed to invite" });
  }
}

export async function disinviteFromClass(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const { email } = req.body as { email?: string };

    if (!email?.trim()) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can disinvite" });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    await prisma.classInvite.deleteMany({
      where: { classId: id, email: normalizedEmail },
    });

    res.json({ success: true, message: "Participant disinvited" });
  } catch (err) {
    console.error("Disinvite error:", err);
    res.status(500).json({ error: "Failed to disinvite" });
  }
}

export async function joinMeeting(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const isTeacher = cls.teacherId === req.user!.id;
    if (!isTeacher) {
      const invited = await prisma.classInvite.findFirst({
        where: { classId: id, email: req.user!.email },
      });
      if (!invited) {
        res.status(403).json({ error: "You are not invited to this class" });
        return;
      }
    }

    if (!env.LIVEKIT_URL?.trim()) {
      res.status(503).json({
        error: "LiveKit is not configured. Set LIVEKIT_URL in backend .env (e.g. ws://localhost:7880).",
      });
      return;
    }

    const participantName = req.user!.email;
    const token = await createLiveKitToken(
      cls.roomName,
      req.user!.email,
      participantName,
      isTeacher
    );

    res.json({
      token,
      url: env.LIVEKIT_URL.trim(),
      roomName: cls.roomName,
      redirectUrl: cls.redirectUrl ?? undefined,
    });
  } catch (err) {
    console.error("Join meeting error:", err);
    res.status(500).json({ error: "Failed to get meeting token" });
  }
}

export async function endMeeting(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can end the meeting" });
      return;
    }

    await roomService.deleteRoom(cls.roomName);

    res.json({ success: true, message: "Meeting ended" });
  } catch (err) {
    console.error("End meeting error:", err);
    res.status(500).json({ error: "Failed to end meeting" });
  }
}

export async function listAttendance(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can view attendance" });
      return;
    }

    const records = await prisma.attendance.findMany({
      where: { classId: id },
      orderBy: { joinTime: "desc" },
      take: 200,
      select: { id: true, email: true, joinTime: true, leaveTime: true, duration: true },
    });

    res.json({
      attendance: records.map((r) => ({
        id: r.id,
        email: r.email,
        joinTime: r.joinTime,
        leaveTime: r.leaveTime,
        duration: r.duration,
      })),
    });
  } catch (err) {
    console.error("List attendance error:", err);
    res.status(500).json({ error: "Failed to list attendance" });
  }
}

export async function listParticipants(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can view participants" });
      return;
    }

    let participants: Array<{ identity: string; name: string }> = [];
    try {
      const list = await roomService.listParticipants(cls.roomName);
      participants = list.map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
      }));
    } catch {
      // Room may not exist yet (no one joined) - return empty
    }

    const invites = await prisma.classInvite.findMany({
      where: { classId: id },
      select: { email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      participants,
      invited: invites.map((i) => ({ email: i.email, invitedAt: i.createdAt })),
    });
  } catch (err) {
    console.error("List participants error:", err);
    res.status(500).json({ error: "Failed to list participants" });
  }
}

export async function kickParticipant(req: Request, res: Response): Promise<void> {
  try {
    const id = classIdParam(req);
    const { identity } = req.body as { identity?: string };

    if (!identity?.trim()) {
      res.status(400).json({ error: "Participant identity (email) is required" });
      return;
    }

    const cls = await prisma.class.findUnique({ where: { id } });

    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    if (cls.teacherId !== req.user!.id) {
      res.status(403).json({ error: "Only the teacher can kick participants" });
      return;
    }

    await roomService.removeParticipant(cls.roomName, identity.trim());

    res.json({ success: true, message: "Participant removed" });
  } catch (err) {
    console.error("Kick error:", err);
    res.status(500).json({ error: "Failed to kick participant" });
  }
}
