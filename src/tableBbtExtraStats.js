// tableBbtExtraStats.js
// Renderiza bbtExtraStats.html en una tabla con columnas para TD y CAS.
// Depende de 'src/bbt/statsExtra.js' (variable statsExtraBbt)

(function () {
    document.addEventListener("DOMContentLoaded", () => {
        if (typeof statsExtraBbt === "undefined") {
            console.error("statsExtraBbt no está definido.");
            return;
        }

        const PAGE_SIZE = 25;
        let currentPage = 1;
        let lastFiltered = [];

        const table = document.getElementById("extraStatsTable");
        if (!table) return;

        const tableBody = table.querySelector("tbody");

        // NOTA: Ya no inyectamos thead ni sortButtons dinámicamente para respetar el HTML estático
        // y mantener consistencia con nafExtraStats.html

        // 2. Filtros UI
        const nafFilter = document.getElementById("nafFilter");
        const coachFilter = document.getElementById("coachFilter");
        const countryFilter = document.getElementById("countryFilter");

        // Llenar select de CCAA
        (function populateCountryOptions() {
            const countryList = Array.from(new Set(statsExtraBbt.map((d) => d.CCAA)))
                .filter(c => c)
                .sort();
            if (countryFilter) {
                countryFilter.innerHTML =
                    '<option value="all" data-i18n="todos">Todos</option>' +
                    countryList.map((c) => `<option value="${c}">${c}</option>`).join("");
            }
        })();

        // 3. Botones de Ordenación
        const sortBar = document.getElementById("sortButtons");
        let sortState = { key: "tdMaxScored", dir: "desc" };

        function setSort(key) {
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

                // Soporte para primary (azul), danger (rojo) y secondary (gris/archienemigo)
                const isDanger = btn.classList.contains("btn-outline-danger") || btn.classList.contains("btn-danger");
                const isSecondary = btn.classList.contains("btn-outline-secondary") || btn.classList.contains("btn-secondary");

                let baseClass = "btn-primary";
                let outlineClass = "btn-outline-primary";

                if (isDanger) {
                    baseClass = "btn-danger";
                    outlineClass = "btn-outline-danger";
                } else if (isSecondary) {
                    baseClass = "btn-secondary";
                    outlineClass = "btn-outline-secondary";
                }

                btn.classList.toggle(baseClass, isActive);
                btn.classList.toggle(outlineClass, !isActive);

                const baseLabel = btn.dataset.label || btn.textContent.replace(/\s*[▲▼]$/, "");
                if (!btn.dataset.label) btn.dataset.label = baseLabel;

                btn.textContent = isActive
                    ? `${baseLabel} ${sortState.dir === "desc" ? "▼" : "▲"}`
                    : baseLabel;
            });
        }

        if (sortBar) {
            sortBar.addEventListener("click", (ev) => {
                const btn = ev.target.closest(".sort-btn");
                if (!btn) return;
                setSort(btn.dataset.key);
            });
        }

        // 4. Lógica de Filtrado y Orden
        function applyFilters() {
            const nafVal = nafFilter ? nafFilter.value.trim() : "";
            const coachVal = coachFilter ? coachFilter.value.trim().toLowerCase() : "";
            const countryVal = countryFilter ? countryFilter.value : "all";

            const filtered = statsExtraBbt.filter((row) => {
                if (nafVal && !String(row["NAF Nr"]).includes(nafVal)) return false;
                if (coachVal && !String(row["NAF Name"]).toLowerCase().includes(coachVal)) return false;
                if (countryVal !== "all" && row.CCAA !== countryVal) return false;
                return true;
            });

            // Ordenar
            filtered.sort((a, b) => {
                const av = a[sortState.key] ?? 0;
                const bv = b[sortState.key] ?? 0;
                if (av === bv) return String(a["NAF Name"]).localeCompare(String(b["NAF Name"]));
                return sortState.dir === "asc" ? av - bv : bv - av;
            });

            lastFiltered = filtered;
            const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
            currentPage = Math.min(currentPage, totalPages) || 1;

            renderTable(paginate(lastFiltered));
            renderPagination(totalPages);
        }

        if (nafFilter) nafFilter.addEventListener("input", () => { currentPage = 1; applyFilters(); });
        if (coachFilter) coachFilter.addEventListener("input", () => { currentPage = 1; applyFilters(); });
        if (countryFilter) countryFilter.addEventListener("change", () => { currentPage = 1; applyFilters(); });

        // 5. Paginación
        function ensurePaginationContainer() {
            let container = document.getElementById("pagination");
            if (container) return container;
            container = document.createElement("nav");
            container.id = "pagination";
            container.className = "mt-3 d-flex justify-content-center";
            table.closest('.section-bg').appendChild(container);
            return container;
        }

        function renderPagination(totalPages) {
            const container = ensurePaginationContainer();
            container.innerHTML = "";
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

            ul.appendChild(makeItem("\u00AB", 1, currentPage === 1));
            ul.appendChild(makeItem("\u2039", Math.max(1, currentPage - 1), currentPage === 1));

            let startP = Math.max(1, currentPage - 4);
            let endP = Math.min(totalPages, startP + 8);
            if (endP - startP < 8) startP = Math.max(1, endP - 8);

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
            table.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        function paginate(rows) {
            const start = (currentPage - 1) * PAGE_SIZE;
            return rows.slice(start, start + PAGE_SIZE);
        }

        // 6. Render Filas
        function renderTable(rows) {
            tableBody.innerHTML = "";
            if (!rows.length) {
                tableBody.innerHTML = '<tr><td colspan="17" class="text-center text-muted p-3">No results found</td></tr>';
                return;
            }

            rows.forEach((row) => {
                const tr = document.createElement("tr");

                // Helper para celdas de diferencia con colores
                const renderDiff = (val) => {
                    const num = val || 0;
                    if (num > 0) return `<span class="text-success fw-bold">+${num}</span>`;
                    if (num < 0) return `<span class="text-danger fw-bold">${num}</span>`;
                    return `<span class="text-muted">0</span>`;
                };

                // Helper para "En Contra" (valores negativos mostrados en rojo)
                const renderDiffAgain = (val) => {
                    const num = val || 0;
                    // En DB viene positivo si te anotaron más de lo que anotaste (creo) 
                    // o viene ya la diferencia. Asumimos comportamiento similar a tabla NAF.
                    // Si num > 0 es "malo" -> rojo.
                    if (num > 0) return `<span class="text-danger fw-bold">-${num}</span>`;
                    if (num < 0) return `<span class="text-success fw-bold">+${Math.abs(num)}</span>`; // Raro caso
                    return `<span class="text-muted">0</span>`;
                };

                // Extraemos valores con defaults
                // NOTA: statsExtraBbt keys: tdMaxScored, casMaxScored, etc.

                tr.innerHTML = `
          <td>${row["NAF Nr"]}</td>
          <td class="text-start">${row["NAF Name"]}</td>
          <td class="country-column">${row["CCAA"] || ""}</td>
          
          <!-- TDs -->
          <td>${row.tdMaxScored || 0}</td>
          <td>${row.tdMaxConceded || 0}</td>
          <td>${row.tdMediaFor || 0}</td>
          <td>${row.tdMediaAgain || 0}</td>
          <td>${renderDiff(row.tdMaxDifFor)}</td>
          <td>${renderDiffAgain(row.tdMaxDifAgain)}</td>
          <td>${row.tdMaxDifCombined || 0}</td>

          <!-- CAS -->
          <td>${row.casMaxScored || 0}</td>
          <td>${row.casMaxConceded || 0}</td>
          <td>${row.casMediaFor || 0}</td>
          <td>${row.casMediaAgain || 0}</td>
          <td>${renderDiff(row.casMaxDifFor)}</td>
          <td>${renderDiffAgain(row.casMaxDifAgain)}</td>
          <td>${row.casMaxDifCombined || 0}</td>
          
          <!-- Archienemigo: no disponible en BBT por ahora, placeholder vacío -->
          <td>-</td>
        `;
                tableBody.appendChild(tr);
            });
        }

        // Inicializar
        applyFilters();
        updateButtonsUI();
    });
})();
