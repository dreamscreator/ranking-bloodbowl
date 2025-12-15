// tableEsExtraStats.js — Estadísticas Extra con filtro solo España y CCAA
// Renderiza nafEsExtraStats.html

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
        if (!table) return;

        const tableBody = table.querySelector("tbody");

        // ===== 1. Crear Mapa de Nombres =====
        const nameMap = {};
        statsExtra.forEach(p => {
            if (p['NAF Nr']) {
                nameMap[p['NAF Nr']] = p['NAF Name'];
            }
        });

        function normCountry(c) {
            return String(c ?? "").trim().toLowerCase();
        }

        // ===== 2. Normalizar Datos y Filtrar SPAIN =====
        const baseData = statsExtra
            .map((item) => {
                // Calcular Archienemigo
                let archName = "-";
                let archCount = 0;
                let archStr = "-";

                if (item.rivals && item.rivals.length > 0) {
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
                    ccaa: item["CCAA"] ?? item.ccaa ?? "", // Mapeo de CCAA

                    maxScored: item.maxScored || 0,
                    maxConceded: item.maxConceded || 0,
                    maxCombined: item.maxCombined || 0,
                    biggestWinDiff: item.biggestWinDiff || 0,
                    biggestLossDiff: item.biggestLossDiff || 0,

                    rivalCount: archCount,
                    rivalStr: archStr,
                    rivalName: archName
                };
            })
            .filter((row) => normCountry(row.country) === "spain"); // ✅ SOLO Spain

        // ===== 3. Orden por Defecto =====
        function defaultSort(a, b) {
            return a.coach.localeCompare(b.coach);
        }

        // ===== 4. Filtros UI (CCAA en lugar de Country) =====
        const nafFilter = document.getElementById("nafFilter");
        const coachFilter = document.getElementById("coachFilter");
        const ccaaFilter = document.getElementById("ccaaFilter"); // ✅

        (function populateCcaaOptions() {
            if (!ccaaFilter) return;

            const ccaas = Array.from(new Set(baseData.map((d) => String(d.ccaa ?? ""))))
                .sort((a, b) => a.localeCompare(b));

            ccaaFilter.innerHTML =
                '<option value="all">Todas / All</option>' +
                ccaas.map((c) => `<option value="${c}">${c || "-"}</option>`).join("");

            ccaaFilter.value = "all";
        })();

        // ===== 5. Lógica de Ordenación =====
        const sortBar = document.getElementById("sortButtons");

        const validSortKeys = new Set([
            "maxScored",
            "maxConceded",
            "maxCombined",
            "biggestWinDiff",
            "biggestLossDiff",
            "rivalCount"
        ]);

        let sortState = { key: "maxScored", dir: "desc" };

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

                btn.classList.toggle("btn-primary", isActive);
                btn.classList.toggle("btn-outline-primary", !isActive);

                const base = btn.dataset.label || btn.textContent.replace(/\s*[▲▼]$/, "");
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
            const ccaaVal = ccaaFilter ? ccaaFilter.value : "all"; // ✅

            const filtered = baseData.filter((row) => {
                if (nafVal && !String(row.nafNr).includes(nafVal)) return false;
                if (coachVal && !row.coach.toLowerCase().includes(coachVal)) return false;
                if (ccaaVal !== "all" && String(row.ccaa) !== String(ccaaVal)) return false; // ✅
                return true;
            });

            if (sortState.key) {
                sortByKey(filtered, sortState.key, sortState.dir);
            } else {
                filtered.sort(defaultSort);
            }

            lastFiltered = filtered;
            const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
            currentPage = Math.min(currentPage, totalPages) || 1;

            renderTable(paginate(lastFiltered));
            renderPagination(totalPages);
        }

        if (nafFilter) nafFilter.addEventListener("input", () => { currentPage = 1; applyFilters(); });
        if (coachFilter) coachFilter.addEventListener("input", () => { currentPage = 1; applyFilters(); });
        if (ccaaFilter) ccaaFilter.addEventListener("change", () => { currentPage = 1; applyFilters(); });

        // ===== 8. Render Tabla =====
        function renderTable(rows) {
            tableBody.innerHTML = "";
            if (!rows.length) {
                const tr = document.createElement("tr");
                const td = document.createElement("td");
                td.colSpan = 9;
                td.className = "text-center text-muted p-3";
                td.textContent = "No results found / Sin resultados";
                tr.appendChild(td);
                tableBody.appendChild(tr);
                return;
            }

            rows.forEach((row) => {
                const tr = document.createElement("tr");

                const winDiffClass = row.biggestWinDiff > 0 ? "text-success fw-bold" : "";
                const lossDiffClass = row.biggestLossDiff < 0 ? "text-danger fw-bold" : (row.biggestLossDiff > 0 ? "text-danger fw-bold" : "");

                tr.innerHTML = `
          <td>${row.nafNr}</td>
          <td class="fw-bold">${row.coach}</td>
          <td class="country-column">${row.ccaa}</td> <!-- ✅ CCAA -->
          
          <td>${row.maxScored}</td>
          <td>${row.maxConceded}</td>
          <td>${row.maxCombined}</td>
          
          <td class="${winDiffClass}">+${row.biggestWinDiff}</td>
          <td class="${lossDiffClass}">-${Math.abs(row.biggestLossDiff)}</td>
          
          <td>${row.rivalStr}</td>
        `;
                tableBody.appendChild(tr);
            });
        }

        applyFilters();
        updateButtonsUI();
    });
})();

