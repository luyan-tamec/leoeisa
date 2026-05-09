
/* ══ TOAST ══ */
let toastTimer;
function showToast(msg, type = "ok") {
  clearTimeout(toastTimer);
  const toastMsg = document.getElementById("toastMsg");
  const dot = document.getElementById("toastDot");
  const toast = document.getElementById("toast");
  if (!toastMsg || !dot || !toast) return;
  toastMsg.textContent = msg;
  dot.className = "toast-dot" + (type === "warn" ? " warn" : type === "err" ? " err" : "");
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

/* ══ CONFIRM ══ */
let pendingOk = null;

function showConfirm(title, msg, cb) {
  const modal = document.getElementById("confirmModal");
  if (!modal) {
    // Modal não existe nessa tab — usa confirm() nativo do browser
    if (window.confirm(`${title}\n${msg}`)) cb();
    return;
  }
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMsg").textContent = msg;
  modal.classList.add("open");
  pendingOk = cb;
}

function closeConfirm() {
  const modal = document.getElementById("confirmModal");
  if (modal) modal.classList.remove("open");
  pendingOk = null;
}

// Bind confirm button com verificação segura
const confirmOkBtn = document.getElementById("confirmOkBtn");
if (confirmOkBtn) {
  confirmOkBtn.addEventListener("click", () => {
    closeConfirm();
    if (pendingOk) { pendingOk(); pendingOk = null; }
  });
}

/* ══ VOTE ADJUST ══ */
async function adjustVotes(id, title, delta) {
  try {
    const res = await fetch(`/api/admin/movies/${id}/adjust-votes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({ delta }),
    });
    if (!res.ok) throw new Error();
    const movie = await res.json();

    // Atualiza todos os elementos de contagem desse filme (overview e movies tab)
    [`vadj-${id}`, `vadj2-${id}`].forEach(elId => {
      const el = document.getElementById(elId);
      if (el) el.textContent = movie.voteCount.toLocaleString("pt-BR");
    });
    const vcount = document.getElementById(`vcount-${id}`);
    if (vcount) vcount.textContent = `${movie.voteCount.toLocaleString("pt-BR")} votos`;

    showToast(`${title}: ${movie.voteCount} votos`);
  } catch {
    showToast("Erro ao ajustar votos.", "err");
  }
}

/* ══ RESET VOTES (individual) ══ */
function resetVotes(id, title) {
  showConfirm("Zerar Votos", `Zerar os votos de "${title}"?`, async () => {
    try {
      const res = await fetch(`/api/admin/movies/${id}/reset-votes`, {
        method: "POST",
        headers: { "Accept": "application/json" },
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error();

      [`vadj-${id}`, `vadj2-${id}`].forEach(elId => {
        const el = document.getElementById(elId);
        if (el) el.textContent = "0";
      });
      const vcount = document.getElementById(`vcount-${id}`);
      if (vcount) vcount.textContent = "0 votos";

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
        method: "DELETE",
        headers: { "Accept": "application/json" },
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error();
      const row = document.getElementById(`row-${id}`);
      if (row) row.remove();
      showToast(`"${title}" apagado.`, "warn");
    } catch {
      showToast("Erro ao apagar filme.", "err");
    }
  });
}

/* ══ RESET ALL VOTES ══ */
function adminAction(type, confirmMsg, method, url) {
  if (type === "reset-all") {
    showConfirm("Zerar TODOS os Votos", `${confirmMsg} Esta ação é irreversível.`, async () => {
      try {
        const res = await fetch(url, {
          method,
          headers: { "Accept": "application/json" },
          credentials: "same-origin",
        });
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

/* ══ EXPORT JSON ══ */
async function exportJson() {
  try {
    const res = await fetch("/api/admin/movies", { credentials: "same-origin" });
    const movies = await res.json();
    const blob = new Blob([JSON.stringify(movies, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cinevote-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast("JSON exportado!");
  } catch {
    showToast("Erro ao exportar.", "err");
  }
}

/* ══ APPLY URL PREVIEW ══ */
function applyUrl() {
  const urlInput = document.getElementById("posterUrlInput");
  if (!urlInput) return;
  const url = urlInput.value.trim();
  if (!url) return;
  const preview = document.getElementById("imgPreview");
  const placeholder = document.getElementById("imgPlaceholder");
  if (preview) { preview.src = url; preview.style.display = "block"; }
  if (placeholder) placeholder.style.display = "none";
  const fileInput = document.getElementById("fImgFile");
  if (fileInput) fileInput.value = "";
}

/* ══ EVENT DELEGATION — captura cliques em todos os botões do admin ══ */
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-delta]");
  const resetBtn = e.target.closest("[data-action='reset']");
  const deleteBtn = e.target.closest("[data-action='delete']");

  if (btn) {
    const id = btn.dataset.id;
    const title = btn.dataset.title;
    const delta = parseInt(btn.dataset.delta);
    adjustVotes(id, title, delta);
    return;
  }

  if (resetBtn) {
    const id = resetBtn.dataset.id;
    const title = resetBtn.dataset.title;
    resetVotes(id, title);
    return;
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    const title = deleteBtn.dataset.title;
    deleteMovie(id, title);
    return;
  }
});
const addForm = document.getElementById("addMovieForm");
if (addForm) {
  const fImgFile = document.getElementById("fImgFile");

  if (fImgFile) {
    fImgFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { showToast("Arquivo muito grande (max 5 MB).", "err"); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = document.getElementById("imgPreview");
        const placeholder = document.getElementById("imgPlaceholder");
        if (preview) { preview.src = ev.target.result; preview.style.display = "block"; }
        if (placeholder) placeholder.style.display = "none";
      };
      reader.readAsDataURL(file);
    });
  }

  const area = document.getElementById("imgUploadArea");
  if (area && fImgFile) {
    area.addEventListener("dragover", (e) => { e.preventDefault(); area.classList.add("drag"); });
    area.addEventListener("dragleave", () => area.classList.remove("drag"));
    area.addEventListener("drop", (e) => {
      e.preventDefault(); area.classList.remove("drag");
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      const dt = new DataTransfer(); dt.items.add(file);
      fImgFile.files = dt.files;
      fImgFile.dispatchEvent(new Event("change"));
    });
  }

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = addForm.querySelector("[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Salvando...";

    try {
      const formData = new FormData(addForm);
      const fileInput = document.getElementById("fImgFile");
      if (fileInput && !fileInput.files[0]) formData.delete("poster");

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
