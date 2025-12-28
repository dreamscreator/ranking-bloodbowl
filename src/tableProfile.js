// tableProfile.js
// Perfiles NAF a partir de generalAll + statsYearYYYY + statsRaceXXX + BBT + razas BB2025.
//
// Fila 1 (2 columnas, 3:1):
//   - Columna 1: Perfil (NAF Nr, Entrenador, Pais, CCAA + totales globales)
//   - Columna 2: Insignias
//
// Fila 2 (debajo, 5 columnas):
//   - Columna 1: estadisticas globales NAF (rating, rachas, proplayers…)
//   - Columna 2: estadisticas NAF por ano
//   - Columna 3: estadisticas NAF por raza (Legacy, sin torneos)
//   - Columna 4: estadisticas por raza BB2025 (variantid=15 -> arrays tipo amazon2025)
//   - Columna 5: estadisticas BBT (globales + por ano)
//
// Filtros EXACTOS: NAF Nr y Entrenador deben coincidir exactamente.

var PAGE_SIZE = 50;         // numero de filas por pagina
var YEAR_START = 2002;      // primer ano con statsYear
var yearStatsByNaf = {};    // NAF: nafNr -> array de stats por ano
var raceStatsByNaf = {};    // NAF: nafNr -> array de stats por raza (Legacy)
var raceStats2025ByNaf = {}; // NAF: nafNr -> array de stats por raza BB2025 (variant 15)
var bbtYearStatsByNaf = {}; // NAF: nafNr -> array de stats por ano
var bbtOverallByNaf = {};   // NAF: nafNr -> stats globales

// Lista de razas y nombres de variables globales esperadas (NAF Legacy)
var RACE_SOURCES = [
  { varName: "statsRaceAmazon", label: "Amazon" },
  { varName: "statsRaceBlack_Orc", label: "Black Orc" },
  { varName: "statsRaceBretonnian", label: "Bretonnian" },
  { varName: "statsRaceChaos_Chosen", label: "Chaos Chosen" },
  { varName: "statsRaceChaos_Dwarf", label: "Chaos Dwarf" },
  { varName: "statsRaceChaos_Renegade", label: "Chaos Renegade" },
  { varName: "statsRaceDark_Elf", label: "Dark Elf" },
  { varName: "statsRaceDwarf", label: "Dwarf" },
  { varName: "statsRaceElf_Union", label: "Elf Union" },
  { varName: "statsRaceGnome", label: "Gnome" },
  { varName: "statsRaceGoblin", label: "Goblin" },
  { varName: "statsRaceHalfling", label: "Halfling" },
  { varName: "statsRaceHigh_Elf", label: "High Elf" },
  { varName: "statsRaceHuman", label: "Human" },
  { varName: "statsRaceImperial_Nobility", label: "Imperial Nobility" },
  { varName: "statsRaceKhorne", label: "Khorne" },
  { varName: "statsRaceLizardmen", label: "Lizardmen" },
  { varName: "statsRaceNecromantic_Horror", label: "Necromantic Horror" },
  { varName: "statsRaceNorse", label: "Norse" },
  { varName: "statsRaceNurgle", label: "Nurgle" },
  { varName: "statsRaceOgre", label: "Ogre" },
  { varName: "statsRaceOld_World_Alliance", label: "Old World Alliance" },
  { varName: "statsRaceOrc", label: "Orc" },
  { varName: "statsRaceShambling_Undead", label: "Shambling Undead" },
  { varName: "statsRaceSkaven", label: "Skaven" },
  { varName: "statsRaceSlann", label: "Slann" },
  { varName: "statsRaceSnotling", label: "Snotling" },
  { varName: "statsRaceTomb_Kings", label: "Tomb Kings" },
  { varName: "statsRaceUnderworld_Denizens", label: "Underworld Denizens" },
  { varName: "statsRaceVampire", label: "Vampire" },
  { varName: "statsRaceWood_Elf", label: "Wood Elf" }
];

// Lista de anos BBT
var BBT_YEARS = [2021, 2022, 2023, 2024, 2025];

// Niveles para insignias de trofeos (1–25 y luego saltos hasta 100)
var TROPHY_BADGE_LEVELS = (function () {
  var arr = [];
  var i;
  for (i = 1; i <= 25; i++) {
    arr.push(i);
  }
  var extra = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
  return arr.concat(extra);
})();

// Niveles para insignias de torneos jugados
// 1, luego 5–100 de 5 en 5, 110–300 de 10 en 10, 350–500 de 50 en 50
var TOURNEY_BADGE_LEVELS = (function () {
  var arr = [1];
  var i;
  for (i = 5; i <= 100; i += 5) {
    arr.push(i);
  }
  for (i = 110; i <= 300; i += 10) {
    arr.push(i);
  }
  for (i = 350; i <= 500; i += 50) {
    arr.push(i);
  }
  return arr;
})();

// Niveles para insignia de paises jugados: 1 a 30
var COUNTRIES_BADGE_LEVELS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30
];

document.addEventListener("DOMContentLoaded", function () {
  var tableBody = document.querySelector("#nafTable tbody");
  var nafFilter = document.getElementById("nafFilter");
  var coachFilter = document.getElementById("coachFilter");
  var paginationContainer = document.getElementById("pagination");

  var allRows = [];
  var filteredRows = [];
  var currentPage = 1;

  // ===================== CARGA DE generalAll (NAF) =====================

  function initDataFromGeneralAll() {
    var source = null;

    // Intentamos usar generalAll o general_all
    if (typeof generalAll !== "undefined" &&
      Object.prototype.toString.call(generalAll) === "[object Array]") {
      source = generalAll;
    } else if (typeof general_all !== "undefined" &&
      Object.prototype.toString.call(general_all) === "[object Array]") {
      source = general_all;
    }

    if (!source) {
      console.error("generalAll / general_all no esta definido o no es un array");
      tableBody.innerHTML = "";
      var trErr = document.createElement("tr");
      var tdErr = document.createElement("td");
      tdErr.colSpan = 2;
      tdErr.className = "text-center text-danger";
      tdErr.textContent = "Error al cargar datos (generalAll / general_all no definido).";
      trErr.appendChild(tdErr);
      tableBody.appendChild(trErr);
      if (paginationContainer) {
        paginationContainer.innerHTML = "";
        paginationContainer.style.display = "none";
      }
      return;
    }

    allRows = [];

    for (var i = 0; i < source.length; i++) {
      var item = source[i];

      // NAF Nr
      var nafNr = "";
      if (item["NAF Nr"] !== undefined && item["NAF Nr"] !== null) {
        nafNr = item["NAF Nr"];
      } else if (item.nafNr !== undefined && item.nafNr !== null) {
        nafNr = item.nafNr;
      } else if (item.NAF !== undefined && item.NAF !== null) {
        nafNr = item.NAF;
      }

      // Entrenador
      var coach = "";
      if (item["NAF Name"] !== undefined && item["NAF Name"] !== null) {
        coach = item["NAF Name"];
      } else if (item.nafName !== undefined && item.nafName !== null) {
        coach = item.nafName;
      } else if (item.coach !== undefined && item.coach !== null) {
        coach = item.coach;
      }

      // Pais
      var countryRaw = "";
      if (item.Country !== undefined && item.Country !== null) {
        countryRaw = item.Country;
      } else if (item.country !== undefined && item.country !== null) {
        countryRaw = item.country;
      }

      var country = String(countryRaw || "").trim();

      // CCAA solo si es Spain/Espana
      var ccaa = "";
      var countryLower = country.toLowerCase();
      if (countryLower === "spain" || countryLower === "espana") {
        if (item.CCAA !== undefined && item.CCAA !== null) {
          ccaa = item.CCAA;
        } else if (item.ccaa !== undefined && item.ccaa !== null) {
          ccaa = item.ccaa;
        }
      }

      // Stats proplayers / topProplayers / megaProplayers (primer elemento)
      var pro = (item.proplayers && item.proplayers.length > 0) ? item.proplayers[0] : null;
      var topPro = (item.topProplayers && item.topProplayers.length > 0) ? item.topProplayers[0] : null;
      var megaPro = (item.megaProplayers && item.megaProplayers.length > 0) ? item.megaProplayers[0] : null;

      // Trofeos globales
      var trophies = item.trophies || {};
      var tWinner = parseInt(trophies.winner, 10) || 0;
      var tRunnerup = parseInt(trophies.runnerup, 10) || 0;
      var tTouchdowns = parseInt(trophies.touchdowns, 10) || 0;
      var tCasualties = parseInt(trophies.casualties, 10) || 0;
      var tStuntycup = parseInt(trophies.stuntycup, 10) || 0;
      var tBestpainted = parseInt(trophies.bestpainted, 10) || 0;
      var tOtherawards = parseInt(trophies.otherawards, 10) || 0;

      // Torneos organizados (viene de mapsGeneratorNaf -> generalAll)
      var organizer = 0;
      if (item.Organizador !== undefined && item.Organizador !== null && item.Organizador !== "") {
        organizer = parseInt(item.Organizador, 10) || 0;
      } else if (item.organizador !== undefined && item.organizador !== null && item.organizador !== "") {
        organizer = parseInt(item.organizador, 10) || 0;
      } else if (item.organizer !== undefined && item.organizer !== null && item.organizer !== "") {
        organizer = parseInt(item.organizer, 10) || 0;
      }

      var rowObj = {
        nafNr: String(nafNr),
        coach: String(coach),
        country: country,
        ccaa: String(ccaa),
        countriesPlayed: parseInt(item.countriesPlayed, 10) || 0, // NEW

        organizer: organizer, // torneos organizados

        rating: item.rating,
        bestRating: item.bestRating,
        worstRating: item.worstRating,
        tendency: item.tendency,
        totalTournaments: item.totalTournaments,
        totalGames: item.totalGames,
        totalWins: item.totalWins,
        totalDraws: item.totalDraws,
        totalLosses: item.totalLosses,
        totalWinRatio: item.totalWinRatio,
        victoryStreak: item.victoryStreak,
        bestVictoryStreak: item.bestVictoryStreak,
        noLostStreak: item.noLostStreak,
        bestNoLostStreak: item.bestNoLostStreak,
        lostStreak: item.lostStreak,
        worstLostStreak: item.worstLostStreak,
        oneTdStreak: item.oneTdStreak,
        bestOneTdStreak: item.bestOneTdStreak,
        twoTdStreak: item.twoTdStreak,
        bestTwoTdStreak: item.bestTwoTdStreak,
        noTdAgainstStreak: item.noTdAgainstStreak,
        bestNoTdAgainstStreak: item.bestNoTdAgainstStreak,

        // Proplayers
        proGames: pro ? pro.totalGames : null,
        proWins: pro ? pro.totalWins : null,
        proDraws: pro ? pro.totalDraws : null,
        proLosses: pro ? pro.totalLosses : null,
        proWinRatio: pro ? pro.totalWinRatio : null,

        // Top Proplayers
        topProGames: topPro ? topPro.totalGames : null,
        topProWins: topPro ? topPro.totalWins : null,
        topProDraws: topPro ? topPro.totalDraws : null,
        topProLosses: topPro ? topPro.totalLosses : null,
        topProWinRatio: topPro ? topPro.totalWinRatio : null,

        // Mega Proplayers
        megaProGames: megaPro ? megaPro.totalGames : null,
        megaProWins: megaPro ? megaPro.totalWins : null,
        megaProDraws: megaPro ? megaPro.totalDraws : null,
        megaProLosses: megaPro ? megaPro.totalLosses : null,
        megaProWinRatio: megaPro ? megaPro.totalWinRatio : null,

        // Trofeos globales
        trophiesWinner: tWinner,
        trophiesRunnerup: tRunnerup,
        trophiesTouchdowns: tTouchdowns,
        trophiesCasualties: tCasualties,
        trophiesStuntycup: tStuntycup,
        trophiesBestpainted: tBestpainted,
        trophiesOtherawards: tOtherawards
      };

      // Solo guardamos si hay un NAF o un entrenador
      if (nafNr || coach) {
        allRows.push(rowObj);
      }
    }
  }

  // ===================== CARGA DE statsYearYYYY (NAF, por ano) =====================

  function getStatsForYear(year) {
    var varName = "statsYear" + year;
    try {
      var data = window[varName];
      if (!data && typeof eval === "function") {
        data = eval(varName);
      }
      if (Object.prototype.toString.call(data) === "[object Array]") {
        return data;
      }
    } catch (e) {
      // ignorar
    }
    return [];
  }

  function initYearStats() {
    yearStatsByNaf = {};
    var currentYear = new Date().getFullYear();

    for (var y = YEAR_START; y <= currentYear; y++) {
      var data = getStatsForYear(y);
      if (!data || !data.length) continue;

      for (var i = 0; i < data.length; i++) {
        var item = data[i];

        var nafNr = "";
        if (item["NAF Nr"] !== undefined && item["NAF Nr"] !== null) {
          nafNr = item["NAF Nr"];
        } else if (item.nafNr !== undefined && item.nafNr !== null) {
          nafNr = item.nafNr;
        } else if (item.NAF !== undefined && item.NAF !== null) {
          nafNr = item.NAF;
        }
        nafNr = String(nafNr || "");
        if (!nafNr) continue;

        // Trofeos por año
        var trophies = item.trophies || {};
        var tWinner = parseInt(trophies.winner, 10) || 0;
        var tRunnerup = parseInt(trophies.runnerup, 10) || 0;
        var tTouchdowns = parseInt(trophies.touchdowns, 10) || 0;
        var tCasualties = parseInt(trophies.casualties, 10) || 0;
        var tStuntycup = parseInt(trophies.stuntycup, 10) || 0;
        var tBestpainted = parseInt(trophies.bestpainted, 10) || 0;
        var tOtherawards = parseInt(trophies.otherawards, 10) || 0;

        if (!yearStatsByNaf[nafNr]) {
          yearStatsByNaf[nafNr] = [];
        }

        yearStatsByNaf[nafNr].push({
          year: y,
          tournaments: item.tournaments || 0,
          gamesWon: item.gamesWon || 0,
          gamesDraw: item.gamesDraw || 0,
          gamesLost: item.gamesLost || 0,
          gamesTotal: item.gamesTotal || 0,
          winRatio: item.winRatio || 0,
          rating: item.rating || 0,
          bestRating: item.bestRating,
          worstRating: item.worstRating,

          trophiesWinner: tWinner,
          trophiesRunnerup: tRunnerup,
          trophiesTouchdowns: tTouchdowns,
          trophiesCasualties: tCasualties,
          trophiesStuntycup: tStuntycup,
          trophiesBestpainted: tBestpainted,
          trophiesOtherawards: tOtherawards
        });
      }
    }

    // Ordenar los anos por mas reciente primero
    for (var key in yearStatsByNaf) {
      if (!yearStatsByNaf.hasOwnProperty(key)) continue;
      yearStatsByNaf[key].sort(function (a, b) {
        return b.year - a.year;
      });
    }
  }

  // ===================== CARGA DE statsRaceXXX (NAF Legacy, por raza) =====================

  function getRaceArray(varName) {
    try {
      var data = window[varName];
      if (!data && typeof eval === "function") {
        data = eval(varName);
      }
      if (Object.prototype.toString.call(data) === "[object Array]") {
        return data;
      }
    } catch (e) {
      // ignorar
    }
    return [];
  }

  function initRaceStats() {
    raceStatsByNaf = {};

    for (var rIndex = 0; rIndex < RACE_SOURCES.length; rIndex++) {
      var raceInfo = RACE_SOURCES[rIndex];
      var data = getRaceArray(raceInfo.varName);
      if (!data || !data.length) continue;

      for (var i = 0; i < data.length; i++) {
        var item = data[i];

        var nafNr = "";
        if (item["NAF Nr"] !== undefined && item["NAF Nr"] !== null) {
          nafNr = item["NAF Nr"];
        } else if (item.nafNr !== undefined && item.nafNr !== null) {
          nafNr = item.nafNr;
        } else if (item.NAF !== undefined && item.NAF !== null) {
          nafNr = item.NAF;
        }
        nafNr = String(nafNr || "");
        if (!nafNr) continue;

        // Trofeos por raza (Legacy)
        var trophies = item.trophies || {};
        var tWinner = parseInt(trophies.winner, 10) || 0;
        var tRunnerup = parseInt(trophies.runnerup, 10) || 0;
        var tTouchdowns = parseInt(trophies.touchdowns, 10) || 0;
        var tCasualties = parseInt(trophies.casualties, 10) || 0;
        var tStuntycup = parseInt(trophies.stuntycup, 10) || 0;
        var tBestpainted = parseInt(trophies.bestpainted, 10) || 0;
        var tOtherawards = parseInt(trophies.otherawards, 10) || 0;

        if (!raceStatsByNaf[nafNr]) {
          raceStatsByNaf[nafNr] = [];
        }

        raceStatsByNaf[nafNr].push({
          race: raceInfo.label,
          tournaments: item.tournaments || item.totalTournaments || 0,
          gamesWon: item.gamesWon || 0,
          gamesDraw: item.gamesDraw || 0,
          gamesLost: item.gamesLost || 0,
          gamesTotal: item.gamesTotal || 0,
          winRatio: item.winRatio || 0,
          rating: item.rating || 0,
          bestRating: item.bestRating,
          worstRating: item.worstRating,
          tendency: item.tendency,

          trophiesWinner: tWinner,
          trophiesRunnerup: tRunnerup,
          trophiesTouchdowns: tTouchdowns,
          trophiesCasualties: tCasualties,
          trophiesStuntycup: tStuntycup,
          trophiesBestpainted: tBestpainted,
          trophiesOtherawards: tOtherawards
        });
      }
    }

    // Ordenar razas alfabeticamente
    for (var key in raceStatsByNaf) {
      if (!raceStatsByNaf.hasOwnProperty(key)) continue;
      raceStatsByNaf[key].sort(function (a, b) {
        if (a.race < b.race) return -1;
        if (a.race > b.race) return 1;
        return 0;
      });
    }
  }

  // ===================== CARGA DE statsRaceXXX BB2025 (variantid=15, por raza) =====================

  // Convierte "Old World Alliance" -> "oldworldalliance"
  function slugifyRaceLabel(label) {
    return String(label || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  // Busca arrays tipo amazon2025, blackorc2025, chaoschosen2025, etc.
  function getRaceArray2025ByLabel(label) {
    var slug = slugifyRaceLabel(label);
    if (!slug) return [];

    var candidates = [
      slug + "2025",
      slug + "_2025"
    ];

    for (var i = 0; i < candidates.length; i++) {
      var name = candidates[i];
      try {
        var data = window[name];
        if (!data && typeof eval === "function") {
          data = eval(name);
        }
        if (Object.prototype.toString.call(data) === "[object Array]") {
          return data;
        }
      } catch (e) {
        // ignorar y probar el siguiente
      }
    }

    return [];
  }

  function initRaceStats2025() {
    raceStats2025ByNaf = {};

    for (var rIndex = 0; rIndex < RACE_SOURCES.length; rIndex++) {
      var raceInfo = RACE_SOURCES[rIndex];
      var data = getRaceArray2025ByLabel(raceInfo.label);
      if (!data || !data.length) continue;

      for (var i = 0; i < data.length; i++) {
        var item = data[i];

        var nafNr = "";
        if (item["NAF Nr"] !== undefined && item["NAF Nr"] !== null) {
          nafNr = item["NAF Nr"];
        } else if (item.nafNr !== undefined && item.nafNr !== null) {
          nafNr = item.nafNr;
        } else if (item.NAF !== undefined && item.NAF !== null) {
          nafNr = item.NAF;
        }
        nafNr = String(nafNr || "");
        if (!nafNr) continue;

        // Trofeos por raza BB2025
        var trophies = item.trophies || {};
        var tWinner = parseInt(trophies.winner, 10) || 0;
        var tRunnerup = parseInt(trophies.runnerup, 10) || 0;
        var tTouchdowns = parseInt(trophies.touchdowns, 10) || 0;
        var tCasualties = parseInt(trophies.casualties, 10) || 0;
        var tStuntycup = parseInt(trophies.stuntycup, 10) || 0;
        var tBestpainted = parseInt(trophies.bestpainted, 10) || 0;
        var tOtherawards = parseInt(trophies.otherawards, 10) || 0;

        if (!raceStats2025ByNaf[nafNr]) {
          raceStats2025ByNaf[nafNr] = [];
        }

        raceStats2025ByNaf[nafNr].push({
          race: raceInfo.label,
          tournaments: item.tournaments || item.totalTournaments || 0,
          gamesWon: item.gamesWon || 0,
          gamesDraw: item.gamesDraw || 0,
          gamesLost: item.gamesLost || 0,
          gamesTotal: item.gamesTotal || 0,
          winRatio: item.winRatio || 0,
          rating: item.rating || 0,
          bestRating: item.bestRating,
          worstRating: item.worstRating,
          tendency: item.tendency,

          trophiesWinner: tWinner,
          trophiesRunnerup: tRunnerup,
          trophiesTouchdowns: tTouchdowns,
          trophiesCasualties: tCasualties,
          trophiesStuntycup: tStuntycup,
          trophiesBestpainted: tBestpainted,
          trophiesOtherawards: tOtherawards
        });
      }
    }

    // Ordenar razas alfabeticamente
    for (var key in raceStats2025ByNaf) {
      if (!raceStats2025ByNaf.hasOwnProperty(key)) continue;
      raceStats2025ByNaf[key].sort(function (a, b) {
        if (a.race < b.race) return -1;
        if (a.race > b.race) return 1;
        return 0;
      });
    }
  }

  // ===================== CARGA DE generalAll BBT =====================

  function getBbtGeneralSource() {
    var name = "generalAllBbt";
    try {
      var data = window[name];
      if (!data && typeof eval === "function") {
        data = eval(name);
      }
      if (Object.prototype.toString.call(data) === "[object Array]") {
        return data;
      }
    } catch (e) {
      // ignorar
    }
    return null;
  }

  function initBbtOverall() {
    bbtOverallByNaf = {};
    var source = getBbtGeneralSource();
    if (!source || !source.length) {
      return;
    }

    for (var i = 0; i < source.length; i++) {
      var item = source[i];

      var nafNr = "";
      if (item["NAF Nr"] !== undefined && item["NAF Nr"] !== null) {
        nafNr = item["NAF Nr"];
      } else if (item.nafNr !== undefined && item.nafNr !== null) {
        nafNr = item.nafNr;
      } else if (item.NAF !== undefined && item.NAF !== null) {
        nafNr = item.NAF;
      }
      nafNr = String(nafNr || "");
      if (!nafNr) continue;

      bbtOverallByNaf[nafNr] = {
        rating: item.rating,
        bestRating: item.bestRating,
        worstRating: item.worstRating,
        tendency: item.tendency,
        totalTournaments: item.totalTournaments,
        totalGames: item.totalGames,
        totalWins: item.totalWins,
        totalDraws: item.totalDraws,
        totalLosses: item.totalLosses,
        totalWinRatio: item.totalWinRatio
      };
    }
  }

  // ===================== CARGA DE statsYear BBT =====================

  function getBbtStatsForYear(year) {
    var candidates = [
      "statsBbtYear" + year,
      "bbtStatsYear" + year,
      "statsYearBbt" + year,
      "statsYearBBT" + year,
      "statsYear" + year + "Bbt",
      "statsYear" + year + "_bbt"
    ];
    for (var i = 0; i < candidates.length; i++) {
      var name = candidates[i];
      try {
        var data = window[name];
        if (!data && typeof eval === "function") {
          data = eval(name);
        }
        if (Object.prototype.toString.call(data) === "[object Array]") {
          return data;
        }
      } catch (e) {
        // ignorar
      }
    }
    return [];
  }

  function initBbtYearStats() {
    bbtYearStatsByNaf = {};

    for (var yIdx = 0; yIdx < BBT_YEARS.length; yIdx++) {
      var y = BBT_YEARS[yIdx];
      var data = getBbtStatsForYear(y);
      if (!data || !data.length) continue;

      for (var i = 0; i < data.length; i++) {
        var item = data[i];

        var nafNr = "";
        if (item["NAF Nr"] !== undefined && item["NAF Nr"] !== null) {
          nafNr = item["NAF Nr"];
        } else if (item.nafNr !== undefined && item.nafNr !== null) {
          nafNr = item.nafNr;
        } else if (item.NAF !== undefined && item.NAF !== null) {
          nafNr = item.NAF;
        }
        nafNr = String(nafNr || "");
        if (!nafNr) continue;

        if (!bbtYearStatsByNaf[nafNr]) {
          bbtYearStatsByNaf[nafNr] = [];
        }

        bbtYearStatsByNaf[nafNr].push({
          year: y,
          tournaments: item.tournaments || 0,
          gamesWon: item.gamesWon || 0,
          gamesDraw: item.gamesDraw || 0,
          gamesLost: item.gamesLost || 0,
          gamesTotal: item.gamesTotal || 0,
          winRatio: item.winRatio || 0,
          rating: item.rating || 0,
          bestRating: item.bestRating,
          worstRating: item.worstRating
        });
      }
    }

    // Ordenar anos BBT por mas reciente
    for (var key in bbtYearStatsByNaf) {
      if (!bbtYearStatsByNaf.hasOwnProperty(key)) continue;
      bbtYearStatsByNaf[key].sort(function (a, b) {
        return b.year - a.year;
      });
    }
  }

  // ===================== ESTADOS VACIOS / SIN RESULTADOS =====================

  function renderEmptyState() {
    tableBody.innerHTML = "";

    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = 2;
    td.className = "text-center text-muted";

    // Clave de traducción para este mensaje
    td.setAttribute("data-i18n", "introduce");

    // Texto por defecto (idioma base)
    td.textContent = "Introduce un NAF # o un Entrenador para buscar.";

    tr.appendChild(td);
    tableBody.appendChild(tr);

    if (paginationContainer) {
      paginationContainer.innerHTML = "";
      paginationContainer.style.display = "none";
    }

    // Si tu librería NO re-traduce automáticamente los nodos nuevos,
    // aquí iría algo tipo:
    // i18next.changeLanguage(currentLang);  // o la función que uses para refrescar
  }


  function renderNoResults() {
    tableBody.innerHTML = "";
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = 2;
    td.className = "text-center text-muted";
    td.textContent = "Sin resultados para los filtros aplicados.";
    tr.appendChild(td);
    tableBody.appendChild(tr);

    if (paginationContainer) {
      paginationContainer.innerHTML = "";
      paginationContainer.style.display = "none";
    }
  }

  // ===================== HELPERS FORMATO =====================

  function safeVal(v, suffix) {
    if (v === undefined || v === null || v === "") {
      return "-";
    }
    if (suffix) {
      return v + suffix;
    }
    return v;
  }

  function safeNum(v, decimals, suffix) {
    if (v === undefined || v === null || v === "") {
      return "-";
    }
    var num = parseFloat(v);
    if (isNaN(num)) {
      return String(v);
    }
    if (typeof decimals === "number") {
      num = num.toFixed(decimals);
    }
    if (suffix) {
      return num + suffix;
    }
    return num;
  }

  // Devuelve el mayor nivel <= valor dentro de levels (levels ordenado ascendente)
  function getBadgeLevel(value, levels) {
    var val = parseInt(value, 10);
    if (isNaN(val) || val <= 0) return 0;
    var chosen = 0;
    for (var i = 0; i < levels.length; i++) {
      if (levels[i] <= val) {
        chosen = levels[i];
      } else {
        break;
      }
    }
    return chosen;
  }

  function buildBadgeImg(src, alt) {
    return '<img width="96" src="' + src + '" alt="' + alt + '" class="badge-icon">';
  }

  function buildSteppedBadge(value, levels, filePrefix, altBase) {
    var lvl = getBadgeLevel(value, levels);
    if (!lvl) return "";
    var src = "img/badges/" + filePrefix + lvl + ".png";
    return buildBadgeImg(src, altBase + " " + lvl);
  }

  // Cuenta razas con rating entre [minRating, maxRating) (o >= minRating si maxRating es null)
  function countRacesByRating(list, minRating, maxRatingExclusive) {
    if (!list || !list.length) return 0;
    var count = 0;
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var rating = parseFloat(r.rating);
      if (isNaN(rating)) continue;
      if (rating < minRating) continue;
      if (maxRatingExclusive !== null && rating >= maxRatingExclusive) continue;
      count++;
    }
    return count;
  }

  // ===================== RENDER TABLA =====================

  function renderTableRows(rows) {
    tableBody.innerHTML = "";

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];

      // Listas de razas para calcular insignias Proplayer
      var legacyRacesList = raceStatsByNaf[r.nafNr] || [];
      var bb2025RacesList = raceStats2025ByNaf[r.nafNr] || [];

      var megaLegacyCount = countRacesByRating(legacyRacesList, 220, null);
      var topLegacyCount = countRacesByRating(legacyRacesList, 200, 220);
      var proLegacyCount = countRacesByRating(legacyRacesList, 180, 200);

      var mega2025Count = countRacesByRating(bb2025RacesList, 220, null);
      var top2025Count = countRacesByRating(bb2025RacesList, 200, 220);
      var pro2025Count = countRacesByRating(bb2025RacesList, 180, 200);

      // ---------- Fila principal: Perfil + Insignias ----------
      var mainTr = document.createElement("tr");
      mainTr.className = "profile-main-row";

      var perfilHtml = "";
      perfilHtml += "<div><strong>NAF #:</strong> " + r.nafNr + "</div>";
      perfilHtml += "<div><strong data-i18n='entrenador'>Entrenador:</strong> " + r.coach + "</div>";
      perfilHtml += "<div><strong data-i18n='pais'>Pais:</strong> " + (r.country || "-") + "</div>";
      if (r.ccaa) {
        perfilHtml += "<div><strong data-i18n='ccaa'>CCAA:</strong> " + r.ccaa + "</div>";
      }

      // Totales globales justo debajo del entrenador
      perfilHtml += '<hr class="my-2">';
      perfilHtml += '<div><strong data-i18n="torneos">Torneos:</strong> ' + safeVal(r.totalTournaments) + '</div>';
      perfilHtml += '<div><strong data-i18n="partidos">Partidos:</strong> ' + safeVal(r.totalGames) + '</div>';
      perfilHtml += '<div><strong data-i18n="victoria">Victorias:</strong> ' + safeVal(r.totalWins) + '</div>';
      perfilHtml += '<div><strong data-i18n="empate">Empates:</strong> ' + safeVal(r.totalDraws) + '</div>';
      perfilHtml += '<div><strong data-i18n="derrota">Derrotas:</strong> ' + safeVal(r.totalLosses) + '</div>';
      perfilHtml += '<div><strong data-i18n="wrTotal">WR total:</strong> ' + safeNum(r.totalWinRatio, 2, "%") + '</div>';

      // Insignias en el orden solicitado
      var badgesHtml = "";

      // 1) Torneos jugados (tourneysX.png)
      var tourneysCount = parseInt(r.totalTournaments, 10) || 0;
      badgesHtml += buildSteppedBadge(
        tourneysCount,
        TOURNEY_BADGE_LEVELS,
        "tourneys",
        "Torneos jugados"
      );

      // 2) Partidos jugados (gamesX.png)
      var games = parseInt(r.totalGames, 10) || 0;
      var gameThresholds = [
        3000, 2750, 2500, 2250, 2000,
        1750, 1500, 1400, 1300, 1250,
        1200, 1100, 1000, 900, 800,
        700, 600, 500, 400, 300,
        200, 100
      ];
      for (var gi = 0; gi < gameThresholds.length; gi++) {
        var tg = gameThresholds[gi];
        if (games >= tg) {
          var gameBadgePath = "img/badges/games" + tg + ".png";
          badgesHtml += buildBadgeImg(gameBadgePath, tg + " partidos jugados");
          break;
        }
      }

      // 3) Partidos ganados (winsX.png)
      var wins = parseInt(r.totalWins, 10) || 0;
      var winThresholds = [
        1500, 1400, 1300, 1200, 1100,
        1000, 900, 800, 700, 600,
        500, 400, 300, 200, 100
      ];
      for (var wi = 0; wi < winThresholds.length; wi++) {
        var tw = winThresholds[wi];
        if (wins >= tw) {
          var winBadgePath = "img/badges/wins" + tw + ".png";
          badgesHtml += buildBadgeImg(winBadgePath, tw + " victorias");
          break;
        }
      }

      // 4) Organizador torneos (tournamentOrganiser.png, si tiene alguno)
      var organizerCount = parseInt(r.organizer, 10) || 0;
      if (organizerCount > 0) {
        badgesHtml += buildBadgeImg(
          "img/badges/tournamentOrganiser.png",
          "Organizador de torneos (" + organizerCount + ")"
        );
      }

      // 4a) Paises Jugados (countriesX.png)
      // Bronce(2), Plata(3), Oro(5), Diamante(10)
      var cpCount = parseInt(r.countriesPlayed, 10) || 0;
      badgesHtml += buildSteppedBadge(
        cpCount,
        COUNTRIES_BADGE_LEVELS,
        "countries",
        "Países jugados"
      );

      // 5) Trofeos ganados (trophyX.png) -> winner
      var winnerCount = parseInt(r.trophiesWinner, 10) || 0;
      badgesHtml += buildSteppedBadge(
        winnerCount,
        TROPHY_BADGE_LEVELS,
        "trophy",
        "Torneos ganados"
      );

      // 6) Máx. Anotador ganados (touchdownsX.png)
      var tdCount = parseInt(r.trophiesTouchdowns, 10) || 0;
      badgesHtml += buildSteppedBadge(
        tdCount,
        TROPHY_BADGE_LEVELS,
        "touchdowns",
        "Máx. Anotador"
      );

      // 7) Máx. Heridos ganados (casualtiesX.png)
      var casualtiesCount = parseInt(r.trophiesCasualties, 10) || 0;
      badgesHtml += buildSteppedBadge(
        casualtiesCount,
        TROPHY_BADGE_LEVELS,
        "casualties",
        "Máx. Heridos"
      );


      // 4b) Stunty Cup (trofeo) - stuntycupX.png
      var scCount = parseInt(r.trophiesStuntycup, 10) || 0;
      badgesHtml += buildSteppedBadge(
        scCount,
        TROPHY_BADGE_LEVELS,
        "stuntycup",
        "Stunty Cup"
      );

      // 8) Pintura ganados (painterX.png)
      var painterCount = parseInt(r.trophiesBestpainted, 10) || 0;
      badgesHtml += buildSteppedBadge(
        painterCount,
        TROPHY_BADGE_LEVELS,
        "painter",
        "Mejor pintado"
      );

      // 9) Proplayer (Legacy, 200–209.999) -> proplayerX.png
      if (proLegacyCount > 0) {
        badgesHtml += buildBadgeImg(
          "img/badges/proplayer" + proLegacyCount + ".png",
          "Proplayer Legacy (" + proLegacyCount + " razas 200–209)"
        );
      }

      // 10) Top Proplayer (Legacy, 210–219.999) -> topProplayerX.png
      if (topLegacyCount > 0) {
        badgesHtml += buildBadgeImg(
          "img/badges/topProplayer" + topLegacyCount + ".png",
          "Top Proplayer Legacy (" + topLegacyCount + " razas 210–219)"
        );
      }

      // 11) Mega Proplayer (Legacy, 220+) -> megaProplayerX.png
      if (megaLegacyCount > 0) {
        badgesHtml += buildBadgeImg(
          "img/badges/megaProplayer" + megaLegacyCount + ".png",
          "Mega Proplayer Legacy (" + megaLegacyCount + " razas 220+)"
        );
      }

      // EXTRA: versiones BB2025 al final (si las quieres usar visualmente)
      if (pro2025Count > 0) {
        badgesHtml += buildBadgeImg(
          "img/badges/proplayer2025" + pro2025Count + ".png",
          "Proplayer 2025 (" + pro2025Count + " razas 200–209)"
        );
      }

      if (top2025Count > 0) {
        badgesHtml += buildBadgeImg(
          "img/badges/topProplayer2025" + top2025Count + ".png",
          "Top Proplayer 2025 (" + top2025Count + " razas 210–219)"
        );
      }

      if (mega2025Count > 0) {
        badgesHtml += buildBadgeImg(
          "img/badges/megaProplayer2025" + mega2025Count + ".png",
          "Mega Proplayer 2025 (" + mega2025Count + " razas 220+)"
        );
      }

      mainTr.innerHTML =
        "<td>" + perfilHtml + "</td>" +
        '<td class="text-center align-middle">' + badgesHtml + "</td>";

      tableBody.appendChild(mainTr);

      // ---------- Fila de estadisticas debajo (5 columnas) ----------
      var statsTr = document.createElement("tr");
      statsTr.className = "profile-stats-row";

      var statsTd = document.createElement("td");
      statsTd.colSpan = 2;

      var statsHtml = "";

      statsHtml += '<div class="row g-3 profile-stats-row">';

      // ===== COLUMNA 1: GLOBAL NAF (rating, rachas, proplayers…) =====
      statsHtml += '<div class="col-md-3 col-12">';

      // 1) RATING (los totales ya se muestran arriba)
      statsHtml += '<div class="stat-item"><span class="stat-label">Rating:</span> ' + safeNum(r.rating, 2) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="mejorRating">Mejor Rating:</span> ' + safeNum(r.bestRating, 2) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="peorRating">Peor Rating:</span> ' + safeNum(r.worstRating, 2) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="tendencia">Tendencia:</span> ' + safeNum(r.tendency, 2) + '</div>';

      statsHtml += '<hr class="my-2">';

      // 2) PREMIOS GLOBALES + TORNEOS ORGANIZADOS
      var organizerCountGlobal = parseInt(r.organizer, 10) || 0;
      var hasOrganizer = organizerCountGlobal > 0;

      var totalTrophiesGlobal =
        (r.trophiesWinner || 0) +
        (r.trophiesRunnerup || 0) +
        (r.trophiesTouchdowns || 0) +
        (r.trophiesCasualties || 0) +
        (r.trophiesStuntycup || 0) +
        (r.trophiesBestpainted || 0) +
        (r.trophiesOtherawards || 0);

      if (hasOrganizer || totalTrophiesGlobal > 0) {

        if (hasOrganizer) {
          statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="torneosOrganizados">Torneos organizados: </span>' + organizerCountGlobal + '</div>';
        }

        if (r.trophiesWinner > 0) {
          statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="torneosGanados">Torneos ganados: </span>' + r.trophiesWinner + '</div>';
        }
        if (r.trophiesRunnerup > 0) {
          statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="segundosPuestos">Segundos puestos: </span>' + r.trophiesRunnerup + '</div>';
        }
        if (r.trophiesTouchdowns > 0) {
          statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="maxAnotador">Máx. Anotador: </span>' + r.trophiesTouchdowns + '</div>';
        }
        if (r.trophiesCasualties > 0) {
          statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="maxHeridos">Máx. Heridos: </span>' + r.trophiesCasualties + '</div>';
        }
        if (r.trophiesStuntycup > 0) {
          statsHtml += '<div class="stat-item"><span class="stat-label">Stunty Cup: </span>' + r.trophiesStuntycup + '</div>';
        }
        if (r.trophiesBestpainted > 0) {
          statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="mejorPintado">Mejor pintado: </span>' + r.trophiesBestpainted + '</div>';
        }
        if (r.trophiesOtherawards > 0) {
          statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="otrosPremios">Otros premios: </span>' + r.trophiesOtherawards + '</div>';
        }

        statsHtml += '<hr class="my-2">';
      }

      // 3) RACHAS
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="victorias">Racha victorias:</span> ' + safeVal(r.victoryStreak) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="mejorVictorias">Mejor racha victorias:</span> ' + safeVal(r.bestVictoryStreak) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="noDerrotas">Racha sin perder:</span> ' + safeVal(r.noLostStreak) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="mejorNoDerrotas">Mejor racha sin perder:</span> ' + safeVal(r.bestNoLostStreak) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="derrotas">Racha derrotas:</span> ' + safeVal(r.lostStreak) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="peorDerrotas">Peor racha derrotas:</span> ' + safeVal(r.worstLostStreak) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="unTd">Racha marcando 1+ TD:</span> ' + safeVal(r.oneTdStreak) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="mejorUnTd">Mejor marcando 1+ TD:</span> ' + safeVal(r.bestOneTdStreak) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="dosTd">Racha marcando 2+ TD:</span> ' + safeVal(r.twoTdStreak) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="mejorDosTd">Mejor marcando 2+ TD:</span> ' + safeVal(r.bestTwoTdStreak) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="noTd">Racha sin recibir TD:</span> ' + safeVal(r.noTdAgainstStreak) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="mejorNoTd">Mejor racha sin recibir TD:</span> ' + safeVal(r.bestNoTdAgainstStreak) + '</div>';

      statsHtml += '<hr class="my-2">';

      // 4) PROPLAYERS
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="proPartidos">Vs Proplayers - Partidos:</span> ' + safeVal(r.proGames) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="proVictorias">Vs Proplayers - Victorias:</span> ' + safeVal(r.proWins) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="proEmpates">Vs Proplayers - Empates:</span> ' + safeVal(r.proDraws) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="proDerrotas">Vs Proplayers - Derrotas:</span> ' + safeVal(r.proLosses) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label">Vs Proplayers - WR:</span> ' + safeNum(r.proWinRatio, 2, "%") + '</div>';

      statsHtml += '<hr class="my-2">';

      // 5) TOP PROPLAYERS
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="topproPartidos">Vs Top Proplayers - Partidos:</span> ' + safeVal(r.topProGames) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="topproVictorias">Vs Top Proplayers - Victorias:</span> ' + safeVal(r.topProWins) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="topproEmpates">Vs Top Proplayers - Empates:</span> ' + safeVal(r.topProDraws) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="topproDerrotas">Vs Top Proplayers - Derrotas:</span> ' + safeVal(r.topProLosses) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label">Vs Top Proplayers - WR:</span> ' + safeNum(r.topProWinRatio, 2, "%") + '</div>';

      statsHtml += '<hr class="my-2">';

      // 6) MEGA PROPLAYERS
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="megaproPartidos">Vs Mega Proplayers - Partidos:</span> ' + safeVal(r.megaProGames) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="megaproVictorias">Vs Mega Proplayers - Victorias:</span> ' + safeVal(r.megaProWins) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="megaproEmpates">Vs Mega Proplayers - Empates:</span> ' + safeVal(r.megaProDraws) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="megaproDerrotas">Vs Mega Proplayers - Derrotas:</span> ' + safeVal(r.megaProLosses) + '</div>';
      statsHtml += '<div class="stat-item"><span class="stat-label">Vs Mega Proplayers - WR:</span> ' + safeNum(r.megaProWinRatio, 2, "%") + '</div>';

      statsHtml += '</div>'; // fin columna 1

      // ===== COLUMNA 2: ESTADISTICAS NAF POR ANO =====
      statsHtml += '<div class="col-md-3 col-12">';

      var yearList = yearStatsByNaf[r.nafNr] || [];
      if (!yearList.length) {
        statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="sinDatosAnyos">Sin datos por años</span></div>';
      } else {
        for (var yi = 0; yi < yearList.length; yi++) {
          var ys = yearList[yi];

          statsHtml += '<div class="stat-item"><strong data-i18n="anyo">' + ys.year + '</strong></div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="torneos">Torneos</span>: ' + safeVal(ys.tournaments) + '</div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="partidos">Partidos</span>: ' + safeVal(ys.gamesTotal) + " (" + safeVal(ys.gamesWon) + "/" + safeVal(ys.gamesDraw) + "/" + safeVal(ys.gamesLost) + ")</div>";
          statsHtml += '<div class="stat-item ms-3">WR: ' + safeNum(ys.winRatio, 2, "%") + '</div>';
          statsHtml += '<div class="stat-item ms-3">Rating: ' + safeNum(ys.rating, 2) + ' (<span data-i18n="mejor">Mejor</span> ' + safeNum(ys.bestRating, 2) + ', <span data-i18n="peor">Peor</span> ' + safeNum(ys.worstRating, 2) + ')</div>';

          var totalTrophiesYear =
            (ys.trophiesWinner || 0) +
            (ys.trophiesRunnerup || 0) +
            (ys.trophiesTouchdowns || 0) +
            (ys.trophiesCasualties || 0) +
            (ys.trophiesStuntycup || 0) +
            (ys.trophiesBestpainted || 0) +
            (ys.trophiesOtherawards || 0);

          if (totalTrophiesYear > 0) {
            statsHtml += '<div class="stat-item ms-3"><u data-i18n="prizes">Premios</u></div>';
            if (ys.trophiesWinner > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="torneosGanados">Torneos ganados</span>: ' + ys.trophiesWinner + '</div>';
            }
            if (ys.trophiesRunnerup > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="segundosPuestos">Segundos puestos</span>: ' + ys.trophiesRunnerup + '</div>';
            }
            if (ys.trophiesTouchdowns > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="maxAnotador">Máx. Anotador</span>: ' + ys.trophiesTouchdowns + '</div>';
            }
            if (ys.trophiesCasualties > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="maxHeridos">Máx. Heridos</span>: ' + ys.trophiesCasualties + '</div>';
            }
            if (ys.trophiesStuntycup > 0) {
              statsHtml += '<div class="stat-item ms-4">Stunty Cup: ' + ys.trophiesStuntycup + '</div>';
            }
            if (ys.trophiesBestpainted > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="mejorPintado">Mejor pintado</span>: ' + ys.trophiesBestpainted + '</div>';
            }
            if (ys.trophiesOtherawards > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="otrosPremios">Otros premios</span>: ' + ys.trophiesOtherawards + '</div>';
            }
          }

          if (yi < yearList.length - 1) {
            statsHtml += '<hr class="my-1">';
          }
        }
      }

      statsHtml += '</div>'; // fin columna 2

      // ===== COLUMNA 3: ESTADISTICAS NAF POR RAZA (Legacy, sin torneos) =====
      statsHtml += '<div class="col-md-3 col-12">';

      var raceList = raceStatsByNaf[r.nafNr] || [];
      if (!raceList.length) {
        statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="sinDatosRaza">Sin datos por raza</span></div>';
      } else {
        for (var ri = 0; ri < raceList.length; ri++) {
          var rs = raceList[ri];

          statsHtml += '<div class="stat-item"><strong>' + rs.race + ' (Legacy)</strong></div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="partidos">Partidos</span>: ' + safeVal(rs.gamesTotal) + " (" + safeVal(rs.gamesWon) + "/" + safeVal(rs.gamesDraw) + "/" + safeVal(rs.gamesLost) + ")</div>";
          statsHtml += '<div class="stat-item ms-3">WR: ' + safeNum(rs.winRatio, 2, "%") + '</div>';
          statsHtml += '<div class="stat-item ms-3">Rating: ' + safeNum(rs.rating, 2) + ' (<span data-i18n="mejor">Mejor</span> ' + safeNum(rs.bestRating, 2) + ', <span data-i18n="peor">Peor</span> ' + safeNum(rs.worstRating, 2) + ')</div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="tendencia">Tendencia</span>: ' + safeNum(rs.tendency, 2) + '</div>';

          var totalTrophiesRace =
            (rs.trophiesWinner || 0) +
            (rs.trophiesRunnerup || 0) +
            (rs.trophiesTouchdowns || 0) +
            (rs.trophiesCasualties || 0) +
            (rs.trophiesStuntycup || 0) +
            (rs.trophiesBestpainted || 0) +
            (rs.trophiesOtherawards || 0);

          if (totalTrophiesRace > 0) {
            statsHtml += '<div class="stat-item ms-3"><u data-i18n="prizes">Premios</u></div>';
            if (rs.trophiesWinner > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="torneosGanados">Torneos ganados</span>: ' + rs.trophiesWinner + '</div>';
            }
            if (rs.trophiesRunnerup > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="segundosPuestos">Segundos puestos</span>: ' + rs.trophiesRunnerup + '</div>';
            }
            if (rs.trophiesTouchdowns > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="maxAnotador">Máx. Anotador</span>: ' + rs.trophiesTouchdowns + '</div>';
            }
            if (rs.trophiesCasualties > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="maxHeridos">Máx. Heridos</span>: ' + rs.trophiesCasualties + '</div>';
            }
            if (rs.trophiesStuntycup > 0) {
              statsHtml += '<div class="stat-item ms-4">Stunty Cup</span>: ' + rs.trophiesStuntycup + '</div>';
            }
            if (rs.trophiesBestpainted > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="mejorPintado">Mejor pintado</span>: ' + rs.trophiesBestpainted + '</div>';
            }
            if (rs.trophiesOtherawards > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="otrosPremios">Otros premios</span>: ' + rs.trophiesOtherawards + '</div>';
            }
          }

          if (ri < raceList.length - 1) {
            statsHtml += '<hr class="my-1">';
          }
        }
      }

      statsHtml += '</div>'; // fin columna 3

      // ===== COLUMNA 4: ESTADISTICAS POR RAZA BB2025 (variantid=15) =====
      statsHtml += '<div class="col-md-3 col-12">';

      var raceList2025 = raceStats2025ByNaf[r.nafNr] || [];
      if (!raceList2025.length) {
        statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="sinDatosRazaBB2025">Sin datos para razas BB2025</span></div>';
      } else {
        for (var r25 = 0; r25 < raceList2025.length; r25++) {
          var rs25 = raceList2025[r25];

          statsHtml += '<div class="stat-item"><strong>' + rs25.race + ' (BB2025)</strong></div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="partidos">Partidos</span>: ' + safeVal(rs25.gamesTotal) + " (" + safeVal(rs25.gamesWon) + "/" + safeVal(rs25.gamesDraw) + "/" + safeVal(rs25.gamesLost) + ")</div>";
          statsHtml += '<div class="stat-item ms-3">WR: ' + safeNum(rs25.winRatio, 2, "%") + '</div>';
          statsHtml += '<div class="stat-item ms-3">Rating: ' + safeNum(rs25.rating, 2) + ' (Mejor ' + safeNum(rs25.bestRating, 2) + ', Peor ' + safeNum(rs25.worstRating, 2) + ')</div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="tendencia">Tendencia</span>: ' + safeNum(rs25.tendency, 2) + '</div>';

          var totalTrophiesRace2025 =
            (rs25.trophiesWinner || 0) +
            (rs25.trophiesRunnerup || 0) +
            (rs25.trophiesTouchdowns || 0) +
            (rs25.trophiesCasualties || 0) +
            (rs25.trophiesStuntycup || 0) +
            (rs25.trophiesBestpainted || 0) +
            (rs25.trophiesOtherawards || 0);

          if (totalTrophiesRace2025 > 0) {
            statsHtml += '<div class="stat-item ms-3"><u data-i18n="prizes">Premios</u></div>';
            if (rs25.trophiesWinner > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="torneosGanados">Torneos ganados</span>: ' + rs25.trophiesWinner + '</div>';
            }
            if (rs25.trophiesRunnerup > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="segundosPuestos">Segundos puestos</span>: ' + rs25.trophiesRunnerup + '</div>';
            }
            if (rs25.trophiesTouchdowns > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="maxAnotador">Máx. Anotador</span>: ' + rs25.trophiesTouchdowns + '</div>';
            }
            if (rs25.trophiesCasualties > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="maxHeridos">Máx. Heridos</span>: ' + rs25.trophiesCasualties + '</div>';
            }
            if (rs25.trophiesStuntycup > 0) {
              statsHtml += '<div class="stat-item ms-4">Stunty Cup: ' + rs25.trophiesStuntycup + '</div>';
            }
            if (rs25.trophiesBestpainted > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="mejorPintado">Mejor pintado</span>: ' + rs25.trophiesBestpainted + '</div>';
            }
            if (rs25.trophiesOtherawards > 0) {
              statsHtml += '<div class="stat-item ms-4"><span data-i18n="otrosPremios">Otros premios</span>: ' + rs25.trophiesOtherawards + '</div>';
            }
          }

          if (r25 < raceList2025.length - 1) {
            statsHtml += '<hr class="my-1">';
          }
        }
      }

      statsHtml += '</div>'; // fin columna 4

      // ===== COLUMNA 5: ESTADISTICAS BBT (global + por ano) =====
      statsHtml += '<div class="col-md-3 col-12">';

      var bbtOverall = bbtOverallByNaf[r.nafNr];
      var bbtYears = bbtYearStatsByNaf[r.nafNr] || [];

      if (!bbtOverall && (!bbtYears || !bbtYears.length)) {
        statsHtml += '<div class="stat-item"><span class="stat-label" data-i18n="sinDatosBbt">Sin datos BBT</span></div>';
      } else {
        if (bbtOverall) {
          statsHtml += '<div class="stat-item"><strong>BBT global</strong></div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="torneos">Torneos</span>: ' + safeVal(bbtOverall.totalTournaments) + '</div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="partidos">Partidos</span>: ' + safeVal(bbtOverall.totalGames) + '</div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="victoria">Victorias</span>: ' + safeVal(bbtOverall.totalWins) + '</div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="empate">Empates</span>: ' + safeVal(bbtOverall.totalDraws) + '</div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="derrota">Derrotas</span>: ' + safeVal(bbtOverall.totalLosses) + '</div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="wrTotal">WR total</span>: ' + safeNum(bbtOverall.totalWinRatio, 2, "%") + '</div>';

          statsHtml += '<hr class="my-2">';

          statsHtml += '<div class="stat-item ms-3">Rating: ' + safeNum(bbtOverall.rating, 2) + '</div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="mejorRating">Mejor Rating</span>: ' + safeNum(bbtOverall.bestRating, 2) + '</div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="peorRating">Peor Rating</span>: ' + safeNum(bbtOverall.worstRating, 2) + '</div>';
          statsHtml += '<div class="stat-item ms-3"><span data-i18n="tendencia">Tendencia</span>: ' + safeNum(bbtOverall.tendency, 2) + '</div>';
        }

        if (bbtYears && bbtYears.length) {
          if (bbtOverall) {
            statsHtml += '<hr class="my-2">';
          }
          for (var by = 0; by < bbtYears.length; by++) {
            var bys = bbtYears[by];

            statsHtml += '<div class="stat-item"><strong>' + bys.year + ' (BBT)</strong></div>';
            statsHtml += '<div class="stat-item ms-3"><span data-i18n="torneos">Torneos</span>: ' + safeVal(bys.tournaments) + '</div>';
            statsHtml += '<div class="stat-item ms-3"><span data-i18n="partidos">Partidos</span>: ' + safeVal(bys.gamesTotal) + " (" + safeVal(bys.gamesWon) + "/" + safeVal(bys.gamesDraw) + "/" + safeVal(bys.gamesLost) + ")</div>";
            statsHtml += '<div class="stat-item ms-3">WR: ' + safeNum(bys.winRatio, 2, "%") + '</div>';
            statsHtml += '<div class="stat-item ms-3">Rating: ' + safeNum(bys.rating, 2) + ' (<span data-i18n="mejor">Mejor</span> ' + safeNum(bys.bestRating, 2) + ', <span data-i18n="peor">Peor</span> ' + safeNum(bys.worstRating, 2) + ')</div>';

            if (by < bbtYears.length - 1) {
              statsHtml += '<hr class="my-1">';
            }
          }
        }
      }

      statsHtml += '</div>'; // fin columna 5

      statsHtml += '</div>'; // fin .row

      statsTd.innerHTML = statsHtml;
      statsTr.appendChild(statsTd);
      tableBody.appendChild(statsTr);
    }
  }

  // ===================== PAGINACION =====================

  function renderPagination(totalPages) {
    if (!paginationContainer) return;

    paginationContainer.innerHTML = "";

    if (totalPages <= 1) {
      paginationContainer.style.display = "none";
      return;
    }

    paginationContainer.style.display = "block";

    var ul = document.createElement("ul");
    ul.className = "pagination pagination-sm flex-wrap";

    function makeItem(label, page, disabled, active) {
      var li = document.createElement("li");
      li.className = "page-item";
      if (disabled) li.className += " disabled";
      if (active) li.className += " active";

      var a = document.createElement("a");
      a.className = "page-link";
      a.href = "#";
      a.textContent = label;

      if (!disabled && !active) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          gotoPage(page);
        });
      }

      li.appendChild(a);
      return li;
    }

    ul.appendChild(makeItem("<<", 1, currentPage === 1, false));
    ul.appendChild(makeItem("<", currentPage === 1 ? 1 : currentPage - 1, currentPage === 1, false));

    for (var p = 1; p <= totalPages; p++) {
      ul.appendChild(makeItem(String(p), p, false, p === currentPage));
    }

    ul.appendChild(makeItem(">", currentPage === totalPages ? totalPages : currentPage + 1, currentPage === totalPages, false));
    ul.appendChild(makeItem(">>", totalPages, currentPage === totalPages, false));

    paginationContainer.appendChild(ul);
  }

  function gotoPage(page) {
    var totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    currentPage = page;
    renderCurrentPage();
  }

  function renderCurrentPage() {
    if (!filteredRows.length) {
      renderNoResults();
      return;
    }

    var totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    var start = (currentPage - 1) * PAGE_SIZE;
    var end = start + PAGE_SIZE;
    var pageRows = filteredRows.slice(start, end);

    renderTableRows(pageRows);
    renderPagination(totalPages);
  }

  // ===================== FILTROS (EXACTOS) =====================

  function applyFilters() {
    var nafVal = nafFilter.value ? nafFilter.value.trim() : "";
    var coachVal = coachFilter.value ? coachFilter.value.trim().toLowerCase() : "";

    if (!nafVal && !coachVal) {
      filteredRows = [];
      currentPage = 1;
      renderEmptyState();
      return;
    }

    filteredRows = [];
    for (var i = 0; i < allRows.length; i++) {
      var r = allRows[i];

      if (nafVal && r.nafNr !== nafVal) {
        continue;
      }

      if (coachVal && r.coach.toLowerCase() !== coachVal) {
        continue;
      }

      filteredRows.push(r);
    }

    currentPage = 1;

    if (!filteredRows.length) {
      renderNoResults();
    } else {
      renderCurrentPage();
    }
  }

  // ===================== INICIO =====================

  initDataFromGeneralAll();
  initYearStats();
  initRaceStats();       // razas legacy
  initRaceStats2025();   // razas BB2025 (variantid 15)
  initBbtOverall();
  initBbtYearStats();
  renderEmptyState();

  nafFilter.addEventListener("input", applyFilters);
  coachFilter.addEventListener("input", applyFilters);
});
