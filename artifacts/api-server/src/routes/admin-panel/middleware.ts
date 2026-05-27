import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminId = (req.session as any).adminId;
  if (!adminId) {
    res.status(401).json({ error: "Yetkisiz erişim" });
    return;
  }
  next();
}
