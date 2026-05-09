import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    if (req.headers.accept?.includes("application/json")) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    return res.redirect("/?error=auth");
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.isAdmin) {
    if (req.headers.accept?.includes("application/json")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return res.redirect("/?error=forbidden");
  }
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // Just passes through — user info is available via req.session if logged in
  next();
}
