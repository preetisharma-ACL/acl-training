// An error that is safe to show the client. Anything else becomes a generic 500.

export class ApiError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code ?? defaultCode(status);
    this.details = details;
  }

  static badRequest(msg = "The request is invalid.", opts) {
    return new ApiError(400, msg, opts);
  }
  static unauthorized(msg = "Please sign in to continue.", opts) {
    return new ApiError(401, msg, opts);
  }
  static forbidden(msg = "You don't have access to this.", opts) {
    return new ApiError(403, msg, opts);
  }
  static notFound(msg = "Not found.", opts) {
    return new ApiError(404, msg, opts);
  }
  static conflict(msg, opts) {
    return new ApiError(409, msg, opts);
  }
}

function defaultCode(status) {
  return (
    {
      400: "BAD_REQUEST",
      401: "UNAUTHENTICATED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      413: "PAYLOAD_TOO_LARGE",
      422: "VALIDATION_ERROR",
      429: "RATE_LIMITED",
    }[status] ?? "ERROR"
  );
}
