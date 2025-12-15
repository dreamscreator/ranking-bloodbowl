// tableEsAnual.js
// - Carga datos statsYearYYYY.js (NAF EspaÃ±a) y unifica filas por aÃ±o
// - Filtros: NAF, Entrenador, AÃ±o, CCAA, WinRatio, Partidos
// - Calcula rankYear (global por aÃ±o) y rankCcaa (por CCAA dentro del aÃ±o)
// - NUEVO: OrdenaciÃ³n por botones (rankYear, rankCcaa, tournaments, games, winRatio, rating)
// - NUEVO: PaginaciÃ³n de 25 filas por pÃ¡gina (Â«Â« â€¹ 1 2 3 â€¦ â€º Â»)

"use strict";

// Rango de aÃ±os: desde 2002 hasta el aÃ±o actual (para cubrir todos los <script> del HTML)
const START_YEAR = 2002;

document.addEventListener("DOMContentLoaded", () => {
  const table = document.getElementById("nafTable");
  const tableBody = document.querySelector("#nafTable tbody");

  // Filtros
  const nafFilter = document.getElementById("nafFilter");
  const coachFilter = document.getElementById("coachFilter");
  const yearFilter = document.getElementById("yearFilter");
  const ccaaFilter = document.getElementById("ccaaFilter");
  const wrMinFilter = document.getElementById("wrMinFilter");
  const wrMaxFilter = document.getElementById("wrMaxFilter");
  const gamesMinFilter = document.getElementById("gamesMinFilter");
  const gamesMaxFilter = document.getElementById("gamesMaxFilter");

  // ===== OrdenaciÃ³n por botones (estilo Streaks) =====
  const sortBar = document.getElementById("sortButtons");
  const validSortKeys = new Set(["rankYear", "rankCcaa", "tournaments", "games", "winRatio", "rating"]);
  let sortState = { key: null, dir: "desc" }; // sin botÃ³n => rankYear asc

  function setSort(key) {
    if (!validSortKeys.has(key)) return;
    if (sortState.key === key) {
      sortState.dir = sortState.dir === "desc" ? "asc" : "desc";
    } else {
      sortState.key = key;
      sortState.dir = "desc"; // primera pulsaciÃ³n descendente
    }
    currentPage = 1; // al cambiar orden, volvemos a la primera pÃ¡gina
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

  // ===== AÃ±os disponibles =====
  const currentYear = new Date().getFullYear();
  const availableYears = [];
  for (let y = START_YEAR; y <= currentYear; y++) availableYears.push(String(y));
  availableYears.sort((a, b) => Number(b) - Number(a));

  // Poblar selector de aÃ±o
  yearFilter.innerHTML = availableYears.map((y) => `<option value="${y}">${y}</option>`).join("");

  // ===== Carga de datos =====
  const yearData = {};
  let loadCount = 0;
  let allRows = [];

  // Recupera la variable global statsYearYYYY aunque estÃ© declarada con const
  function getStatsForYear(year) {
    const varName = `statsYear${year}`;
    try {
      return (0, eval)(varName) || [];
    } catch {
      return [];
    }
  }

  // Carga dinÃ¡mica o reutiliza scripts ya incluidos en el HTML
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
        console.warn(`No se pudo cargar ${srcPath}`);
        yearData[year] = [];
        loadCount++;
        if (loadCount === availableYears.length) initializeTable();
      };
      document.head.appendChild(script);
    }
  });

  function initializeTable() {
    allRows = [];

    // Unificar filas de todos los aÃ±os (solo EspaÃ±a si existe Country)
    Object.entries(yearData).forEach(([year, data]) => {
      data.forEach((item) => {
        if (item.Country && item.Country !== "Spain") return;
        const games = Number(item.gamesTotal || 0);
        if (games <= 0) return;

        allRows.push({
          nafNr: item["NAF Nr"] || "",
          coach: item["NAF Name"] || "",
          ccaa: item.CCAA || "",
          year,
          tournaments: Number(item.tournaments || 0),
          games,
          wins: Number(item.gamesWon || 0),
          draws: Number(item.gamesDraw || 0),
          losses: Number(item.gamesLost || 0),
          winRatio: Number(item.winRatio || 0), // porcentaje 0..100
          rating: Number(item.rating || 0),
        });
      });
    });

    // Ranking por aÃ±o (rankYear)
    const byYear = allRows.reduce((acc, row) => {
      (acc[row.year] = acc[row.year] || []).push(row);
      return acc;
    }, {});
    Object.values(byYear).forEach((group) => {
      group.sort((a, b) => b.rating - a.rating);
      group.forEach((row, idx) => (row.rankYear = idx + 1));
    });

    // Ranking por CCAA dentro del aÃ±o (rankCcaa)
    const byYearCcaa = {};
    allRows.forEach((row) => {
      const key = `${row.year}|${row.ccaa}`;
      (byYearCcaa[key] = byYearCcaa[key] || []).push(row);
    });
    Object.values(byYearCcaa).forEach((group) => {
      group.sort((a, b) => b.rating - a.rating);
      group.forEach((row, idx) => (row.rankCcaa = idx + 1));
    });

    // Poblar selects
    populateCcaa();
    populateWinRatio();
    populateGames();

    // Listeners (restringen a pÃ¡gina 1)
    [nafFilter, coachFilter].forEach((el) => el.addEventListener("input", () => { currentPage = 1; applyFilters(); }));
    [yearFilter, ccaaFilter, wrMinFilter, wrMaxFilter, gamesMinFilter, gamesMaxFilter]
      .forEach((el) => el.addEventListener("change", () => { currentPage = 1; applyFilters(); }));

    // Render inicial
    applyFilters();
    updateButtonsUI();
  }

  // ===== PoblaciÃ³n de selects =====
  function populateCcaa() {
    const list = Array.from(new Set(allRows.map((r) => r.ccaa))).filter(Boolean).sort();
    ccaaFilter.innerHTML =
      '<option value="all">Todas / All</option>' + list.map((c) => `<option value="${c}">${c}</option>`).join("");
  }
  function populateWinRatio() {
    let opts = '<option value="">Todos / All</option>';
    for (let i = 0; i <= 100; i += 10) opts += `<option value="${i}">${i}</option>`;
    wrMinFilter.innerHTML = opts;
    wrMaxFilter.innerHTML = opts;
  }
  function populateGames() {
    let opts = '<option value="">Todos / All</option>';
    for (let i = 0; i < 100; i += 10) opts += `<option value="${i}">${i}</option>`;
    for (let j = 100; j < 1000; j += 100) opts += `<option value="${j}">${j}</option>`;
    opts += '<option value="1000+">1000+</option>';
    gamesMinFilter.innerHTML = opts;
    gamesMaxFilter.innerHTML = opts;
  }

  // ===== Filtrado + ordenaciÃ³n + paginaciÃ³n =====
  function applyFilters() {
    const nafVal = nafFilter.value.trim();
    const coachVal = coachFilter.value.trim().toLowerCase();
    const yearVal = yearFilter.value;
    const ccaaVal = ccaaFilter.value;

    const wrMin = wrMinFilter.value ? parseFloat(wrMinFilter.value) : -Infinity;
    const wrMax = wrMaxFilter.value ? parseFloat(wrMaxFilter.value) : Infinity;

    let gamesMin = -Infinity, gamesMax = Infinity;
    if (gamesMinFilter.value) gamesMin = gamesMinFilter.value.endsWith("+") ? parseInt(gamesMinFilter.value) : parseInt(gamesMinFilter.value);
    if (gamesMaxFilter.value) gamesMax = gamesMaxFilter.value.endsWith("+") ? Infinity : parseInt(gamesMaxFilter.value);

    const filtered = allRows.filter((r) => {
      if (nafVal && !String(r.nafNr).includes(nafVal)) return false;
      if (coachVal && !r.coach.toLowerCase().includes(coachVal)) return false;
      if (r.year !== yearVal) return false;
      if (ccaaVal !== "all" && r.ccaa !== ccaaVal) return false;
      if (r.winRatio < wrMin || r.winRatio > wrMax) return false;
      if (r.games < gamesMin || r.games > gamesMax) return false;
      return true;
    });

    // OrdenaciÃ³n (si hay botÃ³n seleccionado); si no, por rankYear asc
    if (sortState.key) {
      sortByKey(filtered, sortState.key, sortState.dir);
    } else {
      filtered.sort((a, b) => a.rankYear - b.rankYear);
    }

    // PaginaciÃ³n
    lastFiltered = filtered;
    const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
    currentPage = Math.min(currentPage || 1, totalPages);

    renderTable(paginate(lastFiltered));
    renderPagination(totalPages);
  }

  // ===== Render tabla =====
  function renderTable(rows) {
    tableBody.innerHTML = "";
    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9; // columnas visibles
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
        <td>${r.ccaa} (${r.rankCcaa})</td>
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


