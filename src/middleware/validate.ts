import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Describes what all our request schemas look like
type RequestSchema = z.ZodObject<{
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}>;

export function validate(schema: RequestSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const errors = result.error.issues.map((err) => ({
        field: err.path.slice(1).join('.'),
        message: err.message,
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
        },
      });
    }

    if (result.data.body !== undefined) req.body = result.data.body;
    // Note: req.query is read-only in Express 5 — parsed values are accessed
    // directly from req.query; we don't reassign it.
    if (result.data.params !== undefined) req.params = result.data.params as any;

    next();
  };
}
