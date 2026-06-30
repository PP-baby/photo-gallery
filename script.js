const gallery = document.querySelector(".gallery");
const controls = document.querySelector(".controls");
const uploadInput = document.querySelector("#photo-upload");
const lightbox = document.querySelector(".lightbox");
const lightboxImage = lightbox.querySelector("img");
const lightboxCaption = lightbox.querySelector(".lightbox-caption");
const lightboxClose = lightbox.querySelector(".lightbox-close");
const lightboxPrev = lightbox.querySelector(".lightbox-prev");
const lightboxNext = lightbox.querySelector(".lightbox-next");
const editor = document.querySelector(".editor");
const editorForm = document.querySelector(".editor-form");
const editorPreview = document.querySelector(".editor-preview");
const titleInput = document.querySelector("#photo-title");
const tagsInput = document.querySelector("#photo-tags");
const canUseServer = location.protocol === "http:" || location.protocol === "https:";

let activeFilter = "all";
let editingPhotoId = "";
let activeLightboxCard = null;

function splitTags(value) {
  return String(value || "")
    .split(/[,，、\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function uniqueTags(tags) {
  return [...new Set(tags)];
}

function tagsToText(tags) {
  return uniqueTags(tags).join("、") || "未分类";
}

function getCardTags(card) {
  return splitTags(card.dataset.tags);
}

function bindPhotoButton(card) {
  const button = card.querySelector(".photo-button");

  button.addEventListener("click", () => {
    openLightbox(card);
  });
}

function getVisibleCards() {
  return [...document.querySelectorAll(".photo-card")].filter((card) => !card.classList.contains("hidden"));
}

function updateLightboxNav() {
  const visibleCards = getVisibleCards();
  const hasMultiplePhotos = visibleCards.length > 1;

  lightboxPrev.disabled = !hasMultiplePhotos;
  lightboxNext.disabled = !hasMultiplePhotos;
}

function openLightbox(card) {
  const image = card.querySelector("img");
  const title = card.querySelector("h3")?.textContent || "我的照片";
  const tags = tagsToText(getCardTags(card));

  activeLightboxCard = card;
  lightboxImage.src = image.src;
  lightboxImage.alt = image.alt;
  lightboxCaption.textContent = `${title} · ${tags}`;
  updateLightboxNav();

  if (!lightbox.open) {
    lightbox.showModal();
  }
}

function showAdjacentPhoto(direction) {
  if (!activeLightboxCard) return;

  const visibleCards = getVisibleCards();
  if (visibleCards.length < 2) return;

  const currentIndex = visibleCards.indexOf(activeLightboxCard);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (safeIndex + direction + visibleCards.length) % visibleCards.length;

  openLightbox(visibleCards[nextIndex]);
}

function bindEditButton(card) {
  const button = card.querySelector(".edit-photo");
  if (!button || !card.dataset.id) return;

  button.addEventListener("click", () => {
    const image = card.querySelector("img");
    const title = card.querySelector("h3")?.textContent || "";

    editingPhotoId = card.dataset.id;
    editorPreview.src = image.src;
    editorPreview.alt = title;
    titleInput.value = title;
    tagsInput.value = getCardTags(card).join(", ");
    editor.showModal();
    titleInput.focus();
  });
}

function setFilter(tag) {
  activeFilter = tag;

  document.querySelectorAll(".filter").forEach((filter) => {
    filter.classList.toggle("active", filter.dataset.filter === tag);
  });

  document.querySelectorAll(".photo-card").forEach((card) => {
    const tags = getCardTags(card);
    const shouldShow = tag === "all" || tags.includes(tag);
    card.classList.toggle("hidden", !shouldShow);
  });
}

function refreshTagFilters() {
  const tags = [];

  document.querySelectorAll(".photo-card").forEach((card) => {
    tags.push(...getCardTags(card));
  });

  const nextTags = uniqueTags(tags);
  controls.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.className = "filter";
  allButton.type = "button";
  allButton.dataset.filter = "all";
  allButton.textContent = "全部";
  controls.append(allButton);

  nextTags.forEach((tag) => {
    const button = document.createElement("button");
    button.className = "filter";
    button.type = "button";
    button.dataset.filter = tag;
    button.textContent = tag;
    controls.append(button);
  });

  controls.querySelectorAll(".filter").forEach((filter) => {
    filter.addEventListener("click", () => setFilter(filter.dataset.filter));
  });

  setFilter(nextTags.includes(activeFilter) ? activeFilter : "all");
}

function createPhotoCard(photo, layout = "") {
  const card = document.createElement("article");
  const button = document.createElement("button");
  const editButton = document.createElement("button");
  const image = document.createElement("img");
  const meta = document.createElement("div");
  const title = document.createElement("h3");
  const detail = document.createElement("p");
  const tags = uniqueTags(photo.tags || splitTags(photo.category || "日常"));

  card.className = layout ? `photo-card ${layout}` : "photo-card";
  card.dataset.id = photo.id || "";
  card.dataset.tags = tags.join(",");

  button.className = "photo-button";
  button.type = "button";
  button.setAttribute("aria-label", `查看 ${photo.title}`);

  image.src = photo.src;
  image.alt = photo.title;

  editButton.className = "edit-photo";
  editButton.type = "button";
  editButton.textContent = photo.id ? "编辑" : "示例";
  editButton.disabled = !photo.id;

  meta.className = "photo-meta";
  title.textContent = photo.title || "我的照片";
  detail.textContent = tagsToText(tags);

  button.append(image);
  meta.append(title, detail);
  card.append(button, editButton, meta);
  bindPhotoButton(card);
  bindEditButton(card);

  return card;
}

function updateCard(photo) {
  const card = document.querySelector(`.photo-card[data-id="${photo.id}"]`);
  if (!card) return;

  const tags = uniqueTags(photo.tags || []);
  card.dataset.tags = tags.join(",");
  card.querySelector("h3").textContent = photo.title;
  card.querySelector("p").textContent = tagsToText(tags);
  card.querySelector("img").alt = photo.title;
  card.querySelector(".photo-button").setAttribute("aria-label", `查看 ${photo.title}`);
  refreshTagFilters();
}

async function loadSavedPhotos() {
  if (!canUseServer) {
    refreshTagFilters();
    return;
  }

  try {
    const response = await fetch("/api/photos");
    if (!response.ok) return;
    const data = await response.json();

    data.photos
      .slice()
      .reverse()
      .forEach((photo, index) => {
        const layout = index % 5 === 0 ? "wide" : index % 4 === 0 ? "tall" : "";
        gallery.prepend(createPhotoCard(photo, layout));
      });
  } catch {
    // Opening index.html directly still leaves the sample gallery usable.
  } finally {
    refreshTagFilters();
  }
}

uploadInput.addEventListener("change", (event) => {
  const files = Array.from(event.target.files).filter((file) => file.type.startsWith("image/"));
  if (files.length === 0) return;

  if (canUseServer) {
    const formData = new FormData();
    files.forEach((file) => formData.append("photos", file));

    fetch("/api/photos", {
      method: "POST",
      body: formData,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "上传失败，请确认服务正在运行。");
        }
        return data;
      })
      .then((data) => {
        data.photos.forEach((photo, index) => {
          gallery.prepend(createPhotoCard(photo, index % 3 === 0 ? "wide" : ""));
        });
        refreshTagFilters();
      })
      .catch((error) => {
        alert(error.message);
      });
  } else {
    files.forEach((file, index) => {
      const photo = {
        title: file.name.replace(/\.[^/.]+$/, ""),
        tags: ["日常"],
        src: URL.createObjectURL(file),
      };
      gallery.prepend(createPhotoCard(photo, index % 3 === 0 ? "wide" : ""));
    });
    refreshTagFilters();
  }

  uploadInput.value = "";
});

editorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const tags = splitTags(tagsInput.value);

  if (!editingPhotoId || !title) return;

  fetch(`/api/photos/${editingPhotoId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ title, tags }),
  })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "保存失败。");
      }
      return data;
    })
    .then((data) => {
      updateCard(data.photo);
      editor.close();
    })
    .catch((error) => {
      alert(error.message);
    });
});

document.querySelector(".icon-close").addEventListener("click", () => editor.close());
document.querySelector("[data-close-editor]").addEventListener("click", () => editor.close());
lightboxClose.addEventListener("click", () => lightbox.close());
lightboxPrev.addEventListener("click", () => showAdjacentPhoto(-1));
lightboxNext.addEventListener("click", () => showAdjacentPhoto(1));

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    lightbox.close();
  }
});

editor.addEventListener("click", (event) => {
  if (event.target === editor) {
    editor.close();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && lightbox.open) {
    lightbox.close();
  }

  if (event.key === "ArrowLeft" && lightbox.open) {
    showAdjacentPhoto(-1);
  }

  if (event.key === "ArrowRight" && lightbox.open) {
    showAdjacentPhoto(1);
  }
});

document.querySelectorAll(".photo-card").forEach((card) => {
  bindPhotoButton(card);
  bindEditButton(card);
});

loadSavedPhotos();
