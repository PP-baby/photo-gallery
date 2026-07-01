const http = require("node:http");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const rootDir = __dirname;
const uploadDir = path.join(rootDir, "uploads");
const dataFile = path.join(uploadDir, "photos.json");
const port = Number(process.env.PORT || 3000);
const maxUploadBytes = Number(process.env.MAX_UPLOAD_MB || 50) * 1024 * 1024;

loadDotEnv();

const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseBucket = process.env.SUPABASE_BUCKET || "photos";
const useSupabase = Boolean(supabaseUrl && supabaseKey && supabaseBucket);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".svg": "image/svg+xml",
};

const imageExtensions = {
  "image/jpeg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/png": ".png",
  "image/x-png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

function loadDotEnv() {
  const envPath = path.join(rootDir, ".env");
  if (!fsSync.existsSync(envPath)) return;

  const lines = fsSync.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function normalizeTags(value) {
  const source = Array.isArray(value) ? value.join(",") : String(value || "");
  const tags = source
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);

  return [...new Set(tags.length ? tags : ["日常"])];
}

function normalizePhoto(photo) {
  return {
    ...photo,
    title: String(photo.title || "我的照片").trim().slice(0, 80) || "我的照片",
    tags: normalizeTags(photo.tags || photo.category || "日常"),
  };
}

function toClientPhoto(row) {
  return normalizePhoto({
    id: row.id,
    title: row.title,
    tags: row.tags || [],
    src: row.src,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    ...extra,
  };
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${supabaseUrl}${pathname}`, {
    ...options,
    headers: supabaseHeaders(options.headers || {}),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.error || text || "Supabase request failed.";
    throw new Error(message);
  }

  return data;
}

async function ensureStorage() {
  await fs.mkdir(uploadDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, "[]\n", "utf8");
  }
}

async function readLocalPhotos() {
  await ensureStorage();
  const raw = await fs.readFile(dataFile, "utf8");
  const photos = JSON.parse(raw || "[]");
  return photos.map(normalizePhoto);
}

async function writeLocalPhotos(photos) {
  await fs.writeFile(dataFile, `${JSON.stringify(photos.map(normalizePhoto), null, 2)}\n`, "utf8");
}

async function readPhotos() {
  if (!useSupabase) {
    return readLocalPhotos();
  }

  const rows = await supabaseRequest("/rest/v1/photos?select=*&order=created_at.desc");
  return rows.map(toClientPhoto);
}

async function insertSupabasePhoto({ id, title, tags, src, storagePath }) {
  const rows = await supabaseRequest("/rest/v1/photos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id,
      title,
      tags,
      src,
      storage_path: storagePath,
    }),
  });

  return toClientPhoto(rows[0]);
}

async function updateSupabasePhoto(id, payload) {
  const rows = await supabaseRequest(`/rest/v1/photos?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!rows[0]) {
    throw new Error("Photo not found.");
  }

  return toClientPhoto(rows[0]);
}

async function uploadSupabaseObject({ storagePath, fileType, body }) {
  await supabaseRequest(`/storage/v1/object/${encodeURIComponent(supabaseBucket)}/${storagePath}`, {
    method: "POST",
    headers: {
      "Content-Type": fileType,
      "x-upsert": "false",
    },
    body,
  });

  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(supabaseBucket)}/${storagePath}`;
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

function getUrl(requestUrl) {
  return new URL(requestUrl, `http://localhost:${port}`);
}

function safePublicPath(requestUrl) {
  const url = getUrl(requestUrl);
  const pathname = decodeURIComponent(url.pathname);
  const filePath = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.resolve(rootDir, `.${filePath}`);

  if (!resolved.startsWith(rootDir)) {
    return null;
  }

  return resolved;
}

function collectRequest(request, limit = maxUploadBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > limit) {
        reject(new Error(`内容太大了，请上传 ${Math.round(maxUploadBytes / 1024 / 1024)}MB 以内的图片。`));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function readJsonBody(request) {
  const buffer = await collectRequest(request, 128 * 1024);
  if (buffer.length === 0) return {};
  return JSON.parse(buffer.toString("utf8"));
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    throw new Error("上传格式不正确。");
  }

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts = [];
  let cursor = buffer.indexOf(boundary);

  while (cursor !== -1) {
    const next = buffer.indexOf(boundary, cursor + boundary.length);
    if (next === -1) break;

    let part = buffer.subarray(cursor + boundary.length, next);
    if (part.subarray(0, 2).toString() === "\r\n") {
      part = part.subarray(2);
    }
    if (part.subarray(-2).toString() === "\r\n") {
      part = part.subarray(0, -2);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString("utf8");
      const body = part.subarray(headerEnd + 4);
      parts.push({ headers, body });
    }

    cursor = next;
  }

  return parts;
}

function getHeaderValue(headers, name) {
  const line = headers.split("\r\n").find((item) => item.toLowerCase().startsWith(`${name.toLowerCase()}:`));
  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
}

function getDispositionValue(headers, name) {
  const disposition = getHeaderValue(headers, "content-disposition");
  const match = disposition.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : "";
}

async function saveUploadedPart(part) {
  const originalName = getDispositionValue(part.headers, "filename");
  const fileType = getHeaderValue(part.headers, "content-type").toLowerCase();
  const extension = imageExtensions[fileType];

  if (!originalName || !extension) {
    return null;
  }

  const id = crypto.randomUUID();
  const filename = `${id}${extension}`;
  const title = path.parse(originalName).name || "我的照片";
  const tags = ["日常"];

  if (useSupabase) {
    const storagePath = `${id}${extension}`;
    const src = await uploadSupabaseObject({
      storagePath,
      fileType,
      body: part.body,
    });

    return insertSupabasePhoto({
      id,
      title,
      tags,
      src,
      storagePath,
    });
  }

  const photo = normalizePhoto({
    id,
    title,
    tags,
    src: `/uploads/${filename}`,
    createdAt: new Date().toISOString(),
  });

  await fs.writeFile(path.join(uploadDir, filename), part.body);
  return photo;
}

async function handleUpload(request, response) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    sendError(response, 415, "请用图片表单上传。");
    return;
  }

  try {
    const buffer = await collectRequest(request);
    const parts = parseMultipart(buffer, contentType);
    const uploaded = [];

    for (const part of parts) {
      const fieldName = getDispositionValue(part.headers, "name");
      if (fieldName !== "photos") continue;

      const photo = await saveUploadedPart(part);
      if (photo) {
        uploaded.push(photo);
      }
    }

    if (uploaded.length === 0) {
      sendError(response, 400, "没有找到可保存的图片。");
      return;
    }

    if (!useSupabase) {
      const photos = await readLocalPhotos();
      await writeLocalPhotos([...uploaded, ...photos]);
    }

    sendJson(response, 201, { photos: uploaded });
  } catch (error) {
    sendError(response, 400, error.message || "上传失败。");
  }
}

async function handleUpdate(request, response, id) {
  try {
    const payload = await readJsonBody(request);
    const title = String(payload.title || "").trim().slice(0, 80);

    if (!title) {
      sendError(response, 400, "照片名称不能为空。");
      return;
    }

    if (useSupabase) {
      const photo = await updateSupabasePhoto(id, {
        title,
        tags: normalizeTags(payload.tags),
      });
      sendJson(response, 200, { photo });
      return;
    }

    const photos = await readLocalPhotos();
    const index = photos.findIndex((photo) => photo.id === id);

    if (index === -1) {
      sendError(response, 404, "没有找到这张照片。");
      return;
    }

    photos[index] = normalizePhoto({
      ...photos[index],
      title,
      tags: normalizeTags(payload.tags),
      updatedAt: new Date().toISOString(),
    });

    await writeLocalPhotos(photos);
    sendJson(response, 200, { photo: photos[index] });
  } catch (error) {
    sendError(response, 400, error.message || "保存失败，请检查输入内容。");
  }
}

async function serveStatic(request, response) {
  const filePath = safePublicPath(request.url);
  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
    });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = getUrl(request.url);
    const photoMatch = url.pathname.match(/^\/api\/photos\/([^/]+)$/);

    if (request.method === "GET" && url.pathname === "/api/photos") {
      sendJson(response, 200, { photos: await readPhotos(), storage: useSupabase ? "supabase" : "local" });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/photos") {
      await handleUpload(request, response);
      return;
    }

    if (request.method === "PUT" && photoMatch) {
      await handleUpdate(request, response, decodeURIComponent(photoMatch[1]));
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      await serveStatic(request, response);
      return;
    }

    sendError(response, 405, "Method not allowed");
  } catch (error) {
    sendError(response, 500, error.message || "Server error.");
  }
});

ensureStorage().then(() => {
  server.listen(port, () => {
    console.log(`照片网站已启动：http://localhost:${port}`);
    console.log(`当前存储模式：${useSupabase ? "Supabase" : "本地 uploads"}`);
    console.log("按 Ctrl+C 可以停止服务。");
  });
});
