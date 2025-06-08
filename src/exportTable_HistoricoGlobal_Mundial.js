// exportTable_nafHistoricoGlobal.js
// Este script carga los datos de statsData definidos en statsData.js,
// excluye entrenadores con 0 partidas, ordena, asigna posiciones,
// renderiza la tabla y aplica filtros por NAF, entrenador, Country, WR y Partidos.

document.addEventListener('DOMContentLoaded', () => {
  // Verificar que statsData esté cargado
  if (typeof statsData === 'undefined') {
    console.error('statsData no está definido. Asegúrate de que statsData.js se cargue antes de este script.');
    return;
  }

  const tableBody       = document.querySelector('#nafTable tbody');

  // Mapear, normalizar y filtrar: excluye entrenadores con 0 partidas
  const data = statsData
    .map(item => ({
      nafNr:   item['NAF Nr']   || '',
      coach:   item['NAF Name'] || '',
      country: item['Country']  || '',
      tournaments: item.totalTournaments || 0,
      games:       item.totalGames       || 0,
      wins:        item.totalWins        || 0,
      draws:       item.totalDraws       || 0,
      losses:      item.totalLosses      || 0,
      winRatio:    item.totalWinRatio    || 0,
      rating:      item.rating           || 0
    }))
    .filter(row => row.games > 0); // Solo partidas > 0

  // Ordenar por rating descendente para ranking general
  data.sort((a, b) => b.rating - a.rating);

  // Asignar posición general
  data.forEach((row, index) => {
    row.rankOverall = index + 1;
  });

  // Agrupar por Country y asignar posición interna (rankCountry)
  const groupedByCountry = data.reduce((acc, row) => {
    (acc[row.country] = acc[row.country] || []).push(row);
    return acc;
  }, {});

  Object.values(groupedByCountry).forEach(group => {
    group.sort((a, b) => b.rating - a.rating);
    group.forEach((row, idx) => {
      row.rankCountry = idx + 1;
    });
  });

  // ======================
  // Configuración de filtros
  // ======================
  const nafFilter      = document.getElementById('nafFilter');
  const coachFilter    = document.getElementById('coachFilter');
  const countryFilter  = document.getElementById('countryFilter');
  const wrMinFilter    = document.getElementById('wrMinFilter');
  const wrMaxFilter    = document.getElementById('wrMaxFilter');
  const gamesMinFilter = document.getElementById('gamesMinFilter');
  const gamesMaxFilter = document.getElementById('gamesMaxFilter');

  // Poblar opciones de Country
  function populateCountryOptions() {
    const countryList = Array.from(new Set(data.map(item => item.country))).sort();
    countryFilter.innerHTML = '<option value="all">Todos</option>' +
      countryList.map(ctry => `<option value="${ctry}">${ctry}</option>`).join('');
  }

  // Poblar WinRatio en saltos de 10%
  function populateWinRatioOptions() {
    let opts = '<option value="">Todos</option>';
    for (let i = 0; i <= 100; i += 10) {
      opts += `<option value="${i}">${i}</option>`;
    }
    wrMinFilter.innerHTML = opts;
    wrMaxFilter.innerHTML = opts;
  }

  // Poblar Partidos: 0-90 en 10s, 100-900 en 100s, 1000+ para >=1000
  function populateGamesOptions() {
    let opts = '<option value="">Todos</option>';
    for (let i = 0; i < 100; i += 10) {
      opts += `<option value="${i}">${i}</option>`;
    }
    for (let j = 100; j < 1000; j += 100) {
      opts += `<option value="${j}">${j}</option>`;
    }
    opts += `<option value="1000+">1000+</option>`;
    gamesMinFilter.innerHTML = opts;
    gamesMaxFilter.innerHTML = opts;
  }

  // Ejecutar población de filtros
  populateCountryOptions();
  populateWinRatioOptions();
  populateGamesOptions();

  // Función para aplicar filtros y volver a renderizar
  function applyFilters() {
    const nafVal     = nafFilter.value.trim();
    const coachVal   = coachFilter.value.trim().toLowerCase();
    const countryVal = countryFilter.value;
    const wrMin      = wrMinFilter.value !== '' ? parseFloat(wrMinFilter.value) : -Infinity;
    const wrMax      = wrMaxFilter.value !== '' ? parseFloat(wrMaxFilter.value) : Infinity;

    // Manejo de filtros de partidas
    let gamesMin = -Infinity;
    let gamesMax = Infinity;
    const gvMin = gamesMinFilter.value;
    const gvMax = gamesMaxFilter.value;
    if (gvMin) {
      gamesMin = gvMin.endsWith('+') ? parseInt(gvMin, 10) : parseInt(gvMin, 10);
    }
    if (gvMax) {
      gamesMax = gvMax.endsWith('+') ? Infinity : parseInt(gvMax, 10);
    }

    const filtered = data.filter(row => {
      if (nafVal && !row.nafNr.includes(nafVal)) return false;
      if (coachVal && !row.coach.toLowerCase().includes(coachVal)) return false;
      if (countryVal !== 'all' && row.country !== countryVal) return false;
      if (row.winRatio < wrMin || row.winRatio > wrMax) return false;
      if (row.games < gamesMin || row.games > gamesMax) return false;
      return true;
    });
    renderTable(filtered);
  }

  // Asociar eventos de filtro
  nafFilter.addEventListener('input', applyFilters);
  coachFilter.addEventListener('input', applyFilters);
  countryFilter.addEventListener('change', applyFilters);
  wrMinFilter.addEventListener('change', applyFilters);
  wrMaxFilter.addEventListener('change', applyFilters);
  gamesMinFilter.addEventListener('change', applyFilters);
  gamesMaxFilter.addEventListener('change', applyFilters);

  // ==========================
  // Función para renderizar la tabla
  // ==========================
  function renderTable(rows) {
    tableBody.innerHTML = '';
    rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.rankOverall}</td>
        <td>${row.nafNr}</td>
        <td>${row.coach}</td>
        <td class="country-column">${row.country} (${row.rankCountry})</td>
        <td class="hide-lg">${row.tournaments}</td>
        <td class="hide-lg">${row.games}</td>
        <td class="hide-md">${row.wins}/${row.draws}/${row.losses}</td>
        <td class="hide-md">${row.winRatio}%</td>
        <td>${row.rating.toFixed(2)}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // Renderizado inicial
  renderTable(data);
});
