document.addEventListener("DOMContentLoaded", () => {
    loadSchedulePage();
});

/**
 * Load the expanded 10-departure Line 2 schedule and handle row selection
 */
function loadSchedulePage() {
    const params = getUrlQuery();
    const result = queryTrips(params);

    if (!result.ok) {
        window.location.replace("./tripFinder.html");
        return;
    }

    const data = result.data;
    selectedTripId = params.tripId || null;

    const queryString = new URLSearchParams({
        from: data.from,
        to: data.to,
        date: data.date,
        time: data.time
    }).toString();

    document.getElementById("back-to-results-link").href = `./departures.html?${queryString}`;

    renderTripSummary("schedule-summary", data);
    renderScheduleTable(data);

    document.getElementById("confirm-journey-button").addEventListener("click", () => {
        handleConfirmJourney(data);
    });
}

/**
 * Dynamically generate the 10 schedule rows and attach selection listeners
 */
function renderScheduleTable(data) {
    const tbody = document.getElementById("schedule-body");
    const confirmBtn = document.getElementById("confirm-journey-button");
    tbody.innerHTML = "";

    let hasValidSelection = false;

    data.schedule.forEach(trip => {
        const tr = document.createElement("tr");
        tr.tabIndex = 0;

        const isSelected = trip.id === selectedTripId;
        let statusText = "";

        if (isSelected) {
            hasValidSelection = true;
            statusText = "Selected";
            tr.classList.add("selected-row");
        } else if (trip.isNearestBefore) {
            statusText = "Nearest before";
            tr.classList.add("nearest-row");
        } else if (trip.isNearestAfter) {
            statusText = "Nearest after";
            tr.classList.add("nearest-row");
        }

        const tdDepart = document.createElement("td");
        tdDepart.textContent = trip.depart;

        const tdArrive = document.createElement("td");
        tdArrive.textContent = trip.arrive;

        const tdStatus = document.createElement("td");
        tdStatus.className = "status-col";
        tdStatus.textContent = statusText;

        tr.appendChild(tdDepart);
        tr.appendChild(tdArrive);
        tr.appendChild(tdStatus);

        const selectThisRow = () => {
            selectedTripId = trip.id;
            renderScheduleTable(data);

            const announcer = document.getElementById("live-announcer");
            if (announcer) {
                announcer.textContent = `Departure ${trip.depart} selected. Confirm journey enabled.`;
            }
        };

        tr.addEventListener("click", selectThisRow);
        tr.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectThisRow();
            }
        });

        tbody.appendChild(tr);
    });

    confirmBtn.disabled = !hasValidSelection;
}

/**
 * Save selected trip and navigate to confirmation.html
 */
function handleConfirmJourney(data) {
    const chosenTrip = data.schedule.find(r => r.id === selectedTripId);
    if (!chosenTrip) return;

    const savedOk = saveConfirmedJourney({
        tripId: chosenTrip.id,
        from: data.from,
        to: data.to,
        fromLocation: data.fromLocation,
        toLocation: data.toLocation,
        route: data.route,
        direction: data.direction,
        date: data.date,
        dateLabel: data.dateLabel,
        time: data.time,
        depart: chosenTrip.depart,
        arrive: chosenTrip.arrive
    });

    const nextParams = new URLSearchParams({
        from: data.from,
        to: data.to,
        date: data.date,
        time: data.time,
        tripId: chosenTrip.id,
        saved: savedOk ? "1" : "0"
    });

    window.location.href = `./confirmation.html?${nextParams.toString()}`;
}