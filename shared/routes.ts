import { z } from 'zod';
import { insertPresetSchema, insertTimerHistorySchema, insertBannerSchema, presets, timerHistory, bannerSettings } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  presets: {
    list: {
      method: 'GET' as const,
      path: '/api/presets',
      responses: {
        200: z.array(z.custom<typeof presets.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/presets',
      input: insertPresetSchema,
      responses: {
        201: z.custom<typeof presets.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/presets/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  history: {
    list: {
      method: 'GET' as const,
      path: '/api/history',
      responses: {
        200: z.array(z.custom<typeof timerHistory.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/history',
      input: insertTimerHistorySchema,
      responses: {
        201: z.custom<typeof timerHistory.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    stats: {
      method: 'GET' as const,
      path: '/api/history/stats',
      responses: {
        200: z.object({
          totalTime: z.number(),
          sessionCount: z.number(),
          todayTime: z.number(),
        }),
      },
    },
  },
  banner: {
    get: {
      method: 'GET' as const,
      path: '/api/banner',
      responses: {
        200: z.custom<typeof bannerSettings.$inferSelect>().nullable(),
      },
    },
    update: {
      method: 'POST' as const,
      path: '/api/banner',
      input: insertBannerSchema,
      responses: {
        200: z.custom<typeof bannerSettings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
