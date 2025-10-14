// tableEsProplayers.js (NAF España • CCAA)
// - Muestra CCAA (no país) y filtra por CCAA (select #ccaaFilter)
// - Restringe los datos a Country = "Spain"
// - Calcula % vs proplayers = (pp + top + mega) / total * 100
// - Ordenación por botones (definidos en el HTML): games, pctVsPro, ppGames, wrPro, topGames, wrTop, megaGames, wrMega
// - Paginación: 25 por página
// - Filtros: NAF#, Entrenador, CCAA, % vs proplayers (usando wrMinFilter / wrMaxFilter), Partidos totales

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const ONLY_COUNTRY = "Spain";

  // Data requeridos
  if (typeof proplayers === "undefined") {
    console.error("proplayers no está definido. Carga src/naf/proplayers.js antes de este script.");
    return;
  }
  const hasGeneral = typeof generalAll !== "undefined";

  const table = document.getElementById("nafTable");
  const tableBody = table?.querySelector("tbody");
  if (!table || !tableBody) {
    console.error("No se encontró la tabla #nafTable o su <tbody>.");
    return;
  }

  // Map general_all por NAF# para total de partidos
  const generalByNaf = hasGeneral
    ? (() => {
        const m = new Map();
        (generalAll || []).forEach((g) => {
          const key = String(g["NAF Nr"] ?? g.nafNr ?? "");
          m.set(key, {
            totalGames: Number(g.totalGames || 0),
            country: g["Country"] || g.country || "",
            coach: g["NAF Name"] || g.coach || "",
          });
        });
        return m;
      })()
    : new Map();

  // Normalización desde proplayers.js
  const baseData = (proplayers || []).map((p) => {
    const nafNr  = String(p["NAF Nr"] || "");
    const coach  = p["NAF Name"] || "";
    const country = p["Country"] || "";
    const ccaa   = p["CCAA"] || "";

    const pp   = (p.proplayers && p.proplayers[0]) || {};
    const top  = (p.topProplayers && p.topProplayers[0]) || {};
    const mega = (p.megaProplayers && p.megaProplayers[0]) || {};

    const ppGames   = Number(pp.totalGames   || 0);
    const ppWins    = Number(pp.totalWins    || 0);
    const ppDraws   = Number(pp.totalDraws   || 0);
    const ppLosses  = Number(pp.totalLosses  || 0);
    const wrPro     = Number(pp.totalWinRatio || 0);

    const topGames  = Number(top.totalGames  || 0);
    const topWins   = Number(top.totalWins   || 0);
    const topDraws  = Number(top.totalDraws  || 0);
    const topLosses = Number(top.totalLosses || 0);
    const wrTop     = Number(top.totalWinRatio || 0);

    const megaGames  = Number(mega.totalGames  || 0);
    const megaWins   = Number(mega.totalWins   || 0);
    const megaDraws  = Number(mega.totalDraws  || 0);
    const megaLosses = Number(mega.totalLosses || 0);
    const wrMega     = Number(mega.totalWinRatio || 0);

    const g = generalByNaf.get(nafNr);
    const totalGames = g ? Number(g.totalGames || 0) : 0;

    // % partidos vs proplayers = (pp + top + mega) / total
    const vsProCombined = ppGames + topGames + megaGames;
    const pctVsPro = totalGames > 0 ? (vsProCombined / totalGames) * 100 : 0;

    return {
      nafNr,
      coach,
      country,
      ccaa,
      games: totalGames,

      pctVsPro,

      // Proplayers
      ppGames,
      ppWins,
      ppDraws,
      ppLosses,
      wrPro,

      // Top Proplayers
      topGames,
      topWins,
      topDraws,
      topLosses,
      wrTop,

      // Mega Proplayers
      megaGames,
      megaWins,
      megaDraws,
      megaLosses,
      wrMega,
    };
  });

  // Mantener SOLO Country = Spain
  const data = baseData.filter((row) => row.country === ONLY_COUNTRY);

  // ===== Filtros =====
  const nafFilter     = document.getElementById("nafFilter");
  const coachFilter   = document.getElementById("coachFilter");
  const ccaaFilter    = document.getElementById("ccaaFilter"); // <- NUEVO (sustituye a countryFilter)
  const wrMinFilter   = document.getElementById("wrMinFilter");
  const wrMaxFilter   = document.getElementById("wrMaxFilter");
  const gamesMinFilter = document.getElementById("gamesMinFilter");
  const gamesMaxFilter = document.getElementById("gamesMaxFilter");

  function populateCCAAOptions() {
    if (!ccaaFilter) return;
    const list = Array.from(new Set(data.map((x) => x.ccaa))).filter(Boolean).sort((a, b) => a.localeCompare(b));
    ccaaFilter.innerHTML =
      '<option value="all" data-i18n="All">Todas / All</option>' +
      list.map((c) => `<option value="${c}">${c}</option>`).join("");
  }
  function populatePctVsProOptions() {
    if (!wrMinFilter || !wrMaxFilter) return;
    let opts = '<option value="">Todos / All</option>';
    for (let i = 0; i <= 100; i += 10) opts += `<option value="${i}">${i}</option>`;
    wrMinFilter.innerHTML = opts;
    wrMaxFilter.innerHTML = opts;
  }
  function populateGamesOptions() {
    if (!gamesMinFilter || !gamesMaxFilter) return;
    let opts = '<option value="">Todos / All</option>';
    for (let i = 0; i < 100; i += 10) opts += `<option value="${i}">${i}</option>`;
    for (let j = 100; j < 1000; j += 100) opts += `<option value="${j}">${j}</option>`;
    opts += `<option value="1000+">1000+</option>`;
    gamesMinFilter.innerHTML = opts;
    gamesMaxFilter.innerHTML = opts;
  }

  populateCCAAOptions();
  populatePctVsProOptions();
  populateGamesOptions();

  // ===== Ordenación por botones del HTML =====
  const sortBar = document.getElementById("sortButtons");
  const validSortKeys = new Set([
    "games", "pctVsPro",
    "ppGames", "wrPro",
    "topGames", "wrTop",
    "megaGames", "wrMega",
  ]);
  let sortState = { key: "games", dir: "desc" }; // por defecto: Partidos totales

  function setSort(key) {
    if (!validSortKeys.has(key)) return;
    if (sortState.key === key) {
      sortState.dir = sortState.dir === "desc" ? "asc" : "desc";
    } else {
      sortState.key = key;
      sortState.dir = "desc";
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
    rows.sort((a, b) => {
      const av = Number(a[key]) || 0;
      const bv = Number(b[key]) || 0;
      if (av === bv) return a.coach.localeCompare(b.coach);
      return dir === "asc" ? av - bv : bv - av;
    });
  }

  // ===== Paginación =====
  const PAGE_SIZE = 25;
  let currentPage = 1;
  let lastFiltered = [];

  function ensurePaginationContainer() {
    let container = document.getElementById("pagination");
    if (container) return container;
    const parent = table.parentElement || table;
    container = document.createElement("nav");
    container.id = "pagination";
    container.className = "mt-3";
    parent.appendChild(container);
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
      if (!disabled && !active) a.addEventListener("click", (e) => { e.preventDefault(); gotoPage(page); });
      li.appendChild(a);
      return li;
    }

    ul.appendChild(makeItem("«", 1, currentPage === 1));
    ul.appendChild(makeItem("‹", Math.max(1, currentPage - 1), currentPage === 1));
    for (let p = 1; p <= totalPages; p++) ul.appendChild(makeItem(String(p), p, false, p === currentPage));
    ul.appendChild(makeItem("›", Math.min(totalPages, currentPage + 1), currentPage === totalPages));
    ul.appendChild(makeItem("»", totalPages, currentPage === totalPages));

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
    const nafVal   = nafFilter?.value.trim() ?? "";
    const coachVal = (coachFilter?.value.trim() ?? "").toLowerCase();
    const ccaaVal  = ccaaFilter?.value ?? "all";

    // Rango % vs proplayers
    const pctMin = wrMinFilter && wrMinFilter.value !== "" ? parseFloat(wrMinFilter.value) : -Infinity;
    const pctMax = wrMaxFilter && wrMaxFilter.value !== "" ? parseFloat(wrMaxFilter.value) : Infinity;

    // Rango de Partidos totales
    let gamesMin = -Infinity, gamesMax = Infinity;
    const gvMin = gamesMinFilter?.value ?? "";
    const gvMax = gamesMaxFilter?.value ?? "";
    if (gvMin) gamesMin = gvMin.endsWith("+") ? parseInt(gvMin, 10) : parseInt(gvMin, 10);
    if (gvMax) gamesMax = gvMax.endsWith("+") ? Infinity : parseInt(gvMax, 10);

    const filtered = data.filter((row) => {
      if (nafVal && !String(row.nafNr).includes(nafVal)) return false;
      if (coachVal && !row.coach.toLowerCase().includes(coachVal)) return false;
      if (ccaaVal !== "all" && row.ccaa !== ccaaVal) return false; // <- filtro por CCAA

      if (row.pctVsPro < pctMin || row.pctVsPro > pctMax) return false;
      if (row.games < gamesMin || row.games > gamesMax) return false;
      return true;
    });

    sortByKey(filtered, sortState.key, sortState.dir);

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
      td.colSpan = 14;
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
        <td class="country-column">${row.ccaa || ""}</td>
        <td class="country-column">${row.games}</td>
        <td class="country-column">${row.pctVsPro.toFixed(2)}%</td>

        <td>${row.ppGames}</td>
        <td>${row.ppWins}/${row.ppDraws}/${row.ppLosses}</td>
        <td>${row.wrPro.toFixed(2)}%</td>

        <td>${row.topGames}</td>
        <td>${row.topWins}/${row.topDraws}/${row.topLosses}</td>
        <td>${row.wrTop.toFixed(2)}%</td>

        <td>${row.megaGames}</td>
        <td>${row.megaWins}/${row.megaDraws}/${row.megaLosses}</td>
        <td>${row.wrMega.toFixed(2)}%</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // Eventos de filtros
  nafFilter?.addEventListener("input", () => { currentPage = 1; applyFilters(); });
  coachFilter?.addEventListener("input", () => { currentPage = 1; applyFilters(); });
  ccaaFilter?.addEventListener("change", () => { currentPage = 1; applyFilters(); });
  [wrMinFilter, wrMaxFilter, gamesMinFilter, gamesMaxFilter].forEach((el) =>
    el?.addEventListener("change", () => { currentPage = 1; applyFilters(); })
  );

  // Render inicial
  applyFilters();
  updateButtonsUI();
});
