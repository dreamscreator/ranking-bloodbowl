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
