import { Router } from "express";
import { handleBenchmarkDownload } from "../../services/growth-engine";

const router = Router();

router.post("/public/benchmark-download", async (req, res) => {
  try {
    const { sector, visitorName, visitorEmail, visitorCompany, visitorDomain, reportPeriod } = req.body as {
      sector: string;
      visitorName?: string;
      visitorEmail: string;
      visitorCompany?: string;
      visitorDomain?: string;
      reportPeriod?: string;
    };
    if (!sector || !visitorEmail?.trim()) {
      res.status(400).json({ error: "sector ve visitorEmail zorunlu" }); return;
    }

    await handleBenchmarkDownload({ sector, visitorName, visitorEmail, visitorCompany, visitorDomain, reportPeriod });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "benchmark-download failed");
    res.status(500).json({ error: "Kayıt başarısız" });
  }
});

export default router;
