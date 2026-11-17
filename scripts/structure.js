/**
 * The global state and Line 2 station data
 */
const LINE2_STATIONS = [
    "Limebank",
    "Bowesville",
    "Leitrim",
    "South Keys",
    "Greenboro",
    "Walkley",
    "Mooney's Bay",
    "Carleton",
    "Dow's Lake",
    "Corso Italia",
    "Bayview"
];

const STATION_LOCATIONS = {
    "Limebank": "Limebank Road near Bowesville Road, Ottawa",
    "Bowesville": "Bowesville Road near Earl Armstrong Road, Ottawa",
    "Leitrim": "Leitrim Road near Albion Road, Ottawa",
    "South Keys": "Bank Street near South Keys Station, Ottawa",
    "Greenboro": "Johnston Road near Bank Street, Ottawa",
    "Walkley": "Walkley Road near Bank Street, Ottawa",
    "Mooney's Bay": "Heron Road near Bronson Avenue, Ottawa",
    "Carleton": "University Drive near Library Road, Ottawa",
    "Dow's Lake": "Carling Avenue near Preston Street, Ottawa",
    "Corso Italia": "Gladstone Avenue near Preston Street, Ottawa",
    "Bayview": "Albert Street near Bayview Station Road, Ottawa"
};

const NO_SERVICE_DATES = ["2026-12-25"];
const HEADWAY_MINUTES = 12;
const MINUTES_PER_STOP = 3;
const STORAGE_KEY = "ocTranspo_confirmedJourneys";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

let selectedDate = "2026-12-15";
let currentYear = 2026;
let currentMonth = 11; // December (0-indexed)
let baselineQuery = null;
let selectedTripId = null;

/**
 * Helper function to format two-digit numbers
 */
function padTwo(num) {
    return num < 10 ? "0" + num : String(num);
}

/**
 * Helper function to convert total minutes into HH:MM string
 */
function formatMinutes(totalMins) {
    const wrapped = ((totalMins % 1440) + 1440) % 1440;
    const hours = Math.floor(wrapped / 60);
    const mins = wrapped % 60;
    return `${padTwo(hours)}:${padTwo(mins)}`;
}

/**
 * Helper function to parse HH:MM string into minutes
 */
function parseTimeString(timeStr) {
    if (!timeStr) return null;
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeStr.trim());
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Helper function to parse YYYY-MM-DD date string
 */
function parseISODate(dateStr) {
    if (!dateStr) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const dateObj = new Date(Date.UTC(year, month - 1, day));

    if (
        dateObj.getUTCFullYear() !== year ||
        dateObj.getUTCMonth() !== month - 1 ||
        dateObj.getUTCDate() !== day
    ) {
        return null;
    }
    return { year, month, day, dateObj };
}

/**
 * Helper function to format a date as "Tuesday, December 15, 2026"
 */
function formatLongDate(dateStr) {
    const parsed = parseISODate(dateStr);
    if (!parsed) return dateStr;
    const weekday = WEEKDAYS[parsed.dateObj.getUTCDay()];
    const monthName = MONTHS[parsed.month - 1];
    return `${weekday}, ${monthName} ${parsed.day}, ${parsed.year}`;
}

/**
 * Helper function to match station name case-insensitively
 */
function findCanonicalStation(inputName) {
    if (!inputName) return null;
    const cleaned = inputName.trim().toLowerCase();
    return LINE2_STATIONS.find(s => s.toLowerCase() === cleaned) || null;
}

/**
 * Filter stations for autocomplete (prefix matches ranked first)
 */
function getStationMatches(query) {
    const lookup = (query || "").trim().toLowerCase();
    return LINE2_STATIONS
        .filter(station => station.toLowerCase().includes(lookup))
        .sort((a, b) => {
            const aStarts = a.toLowerCase().startsWith(lookup) ? 0 : 1;
            const bStarts = b.toLowerCase().startsWith(lookup) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            return LINE2_STATIONS.indexOf(a) - LINE2_STATIONS.indexOf(b);
        });
}

/**
 * Read query parameters from the current URL
 */
function getUrlQuery() {
    const params = new URLSearchParams(window.location.search);
    return {
        from: params.get("from") || "",
        to: params.get("to") || "",
        date: params.get("date") || "",
        time: params.get("time") || "",
        tripId: params.get("tripId") || "",
        saved: params.get("saved") || ""
    };
}

/**
 * Dynamically render the summary block
 */
function renderTripSummary(containerId, data) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    const routeP = document.createElement("p");
    routeP.className = "route-title";
    routeP.textContent = `${data.from} \u2192 ${data.to}`;

    const lineP = document.createElement("p");
    lineP.textContent = `${data.route} \u00B7 ${data.direction}`;

    const dateP = document.createElement("p");
    dateP.textContent = data.dateLabel;

    const timeP = document.createElement("p");
    timeP.textContent = `Around ${data.time}`;

    container.appendChild(routeP);
    container.appendChild(lineP);
    container.appendChild(dateP);
    container.appendChild(timeP);
}

/**
 * Validate trip inputs and compute the departure schedules
 */
function queryTrips(query) {
    const fromStation = findCanonicalStation(query.from);
    if (!fromStation) {
        return {
            ok: false,
            field: "from",
            error: "The starting station is not recognized. Choose a Line 2 station from the suggestions."
        };
    }

    const toStation = findCanonicalStation(query.to);
    if (!toStation) {
        return {
            ok: false,
            field: "to",
            error: "The destination station is not recognized. Choose a Line 2 station from the suggestions."
        };
    }

    if (fromStation === toStation) {
        return {
            ok: false,
            field: "to",
            error: "From and To must be different stations. Choose a different destination."
        };
    }

    if (!parseISODate(query.date)) {
        return {
            ok: false,
            field: "date",
            error: "Choose a valid travel date."
        };
    }

    const requestedMinutes = parseTimeString(query.time);
    if (requestedMinutes === null) {
        return {
            ok: false,
            field: "time",
            error: "Enter a departure time in 24-hour HH:MM format, for example 14:30."
        };
    }

    if (NO_SERVICE_DATES.includes(query.date)) {
        return {
            ok: false,
            field: "date",
            error: `No service is scheduled on ${formatLongDate(query.date)}: Line 2 is closed for maintenance. Please choose another travel date.`
        };
    }

    const fromIndex = LINE2_STATIONS.indexOf(fromStation);
    const toIndex = LINE2_STATIONS.indexOf(toStation);
    const travelMinutes = Math.abs(toIndex - fromIndex) * MINUTES_PER_STOP;
    const terminal = toIndex > fromIndex ? "Bayview" : "Limebank";

    const allRows = [];
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 1; minute < 60; minute += HEADWAY_MINUTES) {
            const depMins = hour * 60 + minute;
            const arrMins = depMins + travelMinutes;
            allRows.push({
                id: `trip-${depMins}`,
                depart: formatMinutes(depMins),
                arrive: formatMinutes(arrMins),
                departureMinutes: depMins,
                isNearestBefore: false,
                isNearestAfter: false
            });
        }
    }

    let nextIdx = allRows.findIndex(r => r.departureMinutes >= requestedMinutes);
    if (nextIdx === -1) nextIdx = allRows.length;

    if (nextIdx > 0) allRows[nextIdx - 1].isNearestBefore = true;
    if (nextIdx < allRows.length) allRows[nextIdx].isNearestAfter = true;

    const resultsStart = Math.max(0, Math.min(nextIdx - 3, allRows.length - 6));
    const scheduleStart = Math.max(0, Math.min(nextIdx - 5, allRows.length - 10));

    return {
        ok: true,
        data: {
            from: fromStation,
            to: toStation,
            fromLocation: STATION_LOCATIONS[fromStation],
            toLocation: STATION_LOCATIONS[toStation],
            route: "Line 2",
            direction: `Toward ${terminal}`,
            date: query.date,
            dateLabel: formatLongDate(query.date),
            time: formatMinutes(requestedMinutes),
            trips: allRows.slice(resultsStart, resultsStart + 6),
            schedule: allRows.slice(scheduleStart, scheduleStart + 10),
            nearestBefore: nextIdx > 0 ? allRows[nextIdx - 1] : null,
            nearestAfter: nextIdx < allRows.length ? allRows[nextIdx] : null
        }
    };
}

/**
 * Save confirmed journey record to localStorage
 */
function saveConfirmedJourney(journey) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const savedList = raw ? JSON.parse(raw) : [];
        savedList.push({
            ...journey,
            confirmedAt: new Date().toISOString()
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedList));
        return true;
    } catch (error) {
        console.log("Error saving journey to localStorage");
        return false;
    }
}