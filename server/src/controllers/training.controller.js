import * as training from "../services/training.service.js";
import * as assessment from "../services/assessment.service.js";
import { certificateFor } from "../services/certificate.service.js";
import { ok, created } from "../utils/ApiResponse.js";

const pid = (req) => req.validParams?.id ?? req.params.id;

// RFC 6266 filename with a UTF-8 fallback.
export const disposition = (type, name) => `${type}; filename="${name.replace(/[^\x20-\x7e]|"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`;

export const getModule = async (req, res) => ok(res, await training.getModule(req.user));
export const getMaterial = async (req, res) => ok(res, await training.getMaterial(req.user, pid(req)));
export const updateProgress = async (req, res) => ok(res, await training.updateProgress(req.user, pid(req), req.body));

// PDF stream: inline for the viewer, attachment with ?download=1.
export async function materialFile(req, res) {
  const f = await training.openMaterialFile(req.user, pid(req));
  res.set({
    "Content-Type": f.mime,
    "Content-Disposition": disposition(req.query.download ? "attachment" : "inline", f.fileName),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    ...(f.size ? { "Content-Length": String(f.size) } : {}),
  });
  f.stream.on("error", () => res.destroy());
  f.stream.pipe(res);
}

export async function startAttempt(req, res) {
  const a = await assessment.start(req.user);
  return a.resumed ? ok(res, a) : created(res, a);
}
export const activeAttempt = async (req, res) => ok(res, await assessment.getActive(req.user));
export const saveAnswers = async (req, res) => ok(res, await assessment.saveAnswers(req.user, pid(req), req.body));
export const submitAttempt = async (req, res) => ok(res, await assessment.submit(req.user, pid(req), req.body));
export const listMine = async (req, res) => ok(res, await assessment.listMine(req.user));
export const getAttempt = async (req, res) => ok(res, await assessment.getResult(req.user, pid(req)));

export async function certificate(req, res) {
  const c = await certificateFor(req.user, pid(req));
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": disposition(req.query.download === "0" ? "inline" : "attachment", c.fileName), "Cache-Control": "private, no-store" });
  res.send(c.pdf);
}
