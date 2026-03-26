import type { Express, RequestHandler } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { botRouter, initBot } from "./bot/routes";

// Admin email whitelist
const ADMIN_EMAILS = ["kai@2him.net"];

// Middleware to check if user is admin
const isAdmin: RequestHandler = (req, res, next) => {
  const user = req.user as any;
  if (!user?.claims?.email || !ADMIN_EMAILS.includes(user.claims.email)) {
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Setup object storage routes
  registerObjectStorageRoutes(app);

  // 機器人路由（Webhook + 管理後台）
  app.use(botRouter);
  await initBot();

  app.get(api.presets.list.path, async (req, res) => {
    const presets = await storage.getPresets();
    res.json(presets);
  });

  app.post(api.presets.create.path, async (req, res) => {
    try {
      const input = api.presets.create.input.parse(req.body);
      const preset = await storage.createPreset(input);
      res.status(201).json(preset);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.presets.delete.path, async (req, res) => {
    await storage.deletePreset(Number(req.params.id));
    res.status(204).send();
  });

  // Timer History Routes
  app.get(api.history.list.path, async (req, res) => {
    const history = await storage.getTimerHistory();
    res.json(history);
  });

  app.post(api.history.create.path, async (req, res) => {
    try {
      const input = api.history.create.input.parse(req.body);
      const history = await storage.createTimerHistory(input);
      res.status(201).json(history);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.history.stats.path, async (req, res) => {
    const stats = await storage.getTimerStats();
    res.json(stats);
  });

  // Banner Routes
  app.get(api.banner.get.path, async (req, res) => {
    const banner = await storage.getBanner();
    res.json(banner);
  });

  app.post(api.banner.update.path, isAuthenticated, isAdmin, async (req, res) => {
    try {
      const input = api.banner.update.input.parse(req.body);
      const banner = await storage.updateBanner(input);
      res.json(banner);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Analytics Routes
  app.post(api.analytics.track.path, async (req, res) => {
    try {
      const input = api.analytics.track.input.parse(req.body);
      await storage.recordPageView(input);
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(201).json({ success: true }); // Fail silently for analytics
    }
  });

  app.post(api.analytics.timerUsage.path, async (req, res) => {
    try {
      const input = api.analytics.timerUsage.input.parse(req.body);
      await storage.recordTimerUsage(input);
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(201).json({ success: true }); // Fail silently for analytics
    }
  });

  app.get(api.analytics.stats.path, isAuthenticated, isAdmin, async (req, res) => {
    const stats = await storage.getAnalytics();
    res.json(stats);
  });

  // Seed default presets if empty
  const existing = await storage.getPresets();
  if (existing.length === 0) {
    await storage.createPreset({ name: "番茄鐘", duration: 25 * 60 });
    await storage.createPreset({ name: "短休息", duration: 5 * 60 });
    await storage.createPreset({ name: "煮溏心蛋", duration: 6 * 60 });
    await storage.createPreset({ name: "棒式", duration: 60 });
  }

  return httpServer;
}
