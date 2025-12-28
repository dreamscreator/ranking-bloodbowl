// exportTable_nafHistoricoGlobal.js
// AÃ±adido: OrdenaciÃ³n por botones (estilo Streaks) + PaginaciÃ³n (25 por pÃ¡gina)
//
// Carga generalAll (general_all.js), excluye jugadores con 0 partidas,
// calcula rankOverall (global) y rankCountry (por paÃ­s),
// aplica filtros (NAF, entrenador, paÃ­s, WR, Partidos),
// y ahora permite ordenar por columnas + paginar.

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // Verificar que generalAll estÃ© cargado
  if (typeof generalAll === "undefined") {
    console.error("generalAll no estÃ¡ definido. AsegÃºrate de que general_all.js se cargue antes de este script.");
    return;
  }

  const table = document.getElementById("nafTable");
  const tableBody = table.querySelector("tbody");

  // Normalizar datos, solo partidas > 0
  const data = generalAll
    .map((item) => ({
      nafNr: item["NAF Nr"] || "",
      coach: item["NAF Name"] || "",
      country: item["Country"] || "",
      tournaments: Number(item.totalTournaments || 0),
      games: Number(item.totalGames || 0),
      wins: Number(item.totalWins || 0),
      draws: Number(item.totalDraws || 0),
      losses: Number(item.totalLosses || 0),
      winRatio: Number(item.totalWinRatio || 0),
      rating: Number(item.rating || 0),
    }))
    .filter((row) => row.games > 0);

  // Ranking general por rating â†“
  data.sort((a, b) => b.rating - a.rating);
  data.forEach((row, index) => { row.rankOverall = index + 1; });

  // Ranking por paÃ­s (dentro de cada paÃ­s por rating â†“)
  const groupedByCountry = data.reduce((acc, row) => {
    (acc[row.country] = acc[row.country] || []).push(row);
    return acc;
  }, {});
  Object.values(groupedByCountry).forEach((group) => {
    group.sort((a, b) => b.rating - a.rating);
    group.forEach((row, idx) => { row.rankCountry = idx + 1; });
  });

  // ===== Filtros =====
  const nafFilter = document.getElementById("nafFilter");
  const coachFilter = document.getElementById("coachFilter");
  const countryFilter = document.getElementById("countryFilter");
  const wrMinFilter = document.getElementById("wrMinFilter");
  const wrMaxFilter = document.getElementById("wrMaxFilter");
  const gamesMinFilter = document.getElementById("gamesMinFilter");
  const gamesMaxFilter = document.getElementById("gamesMaxFilter");

  function populateCountryOptions() {
    const countryList = Array.from(new Set(data.map((item) => item.country))).filter(Boolean).sort();
    countryFilter.innerHTML =
      '<option value="all" data-i18n="todos">Todos</option>' +
      countryList.map((c) => `<option value="${c}">${c}</option>`).join("");
  }
  function populateWinRatioOptions() {
    let opts = '<option value="" data-i18n="todos">Todos</option>';
    for (let i = 0; i <= 100; i += 10) opts += `<option value="${i}">${i}</option>`;
    wrMinFilter.innerHTML = opts;
    wrMaxFilter.innerHTML = opts;
  }
  function populateGamesOptions() {
    let opts = '<option value="" data-i18n="todos">Todos</option>';
    for (let i = 0; i < 100; i += 10) opts += `<option value="${i}">${i}</option>`;
    for (let j = 100; j < 1000; j += 100) opts += `<option value="${j}">${j}</option>`;
    opts += `<option value="1000+">1000+</option>`;
    gamesMinFilter.innerHTML = opts;
    gamesMaxFilter.innerHTML = opts;
  }

  populateCountryOptions();
  populateWinRatioOptions();
  populateGamesOptions();

  // ===== OrdenaciÃ³n por botones (como en Streaks) =====
  const sortBar = document.getElementById("sortButtons");
  const validSortKeys = new Set(["rankOverall", "rankCountry", "tournaments", "games", "winRatio", "rating"]);
  let sortState = { key: null, dir: "desc" }; // sin botÃ³n => rankOverall asc

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

  // ===== Filtrar + ordenar + paginar =====
  function applyFilters() {
    const nafVal = nafFilter.value.trim();
    const coachVal = coachFilter.value.trim().toLowerCase();
    const countryVal = countryFilter.value;

    const wrMin = wrMinFilter.value !== "" ? parseFloat(wrMinFilter.value) : -Infinity;
    const wrMax = wrMaxFilter.value !== "" ? parseFloat(wrMaxFilter.value) : Infinity;

    let gamesMin = -Infinity, gamesMax = Infinity;
    const gvMin = gamesMinFilter.value;
    const gvMax = gamesMaxFilter.value;
    if (gvMin) gamesMin = gvMin.endsWith("+") ? parseInt(gvMin, 10) : parseInt(gvMin, 10);
    if (gvMax) gamesMax = gvMax.endsWith("+") ? Infinity : parseInt(gvMax, 10);

    const filtered = data.filter((row) => {
      if (nafVal && !String(row.nafNr).includes(nafVal)) return false;
      if (coachVal && !row.coach.toLowerCase().includes(coachVal)) return false;
      if (countryVal !== "all" && row.country !== countryVal) return false;
      if (row.winRatio < wrMin || row.winRatio > wrMax) return false;
      if (row.games < gamesMin || row.games > gamesMax) return false;
      return true;
    });

    // OrdenaciÃ³n
    if (sortState.key) {
      sortByKey(filtered, sortState.key, sortState.dir);
    } else {
      filtered.sort((a, b) => a.rankOverall - b.rankOverall); // por defecto: posiciÃ³n general asc
    }

    // PaginaciÃ³n
    lastFiltered = filtered;
    const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
    currentPage = Math.min(currentPage || 1, totalPages);

    renderTable(paginate(lastFiltered));
    renderPagination(totalPages);
  }

  // ===== Render =====
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

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.rankOverall}</td>
        <td>${row.nafNr}</td>
        <td>${row.coach}</td>
        <td class="country-column">${row.country} (${row.rankCountry})</td>
        <td class="hide-lg">${row.tournaments}</td>
        <td class="hide-lg">${row.games}</td>
        <td class="hide-md">${row.wins}/${row.draws}/${row.losses}</td>
        <td class="hide-md">${row.winRatio}%</td>
        <td>${Number(row.rating).toFixed(2)}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // Eventos de filtros (resetean a pÃ¡gina 1)
  nafFilter.addEventListener("input", () => { currentPage = 1; applyFilters(); });
  coachFilter.addEventListener("input", () => { currentPage = 1; applyFilters(); });
  [countryFilter, wrMinFilter, wrMaxFilter, gamesMinFilter, gamesMaxFilter].forEach((el) =>
    el.addEventListener("change", () => { currentPage = 1; applyFilters(); })
  );

  // Render inicial
  applyFilters();
  updateButtonsUI();
});


