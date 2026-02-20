// tableStatsExtra.js — Estadísticas Extra con formato unificado
// Renderiza extraStats.html en una sola tabla con filtros, ordenación y paginación.
// Depende de 'src/naf/statsExtra.js'

(function () {
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof statsExtra === "undefined") {
      console.error("statsExtra no está definido.");
      return;
    }

    const PAGE_SIZE = 25;
    let currentPage = 1;
    let lastFiltered = [];

    const table = document.getElementById("extraStatsTable");
    // Si no estamos en la página correcta, salir
    if (!table) return;

    const tableBody = table.querySelector("tbody");

    // ===== 1. Crear Mapa de Nombres (NAF ID -> Nombre) =====
    // Necesario para resolver el nombre del "Archienemigo" (que viene como ID)
    const nameMap = {};
    statsExtra.forEach(p => {
      if (p['NAF Nr']) {
        nameMap[p['NAF Nr']] = p['NAF Name'];
      }
    });

    // ===== 2. Normalizar Datos =====
    const baseData = statsExtra.map((item) => {
      // Calcular Archienemigo
      let archName = "-";
      let archCount = 0;
      let archStr = "-";

      if (item.rivals && item.rivals.length > 0) {
        // Encontrar rival con más partidos
        // (Podemos ordenar o reducir. Reducir es más eficiente para solo max)
        const bestRival = item.rivals.reduce((prev, current) => {
          return (prev.count > current.count) ? prev : current;
        });

        if (bestRival && bestRival.count > 0) {
          archCount = bestRival.count;
          const rName = nameMap[bestRival.id] || `Unknown (${bestRival.id})`;
          archName = rName;
          archStr = `${archCount} vs ${rName}`;
        }
      }

      return {
        nafNr: item["NAF Nr"] || "",
        coach: item["NAF Name"] || "",
        country: item["Country"] || "",

        // TD
        tdMaxScored: item.tdMaxScored || 0,
        tdMaxConceded: item.tdMaxConceded || 0,
        tdMediaFor: item.tdMediaFor || 0,
        tdMediaAgain: item.tdMediaAgain || 0,
        tdMaxDifFor: item.tdMaxDifFor || 0,
        tdMaxDifAgain: item.tdMaxDifAgain || 0,
        tdMaxDifCombined: item.tdMaxDifCombined || 0,

        // CAS
        casMaxScored: item.casMaxScored || 0,
        casMaxConceded: item.casMaxConceded || 0,
        casMediaFor: item.casMediaFor || 0,
        casMediaAgain: item.casMediaAgain || 0,
        casMaxDifFor: item.casMaxDifFor || 0,
        casMaxDifAgain: item.casMaxDifAgain || 0,
        casMaxDifCombined: item.casMaxDifCombined || 0,

        // Archienemigo
        rivalCount: archCount, // Para poder ordenar numéricamente
        rivalStr: archStr,     // Para mostrar
        rivalName: archName    // Por si acaso
      };
    });

    // ===== 3. Orden por Defecto =====
    // Por defecto quizás Max Scored? O Coach? 
    // nafStreaks usa comparadores complejos. Usaremos Coach alfabético por defecto si no hay orden.
    function defaultSort(a, b) {
      return a.coach.localeCompare(b.coach);
    }

    // ===== 4. Filtros UI =====
    const nafFilter = document.getElementById("nafFilter");
    const coachFilter = document.getElementById("coachFilter");
    const countryFilter = document.getElementById("countryFilter");

    (function populateCountryOptions() {
      // Obtener lista única de países, filtrando vacíos
      const countryList = Array.from(new Set(baseData.map((d) => d.country)))
        .filter(c => c)
        .sort();

      if (countryFilter) {
        countryFilter.innerHTML =
          '<option value="all" data-i18n="todos">Todos</option>' +
          countryList.map((c) => `<option value="${c}">${c}</option>`).join("");
      }
    })();

    // ===== 5. Lógica de Ordenación =====
    const sortBar = document.getElementById("sortButtons");

    // Lista de keys válidas que coinciden con data-key de los botones
    const validSortKeys = new Set([
      // TD
      "tdMaxScored",
      "tdMaxConceded",
      "tdMediaFor",
      "tdMediaAgain",
      "tdMaxDifFor",
      "tdMaxDifAgain",
      "tdMaxDifCombined",
      // CAS
      "casMaxScored",
      "casMaxConceded",
      "casMediaFor",
      "casMaxDifFor",
      "casMediaAgain",
      "casMaxDifAgain",
      "casMaxDifCombined",

      "rivalCount"
    ]);

    let sortState = { key: "tdMaxScored", dir: "desc" };

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

        // Estilos
        btn.classList.toggle("btn-primary", isActive);
        btn.classList.toggle("btn-outline-primary", !isActive);

        // Flechita text
        const base = btn.dataset.label || btn.textContent.replace(/\s*[▲▼]$/, "");
        // Guardar label original si no existe
        if (!btn.dataset.label) btn.dataset.label = base;

        btn.textContent = isActive
          ? `${base} ${sortState.dir === "desc" ? "▼" : "▲"}`
          : base;
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
      return rows.sort((a, b) => {
        const av = a[key] ?? 0;
        const bv = b[key] ?? 0;
        if (av === bv) return a.coach.localeCompare(b.coach);
        return dir === "asc" ? av - bv : bv - av;
      });
    }

    // ===== 6. Paginación =====
    function ensurePaginationContainer() {
      let container = document.getElementById("pagination");
      if (container) return container;
      // Insertar después de la tabla (o del contenedor table-responsive)
      container = document.createElement("nav");
      container.id = "pagination";
      container.className = "mt-3 d-flex justify-content-center"; // Centrado para que quede bonito
      table.closest('.section-bg').appendChild(container);
      return container;
    }

    function renderPagination(totalPages) {
      const container = ensurePaginationContainer();
      container.innerHTML = "";
      // Ocultar si solo hay 1 página
      if (totalPages <= 1) {
        container.style.display = "none";
        return;
      }
      container.style.display = "flex";

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
          a.addEventListener("click", (e) => {
            e.preventDefault();
            gotoPage(page);
          });
        }
        li.appendChild(a);
        return li;
      }

      // Botones: Primera, Anterior, ... Paginas ... Siguiente, Última
      // Para simplificar, mostraremos un rango alrededor de currentPage
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
      // Scroll suave arriba de la tabla
      table.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function paginate(rows) {
      const start = (currentPage - 1) * PAGE_SIZE;
      return rows.slice(start, start + PAGE_SIZE);
    }

    // ===== 7. Filtrar + Ordenar + Render =====
    function applyFilters() {
      const nafVal = nafFilter ? nafFilter.value.trim() : "";
      const coachVal = coachFilter ? coachFilter.value.trim().toLowerCase() : "";
      const countryVal = countryFilter ? countryFilter.value : "all";

      const filtered = baseData.filter((row) => {
        if (nafVal && !String(row.nafNr).includes(nafVal)) return false;
        if (coachVal && !row.coach.toLowerCase().includes(coachVal)) return false;
        if (countryVal !== "all" && row.country !== countryVal) return false;
        return true;
      });

      if (sortState.key) {
        sortByKey(filtered, sortState.key, sortState.dir);
      } else {
        filtered.sort(defaultSort);
      }

      lastFiltered = filtered;
      const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
      // Si la página actual excede el nuevo total, ir a la última
      currentPage = Math.min(currentPage, totalPages) || 1;

      renderTable(paginate(lastFiltered));
      renderPagination(totalPages);
    }

    if (nafFilter) nafFilter.addEventListener("input", () => { currentPage = 1; applyFilters(); });
    if (coachFilter) coachFilter.addEventListener("input", () => { currentPage = 1; applyFilters(); });
    if (countryFilter) countryFilter.addEventListener("change", () => { currentPage = 1; applyFilters(); });

    // ===== 8. Render Tabla =====
    function renderTable(rows) {
      tableBody.innerHTML = "";
      if (!rows.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 9; // 9 columnas
        td.className = "text-center text-muted p-3";
        td.textContent = "No results found / Sin resultados";
        tr.appendChild(td);
        tableBody.appendChild(tr);
        return;
      }

      rows.forEach((row) => {
        const tr = document.createElement("tr");

        // Estilo condicional para diferencias positivas/negativas
        const winDiffClass = row.biggestWinDiff > 0 ? "text-success fw-bold" : "";
        const lossDiffClass = row.biggestLossDiff < 0 ? "text-danger fw-bold" : (row.biggestLossDiff > 0 ? "text-danger fw-bold" : "");
        // Nota: en statsExtra source biggestLossDiff suele ser positivo en valor absoluto? vamos a asumir que viene como N y lo mostramos como -N o viene como -N.
        // En nafStreak parece que se muestra explícitamente el signo.
        // Verificando `statsExtra` json sample: biggestLossDiff: 6. So likely positive int.
        // We will render as -X.

        // Render
        // Render
        /* Columnas (18 total):
           1. NAF # | 2. Entrenador | 3. País
           
           TD:
           4. tdMaxScored   | 5. tdMaxConceded
           6. tdMediaFor    | 7. tdMediaAgain
           8. tdMaxDifFor   | 9. tdMaxDifAgain
           10. tdMaxDifCombined
           
           CAS:
           11. casMaxScored | 12. casMaxConceded
           13. casMediaFor  | 14. casMediaAgain
           15. casMaxDifFor | 16. casMaxDifAgain
           17. casMaxDifCombined

           18. Archienemigo
        */

        // Clases para diferencias
        const tdDifForClass = row.tdMaxDifFor > 0 ? "text-success fw-bold" : "";
        const tdDifAgainClass = row.tdMaxDifAgain > 0 ? "text-danger fw-bold" : "";

        const casDifForClass = row.casMaxDifFor > 0 ? "text-success fw-bold" : "";
        const casDifAgainClass = row.casMaxDifAgain > 0 ? "text-danger fw-bold" : "";


        tr.innerHTML = `
          <td>${row.nafNr}</td>
          <td class="text-start">${row.coach}</td>
          <td class="country-column">${row.country}</td>
          
          <!-- TD -->
          <td>${row.tdMaxScored}</td>
          <td>${row.tdMaxConceded}</td>
          <td>${row.tdMediaFor}</td>
          <td>${row.tdMediaAgain}</td>
          <td class="${tdDifForClass}">+${row.tdMaxDifFor}</td>
          <td class="${tdDifAgainClass}">-${Math.abs(row.tdMaxDifAgain)}</td>
          <td>${row.tdMaxDifCombined}</td>

          <!-- CAS -->
          <td>${row.casMaxScored}</td>
          <td>${row.casMaxConceded}</td>
          <td>${row.casMediaFor}</td>
          <td>${row.casMediaAgain}</td>
          <td class="${casDifForClass}">+${row.casMaxDifFor}</td>
          <td class="${casDifAgainClass}">-${Math.abs(row.casMaxDifAgain)}</td>
          <td>${row.casMaxDifCombined}</td>
          
          <td class="text-start">${row.rivalStr}</td>
        `;
        tableBody.appendChild(tr);
      });
    }

    // Inicializar
    applyFilters();
    updateButtonsUI();
  });
})();

