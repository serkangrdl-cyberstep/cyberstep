import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "@workspace/db";
import { reportsTable, assessmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { sendMail } from "../../services/email";
import { logger } from "../../lib/logger";

const router = Router();

function getBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) {
    const first = domains.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  return "http://localhost:80";
}

// PATCH /api/admin-panel/assessments/:id/expert-review
router.patch("/admin-panel/assessments/:id/expert-review", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const { status, notes, expertName } = req.body as {
    status: "approved" | "rejected";
    notes?: string;
    expertName: string;
  };

  if (!status || !expertName) {
    res.status(400).json({ error: "status ve expertName zorunludur" });
    return;
  }

  const report = await db.query.reportsTable.findFirst({
    where: eq(reportsTable.assessmentId, id),
  });
  if (!report) { res.status(404).json({ error: "Rapor bulunamadı" }); return; }

  const approved = status === "approved";

  await db.update(reportsTable).set({
    expertReviewStatus: status,
    expertReviewedAt: new Date(),
    expertNotes: notes ?? null,
    expertReviewedBy: expertName,
    expertBadgeEarned: approved,
  }).where(eq(reportsTable.assessmentId, id));

  if (approved) {
    const assessment = await db.query.assessmentsTable.findFirst({
      where: eq(assessmentsTable.id, id),
    });

    const recipientEmail = assessment?.email;
    const companyName = assessment?.companyName ?? "Şirketiniz";
    const reportUrl = `${getBaseUrl()}/raporlarim`;

    if (recipientEmail) {
      sendMail({
        to: recipientEmail,
        subject: `Raporunuz Uzman Tarafından İncelendi — ${companyName}`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#f8fafc;">
            <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
              <div style="text-align:center;margin-bottom:24px;">
                <div style="background:#ecfdf5;border:2px solid #6ee7b7;border-radius:12px;display:inline-block;padding:16px 24px;">
                  <p style="margin:0;font-size:28px;">🛡️</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#065f46;">Uzman Doğrulandı</p>
                </div>
              </div>
              <h2 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 12px;">Raporunuz Uzman Tarafından İncelendi</h2>
              <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px;">
                <strong>${companyName}</strong> için hazırlanan siber güvenlik değerlendirme raporunuz,
                <strong>${expertName}</strong> tarafından incelendi ve onaylandı.
              </p>
              <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px;">
                Raporunuza <strong>"Uzman Doğrulandı"</strong> rozeti eklendi. Bu rozeti tekliflerinizde, web sitenizde ve kurumsal belgelerinizde kullanabilirsiniz.
              </p>
              ${notes ? `<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 16px;"><p style="margin:0;color:#15803d;font-size:13px;font-weight:600;">Uzman Notu:</p><p style="margin:4px 0 0;color:#166534;font-size:13px;">${notes}</p></div>` : ""}
              <a href="${reportUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;margin:8px 0;">
                Raporumu Görüntüle →
              </a>
              <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">CyberStep.io — Türkiye'nin Siber Güvenlik Risk Platformu</p>
            </div>
          </div>
        `,
      }).catch((err: unknown) => {
        logger.error({ err }, "Expert review email failed");
      });
    }
  }

  res.json({ ok: true, expertBadgeEarned: approved });
});

// GET /api/admin-panel/assessments/:id/expert-review
router.get("/admin-panel/assessments/:id/expert-review", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) { res.status(400).json({ error: "Geçersiz ID" }); return; }

  const report = await db.query.reportsTable.findFirst({
    where: eq(reportsTable.assessmentId, id),
    columns: { expertReviewStatus: true, expertReviewedAt: true, expertNotes: true, expertReviewedBy: true, expertBadgeEarned: true },
  });

  if (!report) { res.status(404).json({ error: "Rapor bulunamadı" }); return; }
  res.json(report);
});

export default router;
