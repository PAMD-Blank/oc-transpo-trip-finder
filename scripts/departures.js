document.addEventListener("DOMContentLoaded", () => {
    loadDeparturesPage();
});

/**
 * Load query parameters and render the 6-departure table
 */
function loadDeparturesPage() {
    const params = getUrlQuery();
    const result = queryTrips(params);

    if (!result.ok) {
        window.location.replace("./tripFinder.html");
        return;
    }

    const data = result.data;
    const queryString = new URLSearchParams({
        from: data.from,
        to: data.to,
        date: data.date,
        time: data.time
    }).toString();

    document.getElementById("edit-search-link").href = `./tripFinder.html?${queryString}`;
    document.getElementById("open-schedule-link").href = `./schedule.html?${queryString}`;

    renderTripSummary("results-summary", data);
    renderDepartureRows(data);
}

/**
 * Dynamically generate the 6 departure rows around the requested time
 */
function renderDepartureRows(data) {
    const tbody = document.getElementById("results-body");
    tbody.innerHTML = "";

    data.trips.forEach(trip => {
        const tr = document.createElement("tr");
        tr.tabIndex = 0;

        let statusText = "";
        if (trip.isNearestBefore) {
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

        const goToSchedule = () => {
            const nextParams = new URLSearchParams({
                from: data.from,
                to: data.to,
                date: data.date,
                time: data.time,
                tripId: trip.id
            });
            window.location.href = `./schedule.html?${nextParams.toString()}`;
        };

        tr.addEventListener("click", goToSchedule);
        tr.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                goToSchedule();
            }
        });

        tbody.appendChild(tr);
    });
}