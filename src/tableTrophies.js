(function () {
  document.addEventListener("DOMContentLoaded", () => {
    function getArrayCandidate(fn) {
      try {
        const v = fn();
        return Array.isArray(v) ? v : null;
      } catch {
        return null;
      }
    }

    // Detecta `const generalAll = [...]`
    const source =
      getArrayCandidate(() => (typeof generalAll !== "undefined" ? generalAll : null)) ||
      getArrayCandidate(() => (typeof generalAllBbt !== "undefined" ? generalAllBbt : null)) ||
      getArrayCandidate(() => (typeof general_all !== "undefined" ? general_all : null)) ||
      getArrayCandidate(() => (typeof general_allBbt !== "undefined" ? general_allBbt : null)) ||
      getArrayCandidate(() => globalThis.generalAll) ||
      getArrayCandidate(() => globalThis.general_all);

    if (!source) {
      console.error(
        "No se encontrÃ³ el array de datos. AsegÃºrate de cargar antes src/naf/general_all.js (generalAll)."
      );
      return;
    }

    const PAGE_SIZE = 25;
    let currentPage = 1;
    let lastFiltered = [];

    const table = document.getElementById("nafTable");
    const tableBody = table.querySelector("tbody");

    const nafFilter = document.getElementById("nafFilter");
    const coachFilter = document.getElementById("coachFilter");
    const countryFilter = document.getElementById("countryFilter");
    const sortBar = document.getElementById("sortButtons");

    function toInt(v) {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : 0;
    }

    // âœ… Premios desde item.trophies.*
    const baseData = source.map((item) => {
      const trophies = item?.trophies || {};
      return {
        nafNr: item["NAF Nr"] ?? item.nafNr ?? item.naf ?? "",
        coach: item["NAF Name"] ?? item.coach ?? item.name ?? "",
        country: item["Country"] ?? item.country ?? "",

        winner: toInt(trophies.winner),
        runnerup: toInt(trophies.runnerup),
        touchdowns: toInt(trophies.touchdowns),
        casualties: toInt(trophies.casualties),
        stuntycup: toInt(trophies.stuntycup),
        bestpainted: toInt(trophies.bestpainted),
        otherawards: toInt(trophies.otherawards),
        organized: toInt(item.Organizador ?? item.organizer ?? item.organizador),
      };
    });

    // PaÃ­ses
    (function populateCountryOptions() {
      const countries = Array.from(new Set(baseData.map((d) => d.country)))
        .sort((a, b) => String(a).localeCompare(String(b)));

      countryFilter.innerHTML =
        '<option value="all" data-i18n="todos">Todos</option>' +
        countries.map((c) => `<option value="${String(c)}">${String(c) || "-"}</option>`).join("");
    })();

    // OrdenaciÃ³n
    const validSortKeys = new Set([
      "winner",
      "runnerup",
      "touchdowns",
      "casualties",
      "stuntycup",
      "bestpainted",
      "otherawards",
      "organized",
    ]);

    let sortState = { key: "winner", dir: "desc" };

    function updateButtonsUI() {
      if (!sortBar) return;
      const sortBtns = sortBar.querySelectorAll(".sort-btn");
      sortBtns.forEach((btn) => {
        const key = btn.dataset.key;
        const isActive = sortState.key === key;

        btn.classList.toggle("btn-primary", isActive);
        btn.classList.toggle("btn-outline-primary", !isActive);

        const base = btn.dataset.label || btn.textContent.replace(/\s*[â–²â–¼]$/, "");
        btn.dataset.label = base;
        btn.textContent = isActive ? `${base} ${sortState.dir === "desc" ? "â–¼" : "â–²"}` : base;
      });
    }

    function setSort(key) {
      if (!validSortKeys.has(key)) return;

      if (sortState.key === key) sortState.dir = sortState.dir === "desc" ? "asc" : "desc";
      else {
        sortState.key = key;
        sortState.dir = "desc";
      }

      currentPage = 1;
      applyFilters();
      updateButtonsUI();
    }

    sortBar?.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".sort-btn");
      if (!btn) return;
      setSort(btn.dataset.key);
    });

    function sortRows(rows) {
      const { key, dir } = sortState;
      rows.sort((a, b) => {
        const av = a[key] ?? 0;
        const bv = b[key] ?? 0;
        if (av === bv) return String(a.coach).localeCompare(String(b.coach));
        return dir === "asc" ? av - bv : bv - av;
      });
    }

    // PaginaciÃ³n
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

          let startP = Math.max(1, currentPage - 4);
    let endP = Math.min(totalPages, startP + 8);
    if (endP - startP < 8) {
        startP = Math.max(1, endP - 8);
    }

    for (let p = startP; p <= endP; p++) {
      ul.appendChild(makeItem(String(p), p, false, p === currentPage));
    }

      ul.appendChild(makeItem("\u203A", Math.min(totalPages, currentPage + 1), currentPage === totalPages));
      ul.appendChild(makeItem("\u00BB", totalPages, currentPage === totalPages));

      container.appendChild(ul);
    }

    function paginate(rows) {
      const start = (currentPage - 1) * PAGE_SIZE;
      return rows.slice(start, start + PAGE_SIZE);
    }

    function gotoPage(p) {
      const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
      currentPage = Math.min(Math.max(1, p), totalPages);
      renderTable(paginate(lastFiltered));
      renderPagination(totalPages);
      table.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Render
    function renderTable(rows) {
      tableBody.innerHTML = "";

      if (!rows.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 11; // 11 columnas con la nueva
        td.className = "text-center text-muted";
        td.textContent = "No results";
        tr.appendChild(td);
        tableBody.appendChild(tr);
        return;
      }

      rows.forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${r.nafNr}</td>
          <td>${r.coach}</td>
          <td class="country-column">${r.country || ""}</td>
          <td>${r.winner}</td>
          <td>${r.runnerup}</td>
          <td>${r.touchdowns}</td>
          <td>${r.casualties}</td>
          <td>${r.stuntycup}</td>
          <td>${r.bestpainted}</td>
          <td>${r.otherawards}</td>
          <td>${r.organized}</td>
        `;
        tableBody.appendChild(tr);
      });
    }

    function applyFilters() {
      const nafVal = nafFilter.value.trim();
      const coachVal = coachFilter.value.trim().toLowerCase();
      const countryVal = countryFilter.value;

      const filtered = baseData.filter((row) => {
        if (nafVal && !String(row.nafNr).includes(nafVal)) return false;
        if (coachVal && !String(row.coach).toLowerCase().includes(coachVal)) return false;
        if (countryVal !== "all" && String(row.country) !== String(countryVal)) return false;
        return true;
      });

      sortRows(filtered);

      lastFiltered = filtered;
      const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
      currentPage = Math.min(currentPage, totalPages) || 1;

      renderTable(paginate(lastFiltered));
      renderPagination(totalPages);
    }

    nafFilter.addEventListener("input", () => { currentPage = 1; applyFilters(); });
    coachFilter.addEventListener("input", () => { currentPage = 1; applyFilters(); });
    countryFilter.addEventListener("change", () => { currentPage = 1; applyFilters(); });

    applyFilters();
    updateButtonsUI();
  });
})();


