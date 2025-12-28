// exportTable_AnualGlobal.js (NAF Mundial - Anual)
// AÃ±adido: OrdenaciÃ³n por botones (estilo Streaks) + PaginaciÃ³n (25 por pÃ¡gina)
//
// Carga los statsYearYYYY.js desde "src/naf", filtra games>0,
// filtros: NAF, entrenador, aÃ±o, paÃ­s, WR, Partidos,
// calcula rankYear (global por aÃ±o) y rankCountry (por paÃ­s dentro del aÃ±o),
// y ahora permite ordenar por columnas + paginar.

const START_YEAR = 2008;

document.addEventListener("DOMContentLoaded", () => {
  const table = document.getElementById("nafTable");
  const tableBody = document.querySelector("#nafTable tbody");
  const nafFilter = document.getElementById("nafFilter");
  const coachFilter = document.getElementById("coachFilter");
  const yearFilter = document.getElementById("yearFilter");
  const countryFilter = document.getElementById("countryFilter");
  const wrMinFilter = document.getElementById("wrMinFilter");
  const wrMaxFilter = document.getElementById("wrMaxFilter");
  const gamesMinFilter = document.getElementById("gamesMinFilter");
  const gamesMaxFilter = document.getElementById("gamesMaxFilter");

  // ===== OrdenaciÃ³n por botones =====
  const sortBar = document.getElementById("sortButtons");
  const validSortKeys = new Set(["rankYear", "rankCountry", "tournaments", "games", "winRatio", "rating"]);
  let sortState = { key: null, dir: "desc" }; // sin botÃ³n => rankYear asc

  function setSort(key) {
    if (!validSortKeys.has(key)) return;
    if (sortState.key === key) {
      sortState.dir = sortState.dir === "desc" ? "asc" : "desc";
    } else {
      sortState.key = key;
      sortState.dir = "desc"; // primera pulsaciÃ³n descendente
    }
    currentPage = 1;
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
      const base = btn.dataset.label || btn.textContent.replace(/\s*[â–²â–¼]$/, "");
      btn.dataset.label = base;
      btn.textContent = isActive ? `${base} ${sortState.dir === "desc" ? "â–¼" : "â–²"}` : base;
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
    rows.sort((a, b) => {
      const av = Number(a[key]) || 0;
      const bv = Number(b[key]) || 0;
      if (av === bv) return a.coach.localeCompare(b.coach);
      return dir === "asc" ? av - bv : bv - av;
    });
  }

  // ===== PaginaciÃ³n =====
  const PAGE_SIZE = 25;
  let currentPage = 1;
  let lastFiltered = [];

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
        a.addEventListener("click", (e) => { e.preventDefault(); gotoPage(page); });
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

  function gotoPage(p) {
    const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, p), totalPages);
    renderTable(paginate(lastFiltered));
    renderPagination(totalPages);
    table.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function paginate(rows) {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }

  // ===== AÃ±os =====
  const currentYear = new Date().getFullYear();
  const availableYears = [];
  for (let y = START_YEAR; y <= currentYear; y++) {
    availableYears.push(y.toString());
  }
  availableYears.sort((a, b) => b - a);

  // Poblar selector de aÃ±o
  yearFilter.innerHTML = availableYears.map((y) => `<option value="${y}">${y}</option>`).join("");

  const yearData = {};
  let loadCount = 0;
  let allRows = [];

  function getStatsForYear(year) {
    const varName = `statsYear${year}`;
    try {
      return eval(varName) || [];
    } catch {
      return [];
    }
  }

  // Carga dinÃ¡mica de scripts de datos por aÃ±o (o reutiliza si ya estÃ¡n en el HTML)
  availableYears.forEach((year) => {
    const srcPath = `src/naf/statsYear${year}.js`;
    const existingScript = Array.from(document.getElementsByTagName("script")).find(
      (s) => s.src && s.src.endsWith(`statsYear${year}.js`)
    );

    if (existingScript) {
      yearData[year] = getStatsForYear(year);
      loadCount++;
      if (loadCount === availableYears.length) initializeTable();
    } else {
      const script = document.createElement("script");
      script.src = srcPath;
      script.async = false;
      script.onload = () => {
        yearData[year] = getStatsForYear(year);
        loadCount++;
        if (loadCount === availableYears.length) initializeTable();
      };
      script.onerror = () => {
        yearData[year] = [];
        loadCount++;
        if (loadCount === availableYears.length) initializeTable();
      };
      document.head.appendChild(script);
    }
  });

  function initializeTable() {
    allRows = [];

    // Unificar filas de todos los aÃ±os
    Object.entries(yearData).forEach(([year, data]) => {
      data.forEach((item) => {
        const games = item.gamesTotal || 0;
        if (games <= 0) return;
        allRows.push({
          nafNr: item["NAF Nr"] || "",
          coach: item["NAF Name"] || "",
          country: item.Country || "",
          year,
          tournaments: item.tournaments || 0,
          games,
          wins: item.gamesWon || 0,
          draws: item.gamesDraw || 0,
          losses: item.gamesLost || 0,
          winRatio: item.winRatio || 0,
          rating: item.rating || 0,
        });
      });
    });

    // Ranking por aÃ±o
    const byYear = allRows.reduce((acc, row) => {
      (acc[row.year] = acc[row.year] || []).push(row);
      return acc;
    }, {});
    Object.values(byYear).forEach((group) => {
      group.sort((a, b) => b.rating - a.rating);
      group.forEach((row, idx) => {
        row.rankYear = idx + 1;
      });
    });

    // Ranking por PaÃ­s dentro del aÃ±o
    const byYearCountry = {};
    allRows.forEach((row) => {
      const key = `${row.year}|${row.country}`;
      (byYearCountry[key] = byYearCountry[key] || []).push(row);
    });
    Object.values(byYearCountry).forEach((group) => {
      group.sort((a, b) => b.rating - a.rating);
      group.forEach((row, idx) => {
        row.rankCountry = idx + 1;
      });
    });

    // PoblaciÃ³n de filtros
    populateCountry();
    populateWinRatio();
    populateGames();

    // Listeners (resetean a pÃ¡gina 1)
    [nafFilter, coachFilter].forEach((el) => el.addEventListener("input", () => { currentPage = 1; applyFilters(); }));
    [yearFilter, countryFilter, wrMinFilter, wrMaxFilter, gamesMinFilter, gamesMaxFilter]
      .forEach((el) => el.addEventListener("change", () => { currentPage = 1; applyFilters(); }));

    // Render inicial
    applyFilters();
    updateButtonsUI();
  }

  function populateCountry() {
    const list = Array.from(new Set(allRows.map((r) => r.country))).filter(Boolean).sort();
    countryFilter.innerHTML =
      '<option value="all" data-i18n="todos">Todos</option>' +
      list.map((c) => `<option value="${c}">${c}</option>`).join("");
  }

  function populateWinRatio() {
    let opts = '<option value="" data-i18n="todos">Todos</option>';
    for (let i = 0; i <= 100; i += 10) opts += `<option value="${i}">${i}</option>`;
    wrMinFilter.innerHTML = opts;
    wrMaxFilter.innerHTML = opts;
  }

  function populateGames() {
    let opts = '<option value="" data-i18n="todos">Todos</option>';
    for (let i = 0; i < 100; i += 10) opts += `<option value="${i}">${i}</option>`;
    for (let j = 100; j < 1000; j += 100) opts += `<option value="${j}">${j}</option>`;
    opts += '<option value="1000+">1000+</option>';
    gamesMinFilter.innerHTML = opts;
    gamesMaxFilter.innerHTML = opts;
  }

  function applyFilters() {
    const nafVal = nafFilter.value.trim();
    const coachVal = coachFilter.value.trim().toLowerCase();
    const yearVal = yearFilter.value;
    const countryVal = countryFilter.value;
    const wrMin = wrMinFilter.value ? parseFloat(wrMinFilter.value) : -Infinity;
    const wrMax = wrMaxFilter.value ? parseFloat(wrMaxFilter.value) : Infinity;

    let gamesMin = -Infinity, gamesMax = Infinity;
    if (gamesMinFilter.value)
      gamesMin = gamesMinFilter.value.endsWith("+") ? parseInt(gamesMinFilter.value, 10) : parseInt(gamesMinFilter.value, 10);
    if (gamesMaxFilter.value)
      gamesMax = gamesMaxFilter.value.endsWith("+") ? Infinity : parseInt(gamesMaxFilter.value, 10);

    const filtered = allRows.filter((r) => {
      if (nafVal && !String(r.nafNr).includes(nafVal)) return false;
      if (coachVal && !r.coach.toLowerCase().includes(coachVal)) return false;
      if (r.year !== yearVal) return false;
      if (countryVal !== "all" && r.country !== countryVal) return false;
      if (r.winRatio < wrMin || r.winRatio > wrMax) return false;
      if (r.games < gamesMin || r.games > gamesMax) return false;
      return true;
    });

    // OrdenaciÃ³n
    if (sortState.key) {
      sortByKey(filtered, sortState.key, sortState.dir);
    } else {
      filtered.sort((a, b) => a.rankYear - b.rankYear); // por defecto: posiciÃ³n general asc
    }

    // PaginaciÃ³n
    lastFiltered = filtered;
    const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
    currentPage = Math.min(currentPage || 1, totalPages);

    renderTable(paginate(lastFiltered));
    renderPagination(totalPages);
  }

  function renderTable(rows) {
    tableBody.innerHTML = "";
    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      td.className = "text-center text-muted";
      td.textContent = "Sin resultados";
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.rankYear}</td>
        <td>${r.nafNr}</td>
        <td>${r.coach}</td>
        <td>${r.country} (${r.rankCountry})</td>
        <td class="hide-lg">${r.tournaments}</td>
        <td class="hide-lg">${r.games}</td>
        <td class="hide-md">${r.wins}/${r.draws}/${r.losses}</td>
        <td class="hide-md">${r.winRatio}%</td>
        <td>${Number(r.rating).toFixed(2)}</td>
      `;
      tableBody.appendChild(tr);
    });
  }
});


