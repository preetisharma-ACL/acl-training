// Zod validation for body, query and params. Parsed (and coerced) values
// replace the raw ones; unknown keys are stripped by the schemas.

import { ApiError } from "../utils/ApiError.js";

export const validate =
  ({ body, query, params } = {}) =>
  (req, res, next) => {
    const issues = [];
    const run = (schema, value, where) => {
      if (!schema) return value;
      const r = schema.safeParse(value ?? {});
      if (r.success) return r.data;
      for (const i of r.error.issues) issues.push({ where, path: i.path.join("."), message: i.message });
      return value;
    };
    const b = run(body, req.body, "body");
    const q = run(query, req.query, "query");
    const p = run(params, req.params, "params");
    if (issues.length) {
      return next(new ApiError(422, issues[0].message, { code: "VALIDATION_ERROR", details: issues }));
    }
    if (body) req.body = b;
    // Express 5 makes req.query a getter; keep the parsed copy separately.
    if (query) req.validQuery = q;
    if (params) req.validParams = p;
    next();
  };
