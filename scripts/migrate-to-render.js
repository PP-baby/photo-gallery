const fs = require("node:fs/promises");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const uploadsDir = path.join(rootDir, "uploads");
const photosFile = path.join(uploadsDir, "photos.json");

const mimeTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function normalizeBaseUrl(value) {
  const url = String(value || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Please pass a full Render URL, for example: https://photo-gallery.onrender.com");
  }
  return url;
}

function getUploadPath(photo) {
  const filename = path.basename(photo.src || "");
  if (!filename) {
    throw new Error(`Photo "${photo.title || photo.id}" is missing src.`);
  }
  return path.join(uploadsDir, filename);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `${options.method || "GET"} ${url} failed with ${response.status}`);
  }

  return data;
}

async function uploadPhoto(baseUrl, photo) {
  const filePath = getUploadPath(photo);
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypes[extension] || "application/octet-stream";
  const buffer = await fs.readFile(filePath);
  const formData = new FormData();

  formData.append("photos", new Blob([buffer], { type: mimeType }), path.basename(filePath));

  const uploadResult = await requestJson(`${baseUrl}/api/photos`, {
    method: "POST",
    body: formData,
  });

  const uploaded = uploadResult.photos?.[0];
  if (!uploaded?.id) {
    throw new Error(`Render did not return an uploaded photo id for "${photo.title || filePath}".`);
  }

  const updateResult = await requestJson(`${baseUrl}/api/photos/${uploaded.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      title: photo.title || uploaded.title,
      tags: photo.tags || ["日常"],
    }),
  });

  return updateResult.photo;
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.argv[2]);
  const raw = await fs.readFile(photosFile, "utf8");
  const photos = JSON.parse(raw);

  if (!Array.isArray(photos) || photos.length === 0) {
    console.log("No local photos found in uploads/photos.json.");
    return;
  }

  console.log(`Migrating ${photos.length} photo(s) to ${baseUrl}`);
  const existing = await requestJson(`${baseUrl}/api/photos`, { method: "GET" });
  const existingTitles = new Set((existing.photos || []).map((photo) => photo.title));

  for (const [index, photo] of photos.entries()) {
    if (existingTitles.has(photo.title)) {
      console.log(`${index + 1}/${photos.length} skipped: ${photo.title}`);
      continue;
    }

    const migrated = await uploadPhoto(baseUrl, photo);
    existingTitles.add(migrated.title);
    console.log(`${index + 1}/${photos.length} uploaded: ${migrated.title}`);
  }

  console.log("Migration complete.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
