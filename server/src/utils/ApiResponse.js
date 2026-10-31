// Every API response has one of two shapes:
//   success → { ok: true,  data }
//   failure → { ok: false, error: { code, message, details? } }

export const ok = (res, data = null, status = 200) => res.status(status).json({ ok: true, data });

export const created = (res, data = null) => ok(res, data, 201);

export const fail = (res, status, code, message, details) =>
  res.status(status).json({ ok: false, error: { code, message, ...(details ? { details } : {}) } });
