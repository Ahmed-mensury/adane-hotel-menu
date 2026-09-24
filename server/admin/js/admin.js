/* Adane International Hotel — admin dashboard logic */
window.AdaneAdmin = (function () {
  "use strict";

  const api = {
    async call(method, url, body) {
      const opts = { method, headers: {}, credentials: "same-origin" };
      if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
      const res = await fetch(url, opts);
      let data = null;
      try { data = await res.json(); } catch (e) { /* no body */ }
      if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
      return data;
    },
    get(url) { return this.call("GET", url); },
    post(url, body) { return this.call("POST", url, body); },
    put(url, body) { return this.call("PUT", url, body); },
    del(url) { return this.call("DELETE", url); }
  };

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 2600);
  }

  /* ================= LOGIN PAGE ================= */
  function initLogin() {
    const form = document.getElementById("loginForm");
    const errEl = document.getElementById("loginError");
    const btn = document.getElementById("loginBtn");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.hidden = true;
      btn.disabled = true; btn.textContent = "Logging in…";
      try {
        await api.post("/api/auth/login", {
          email: document.getElementById("email").value.trim(),
          password: document.getElementById("password").value
        });
        window.location.href = "dashboard.html";
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
        btn.disabled = false; btn.textContent = "Log in";
      }
    });
  }

  /* ================= DASHBOARD ================= */
  function initDashboard() {
    const app = document.getElementById("app");
    let items = [], categories = [];
    let editingImageUrl = "";

    api.get("/api/auth/me")
      .then((me) => {
        document.getElementById("adminEmail").textContent = me.email;
        app.hidden = false;
        boot();
      })
      .catch(() => { window.location.href = "login.html"; });

    function boot() {
      wireNav();
      wireLogout();
      wireItemModal();
      wireCategoryForm();
      wireSettingsForm();
      wireItemFilters();
      document.getElementById("addItemBtn").addEventListener("click", () => openItemModal(null));
      wireBulkUpload();
      loadEverything();
    }

    async function loadEverything() {
      const [summary, itemList, catList, settings] = await Promise.all([
        api.get("/api/admin/summary"),
        api.get("/api/admin/items"),
        api.get("/api/admin/categories"),
        api.get("/api/admin/settings")
      ]);
      items = itemList; categories = catList;
      renderSummary(summary);
      renderCategoryOptions();
      renderItemsTable();
      renderCategoriesView();
      renderSettings(settings);
    }

    function renderSummary(s) {
      document.getElementById("statTotal").textContent = s.totalItems;
      document.getElementById("statAvailable").textContent = s.availableItems;
      document.getElementById("statHidden").textContent = s.hiddenItems;
      document.getElementById("statCats").textContent = s.totalCategories;
    }

    /* ---- nav ---- */
    function wireNav() {
      document.querySelectorAll(".nav-item").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          document.querySelectorAll(".view").forEach((v) => (v.hidden = true));
          document.getElementById("view-" + btn.dataset.view).hidden = false;
        });
      });
    }
    function wireLogout() {
      document.getElementById("logoutBtn").addEventListener("click", async () => {
        await api.post("/api/auth/logout");
        window.location.href = "login.html";
      });
    }

    /* ---- items table ---- */
    function wireItemFilters() {
      ["itemSearch", "itemCatFilter", "itemStatusFilter"].forEach((id) =>
        document.getElementById(id).addEventListener("input", renderItemsTable)
      );
    }
    function renderCategoryOptions() {
      const sorted = [...categories].sort((a, b) => a.order - b.order);
      document.getElementById("itemCatFilter").innerHTML =
        `<option value="all">All categories</option>` + sorted.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
      document.getElementById("fCategory").innerHTML =
        sorted.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("");
    }

    function renderItemsTable() {
      const q = document.getElementById("itemSearch").value.trim().toLowerCase();
      const cat = document.getElementById("itemCatFilter").value;
      const status = document.getElementById("itemStatusFilter").value;
      const rows = items
        .filter((i) => (cat === "all" || i.category === cat))
        .filter((i) => (status === "all" || (status === "available" ? i.available : !i.available)))
        .filter((i) => !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));

      document.getElementById("itemsTbody").innerHTML = rows.map((i) => `
        <tr data-id="${i.id}">
          <td>${i.image ? `<img class="row-thumb" src="${i.image}" alt="">` : `<div class="row-thumb-fallback"></div>`}</td>
          <td>${esc(i.name)}${i.popular ? " ⭐" : ""}</td>
          <td>${esc(i.category)}</td>
          <td>${i.price.toLocaleString()}</td>
          <td><span class="pill-status ${i.available ? "on" : "off"}">${i.available ? "Available" : "Hidden"}</span></td>
          <td class="row-actions">
            <button data-action="edit">Edit</button>
            <button data-action="toggle">${i.available ? "Hide" : "Show"}</button>
          </td>
        </tr>`).join("") || `<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--text-soft)">No items match your filters.</td></tr>`;

      document.getElementById("itemsTbody").querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = Number(btn.closest("tr").dataset.id);
          const item = items.find((i) => i.id === id);
          if (btn.dataset.action === "edit") openItemModal(item);
          if (btn.dataset.action === "toggle") {
            const updated = await api.put(`/api/admin/items/${id}`, { available: !item.available });
            Object.assign(item, updated);
            renderItemsTable();
            toast(item.available ? "Item is now visible on the public menu" : "Item hidden from the public menu");
          }
        });
      });
    }

    /* ---- item modal ---- */
    function wireItemModal() {
      document.getElementById("itemModalClose").addEventListener("click", closeItemModal);
      document.getElementById("itemModalBackdrop").addEventListener("click", (e) => {
        if (e.target.id === "itemModalBackdrop") closeItemModal();
      });
      document.getElementById("itemForm").addEventListener("submit", saveItem);
      document.getElementById("deleteItemBtn").addEventListener("click", deleteItem);
      document.getElementById("fImageFile").addEventListener("change", handleImageUpload);
    }

    function openItemModal(item) {
      document.getElementById("itemFormError").hidden = true;
      document.getElementById("itemModalTitle").textContent = item ? "Edit item" : "Add new item";
      document.getElementById("itemId").value = item ? item.id : "";
      document.getElementById("fName").value = item ? item.name : "";
      document.getElementById("fCategory").value = item ? item.category : (categories[0] && categories[0].name) || "";
      document.getElementById("fPrice").value = item ? item.price : "";
      document.getElementById("fDescription").value = item ? item.description : "";
      document.getElementById("fAvailable").checked = item ? item.available : true;
      document.getElementById("fPopular").checked = item ? !!item.popular : false;
      document.getElementById("fImageFile").value = "";
      document.getElementById("fImageHint").textContent = "Upload a JPG, PNG or WEBP photo (auto-optimized).";
      editingImageUrl = item ? item.image || "" : "";
      updateImagePreview();
      document.getElementById("deleteItemBtn").style.display = item ? "inline-block" : "none";
      document.getElementById("itemModalBackdrop").hidden = false;
    }
    function closeItemModal() { document.getElementById("itemModalBackdrop").hidden = true; }
    function updateImagePreview() {
      const el = document.getElementById("fImagePreview");
      el.innerHTML = editingImageUrl ? `<img src="${editingImageUrl}" alt="">` : "No image";
    }

    async function handleImageUpload() {
      const file = document.getElementById("fImageFile").files[0];
      if (!file) return;
      const hint = document.getElementById("fImageHint");
      hint.textContent = "Uploading…";
      const fd = new FormData();
      fd.append("image", file);
      try {
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd, credentials: "same-origin" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        editingImageUrl = data.url;
        updateImagePreview();
        hint.textContent = "Uploaded. Photo will be saved with this item.";
      } catch (err) {
        hint.textContent = err.message;
      }
    }

    async function saveItem(e) {
      e.preventDefault();
      const errEl = document.getElementById("itemFormError");
      errEl.hidden = true;
      const id = document.getElementById("itemId").value;
      const payload = {
        name: document.getElementById("fName").value.trim(),
        category: document.getElementById("fCategory").value,
        price: Number(document.getElementById("fPrice").value),
        description: document.getElementById("fDescription").value.trim(),
        image: editingImageUrl,
        available: document.getElementById("fAvailable").checked,
        popular: document.getElementById("fPopular").checked
      };
      try {
        if (id) {
          const updated = await api.put(`/api/admin/items/${id}`, payload);
          Object.assign(items.find((i) => i.id === Number(id)), updated);
          toast("Item updated");
        } else {
          const created = await api.post("/api/admin/items", payload);
          items.push(created);
          toast("Item added");
        }
        closeItemModal();
        renderItemsTable();
        const summary = await api.get("/api/admin/summary");
        renderSummary(summary);
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    }

    async function deleteItem() {
      const id = Number(document.getElementById("itemId").value);
      if (!id) return;
      if (!confirm("Delete this item permanently? This can't be undone — consider hiding it instead.")) return;
      await api.del(`/api/admin/items/${id}`);
      items = items.filter((i) => i.id !== id);
      closeItemModal();
      renderItemsTable();
      const summary = await api.get("/api/admin/summary");
      renderSummary(summary);
      toast("Item deleted");
    }

    /* ---- bulk photo upload ---- */
    function wireBulkUpload() {
      document.getElementById("bulkUploadBtn").addEventListener("click", () => {
        document.getElementById("bulkFiles").value = "";
        document.getElementById("bulkResults").innerHTML = "";
        document.getElementById("bulkModalBackdrop").hidden = false;
      });
      document.getElementById("bulkModalClose").addEventListener("click", () => {
        document.getElementById("bulkModalBackdrop").hidden = true;
      });
      document.getElementById("bulkModalBackdrop").addEventListener("click", (e) => {
        if (e.target.id === "bulkModalBackdrop") document.getElementById("bulkModalBackdrop").hidden = true;
      });
      document.getElementById("bulkUploadSubmit").addEventListener("click", async () => {
        const input = document.getElementById("bulkFiles");
        const files = input.files;
        const resultsEl = document.getElementById("bulkResults");
        if (!files || files.length === 0) {
          resultsEl.innerHTML = `<p class="form-error">Choose one or more photo files first.</p>`;
          return;
        }
        const btn = document.getElementById("bulkUploadSubmit");
        btn.disabled = true;
        btn.textContent = `Uploading ${files.length} photo${files.length === 1 ? "" : "s"}…`;
        resultsEl.innerHTML = "";

        const fd = new FormData();
        Array.from(files).forEach((f) => fd.append("images", f));

        try {
          const res = await fetch("/api/admin/bulk-upload", { method: "POST", body: fd, credentials: "same-origin" });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Bulk upload failed");

          let html = "";
          data.matched.forEach((m) => {
            html += `<div class="bulk-row"><span class="file">${esc(m.filename)}</span><span class="result ok">✓ matched to "${esc(m.itemName)}"</span></div>`;
          });
          data.unmatched.forEach((f) => {
            html += `<div class="bulk-row"><span class="file">${esc(f)}</span><span class="result fail">✗ no matching item name</span></div>`;
          });
          html += `<div class="bulk-summary">${data.matched.length} photo${data.matched.length === 1 ? "" : "s"} applied, ${data.unmatched.length} unmatched</div>`;
          resultsEl.innerHTML = html;

          // refresh items so the table/thumbnails show the new photos immediately
          items = await api.get("/api/admin/items");
          renderItemsTable();
          toast(`${data.matched.length} photo(s) uploaded and matched`);
        } catch (err) {
          resultsEl.innerHTML = `<p class="form-error">${esc(err.message)}</p>`;
        } finally {
          btn.disabled = false;
          btn.textContent = "Upload & match";
        }
      });
    }

    /* ---- categories ---- */
    function wireCategoryForm() {
      document.getElementById("addCatForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("newCatName");
        try {
          const cat = await api.post("/api/admin/categories", { name: input.value.trim() });
          categories.push(cat);
          input.value = "";
          renderCategoryOptions();
          renderCategoriesView();
          toast("Category added");
        } catch (err) { alert(err.message); }
      });
    }
    function renderCategoriesView() {
      const sorted = [...categories].sort((a, b) => a.order - b.order);
      document.getElementById("catList").innerHTML = sorted.map((c) => {
        const count = items.filter((i) => i.category === c.name).length;
        return `<div class="cat-row" data-id="${c.id}">
          <input type="text" value="${esc(c.name)}" data-orig="${esc(c.name)}">
          <span class="cat-row-count">${count} item${count === 1 ? "" : "s"}</span>
          <button data-action="rename">Rename</button>
          <button data-action="delete">Delete</button>
        </div>`;
      }).join("");
      document.getElementById("catList").querySelectorAll(".cat-row").forEach((row) => {
        const id = Number(row.dataset.id);
        row.querySelector('[data-action="rename"]').addEventListener("click", async () => {
          const newName = row.querySelector("input").value.trim();
          if (!newName) return;
          const updated = await api.put(`/api/admin/categories/${id}`, { name: newName });
          const cat = categories.find((c) => c.id === id);
          const oldName = cat.name;
          cat.name = updated.name;
          items.forEach((i) => { if (i.category === oldName) i.category = updated.name; });
          renderCategoryOptions(); renderItemsTable(); renderCategoriesView();
          toast("Category renamed");
        });
        row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
          if (!confirm("Delete this category? It must have no items in it.")) return;
          try {
            await api.del(`/api/admin/categories/${id}`);
            categories = categories.filter((c) => c.id !== id);
            renderCategoryOptions(); renderCategoriesView();
            toast("Category deleted");
          } catch (err) { alert(err.message); }
        });
      });
    }

    /* ---- settings ---- */
    function renderSettings(s) {
      document.getElementById("setHotelName").value = s.hotelName || "";
      document.getElementById("setTagline").value = s.tagline || "";
      document.getElementById("setVatNote").value = s.vatNote || "";
      document.getElementById("setPhone").value = s.phone || "";
      document.getElementById("setAddress").value = s.address || "";
    }
    function wireSettingsForm() {
      document.getElementById("settingsForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        await api.put("/api/admin/settings", {
          hotelName: document.getElementById("setHotelName").value,
          tagline: document.getElementById("setTagline").value,
          vatNote: document.getElementById("setVatNote").value,
          phone: document.getElementById("setPhone").value,
          address: document.getElementById("setAddress").value
        });
        const el = document.getElementById("settingsSaved");
        el.hidden = false;
        setTimeout(() => (el.hidden = true), 2000);
      });
    }
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  return { initLogin, initDashboard };
})();
