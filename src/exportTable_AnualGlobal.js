// exportTable_nafAnualGlobal.js
// Este script carga los datos de finalData_nafAnualGlobal.js,
// filtra solo Country Spain, expande por año, excluye partidas 0,
// aplica filtros de NAF, entrenador, año, CCAA, WinRatio y Partidos,
// asigna posiciones fijas por año y renderiza la tabla anual.

document.addEventListener('DOMContentLoaded', () => {
  if (typeof statsData === 'undefined') {
    console.error('statsData no está definido. Asegúrate de que finalData_nafAnualGlobal.js se cargue antes.');
    return;
  }

  const tableBody = document.querySelector('#nafTable tbody');
  const nafFilter = document.getElementById('nafFilter');
  const coachFilter = document.getElementById('coachFilter');
  const yearFilter = document.getElementById('yearFilter');
  const ccaaFilter = document.getElementById('ccaaFilter');
  const wrMinFilter = document.getElementById('wrMinFilter');
  const wrMaxFilter = document.getElementById('wrMaxFilter');
  const gamesMinFilter = document.getElementById('gamesMinFilter');
  const gamesMaxFilter = document.getElementById('gamesMaxFilter');

  // Construir filas anuales: solo España y games > 0
  const allRows = [];
  statsData.forEach(item => {
    if ((item.Country || '') !== 'Spain') return;
    const base = {
      nafNr: item['NAF Nr'] || '',
      coach: item['NAF Name'] || '',
      ccaa: item.CCAA || ''
    };
    const ys = item.yearStats || {};
    Object.entries(ys).forEach(([year, stats]) => {
      const games = stats.gamesTotal || 0;
      if (games <= 0) return;
      allRows.push({
        ...base,
        year,
        tournaments: stats.tournaments || 0,
        games,
        wins: stats.gamesWon || 0,
        draws: stats.gamesDraw || 0,
        losses: stats.gamesLost || 0,
        winRatio: stats.winRatio || 0,
        rating: stats.rating || 0
      });
    });
  });

  // Asignar ranking fijo por año (rankYear)
  const byYear = allRows.reduce((acc, row) => {
    (acc[row.year] = acc[row.year] || []).push(row);
    return acc;
  }, {});
  Object.values(byYear).forEach(group => {
    group.sort((a, b) => b.rating - a.rating);
    group.forEach((row, idx) => {
      row.rankYear = idx + 1;
    });
  });

  // Asignar ranking fijo por año y CCAA (rankCcaa)
  const byYearCcaa = {};
  allRows.forEach(row => {
    const key = `${row.year}|${row.ccaa}`;
    (byYearCcaa[key] = byYearCcaa[key] || []).push(row);
  });
  Object.values(byYearCcaa).forEach(group => {
    group.sort((a, b) => b.rating - a.rating);
    group.forEach((row, idx) => {
      row.rankCcaa = idx + 1;
    });
  });

  // Población de filtros
  // Años (sin opción "Todos")
  const years = Object.keys(byYear).sort((a, b) => b - a);
  yearFilter.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');

  // CCAA
  function populateCcaa() {
    const list = Array.from(new Set(allRows.map(r => r.ccaa))).sort();
    ccaaFilter.innerHTML = '<option value="all">Todas</option>' +
      list.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  // WinRatio 0-100 en saltos de 10
  function populateWinRatio() {
    let opts = '<option value="">Todos</option>';
    for (let i = 0; i <= 100; i += 10) {
      opts += `<option value="${i}">${i}</option>`;
    }
    wrMinFilter.innerHTML = opts;
    wrMaxFilter.innerHTML = opts;
  }

  // Partidos: 0-90 de 10, 100-900 de 100, 1000+
  function populateGames() {
    let opts = '<option value="">Todos</option>';
    for (let i = 0; i < 100; i += 10) opts += `<option value="${i}">${i}</option>`;
    for (let j = 100; j < 1000; j += 100) opts += `<option value="${j}">${j}</option>`;
    opts += '<option value="1000+">1000+</option>';
    gamesMinFilter.innerHTML = opts;
    gamesMaxFilter.innerHTML = opts;
  }

  populateCcaa();
  populateWinRatio();
  populateGames();

  // Aplicar filtros y renderizar usando posición fija por año
  function applyFilters() {
    const nafVal = nafFilter.value.trim();
    const coachVal = coachFilter.value.trim().toLowerCase();
    const yearVal = yearFilter.value;
    const ccaaVal = ccaaFilter.value;
    const wrMin = wrMinFilter.value ? parseFloat(wrMinFilter.value) : -Infinity;
    const wrMax = wrMaxFilter.value ? parseFloat(wrMaxFilter.value) : Infinity;
    let gamesMin = -Infinity;
    let gamesMax = Infinity;
    if (gamesMinFilter.value) {
      gamesMin = gamesMinFilter.value.endsWith('+') ? parseInt(gamesMinFilter.value) : parseInt(gamesMinFilter.value);
    }
    if (gamesMaxFilter.value) {
      gamesMax = gamesMaxFilter.value.endsWith('+') ? Infinity : parseInt(gamesMaxFilter.value);
    }

    let filtered = allRows.filter(r => {
      if (nafVal && !r.nafNr.includes(nafVal)) return false;
      if (coachVal && !r.coach.toLowerCase().includes(coachVal)) return false;
      if (r.year !== yearVal) return false;
      if (ccaaVal !== 'all' && r.ccaa !== ccaaVal) return false;
      if (r.winRatio < wrMin || r.winRatio > wrMax) return false;
      if (r.games < gamesMin || r.games > gamesMax) return false;
      return true;
    });

    // Ordenar por rango anual fijo
    filtered.sort((a, b) => a.rankYear - b.rankYear);

    tableBody.innerHTML = '';
    filtered.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.rankYear}</td>
        <td>${r.nafNr}</td>
        <td>${r.coach}</td>
        <td>${r.ccaa} (${r.rankCcaa})</td>
        <td class="hide-lg">${r.tournaments}</td>
        <td class="hide-lg">${r.games}</td>
        <td class="hide-md">${r.wins}/${r.draws}/${r.losses}</td>
        <td class="hide-md">${r.winRatio}%</td>
        <td>${r.rating.toFixed(2)}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  [nafFilter, coachFilter].forEach(el => el.addEventListener('input', applyFilters));
  [yearFilter, ccaaFilter, wrMinFilter, wrMaxFilter, gamesMinFilter, gamesMaxFilter]
    .forEach(el => el.addEventListener('change', applyFilters));

  // Renderizado inicial
  applyFilters();
});
