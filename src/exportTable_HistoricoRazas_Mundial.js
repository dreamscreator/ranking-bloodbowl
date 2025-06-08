// exportTable_nafHistoricoRazas.js
// Este script carga los datos de statsData definidos en statsData.js,
// expande estadísticas por raza, excluye partidas 0,
// aplica filtros de Country, Raza, NAF, Entrenador, WR y Partidos,
// asigna ranking estático global, por raza y por Country,
// y renderiza la tabla con posiciones dinámicas solo si se filtra por raza.

document.addEventListener('DOMContentLoaded', () => {
  if (typeof statsData === 'undefined') {
    console.error('statsData no está definido. Asegúrate de que statsData.js se cargue antes.');
    return;
  }

  const tableBody      = document.querySelector('#nafTable tbody');
  const countryFilter  = document.getElementById('countryFilter');
  const raceFilter     = document.getElementById('raceFilter');
  const wrMinFilter    = document.getElementById('wrMinFilter');
  const wrMaxFilter    = document.getElementById('wrMaxFilter');
  const gamesMinFilter = document.getElementById('gamesMinFilter');
  const gamesMaxFilter = document.getElementById('gamesMaxFilter');
  const nafFilter      = document.getElementById('nafFilter');
  const coachFilter    = document.getElementById('coachFilter');

  // Construir todas las filas de datos para todos los países
  const allRows = [];
  statsData.forEach(item => {
    const base = {
      nafNr:   item['NAF Nr']   || '',
      coach:   item['NAF Name'] || '',
      country: item.Country     || ''
    };
    (item.raceStats || []).forEach(rs => {
      const games = parseInt(rs.gamesTotal, 10) || 0;
      if (games <= 0) return;
      allRows.push({
        ...base,
        race:        rs.race        || 'Unknown',
        tournaments: parseInt(rs.totalTournaments, 10) || 0,
        games,
        wins:        parseInt(rs.gamesWon, 10)  || 0,
        draws:       parseInt(rs.gamesDraw, 10) || 0,
        losses:      parseInt(rs.gamesLost, 10) || 0,
        winRatio:    parseFloat(rs.winRatio)    || 0,
        rating:      parseFloat(rs.rating)      || 0
      });
    });
  });

  // Ranking estático global
  allRows.sort((a, b) => b.rating - a.rating);
  allRows.forEach((row, idx) => { row.globalRank = idx + 1; });

  // Ranking estático por raza
  const byRace = allRows.reduce((acc, row) => {
    (acc[row.race] = acc[row.race] || []).push(row);
    return acc;
  }, {});
  Object.values(byRace).forEach(group => {
    group.sort((a, b) => b.rating - a.rating);
    group.forEach((row, idx) => { row.raceRank = idx + 1; });
  });

  // Ranking estático por Country
  const byCountry = allRows.reduce((acc, row) => {
    (acc[row.country] = acc[row.country] || []).push(row);
    return acc;
  }, {});
  Object.values(byCountry).forEach(group => {
    group.sort((a, b) => b.rating - a.rating);
    group.forEach((row, idx) => { row.countryRank = idx + 1; });
  });

  // Población de filtros
  countryFilter.innerHTML = '<option value="all">Todos</option>' +
    Array.from(new Set(allRows.map(r => r.country))).sort()
      .map(c => `<option value="${c}">${c}</option>`).join('');

  raceFilter.innerHTML = '<option value="all">Todas</option>' +
    Array.from(new Set(allRows.map(r => r.race))).sort()
      .map(r => `<option value="${r}">${r}</option>`).join('');

  const buildNumericOptions = (min, max, step) => {
    let opts = '<option value="">Todos</option>';
    for (let v = min; v <= max; v += step) opts += `<option value="${v}">${v}</option>`;
    return opts;
  };

  wrMinFilter.innerHTML = buildNumericOptions(0, 100, 10);
  wrMaxFilter.innerHTML = buildNumericOptions(0, 100, 10);

  let gOpts = '<option value="">Todos</option>';
  for (let i = 0; i < 100; i += 10) gOpts += `<option value="${i}">${i}</option>`;
  for (let j = 100; j < 1000; j += 100) gOpts += `<option value="${j}">${j}</option>`;
  gOpts += '<option value="1000+">1000+</option>';
  gamesMinFilter.innerHTML = gOpts;
  gamesMaxFilter.innerHTML = gOpts;

  // Función de filtrado y renderizado
  function applyFilters() {
    const ct       = countryFilter.value;
    const rf       = raceFilter.value;
    const nq       = nafFilter.value.trim();
    const cq       = coachFilter.value.trim().toLowerCase();
    const wrMin    = wrMinFilter.value ? parseFloat(wrMinFilter.value)    : -Infinity;
    const wrMax    = wrMaxFilter.value ? parseFloat(wrMaxFilter.value)    : Infinity;
    let gmMin = -Infinity, gmMax = Infinity;
    const gmin = gamesMinFilter.value, gmax = gamesMaxFilter.value;
    if (gmin) gmMin = gmin.endsWith('+') ? parseInt(gmin, 10) : parseInt(gmin, 10);
    if (gmax) gmMax = gmax.endsWith('+') ? Infinity : parseInt(gmax, 10);

    // Filtrar según controles
    let filtered = allRows.filter(r => {
      if (ct !== 'all' && r.country !== ct) return false;
      if (rf !== 'all' && r.race !== rf) return false;
      if (nq && !r.nafNr.includes(nq)) return false;
      if (cq && !r.coach.toLowerCase().includes(cq)) return false;
      if (r.winRatio < wrMin || r.winRatio > wrMax) return false;
      if (r.games < gmMin || r.games > gmMax) return false;
      return true;
    });

    // Determinar posiciones a mostrar
    filtered.forEach(row => {
      // Global rank solo cambia si se filtra por raza
      row.displayRank = (rf !== 'all') ? row.raceRank : row.globalRank;
      // Country rank dinámico cuando se filtra por raza, si no estático
      row.displayCountryRank = (rf !== 'all')
        ? (() => {
            // agrupa por Country dentro de esta raza y asigna rank dinámico
            const group = filtered.filter(r => r.country === row.country);
            group.sort((a, b) => b.rating - a.rating);
            return group.findIndex(r => r === row) + 1;
          })()
        : row.countryRank;
    });

    // Ordenar por displayRank
    filtered.sort((a, b) => a.displayRank - b.displayRank);

    // Renderizar
    tableBody.innerHTML = '';
    filtered.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.displayRank}</td>
        <td>${r.nafNr}</td>
        <td>${r.coach}</td>
        <td class="country-column">${r.country} (${r.displayCountryRank})</td>
        <td>${r.race}</td>
        <td>${r.tournaments}</td>
        <td class="hide-lg">${r.games}</td>
        <td class="hide-md">${r.wins}/${r.draws}/${r.losses}</td>
        <td class="hide-md">${r.winRatio}%</td>
        <td>${r.rating.toFixed(2)}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // Asociar eventos a filtros
  [countryFilter, raceFilter, wrMinFilter, wrMaxFilter, gamesMinFilter, gamesMaxFilter]
    .forEach(el => el.addEventListener('change', applyFilters));
  [nafFilter, coachFilter].forEach(el => el.addEventListener('input', applyFilters));

  // Carga inicial
  applyFilters();
});
