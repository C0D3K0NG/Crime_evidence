import { Router, Request, Response } from "express";
import { authenticate, prisma } from "../middleware/auth.js";

const router = Router();

// GET /api/v1/stats — dashboard statistics with chart data
router.get("/", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        // Basic counts
        const [totalEvidence, pendingTransfers, totalCases, totalLabs] = await Promise.all([
            prisma.evidence.count(),
            prisma.custodyEvent.count({ where: { toUserId: userId, status: "pending" } }),
            prisma.case.count(),
            prisma.labResult.count(),
        ]);

        // Evidence by status
        const evidenceByStatus = await prisma.evidence.groupBy({
            by: ["status"],
            _count: { id: true },
        });

        // Evidence by type
        const evidenceByType = await prisma.evidence.groupBy({
            by: ["type"],
            _count: { id: true },
        });

        // Evidence submitted in last 7 days (per day)
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentEvidence = await prisma.evidence.findMany({
            where: { createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true },
            orderBy: { createdAt: "asc" },
        });

        // Bucket by day
        const dayBuckets: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            dayBuckets[key] = 0;
        }
        for (const ev of recentEvidence) {
            const key = ev.createdAt.toISOString().split("T")[0];
            if (key in dayBuckets) dayBuckets[key]++;
        }
        const evidenceOverTime = Object.entries(dayBuckets).map(([date, count]) => ({ date, count }));

        // Pending access requests
        const pendingAccessRequests = await prisma.evidenceAccessRequest.count({ where: { status: "pending" } });

        // Unread notifications count
        const unreadNotifications = await prisma.notification.count({ where: { userId, read: false } });

        res.json({
            totalEvidence,
            pendingTransfers,
            totalCases,
            totalLabs,
            pendingAccessRequests,
            unreadNotifications,
            evidenceByStatus: evidenceByStatus.map(e => ({ status: e.status, count: e._count.id })),
            evidenceByType: evidenceByType.map(e => ({ type: e.type, count: e._count.id })),
            evidenceOverTime,
        });
    } catch (err: any) {
        res.status(500).json({ error: "Failed to fetch stats", details: err.message });
    }
});

export default router;
