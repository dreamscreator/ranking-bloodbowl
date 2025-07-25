// exportTable_AnualGlobal.js
// Este script carga los datos de statsYearYYYY.js desde la carpeta "src/naf" para cada año,
// filtra solo partidas con juegos > 0,
// aplica filtros de NAF, entrenador, año, Country, WinRatio y Partidos,
// asigna posiciones fijas por año y renderiza la tabla anual.

// Rango de años: desde 2008 hasta el año actual
const START_YEAR = 2008;

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.querySelector("#nafTable tbody");
  const nafFilter = document.getElementById("nafFilter");
  const coachFilter = document.getElementById("coachFilter");
  const yearFilter = document.getElementById("yearFilter");
  const countryFilter = document.getElementById("countryFilter");
  const wrMinFilter = document.getElementById("wrMinFilter");
  const wrMaxFilter = document.getElementById("wrMaxFilter");
  const gamesMinFilter = document.getElementById("gamesMinFilter");
  const gamesMaxFilter = document.getElementById("gamesMaxFilter");

  // Generar lista de años dinámicamente
  const currentYear = new Date().getFullYear();
  const availableYears = [];
  for (let y = START_YEAR; y <= currentYear; y++) {
    availableYears.push(y.toString());
  }
  availableYears.sort((a, b) => b - a);

  // Poblar selector de año
  yearFilter.innerHTML = availableYears
    .map((y) => `<option value="${y}">${y}</option>`)
    .join("");

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

  // Carga dinámica de scripts de datos por año
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

    // Unificar filas de todos los años
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

    // Ranking por año
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

    // Ranking por Country dentro del año
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

    // Población de filtros
    populateCountry();
    populateWinRatio();
    populateGames();

    // Listeners de filtros
    [nafFilter, coachFilter].forEach((el) =>
      el.addEventListener("input", applyFilters)
    );
    [
      yearFilter,
      countryFilter,
      wrMinFilter,
      wrMaxFilter,
      gamesMinFilter,
      gamesMaxFilter,
    ].forEach((el) => el.addEventListener("change", applyFilters));

    // Renderizado inicial
    applyFilters();
  }

  function populateCountry() {
    const list = Array.from(new Set(allRows.map((r) => r.country))).sort();
    countryFilter.innerHTML =
      '<option value="all">Todos / All</option>' +
      list.map((c) => `<option value="${c}">${c}</option>`).join("");
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

  function applyFilters() {
    const nafVal = nafFilter.value.trim();
    const coachVal = coachFilter.value.trim().toLowerCase();
    const yearVal = yearFilter.value;
    const countryVal = countryFilter.value;
    const wrMin = wrMinFilter.value ? parseFloat(wrMinFilter.value) : -Infinity;
    const wrMax = wrMaxFilter.value ? parseFloat(wrMaxFilter.value) : Infinity;
    let gamesMin = -Infinity,
      gamesMax = Infinity;
    if (gamesMinFilter.value)
      gamesMin = gamesMinFilter.value.endsWith("+")
        ? parseInt(gamesMinFilter.value)
        : parseInt(gamesMinFilter.value);
    if (gamesMaxFilter.value)
      gamesMax = gamesMaxFilter.value.endsWith("+")
        ? Infinity
        : parseInt(gamesMaxFilter.value);

    const filtered = allRows.filter((r) => {
      if (nafVal && !r.nafNr.includes(nafVal)) return false;
      if (coachVal && !r.coach.toLowerCase().includes(coachVal)) return false;
      if (r.year !== yearVal) return false;
      if (countryVal !== "all" && r.country !== countryVal) return false;
      if (r.winRatio < wrMin || r.winRatio > wrMax) return false;
      if (r.games < gamesMin || r.games > gamesMax) return false;
      return true;
    });

    filtered.sort((a, b) => a.rankYear - b.rankYear);
    tableBody.innerHTML = "";
    filtered.forEach((r) => {
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
        <td>${r.rating.toFixed(2)}</td>
      `;
      tableBody.appendChild(tr);
    });
  }
});
