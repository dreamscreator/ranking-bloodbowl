// tableRazasHistorico.js (actualizado)
// - Carga estadÃ­sticas por raza (todos los paÃ­ses, games > 0)
// - Filtros: PaÃ­s, NAF, Entrenador, Raza, WinRatio, Partidos
// - Calcula globalRank (general) y countryRank (dentro del paÃ­s)
// - NUEVO: OrdenaciÃ³n por botones (globalRank, countryRank, tournaments, games, wr, rating)
// - NUEVO: PaginaciÃ³n a 25 filas por pÃ¡gina

"use strict";

document.addEventListener('DOMContentLoaded', () => {
  const table         = document.getElementById('nafTable');
  const tableBody     = document.querySelector('#nafTable tbody');
  const countryFilter = document.getElementById('countryFilter');
  const raceFilter    = document.getElementById('raceFilter');
  const wrMinFilter   = document.getElementById('wrMinFilter');
  const wrMaxFilter   = document.getElementById('wrMaxFilter');
  const gamesMinFilter= document.getElementById('gamesMinFilter');
  const gamesMaxFilter= document.getElementById('gamesMaxFilter');
  const nafFilter     = document.getElementById('nafFilter');
  const coachFilter   = document.getElementById('coachFilter');

  // ===== Botonera de ordenaciÃ³n =====
  const sortBar = document.getElementById('sortButtons');
  // Permite teclas "antiguas" del HTML y las internas del script
  const sortKeyMap = { rankOverall: 'globalRank', rankCountry: 'countryRank', winRatio: 'wr' };
  const validSortKeys = new Set(['globalRank','countryRank','tournaments','games','wr','rating']);
  let sortState = { key: null, dir: 'desc' }; // sin botÃ³n => globalRank asc

  function setSort(key){
    // Normaliza claves provenientes del HTML
    key = sortKeyMap[key] || key;
    if(!validSortKeys.has(key)) return;
    if(sortState.key === key){
      sortState.dir = (sortState.dir === 'desc') ? 'asc' : 'desc';
    } else {
      sortState.key = key;
      sortState.dir = 'desc';
    }
    currentPage = 1;
    applyFiltersAndRender();
    updateButtonsUI();
  }

  function updateButtonsUI(){
    if(!sortBar) return;
    const sortBtns = sortBar.querySelectorAll('.sort-btn');
    sortBtns.forEach(btn => {
      const rawKey = btn.dataset.key;
      const key = sortKeyMap[rawKey] || rawKey;
      const isActive = sortState.key === key;
      btn.classList.toggle('btn-primary', isActive);
      btn.classList.toggle('btn-outline-primary', !isActive);
      const base = btn.dataset.label || btn.textContent.replace(/\s*[â–²â–¼]$/, '');
      btn.dataset.label = base;
      btn.textContent = isActive ? `${base} ${sortState.dir === 'desc' ? 'â–¼' : 'â–²'}` : base;
    });
  }

  if (sortBar){
    sortBar.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.sort-btn');
      if(!btn) return;
      setSort(btn.dataset.key);
    });
  }

  function sortByKey(rows, key, dir){
    rows.sort((a,b)=>{
      const av = Number(a[key]) || 0;
      const bv = Number(b[key]) || 0;
      if(av === bv) return a.coach.localeCompare(b.coach);
      return dir === 'asc' ? av - bv : bv - av;
    });
  }

  // ===== PaginaciÃ³n =====
  const PAGE_SIZE = 25;
  let currentPage = 1;
  let lastFiltered = [];

  function ensurePaginationContainer(){
    let container = document.getElementById('pagination');
    if (container) return container;
    container = document.createElement('nav');
    container.id = 'pagination';
    container.className = "mt-3 d-flex justify-content-center";
    table.parentElement.appendChild(container);
    return container;
  }

  function renderPagination(totalPages){
    const container = ensurePaginationContainer();
    container.innerHTML = '';
    container.style.display = totalPages > 1 ? 'block' : 'none';
    if (totalPages <= 1) return;

    const ul = document.createElement('ul');
    ul.className = 'pagination pagination-sm flex-wrap';

    function makeItem(label, page, disabled=false, active=false){
      const li = document.createElement('li');
      li.className = `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}`;
      const a = document.createElement('a');
      a.className = 'page-link';
      a.href = '#';
      a.textContent = label;
      if (!disabled && !active){
        a.addEventListener('click', (e)=>{ e.preventDefault(); gotoPage(page); });
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

  function gotoPage(p){
    const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, p), totalPages);
    renderTable(paginate(lastFiltered));
    renderPagination(totalPages);
    table.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function paginate(rows){
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }

  // ===== Lista de razas disponibles =====
  const raceList = [
    'Amazon','Black Orc','Bretonnian','Chaos Chosen','Chaos Dwarf','Chaos Renegade','Dark Elf','Dwarf','Elf Union',
    'Gnome','Goblin','Halfling','High Elf','Human','Imperial Nobility','Khorne','Lizardmen','Necromantic Horror',
    'Norse','Nurgle','Ogre','Old World Alliance','Orc','Shambling Undead','Skaven','Slann','Snotling','Tomb Kings',
    'Underworld Denizens','Vampire','Wood Elf'
  ];

  let currentData = [];
  let raceRows    = [];
  const raceDataCache = {};

  function getRaceVarName(raceName){
    return `statsRace${raceName.replace(/\s+/g,'_')}`;
  }

  async function loadRaceData(raceName){
    if (raceDataCache[raceName]) return raceDataCache[raceName];
    const varName = getRaceVarName(raceName);
    let rawData;
    if (typeof window[varName] !== 'undefined') {
      rawData = window[varName];
    } else {
      // eval como fallback (manteniendo compatibilidad con dataset actual)
      // eslint-disable-next-line no-eval
      rawData = eval(varName);
    }
    if (!Array.isArray(rawData)) throw new Error(`${varName} no es un array.`);
    raceDataCache[raceName] = rawData;
    return rawData;
  }

  function processRaceData(data){
    return data
      .filter(item => item.gamesTotal > 0)
      .map(item => ({
        race: item.race,
        naf: item['NAF Nr'],
        coach: item['NAF Name'],
        country: item.Country,
        tournaments: Number(item.totalTournaments) || 0,
        games: Number(item.gamesTotal) || 0,
        wdl: `${item.gamesWon}/${item.gamesDraw}/${item.gamesLost}`,
        wr: Number(item.winRatio) || 0,
        rating: Number(item.rating) || 0
      }));
  }

  // ===== Render de tabla =====
  function renderTable(rows){
    tableBody.innerHTML = '';
    if(!rows.length){
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 9;
      td.className = 'text-center text-muted';
      td.textContent = 'Sin resultados';
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    rows.forEach(r => {
      const tr = document.createElement('tr');
      const coachCell = (raceFilter.value === '') ? `${r.coach} (${r.race})` : r.coach;
      const values = [
        r.globalRank,
        r.naf,
        coachCell,
        `${r.country} (${r.countryRank})`,
        r.tournaments,
        r.games,
        r.wdl,
        r.wr.toFixed(2),
        r.rating.toFixed(2)
      ];
      const classes = ['', '', '', '', 'hide-lg', 'hide-lg', 'hide-md', 'hide-md', ''];

      values.forEach((text, index) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (classes[index]) td.className = classes[index];
        tr.appendChild(td);
      });

      tableBody.appendChild(tr);
    });
  }

  // ===== Filtrar + ordenar + paginar + render =====
  function applyFiltersAndRender(){
    if (!raceRows.length){
      tableBody.innerHTML = '<tr><td colspan="9">No hay datos que mostrar.</td></tr>';
      const pg = ensurePaginationContainer();
      if (pg) pg.style.display = 'none';
      return;
    }

    const countryVal = countryFilter.value; // "" => Todos
    const wrMin = wrMinFilter.value ? parseFloat(wrMinFilter.value) : -Infinity;
    const wrMax = wrMaxFilter.value ? parseFloat(wrMaxFilter.value) : Infinity;

    let gmMin = -Infinity, gmMax = Infinity;
    if (gamesMinFilter.value) gmMin = gamesMinFilter.value.endsWith('+') ? parseInt(gamesMinFilter.value, 10) : parseInt(gamesMinFilter.value, 10);
    if (gamesMaxFilter.value) gmMax = gamesMaxFilter.value.endsWith('+') ? Infinity : parseInt(gamesMaxFilter.value, 10);

    const nafText = (nafFilter.value || '').trim().toLowerCase();
    const coachText = (coachFilter.value || '').trim().toLowerCase();

    const filtered = raceRows.filter(r =>
      (!countryVal || r.country === countryVal) &&
      r.wr >= wrMin && r.wr <= wrMax &&
      r.games >= gmMin && r.games <= gmMax &&
      (!nafText || String(r.naf).toLowerCase().includes(nafText)) &&
      (!coachText || r.coach.toLowerCase().includes(coachText))
    );

    // OrdenaciÃ³n (si hay botÃ³n) o por posiciÃ³n general ascendente
    if (sortState.key){
      sortByKey(filtered, sortState.key, sortState.dir);
    } else {
      filtered.sort((a,b)=> a.globalRank - b.globalRank);
    }

    // PaginaciÃ³n
    lastFiltered = filtered;
    const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
    currentPage = Math.min(currentPage || 1, totalPages);

    renderTable(paginate(lastFiltered));
    renderPagination(totalPages);
  }

  // ===== Cambio de Raza: recarga datos + recalcula rankings =====
  async function handleRaceChange(){
    currentPage = 1;
    tableBody.innerHTML = '<tr><td colspan="9">Cargando...</td></tr>';

    let rawDatas = [];
    const selectedRace = raceFilter.value;
    const racesToLoad = selectedRace ? [selectedRace] : raceList;

    for (const r of racesToLoad){
      const data = await loadRaceData(r);
      rawDatas = rawDatas.concat(data.map(item => ({ ...item, race: r })));
    }
    currentData = rawDatas;

    // Procesar, ordenar y asignar rankings
    raceRows = processRaceData(currentData);
    raceRows.sort((a,b)=>{
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (b.wr !== a.wr) return b.wr - a.wr;
      return a.tournaments - b.tournaments;
    });

    const countryCounters = {};
    raceRows.forEach((r, idx)=>{
      r.globalRank = idx + 1;
      countryCounters[r.country] = (countryCounters[r.country] || 0) + 1;
      r.countryRank = countryCounters[r.country];
    });

    // Rellenar filtros dinÃ¡micos
    const countries = Array.from(new Set(currentData.map(i => i.Country))).sort();
    countryFilter.innerHTML = '<option value="" data-i18n="todos">Todos</option>' +
      countries.map(c => `<option value="${c}">${c}</option>`).join('');

    const wrSteps = Array.from({ length: 11 }, (_, i) => i * 10);
    const wrOptions = wrSteps.map(n => `<option value="${n}">${n}</option>`).join('');
    wrMinFilter.innerHTML = '<option value="" data-i18n="todos">Todos</option>' + wrOptions;
    wrMaxFilter.innerHTML = '<option value="" data-i18n="todos">Todos</option>' + wrOptions;

    const gamesSteps = [...wrSteps, 200, 300, 400, 500, 600, 700, 800, 900];
    const gamesOptions = gamesSteps.map(n => `<option value="${n}">${n}</option>`).join('') +
                         '<option value="1000+">1000+</option>';
    gamesMinFilter.innerHTML = '<option value="" data-i18n="todos">Todos</option>' + gamesOptions;
    gamesMaxFilter.innerHTML = '<option value="" data-i18n="todos">Todos</option>' + gamesOptions;

    applyFiltersAndRender();
    updateButtonsUI();
  }

  // ===== InicializaciÃ³n de filtros estÃ¡ticos =====
  function initializeFilters(){
    raceFilter.innerHTML = '<option value="" data-i18n="todas">Todas</option>' +
      raceList.map(r => `<option value="${r}">${r}</option>`).join('');
    countryFilter.innerHTML = '<option value="" data-i18n="todos">Todos</option>';
    wrMinFilter.innerHTML = '<option value="" data-i18n="todos">Todos</option>';
    wrMaxFilter.innerHTML = '<option value="" data-i18n="todos">Todos</option>';
    gamesMinFilter.innerHTML = '<option value="" data-i18n="todos">Todos</option>';
    gamesMaxFilter.innerHTML = '<option value="" data-i18n="todos">Todos</option>';
  }

  // ===== Eventos =====
  initializeFilters();
  raceFilter.addEventListener('change', handleRaceChange);

  [countryFilter, wrMinFilter, wrMaxFilter, gamesMinFilter, gamesMaxFilter].forEach(el =>
    el.addEventListener('change', () => { currentPage = 1; applyFiltersAndRender(); })
  );
  nafFilter.addEventListener('input', () => { currentPage = 1; applyFiltersAndRender(); });
  coachFilter.addEventListener('input', () => { currentPage = 1; applyFiltersAndRender(); });

  // Carga inicial mostrando todas las razas
  handleRaceChange();
});


