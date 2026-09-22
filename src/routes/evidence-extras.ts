/**
 * Comments routes — per-evidence internal officer notes.
 * Lab Results routes — forensic lab submissions.
 * Access Requests routes — request + approve/deny restricted evidence access.
 * Retention + RBAC per evidence item.
 */
import { Router, Request, Response } from "express";
import { authenticate, prisma } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// COMMENTS
// ---------------------------------------------------------------------------
router.get("/comments", authenticate, async (req: Request, res: Response) => {
  try {
    const comments = await prisma.evidenceComment.findMany({
      where: { evidenceId: req.params.evidenceId as string },
      include: { user: { select: { id: true, username: true, fullName: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(comments);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch comments", details: err.message });
  }
});

router.post("/comments", authenticate, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }
    const comment = await prisma.evidenceComment.create({
      data: { evidenceId: req.params.evidenceId as string, userId: req.user!.id, content: content.trim() },
      include: { user: { select: { id: true, username: true, fullName: true, role: true } } },
    });
    await prisma.activityLog.create({
      data: {
        actorId: req.user!.id,
        actorName: req.user!.username,
        action: "commented",
        entityType: "Evidence",
        entityId: req.params.evidenceId as string,
      },
    });
    res.status(201).json(comment);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create comment", details: err.message });
  }
});

router.delete("/comments/:commentId", authenticate, async (req: Request, res: Response) => {
  try {
    const comment = await prisma.evidenceComment.findUnique({ where: { id: req.params.commentId as string } });
    if (!comment) { res.status(404).json({ error: "Comment not found" }); return; }
    if (comment.userId !== req.user!.id && !["Admin", "HeadOfficer"].includes(req.user!.role)) {
      res.status(403).json({ error: "Not authorised to delete this comment" }); return;
    }
    await prisma.evidenceComment.delete({ where: { id: req.params.commentId as string } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete comment", details: err.message });
  }
});

// ---------------------------------------------------------------------------
// LAB RESULTS
// ---------------------------------------------------------------------------
router.get("/lab-results", authenticate, async (req: Request, res: Response) => {
  try {
    const results = await prisma.labResult.findMany({
      where: { evidenceId: req.params.evidenceId as string },
      include: { submittedBy: { select: { id: true, username: true, fullName: true } } },
      orderBy: { submittedAt: "desc" },
    });
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch lab results", details: err.message });
  }
});

router.post("/lab-results", authenticate, async (req: Request, res: Response) => {
  try {
    const { title, summary, findings } = req.body;
    if (!title || !summary) { res.status(400).json({ error: "title and summary are required" }); return; }
    const result = await prisma.labResult.create({
      data: {
        evidenceId: req.params.evidenceId as string,
        submittedById: req.user!.id,
        title,
        summary,
        findings: findings ?? null,
      },
      include: { submittedBy: { select: { id: true, username: true, fullName: true } } },
    });
    await prisma.activityLog.create({
      data: {
        actorId: req.user!.id,
        actorName: req.user!.username,
        action: "submitted_lab_result",
        entityType: "Evidence",
        entityId: req.params.evidenceId as string,
        entityLabel: title,
      },
    });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to submit lab result", details: err.message });
  }
});

// ---------------------------------------------------------------------------
// ACCESS REQUESTS
// ---------------------------------------------------------------------------
router.get("/requests", authenticate, async (req: Request, res: Response) => {
  try {
    const requests = await prisma.evidenceAccessRequest.findMany({
      where: { evidenceId: req.params.evidenceId as string },
      include: {
        requester: { select: { id: true, username: true, fullName: true, role: true } },
        reviewer: { select: { id: true, username: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch requests", details: err.message });
  }
});

router.post("/requests", authenticate, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) { res.status(400).json({ error: "reason is required" }); return; }
    const existing = await prisma.evidenceAccessRequest.findFirst({
      where: { evidenceId: req.params.evidenceId as string, requesterId: req.user!.id, status: "pending" },
    });
    if (existing) { res.status(409).json({ error: "You already have a pending request for this evidence" }); return; }
    const request = await prisma.evidenceAccessRequest.create({
      data: { evidenceId: req.params.evidenceId as string, requesterId: req.user!.id, reason: reason.trim() },
      include: { requester: { select: { id: true, username: true, fullName: true } } },
    });
    // Notify supervisors
    const supervisors = await prisma.user.findMany({ where: { role: { in: ["Admin", "HeadOfficer"] } } });
    if (supervisors.length > 0) {
      await prisma.notification.createMany({
        data: supervisors.map((s: { id: string }) => ({
          userId: s.id,
          type: "access_request",
          title: "New Access Request",
          message: `${req.user!.username} requested access to evidence`,
          link: `/dashboard/${s.id}/evidence/${req.params.evidenceId as string}`,
        })),
      });
    }
    res.status(201).json(request);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create request", details: err.message });
  }
});

router.put("/requests/:requestId", authenticate, async (req: Request, res: Response) => {
  try {
    const { status, reviewNotes } = req.body;
    if (!["approved", "denied"].includes(status)) {
      res.status(400).json({ error: "status must be approved or denied" }); return;
    }
    const updated = await prisma.evidenceAccessRequest.update({
      where: { id: req.params.requestId as string },
      data: { status, reviewNotes: reviewNotes ?? null, reviewerId: req.user!.id, reviewedAt: new Date() },
    });
    await prisma.notification.create({
      data: {
        userId: updated.requesterId,
        type: "access_request_reviewed",
        title: `Access Request ${status === "approved" ? "Approved" : "Denied"}`,
        message: `Your access request was ${status}`,
        link: `/dashboard/${updated.requesterId}/evidence/${req.params.evidenceId as string}`,
      },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update request", details: err.message });
  }
});

// ---------------------------------------------------------------------------
// RETENTION
// ---------------------------------------------------------------------------
router.put("/retention", authenticate, async (req: Request, res: Response) => {
  try {
    const { retentionDeadline, retentionPolicy } = req.body;
    const updated = await prisma.evidence.update({
      where: { id: req.params.evidenceId as string },
      data: {
        retentionDeadline: retentionDeadline ? new Date(retentionDeadline) : null,
        retentionPolicy: retentionPolicy ?? null,
      },
    });
    res.json({ success: true, evidence: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update retention", details: err.message });
  }
});

// ---------------------------------------------------------------------------
// RBAC
// ---------------------------------------------------------------------------
router.get("/rbac", authenticate, async (req: Request, res: Response) => {
  try {
    const evidence = await prisma.evidence.findUnique({
      where: { id: req.params.evidenceId as string },
      select: { allowedRoles: true },
    });
    if (!evidence) { res.status(404).json({ error: "Evidence not found" }); return; }
    res.json({ allowedRoles: evidence.allowedRoles ? JSON.parse(evidence.allowedRoles) : null });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch RBAC", details: err.message });
  }
});

router.put("/rbac", authenticate, async (req: Request, res: Response) => {
  try {
    const { allowedRoles } = req.body;
    const updated = await prisma.evidence.update({
      where: { id: req.params.evidenceId as string },
      data: { allowedRoles: allowedRoles ? JSON.stringify(allowedRoles) : null },
    });
    res.json({ success: true, allowedRoles: updated.allowedRoles ? JSON.parse(updated.allowedRoles) : null });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update RBAC", details: err.message });
  }
});

export default router;
