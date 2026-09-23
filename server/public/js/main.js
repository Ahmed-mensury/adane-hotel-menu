/* Adane International Hotel — public menu logic
   No frameworks, no build step: fetch JSON, render, filter, search. */
(function () {
  "use strict";

  const state = { items: [], categories: [], activeCat: "all", query: "" };

  const els = {
    menunavCats: document.getElementById("menunavCats"),
    sections: document.getElementById("menuSections"),
    search: document.getElementById("searchInput"),
    searchClear: document.getElementById("searchClear"),
    searchStatus: document.getElementById("searchStatus"),
    backToTop: document.getElementById("backToTop"),
    loading: document.getElementById("loadingState"),
    vatNote: document.getElementById("vatNote"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modalClose: document.getElementById("modalClose"),
    modalImage: document.getElementById("modalImage"),
    modalCategory: document.getElementById("modalCategory"),
    modalTitle: document.getElementById("modalTitle"),
    modalDesc: document.getElementById("modalDesc"),
    modalPrice: document.getElementById("modalPrice")
  };

  const GRADIENTS = [
    ["#7A2430", "#9C3A47"], ["#1B1410", "#3A2C22"], ["#33513A", "#4C7256"],
    ["#8A5A28", "#C9A15A"], ["#5C3A5E", "#8A5A8C"], ["#2B4A5A", "#4C7A8C"]
  ];
  function gradientFor(cat) {
    let h = 0;
    for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) >>> 0;
    return GRADIENTS[h % GRADIENTS.length];
  }
  const PLATE_SVG = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="22" stroke="currentColor" stroke-width="2" opacity=".9"/>
    <circle cx="32" cy="32" r="14" stroke="currentColor" stroke-width="1.4" opacity=".55"/>
    <path d="M15 16v14M15 16c-2.2 0-4 2-4 4.5S12.8 25 15 25M15 25v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>
    <path d="M49 16v22M49 16c2 0 3.2 1.7 3.2 5.2 0 3-1.2 4.8-3.2 4.8M49 26v12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>
  </svg>`;

  function money(n) {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + " ETB";
  }

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function cardHtmlFixed(item) {
    const media = item.image
      ? `<img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" width="400" height="300">`
      : (() => { const [c1, c2] = gradientFor(item.category); return `<div class="card-fallback" style="background:linear-gradient(135deg,${c1},${c2})">${PLATE_SVG}</div>`; })();
    return `<article class="card" data-id="${item.id}" tabindex="0" role="button" aria-label="${escapeHtml(item.name)}, ${money(item.price)}">
      <div class="card-media">${media}${item.popular ? '<span class="badge">Popular</span>' : ""}</div>
      <div class="card-body">
        <h3 class="card-name">${escapeHtml(item.name)}</h3>
        ${item.description ? `<p class="card-desc">${escapeHtml(item.description)}</p>` : `<p class="card-desc">&nbsp;</p>`}
        <div class="card-foot">
          <span class="card-price">${money(item.price)}</span>
          <span class="card-cat">${escapeHtml(item.category)}</span>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const q = state.query.trim().toLowerCase();
    const filtered = state.items.filter((i) => {
      const matchesCat = state.activeCat === "all" || i.category === state.activeCat;
      const matchesQ = !q || i.name.toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });

    if (q) {
      els.searchStatus.hidden = false;
      els.searchStatus.textContent = `${filtered.length} result${filtered.length === 1 ? "" : "s"} for "${state.query}"`;
    } else {
      els.searchStatus.hidden = true;
    }

    if (filtered.length === 0) {
      els.sections.innerHTML = `<div class="no-results"><h3>No dishes found</h3><p>Try a different search term or browse a category above.</p></div>`;
      return;
    }

    const cats = state.activeCat === "all"
      ? state.categories.map((c) => c.name)
      : [state.activeCat];

    let html = "";
    cats.forEach((catName) => {
      const catItems = filtered.filter((i) => i.category === catName);
      if (catItems.length === 0) return;
      html += `<section class="cat-section" id="cat-${slug(catName)}">
        <div class="cat-heading"><h2>${escapeHtml(catName)}</h2><span class="cat-count">${catItems.length} item${catItems.length === 1 ? "" : "s"}</span></div>
        <div class="grid">${catItems.map(cardHtmlFixed).join("")}</div>
      </section>`;
    });
    els.sections.innerHTML = html;
    observeCards();
  }

  function renderCatPills() {
    const all = [{ name: "all", label: "All" }, ...state.categories.map((c) => ({ name: c.name, label: c.name }))];
    els.menunavCats.innerHTML = all.map((c) =>
      `<button class="cat-pill ${state.activeCat === c.name ? "active" : ""}" data-cat="${escapeHtml(c.name)}" role="tab" aria-selected="${state.activeCat === c.name}">${escapeHtml(c.label)}</button>`
    ).join("");
  }

  function observeCards() {
    const cards = document.querySelectorAll(".card:not(.in-view)");
    if (!("IntersectionObserver" in window)) { cards.forEach((c) => c.classList.add("in-view")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
      });
    }, { rootMargin: "80px" });
    cards.forEach((c) => io.observe(c));
  }

  function openModal(item) {
    const media = item.image
      ? `<img src="${item.image}" alt="${escapeHtml(item.name)}">`
      : (() => { const [c1, c2] = gradientFor(item.category); return `<div class="card-fallback" style="background:linear-gradient(135deg,${c1},${c2});width:100%;height:100%">${PLATE_SVG}</div>`; })();
    els.modalImage.innerHTML = media;
    els.modalCategory.textContent = item.category;
    els.modalTitle.textContent = item.name;
    els.modalDesc.textContent = item.description || "";
    els.modalPrice.textContent = money(item.price);
    els.modalBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    els.modalBackdrop.hidden = true;
    document.body.style.overflow = "";
  }

  function wireEvents() {
    els.menunavCats.addEventListener("click", (e) => {
      const btn = e.target.closest(".cat-pill");
      if (!btn) return;
      state.activeCat = btn.dataset.cat;
      renderCatPills();
      render();
      if (state.activeCat !== "all") {
        window.scrollTo({ top: document.getElementById("menunav").offsetTop, behavior: "instant" in window ? "auto" : "auto" });
      }
    });

    let searchTimer;
    els.search.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      const val = e.target.value;
      els.searchClear.hidden = !val;
      searchTimer = setTimeout(() => { state.query = val; render(); }, 140);
    });
    els.searchClear.addEventListener("click", () => {
      els.search.value = ""; state.query = ""; els.searchClear.hidden = true; render(); els.search.focus();
    });

    els.sections.addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      const item = state.items.find((i) => String(i.id) === card.dataset.id);
      if (item) openModal(item);
    });
    els.sections.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".card");
      if (!card) return;
      e.preventDefault();
      const item = state.items.find((i) => String(i.id) === card.dataset.id);
      if (item) openModal(item);
    });

    els.modalClose.addEventListener("click", closeModal);
    els.modalBackdrop.addEventListener("click", (e) => { if (e.target === els.modalBackdrop) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

    window.addEventListener("scroll", () => {
      els.backToTop.classList.toggle("show", window.scrollY > 600);
    }, { passive: true });
    els.backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  async function init() {
    wireEvents();
    try {
      const res = await fetch("/api/menu");
      if (!res.ok) throw new Error("Failed to load menu");
      const data = await res.json();
      state.items = data.items;
      state.categories = data.categories;
      if (data.settings && data.settings.vatNote) els.vatNote.textContent = data.settings.vatNote;
      renderCatPills();
      render();
    } catch (err) {
      els.sections.innerHTML = `<div class="no-results"><h3>The menu couldn't load</h3><p>Please refresh the page. If this keeps happening, let our staff know.</p></div>`;
      console.error(err);
    } finally {
      els.loading.classList.add("hide");
    }
  }

  init();
})();
