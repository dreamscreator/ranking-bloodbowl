// exportTable_Naf_HistoricoRazas_Mundial.js
// Carga datos de razas desde archivos individuales statsRace<Race>.js
// Excluye partidas 0, aplica filtros de Country, Raza, NAF, Entrenador, WR y Partidos,
// asigna ranking general y por Country, renderiza tabla dinámicamente al cambiar la raza seleccionada.

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.querySelector("#nafTable tbody");
  const countryFilter = document.getElementById("countryFilter");
  const raceFilter = document.getElementById("raceFilter");
  const wrMinFilter = document.getElementById("wrMinFilter");
  const wrMaxFilter = document.getElementById("wrMaxFilter");
  const gamesMinFilter = document.getElementById("gamesMinFilter");
  const gamesMaxFilter = document.getElementById("gamesMaxFilter");
  const nafFilter = document.getElementById("nafFilter");
  const coachFilter = document.getElementById("coachFilter");

  let currentData = [];

  // Lista de razas disponibles (debe coincidir con los archivos en naf/)
  const races = [
    "Amazon", "Black Orc", "Bretonnian", "Chaos Chosen", "Chaos Dwarf", "Chaos Renegade", "Dark Elf",
    "Dwarf", "Elf Union", "Gnome", "Goblin", "Halfling", "High Elf", "Human", "Imperial Nobility", "Khorne",
    "Lizardmen", "Necromantic Horror", "Norse", "Nurgle", "Ogre", "Old World Alliance",
    "Orc", "Shambling Undead", "Skaven", "Slann", "Snotling", "Tomb Kings", "Underworld Denizens",
    "Vampire", "Wood Elf"
  ];

  // Rellenar el filtro de razas
  function populateRaceFilter() {
    raceFilter.innerHTML = ['<option value="all">Todas</option>']
      .concat(races.map(r => `<option value="${r}">${r}</option>`))
      .join('');
  }

  // Rellenar el filtro de países según los datos cargados
  function populateCountryFilter(data) {
    const countries = Array.from(new Set(data.map(r => r.Country))).sort();
    countryFilter.innerHTML = '<option value="all">Todos</option>' +
      countries.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  // Rellenar los filtros de WR y Partidos
  function populateOtherFilters() {
    // WR
    let opts = '<option value="">Todos</option>';
    for (let i = 0; i <= 100; i += 10) {
      opts += `<option value="${i}">${i}</option>`;
    }
    wrMinFilter.innerHTML = wrMaxFilter.innerHTML = opts;
    // Partidos
    let gopts = '<option value="">Todos</option>';
    for (let i = 0; i < 100; i += 10) gopts += `<option value="${i}">${i}</option>`;
    for (let j = 100; j < 1000; j += 100) gopts += `<option value="${j}">${j}</option>`;
    gopts += '<option value="1000+">1000+</option>';
    gamesMinFilter.innerHTML = gamesMaxFilter.innerHTML = gopts;
  }

  // Cargar datos de la raza seleccionada desde el archivo correspondiente usando <script>
  function loadRaceData(raceName, callback) {
    if (raceName === "all") {
      currentData = [];
      tableBody.innerHTML = '';
      countryFilter.innerHTML = '<option value="all">Todos</option>';
      callback();
      return;
    }
    const safeRace = raceName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const scriptId = 'raceScriptLoader';
    // Elimina script anterior si existe
    const oldScript = document.getElementById(scriptId);
    if (oldScript) oldScript.remove();

    // Elimina la variable global anterior si existe
    try { delete window[`statsRace${safeRace}`]; } catch(e) {}

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `src/naf/statsRace${safeRace}.js`;
    script.onload = function() {
      const data = window[`statsRace${safeRace}`];
      currentData = Array.isArray(data) ? data.filter(r => r.gamesTotal > 0) : [];
      currentData.sort((a, b) => b.rating - a.rating);
      currentData.forEach((row, idx) => row.raceRank = idx + 1);
      populateCountryFilter(currentData);
      callback();
    };
    script.onerror = function() {
      console.error(`No se pudo cargar datos de raza: ${raceName}`);
      currentData = [];
      countryFilter.innerHTML = '<option value="all">Todos</option>';
      callback();
    };
    document.body.appendChild(script);
  }

  // Aplicar filtros y renderizar la tabla
  function applyFilters() {
    let filtered = currentData.slice();
    const ct = countryFilter.value;
    const nq = nafFilter.value.trim();
    const cq = coachFilter.value.trim().toLowerCase();
    const wrMin = wrMinFilter.value ? parseFloat(wrMinFilter.value) : -Infinity;
    const wrMax = wrMaxFilter.value ? parseFloat(wrMaxFilter.value) : Infinity;
    let gmMin = -Infinity, gmMax = Infinity;
    if (gamesMinFilter.value)
      gmMin = gamesMinFilter.value.endsWith('+')
        ? parseInt(gamesMinFilter.value)
        : parseInt(gamesMinFilter.value);
    if (gamesMaxFilter.value)
      gmMax = gamesMaxFilter.value.endsWith('+')
        ? Infinity
        : parseInt(gamesMaxFilter.value);

    filtered = filtered.filter(r => {
      if (ct !== 'all' && r.Country !== ct) return false;
      if (nq && !r['NAF Nr'].includes(nq)) return false;
      if (cq && !r['NAF Name'].toLowerCase().includes(cq)) return false;
      if (r.winRatio < wrMin || r.winRatio > wrMax) return false;
      if (r.gamesTotal < gmMin || r.gamesTotal > gmMax) return false;
      return true;
    });

    // Ranking por Country dentro de la raza seleccionada
    const byCountry = filtered.reduce((acc, row) => {
      (acc[row.Country] = acc[row.Country] || []).push(row);
      return acc;
    }, {});
    Object.values(byCountry).forEach(group => {
      group.sort((a, b) => b.rating - a.rating);
      group.forEach((row, i) => row.countryRank = i + 1);
    });

    // Renderizar tabla
    tableBody.innerHTML = '';
    filtered.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.raceRank}</td>
        <td>${r['NAF Nr']}</td>
        <td>${r['NAF Name']}</td>
        <td>${r.Country} (${r.countryRank || '-'})</td>
        <td>${r.race}</td>
        <td>${r.totalTournaments}</td>
        <td>${r.gamesTotal}</td>
        <td>${r.gamesWon}/${r.gamesDraw}/${r.gamesLost}</td>
        <td>${r.winRatio}%</td>
        <td>${parseFloat(r.rating).toFixed(2)}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // Inicializar filtros y eventos
  function initializeFilters() {
    populateRaceFilter();
    populateOtherFilters();
    countryFilter.innerHTML = '<option value="all">Todos</option>';

    [countryFilter, raceFilter, wrMinFilter, wrMaxFilter, gamesMinFilter, gamesMaxFilter]
      .forEach(el => el.addEventListener('change', applyFilters));
    [nafFilter, coachFilter].forEach(el => el.addEventListener('input', applyFilters));
  }

  // Al cambiar raza, cargar datos y actualizar tabla
  raceFilter.addEventListener('change', () => {
    const race = raceFilter.value;
    loadRaceData(race, applyFilters);
  });

  // Inicialización
  initializeFilters();
  // Cargar la raza seleccionada por defecto (si no es "all")
  if (raceFilter.value !== "all") {
    loadRaceData(raceFilter.value, applyFilters);
  }
});
