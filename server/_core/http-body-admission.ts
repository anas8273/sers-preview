import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";

export const GLOBAL_JSON_BODY_MAX_BYTES = 256_000;
export const GLOBAL_FORM_BODY_MAX_BYTES = 64_000;
export const PDF_BODY_MAX_BYTES = 3_000_000;
export const DOCX_BODY_MAX_BYTES = 16_000_000;
export const AI_TRPC_BODY_MAX_BYTES = 9_000_000;

/** Express routes are case-insensitive and accept a trailing slash by default. */
export function isRouteSpecificBodyPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "").toLowerCase();
  return path === "/api/export-pdf" || path === "/api/export-docx"
    || path === "/api/trpc" || path.startsWith("/api/trpc/");
}

export type HttpBodyAdmissionOptions = {
  maxBytes: number;
  contentType?: string;
  allowEmpty?: boolean;
};

function reject(res: Response, status: number, error: string) {
  if (!res.headersSent) res.status(status).json({ error });
}

function contentTypeMatches(value: string | undefined, expected: string) {
  if (!value) return false;
  const [mediaType, ...parameters] = value.split(";").map(part => part.trim().toLowerCase());
  if (mediaType !== expected) return false;
  return parameters.every(parameter => parameter === "charset=utf-8");
}

function declaredLength(value: string | string[] | undefined) {
  if (Array.isArray(value) || value === undefined || !/^\d+$/.test(value)) return undefined;
  const length = Number(value);
  return Number.isSafeInteger(length) ? length : undefined;
}

/**
 * Reject a request before a body parser or authenticated handler can consume it.
 * Content-Length is checked synchronously. For chunked requests the IncomingMessage
 * is observed at emit-time, so the parser still receives the original stream while
 * the connection is terminated as soon as the bounded ceiling is crossed.
 */
export function httpBodyAdmission(options: HttpBodyAdmissionOptions): RequestHandler {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) throw new Error("maxBytes must be a positive safe integer");
  const expectedType = options.contentType?.toLowerCase();

  return (req: Request, res: Response, next: NextFunction) => {
    if (expectedType && !contentTypeMatches(req.headers["content-type"], expectedType)) {
      reject(res, 415, "Unsupported request content type");
      return;
    }
    const encoding = req.headers["content-encoding"];
    if (encoding && encoding !== "identity") {
      reject(res, 415, "Compressed request bodies are not accepted");
      return;
    }
    const lengthHeader = req.headers["content-length"];
    const length = declaredLength(lengthHeader);
    if (lengthHeader !== undefined && length === undefined) {
      reject(res, 400, "Invalid Content-Length");
      return;
    }
    if (length !== undefined && length > options.maxBytes) {
      reject(res, 413, "Request body exceeds the size limit");
      return;
    }
    if (length === 0 && options.allowEmpty !== true) {
      reject(res, 400, "Request body is required");
      return;
    }

    let received = 0;
    let settled = false;
    const originalEmit = req.emit.bind(req);
    const restore = () => {
      if (req.emit !== trackedEmit) return;
      req.emit = originalEmit as typeof req.emit;
      req.removeListener("end", restore);
      req.removeListener("aborted", restore);
      req.removeListener("error", restore);
    };
    const trackedEmit = ((event: string | symbol, ...args: unknown[]) => {
      if (event === "data" && !settled) {
        const chunk = args[0];
        received += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
        if (received > options.maxBytes) {
          settled = true;
          restore();
          req.pause();
          reject(res, 413, "Request body exceeds the size limit");
          res.once("finish", () => req.destroy());
          return false;
        }
      }
      const result = originalEmit(event, ...args);
      if (event === "end" || event === "aborted" || event === "error") restore();
      return result;
    }) as typeof req.emit;
    req.emit = trackedEmit;
    req.once("end", restore);
    req.once("aborted", restore);
    req.once("error", restore);
    next();
  };
}

export function isJsonBodyParserError(error: unknown): error is { status?: number; type?: string } {
  return Boolean(error && typeof error === "object" && ("status" in error || "type" in error));
}

export function boundedBodyParser(parser: RequestHandler): RequestHandler {
  return (req, res, next) => parser(req, res, error => {
    if (error) {
      const status = isJsonBodyParserError(error) && error.status === 413 ? 413 : 400;
      if (!res.headersSent) res.status(status).json({ error: status === 413 ? "Request body exceeds the size limit" : "Malformed request body" });
      return;
    }
    next();
  });
}

export function boundedJsonBodyParser(limit: number): RequestHandler {
  return boundedBodyParser(express.json({ limit, strict: true, inflate: false }));
}
