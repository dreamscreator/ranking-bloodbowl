// exportTable_nafHistoricoRazas.js
// Carga datos de estadísticas por raza y muestra la tabla con filtros, ordenamiento fijo por raza y ranking fijo por CCAA.

document.addEventListener('DOMContentLoaded', () => {
  const tableBody      = document.querySelector('#nafTable tbody');
  const ccaaFilter     = document.getElementById('ccaaFilter'); // Cambio: countryFilter -> ccaaFilter
  const raceFilter     = document.getElementById('raceFilter');
  const wrMinFilter    = document.getElementById('wrMinFilter');
  const wrMaxFilter    = document.getElementById('wrMaxFilter');
  const gamesMinFilter = document.getElementById('gamesMinFilter');
  const gamesMaxFilter = document.getElementById('gamesMaxFilter');
  const nafFilter      = document.getElementById('nafFilter');
  const coachFilter    = document.getElementById('coachFilter');

  // Lista de razas disponibles
  const raceList = ['Amazon', 'Black Orc', 'Bretonnian', 'Chaos Chosen', 'Chaos Dwarf', 'Chaos Renegade', 'Dark Elf', 'Dwarf', 'Elf Union', 'Gnome', 'Goblin', 'Halfling', 'High Elf', 'Human', 'Imperial Nobility', 'Khorne', 'Lizardmen', 'Necromantic Horror', 'Norse', 'Nurgle', 'Ogre', 'Old World Alliance', 'Orc', 'Shambling Undead', 'Skaven', 'Slann', 'Snotling', 'Tomb Kings', 'Underworld Denizens', 'Vampire', 'Wood Elf'];

  let currentData = [];
  let raceRows    = [];
  const raceDataCache = {};

  function getRaceVarName(raceName) {
    return `statsRace${raceName.replace(/\s+/g, '_')}`;
  }

  async function loadRaceData(raceName) {
    if (raceDataCache[raceName]) return raceDataCache[raceName];
    const varName = getRaceVarName(raceName);
    let rawData;
    if (typeof window[varName] !== 'undefined') {
      rawData = window[varName];
    } else {
      rawData = eval(varName);
    }
    if (!Array.isArray(rawData)) throw new Error(`${varName} no es un array.`);
    raceDataCache[raceName] = rawData;
    return rawData;
  }

  function processRaceData(data) {
    // data items include .race property
    return data
      .filter(item => item.gamesTotal > 0 && item.Country === 'Spain') // Filtrar solo entrenadores de España
      .map(item => ({
        race: item.race,
        naf: item['NAF Nr'],
        coach: item['NAF Name'],
        ccaa: item.CCAA, // Cambio: country -> ccaa
        tournaments: item.totalTournaments,
        games: item.gamesTotal,
        wdl: `${item.gamesWon}/${item.gamesDraw}/${item.gamesLost}`,
        wr: item.winRatio,
        rating: item.rating
      }));
  }

  function applyFiltersAndRender() {
    if (!raceRows.length) {
      tableBody.innerHTML = '<tr><td colspan="9">No hay datos que mostrar.</td></tr>';
      return;
    }

    const ccaaVal = ccaaFilter.value; // Cambio: countryVal -> ccaaVal
    const wrMin = parseFloat(wrMinFilter.value) || 0;
    const wrMax = parseFloat(wrMaxFilter.value) || 100;
    const gmMin = parseInt(gamesMinFilter.value) || 0;
    const gmMaxVal = gamesMaxFilter.value;
    let gmMax;
    if (!gmMaxVal) gmMax = Infinity;
    else if (gmMaxVal.endsWith('+')) gmMax = Infinity;
    else gmMax = parseInt(gmMaxVal, 10) || 0;
    const nafText = nafFilter.value.toLowerCase();
    const coachText = coachFilter.value.toLowerCase();

    const filtered = raceRows.filter(r =>
      (!ccaaVal || r.ccaa === ccaaVal) && // Cambio: country -> ccaa
      r.wr >= wrMin && r.wr <= wrMax &&
      r.games >= gmMin && r.games <= gmMax &&
      (!nafText || r.naf.toLowerCase().includes(nafText)) &&
      (!coachText || r.coach.toLowerCase().includes(coachText))
    );

    tableBody.innerHTML = '';
    if (!filtered.length) {
      tableBody.innerHTML = '<tr><td colspan="9">No hay datos que mostrar.</td></tr>';
      return;
    }

    filtered.forEach(r => {
      const tr = document.createElement('tr');
      // Coach cell: include race only when 'Todas' selected
      const coachCell = (raceFilter.value === '') ? `${r.coach} (${r.race})` : r.coach;
      const values = [
        r.globalRank,
        r.naf,
        coachCell,
        `${r.ccaa} (${r.ccaaRank})`, // Cambio: country -> ccaa, countryRank -> ccaaRank
        r.tournaments,
        r.games,
        r.wdl,
        r.wr.toFixed(2),
        r.rating
      ];
      const classes = ['', '', '', '', 'hide-lg', 'hide-lg', 'hide-md', 'hide-md', ''];
      
      values.forEach((text, index) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (classes[index]) {
          td.className = classes[index];
        }
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });
  }

  async function handleRaceChange() {
    const selectedRace = raceFilter.value;
    tableBody.innerHTML = '<tr><td colspan="9">Cargando...</td></tr>';

    // Cargar datos con race property
    let rawDatas = [];
    const racesToLoad = selectedRace ? [selectedRace] : raceList;
    for (const r of racesToLoad) {
      const data = await loadRaceData(r);
      rawDatas = rawDatas.concat(data.map(item => ({ ...item, race: r })));
    }
    currentData = rawDatas;

    // Procesar, ordenar y asignar rankings
    raceRows = processRaceData(currentData);
    raceRows.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (b.wr !== a.wr) return b.wr - a.wr;
      return a.tournaments - b.tournaments;
    });
    const ccaaCounters = {}; // Cambio: countryCounters -> ccaaCounters
    raceRows.forEach((r, idx) => {
      r.globalRank = idx + 1;
      ccaaCounters[r.ccaa] = (ccaaCounters[r.ccaa] || 0) + 1; // Cambio: country -> ccaa
      r.ccaaRank = ccaaCounters[r.ccaa]; // Cambio: countryRank -> ccaaRank
    });

    // Rellenar filtros dinámicos
    const ccaas = Array.from(new Set(currentData.filter(i => i.Country === 'Spain').map(i => i.CCAA))).sort(); // Cambio: Country -> CCAA
    ccaaFilter.innerHTML = '<option value="">Todas</option>' +
      ccaas.map(c => `<option value="${c}">${c}</option>`).join('');

    const wrSteps = Array.from({ length: 11 }, (_, i) => i * 10);
    const wrOptions = wrSteps.map(n => `<option value="${n}">${n}</option>`).join('');
    wrMinFilter.innerHTML = '<option value="">Todos</option>' + wrOptions;
    wrMaxFilter.innerHTML = '<option value="">Todos</option>' + wrOptions;

    const gamesSteps = [...wrSteps, 200, 300, 400, 500, 600, 700, 800, 900];
    const gamesOptions = gamesSteps.map(n => `<option value="${n}">${n}</option>`).join('') +
                           '<option value="1000+">1000+</option>';
    gamesMinFilter.innerHTML = '<option value="">Todos</option>' + gamesOptions;
    gamesMaxFilter.innerHTML = '<option value="">Todos</option>' + gamesOptions;

    applyFiltersAndRender();
  }

  function initializeFilters() {
    raceFilter.innerHTML = '<option value="">Todas</option>' +
      raceList.map(r => `<option value="${r}">${r}</option>`).join('');
    ccaaFilter.innerHTML = '<option value="">Todas</option>'; // Cambio: countryFilter -> ccaaFilter
    wrMinFilter.innerHTML = '<option value="">Todos</option>';
    wrMaxFilter.innerHTML = '<option value="">Todos</option>';
    gamesMinFilter.innerHTML = '<option value="">Todos</option>';
    gamesMaxFilter.innerHTML = '<option value="">Todos</option>';
  }

  initializeFilters();
  raceFilter.addEventListener('change', handleRaceChange);
  [ccaaFilter, wrMinFilter, wrMaxFilter, gamesMinFilter, gamesMaxFilter, nafFilter, coachFilter] // Cambio: countryFilter -> ccaaFilter
    .forEach(el => el.addEventListener('change', applyFiltersAndRender));

  // Carga inicial mostrando todas las razas
  handleRaceChange();
});