import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
