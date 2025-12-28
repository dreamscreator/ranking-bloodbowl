// tableBbtRachas.js — BBT Rachas con paginación (25/ página)
// Lee `streaks` (src/bbt/streaks.js), pinta bbtStreak.html, ordena por botones del HTML (#sortButtons)
// e inyecta controles de paginación debajo de la tabla.

(function () {
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof streaksBbt === "undefined") {
      console.error("streaksBbt no está definido. Carga src/bbt/streaks.js antes de este script.");
      return;
    }

    const PAGE_SIZE = 25;
    let currentPage = 1;
    let lastFiltered = [];

    const table = document.getElementById("nafTable");
    const tableBody = table.querySelector("tbody");

    // ===== Normaliza datos (solo Country = Spain) =====
    const baseData = streaksBbt
      .map((item) => ({
        nafNr: item["NAF Nr"] || "",
        coach: item["NAF Name"] || "",
        ccaa: (item["CCAA"] || "").trim(),
        country: item["Country"] || "",
        victoryStreak: item.victoryStreak || 0,
        bestVictoryStreak: item.bestVictoryStreak || 0,
        noLostStreak: item.noLostStreak || 0,
        bestNoLostStreak: item.bestNoLostStreak || 0,
        lostStreak: item.lostStreak || 0,
        worstLostStreak: item.worstLostStreak || 0,
        oneTdStreak: item.oneTdStreak || 0,
        bestOneTdStreak: item.bestOneTdStreak || 0,
        twoTdStreak: item.twoTdStreak || 0,
        bestTwoTdStreak: item.bestTwoTdStreak || 0,
        noTdAgainstStreak: item.noTdAgainstStreak || 0,
        bestNoTdAgainstStreak: item.bestNoTdAgainstStreak || 0,
      }))
      .filter((row) => row.country === "Spain");

    // ===== Orden por defecto (históricas -> actuales -> nombre) =====
    function compareRows(a, b) {
      const keys = [
        "bestVictoryStreak",
        "bestNoLostStreak",
        "bestOneTdStreak",
        "bestTwoTdStreak",
        "bestNoTdAgainstStreak",
        "victoryStreak",
        "noLostStreak",
      ];
      for (const k of keys) {
        const diff = (b[k] ?? 0) - (a[k] ?? 0);
        if (diff !== 0) return diff;
      }
      return a.coach.localeCompare(b.coach);
    }

    // ===== Filtros =====
    const nafFilter = document.getElementById("nafFilter");
    const coachFilter = document.getElementById("coachFilter");
    const ccaaFilter = document.getElementById("ccaaFilter");

    (function populateCcaaOptions() {
      const ccaaList = Array.from(new Set(baseData.map((d) => d.ccaa))).sort();
      ccaaFilter.innerHTML =
        '<option value="all" data-i18n="todas">Todas</option>' +
        ccaaList.map((ccaa) => `<option value="${ccaa}">${ccaa}</option>`).join("");
    })();

    // ===== Ordenación por botones del HTML =====
    const sortBar = document.getElementById("sortButtons");
    const validSortKeys = new Set([
      "victoryStreak",
      "bestVictoryStreak",
      "noLostStreak",
      "bestNoLostStreak",
      "lostStreak",
      "worstLostStreak",
      "oneTdStreak",
      "bestOneTdStreak",
      "twoTdStreak",
      "bestTwoTdStreak",
      "noTdAgainstStreak",
      "bestNoTdAgainstStreak",
    ]);

    let sortState = { key: null, dir: "desc" }; // null => orden por defecto

    function setSort(key) {
      if (!validSortKeys.has(key)) return;
      if (sortState.key === key) {
        sortState.dir = sortState.dir === "desc" ? "asc" : "desc";
      } else {
        sortState.key = key;
        sortState.dir = "desc"; // primera pulsación: descendente
      }
      currentPage = 1; // al cambiar orden, vuelve a página 1
      applyFilters();
      updateButtonsUI();
    }

    function updateButtonsUI() {
      if (!sortBar) return;
      const sortBtns = sortBar.querySelectorAll(".sort-btn");
      sortBtns.forEach((btn) => {
        const key = btn.dataset.key;
        const isActive = sortState.key === key;
        btn.classList.toggle("btn-primary", isActive);
        btn.classList.toggle("btn-outline-primary", !isActive);
        const base = btn.dataset.label || btn.textContent.replace(/\s*[▲▼]$/, "");
        btn.dataset.label = base;
        btn.textContent = isActive ? `${base} ${sortState.dir === "desc" ? "▼" : "▲"}` : base;
      });
    }

    if (sortBar) {
      sortBar.addEventListener("click", (ev) => {
        const btn = ev.target.closest(".sort-btn");
        if (!btn) return;
        setSort(btn.dataset.key);
      });
    }

    function sortByKey(rows, key, dir) {
      return rows.sort((a, b) => {
        const av = a[key] ?? 0;
        const bv = b[key] ?? 0;
        if (av === bv) return a.coach.localeCompare(b.coach);
        return dir === "asc" ? av - bv : bv - av;
      });
    }

    // ===== Paginación =====
    function ensurePaginationContainer() {
      let container = document.getElementById("pagination");
      if (container) return container;
      container = document.createElement("nav");
      container.id = "pagination";
      container.className = "mt-3 d-flex justify-content-center";
      table.parentElement.appendChild(container);
      return container;
    }

    function renderPagination(totalPages) {
      const container = ensurePaginationContainer();
      container.innerHTML = "";
      container.style.display = totalPages > 1 ? "block" : "none";
      if (totalPages <= 1) return;

      const ul = document.createElement("ul");
      ul.className = "pagination pagination-sm flex-wrap";

      function makeItem(label, page, disabled = false, active = false) {
        const li = document.createElement("li");
        li.className = `page-item${disabled ? " disabled" : ""}${active ? " active" : ""}`;
        const a = document.createElement("a");
        a.className = "page-link";
        a.href = "#";
        a.textContent = label;
        if (!disabled && !active) {
          a.addEventListener("click", (e) => {
            e.preventDefault();
            gotoPage(page);
          });
        }
        li.appendChild(a);
        return li;
      }

      ul.appendChild(makeItem("\u00AB", 1, currentPage === 1));
      ul.appendChild(makeItem("\u2039", Math.max(1, currentPage - 1), currentPage === 1));

      const total = totalPages;
      // Simple: muestra todas. Si quieres compactar, podemos añadir elipsis.
      for (let p = 1; p <= total; p++) {
        ul.appendChild(makeItem(String(p), p, false, p === currentPage));
      }

      ul.appendChild(makeItem("\u203A", Math.min(totalPages, currentPage + 1), currentPage === totalPages));
      ul.appendChild(makeItem("\u00BB", totalPages, currentPage === totalPages));

      container.appendChild(ul);
    }

    function gotoPage(p) {
      const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
      currentPage = Math.min(Math.max(1, p), totalPages);
      renderTable(paginate(lastFiltered));
      renderPagination(totalPages);
      // scroll hacia la tabla para mejor UX
      table.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function paginate(rows) {
      const start = (currentPage - 1) * PAGE_SIZE;
      return rows.slice(start, start + PAGE_SIZE);
    }

    // ===== Filtrar + Ordenar + Paginar =====
    function applyFilters() {
      const nafVal = nafFilter.value.trim();
      const coachVal = coachFilter.value.trim().toLowerCase();
      const ccaaVal = ccaaFilter.value;

      const filtered = baseData.filter((row) => {
        if (nafVal && !row.nafNr.includes(nafVal)) return false;
        if (coachVal && !row.coach.toLowerCase().includes(coachVal)) return false;
        if (ccaaVal !== "all" && row.ccaa !== ccaaVal) return false;
        return true;
      });

      if (sortState.key) {
        sortByKey(filtered, sortState.key, sortState.dir);
      } else {
        filtered.sort(compareRows);
      }

      lastFiltered = filtered;
      const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
      currentPage = Math.min(currentPage, totalPages) || 1;

      renderTable(paginate(lastFiltered));
      renderPagination(totalPages);
    }

    nafFilter.addEventListener("input", () => { currentPage = 1; applyFilters(); });
    coachFilter.addEventListener("input", () => { currentPage = 1; applyFilters(); });
    ccaaFilter.addEventListener("change", () => { currentPage = 1; applyFilters(); });

    // ===== Render tabla =====
    function renderTable(rows) {
      tableBody.innerHTML = "";
      if (!rows.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 15;
        td.className = "text-center text-muted";
        td.textContent = "Sin resultados";
        tr.appendChild(td);
        tableBody.appendChild(tr);
        return;
      }
      rows.forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.nafNr}</td>
          <td>${row.coach}</td>
          <td>${row.ccaa}</td>
          <td>${row.victoryStreak}</td>
          <td>${row.bestVictoryStreak}</td>
          <td>${row.noLostStreak}</td>
          <td>${row.bestNoLostStreak}</td>
          <td>${row.lostStreak}</td>
          <td>${row.worstLostStreak}</td>
          <td>${row.oneTdStreak}</td>
          <td>${row.bestOneTdStreak}</td>
          <td>${row.twoTdStreak}</td>
          <td>${row.bestTwoTdStreak}</td>
          <td>${row.noTdAgainstStreak}</td>
          <td>${row.bestNoTdAgainstStreak}</td>
        `;
        tableBody.appendChild(tr);
      });
    }

    // Primer render
    applyFilters();
    updateButtonsUI();
  });
})();

