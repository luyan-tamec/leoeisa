/* ══ TOAST ══ */
let toastTimer;
function showToast(msg, type = "ok") {
  clearTimeout(toastTimer);
  document.getElementById("toastMsg").textContent = msg;
  const dot = document.getElementById("toastDot");
  dot.className = "toast-dot" + (type === "warn" ? " warn" : type === "err" ? " err" : "");
  document.getElementById("toast").classList.add("show");
  toastTimer = setTimeout(() => document.getElementById("toast").classList.remove("show"), 3200);
}

/* ══ CONFIRM ══ */
let pendingOk = null;
function showConfirm(title, msg, cb) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMsg").textContent = msg;
  document.getElementById("confirmModal").classList.add("open");
  pendingOk = cb;
}
function closeConfirm() {
  document.getElementById("confirmModal").classList.remove("open");
  pendingOk = null;
}
document.getElementById("confirmOkBtn").addEventListener("click", () => {
  closeConfirm();
  if (pendingOk) { pendingOk(); pendingOk = null; }
});

/* ══ VOTE ADJUST ══ */
async function adjustVotes(id, title, delta) {
  try {
    const res = await fetch(`/api/admin/movies/${id}/adjust-votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ delta }),
    });
    if (!res.ok) throw new Error();
    const movie = await res.json();
    // Update all vote display elements for this movie
    document.querySelectorAll(`#vadj-${id}, #vadj2-${id}`).forEach(el => {
      el.textContent = movie.voteCount.toLocaleString("pt-BR");
    });
    document.querySelectorAll(`#vcount-${id}`).forEach(el => {
      el.textContent = `${movie.voteCount.toLocaleString("pt-BR")} votos`;
    });
    showToast(`${title}: ${movie.voteCount} votos`);
  } catch {
    showToast("Erro ao ajustar votos.", "err");
  }
}

/* ══ RESET VOTES ══ */
function resetVotes(id, title) {
  showConfirm("Zerar Votos", `Zerar os votos de "${title}"?`, async () => {
    try {
      const res = await fetch(`/api/admin/movies/${id}/reset-votes`, {
        method: "POST", credentials: "same-origin",
      });
      if (!res.ok) throw new Error();
      document.querySelectorAll(`#vadj-${id}, #vadj2-${id}, #vcount-${id}`).forEach(el => {
        el.textContent = el.id.startsWith("vcount") ? "0 votos" : "0";
      });
      showToast(`Votos de "${title}" zerados.`, "warn");
    } catch {
      showToast("Erro ao zerar votos.", "err");
    }
  });
}

/* ══ DELETE MOVIE ══ */
function deleteMovie(id, title) {
  showConfirm("Apagar Filme", `Apagar "${title}"? Esta ação é irreversível.`, async () => {
    try {
      const res = await fetch(`/api/admin/movies/${id}`, {
        method: "DELETE", credentials: "same-origin",
      });
      if (!res.ok) throw new Error();
      document.getElementById(`row-${id}`)?.remove();
      showToast(`"${title}" apagado.`, "warn");
    } catch {
      showToast("Erro ao apagar filme.", "err");
    }
  });
}

/* ══ RESET ALL VOTES ══ */
function adminAction(type, confirmMsg, method, url) {
  if (type === "reset-all") {
    showConfirm("Zerar TODOS os Votos", confirmMsg + " Esta ação é irreversível.", async () => {
      try {
        const res = await fetch(url, { method, credentials: "same-origin" });
        if (!res.ok) throw new Error();
        document.querySelectorAll("[id^='vadj-'], [id^='vadj2-']").forEach(el => el.textContent = "0");
        document.querySelectorAll("[id^='vcount-']").forEach(el => el.textContent = "0 votos");
        showToast("Todos os votos foram zerados.", "warn");
      } catch {
        showToast("Erro ao zerar votos.", "err");
      }
    });
  }
}

/* ══ ADD MOVIE FORM ══ */
const addForm = document.getElementById("addMovieForm");
if (addForm) {
  // Image preview on file input
  document.getElementById("fImgFile")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast("Arquivo muito grande (max 5 MB).", "err"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById("imgPreview");
      const placeholder = document.getElementById("imgPlaceholder");
      preview.src = ev.target.result;
      preview.style.display = "block";
      if (placeholder) placeholder.style.display = "none";
    };
    reader.readAsDataURL(file);
  });

  // Drag-drop highlight
  const area = document.getElementById("imgUploadArea");
  if (area) {
    area.addEventListener("dragover", (e) => { e.preventDefault(); area.classList.add("drag"); });
    area.addEventListener("dragleave", () => area.classList.remove("drag"));
    area.addEventListener("drop", (e) => {
      e.preventDefault(); area.classList.remove("drag");
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      // Manually set to file input
      const dt = new DataTransfer(); dt.items.add(file);
      document.getElementById("fImgFile").files = dt.files;
      document.getElementById("fImgFile").dispatchEvent(new Event("change"));
    });
  }

  // Submit form via fetch (multipart)
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = addForm.querySelector('[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Salvando...";

    try {
      const formData = new FormData(addForm);
      // If no file, remove the field to avoid sending empty file
      const fileInput = document.getElementById("fImgFile");
      if (!fileInput.files[0]) formData.delete("poster");

      const res = await fetch("/api/admin/movies", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao salvar");
      }

      const movie = await res.json();
      showToast(`"${movie.title}" adicionado!`);
      setTimeout(() => { window.location.href = "/admin?tab=movies"; }, 1200);
    } catch (err) {
      showToast(err.message || "Erro ao salvar.", "err");
      submitBtn.disabled = false;
      submitBtn.textContent = "Adicionar Filme";
    }
  });
}

/* ══ EXPORT JSON ══ */
async function exportJson() {
  try {
    const res = await fetch('/api/admin/movies', { credentials: 'same-origin' });
    const movies = await res.json();
    const blob = new Blob([JSON.stringify(movies, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cinevote-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    showToast('JSON exportado!');
  } catch {
    showToast('Erro ao exportar.', 'err');
  }
}
function applyUrl() {
  const url = document.getElementById("posterUrlInput")?.value.trim();
  if (!url) return;
  const preview = document.getElementById("imgPreview");
  const placeholder = document.getElementById("imgPlaceholder");
  if (preview) { preview.src = url; preview.style.display = "block"; }
  if (placeholder) placeholder.style.display = "none";
  // Clear file input so URL takes priority
  const fileInput = document.getElementById("fImgFile");
  if (fileInput) fileInput.value = "";
}
