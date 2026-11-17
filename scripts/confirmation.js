document.addEventListener("DOMContentLoaded", () => {
    loadConfirmationPage();
});

/**
 * Render the confirmed journey details and nearby street addresses
 */
function loadConfirmationPage() {
    const params = getUrlQuery();
    const result = queryTrips(params);

    if (!result.ok) {
        window.location.replace("./tripFinder.html");
        return;
    }

    const data = result.data;
    const chosenTrip =
        data.schedule.find(r => r.id === params.tripId) ||
        data.nearestBefore ||
        data.trips[0];

    const baseQueryString = new URLSearchParams({
        from: data.from,
        to: data.to,
        date: data.date,
        time: data.time
    }).toString();

    const scheduleQueryString = new URLSearchParams({
        from: data.from,
        to: data.to,
        date: data.date,
        time: data.time,
        tripId: chosenTrip.id
    }).toString();

    document.getElementById("back-to-results-link").href = `./departures.html?${baseQueryString}`;
    document.getElementById("choose-another-link").href = `./schedule.html?${scheduleQueryString}`;

    renderTripSummary("confirmation-summary", data);
    renderConfirmationCard(data, chosenTrip);

    if (params.saved === "0") {
        const alertBox = document.getElementById("confirmation-alert");
        alertBox.textContent = "Journey confirmed for this session, but browser storage is unavailable.";
        alertBox.classList.remove("hidden");
    }
}

/**
 * Dynamically build the confirmation card DOM elements
 */
function renderConfirmationCard(data, trip) {
    const card = document.getElementById("confirmation-card");
    card.innerHTML = "";

    const depTime = document.createElement("p");
    depTime.className = "time-heading";
    depTime.textContent = `Depart ${trip.depart}`;

    const depStation = document.createElement("p");
    depStation.className = "station-name";
    depStation.textContent = data.from;

    const depAddress = document.createElement("p");
    depAddress.className = "station-address";
    depAddress.textContent = data.fromLocation;

    const arrTime = document.createElement("p");
    arrTime.className = "time-heading";
    arrTime.textContent = `Arrive ${trip.arrive}`;

    const arrStation = document.createElement("p");
    arrStation.className = "station-name";
    arrStation.textContent = data.to;

    const arrAddress = document.createElement("p");
    arrAddress.className = "station-address last-address";
    arrAddress.textContent = data.toLocation;

    card.appendChild(depTime);
    card.appendChild(depStation);
    card.appendChild(depAddress);
    card.appendChild(arrTime);
    card.appendChild(arrStation);
    card.appendChild(arrAddress);
}