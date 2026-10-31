// Express 5 already forwards rejected promises to the error handler; this
// wrapper keeps controllers explicit and works the same on Express 4.

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
