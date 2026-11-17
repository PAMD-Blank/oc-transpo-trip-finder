document.addEventListener("DOMContentLoaded", () => {
    initTripFinder();
});

/**
 * Initialize the Trip Finder form, calendar, and autocomplete inputs
 */
function initTripFinder() {
    const fromInput = document.getElementById("from-input");
    const toInput = document.getElementById("to-input");
    const timeInput = document.getElementById("time-input");
    const tripForm = document.getElementById("trip-form");

    restorePreviousSearchIfPresent();
    renderCalendar();
    updateSearchButton();

    setupStationAutocomplete(fromInput, "from-listbox");
    setupStationAutocomplete(toInput, "to-listbox");

    timeInput.addEventListener("input", () => {
        handleFormInputChange();
    });

    document.getElementById("calendar-prev").addEventListener("click", () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    });

    document.getElementById("calendar-next").addEventListener("click", () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendar();
    });

    tripForm.addEventListener("submit", (e) => {
        e.preventDefault();
        handleTripSearch();
    });
}

/**
 * Restore query fields if user clicked "< Edit search" from departures page
 */
function restorePreviousSearchIfPresent() {
    const params = getUrlQuery();
    if (!params.from || !params.to || !params.date || !params.time) return;

    const result = queryTrips(params);
    if (!result.ok) return;

    baselineQuery = {
        from: result.data.from,
        to: result.data.to,
        date: result.data.date,
        time: result.data.time
    };

    document.getElementById("from-input").value = baselineQuery.from;
    document.getElementById("to-input").value = baselineQuery.to;
    document.getElementById("time-input").value = baselineQuery.time;
    selectedDate = baselineQuery.date;

    const parsed = parseISODate(selectedDate);
    if (parsed) {
        currentYear = parsed.year;
        currentMonth = parsed.month - 1;
    }

    const outdatedContent = document.getElementById("outdated-content");
    outdatedContent.innerHTML = "";

    const routeP = document.createElement("p");
    routeP.textContent = `${result.data.from} \u2192 ${result.data.to}`;

    const metaP = document.createElement("p");
    metaP.textContent = `${result.data.dateLabel} \u00B7 Around ${result.data.time}`;

    const nearP = document.createElement("p");
    const nb = result.data.nearestBefore;
    const na = result.data.nearestAfter;
    nearP.textContent = `Nearest before: ${nb ? nb.depart : "N/A"} | Nearest after: ${na ? na.depart : "N/A"}`;

    outdatedContent.appendChild(routeP);
    outdatedContent.appendChild(metaP);
    outdatedContent.appendChild(nearP);
}

/**
 * Dynamically generate the monthly calendar grid
 */
function renderCalendar() {
    const titleEl = document.getElementById("calendar-title");
    const gridEl = document.getElementById("calendar-grid");

    titleEl.textContent = `${MONTHS[currentMonth]} ${currentYear}`;
    gridEl.innerHTML = "";

    const firstWeekday = new Date(Date.UTC(currentYear, currentMonth, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();

    for (let i = 0; i < firstWeekday; i++) {
        const blank = document.createElement("span");
        blank.className = "calendar-blank";
        gridEl.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const isoDate = `${currentYear}-${padTwo(currentMonth + 1)}-${padTwo(day)}`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "calendar-day";
        btn.textContent = day;
        btn.setAttribute("aria-label", formatLongDate(isoDate));

        if (isoDate === selectedDate) {
            btn.classList.add("active-date");
        }

        btn.addEventListener("click", () => {
            selectedDate = isoDate;
            renderCalendar();
            handleFormInputChange();
            announceMessage(`Travel date set to ${formatLongDate(isoDate)}.`);
        });

        gridEl.appendChild(btn);
    }
}

/**
 * Attach autocomplete suggestions and keyboard navigation to a station input
 */
function setupStationAutocomplete(inputEl, listboxId) {
    const listEl = document.getElementById(listboxId);
    let activeIndex = -1;

    function renderSuggestions() {
        const matches = getStationMatches(inputEl.value);
        listEl.innerHTML = "";

        if (matches.length === 0) {
            listEl.classList.add("hidden");
            return;
        }

        matches.forEach((station, index) => {
            const li = document.createElement("li");
            li.textContent = station;
            li.setAttribute("role", "option");

            if (index === activeIndex) {
                li.classList.add("active-option");
            }

            li.addEventListener("mousedown", (e) => {
                e.preventDefault();
                inputEl.value = station;
                listEl.classList.add("hidden");
                activeIndex = -1;
                handleFormInputChange();
            });

            listEl.appendChild(li);
        });

        listEl.classList.remove("hidden");
    }

    inputEl.addEventListener("focus", () => {
        activeIndex = -1;
        renderSuggestions();
    });

    inputEl.addEventListener("input", () => {
        activeIndex = -1;
        renderSuggestions();
        handleFormInputChange();
    });

    inputEl.addEventListener("keydown", (e) => {
        const matches = getStationMatches(inputEl.value);
        if (e.key === "Escape") {
            listEl.classList.add("hidden");
            return;
        }
        if (e.key === "ArrowDown" && matches.length > 0) {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % matches.length;
            renderSuggestions();
            return;
        }
        if (e.key === "ArrowUp" && matches.length > 0) {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + matches.length) % matches.length;
            renderSuggestions();
            return;
        }
        if (e.key === "Enter" && !listEl.classList.contains("hidden") && matches.length > 0) {
            e.preventDefault();
            const chosen = activeIndex >= 0 ? matches[activeIndex] : matches[0];
            inputEl.value = chosen;
            listEl.classList.add("hidden");
            activeIndex = -1;
            handleFormInputChange();
        }
    });

    inputEl.addEventListener("blur", () => {
        setTimeout(() => {
            listEl.classList.add("hidden");
        }, 120);
    });
}

/**
 * Update button state, clear error banner, and check if previous results are outdated
 */
function handleFormInputChange() {
    clearFormError();
    updateSearchButton();
    updateOutdatedBanner();
}

/**
 * Enable Search button only when all four inputs are filled
 */
function updateSearchButton() {
    const fromVal = document.getElementById("from-input").value.trim();
    const toVal = document.getElementById("to-input").value.trim();
    const timeVal = document.getElementById("time-input").value.trim();
    const searchBtn = document.getElementById("search-button");

    const isComplete = fromVal !== "" && toVal !== "" && selectedDate !== "" && timeVal !== "";
    searchBtn.disabled = !isComplete;
}

/**
 * Show or hide the outdated results preview box when inputs change
 */
function updateOutdatedBanner() {
    const outdatedBox = document.getElementById("outdated-preview");
    if (!baselineQuery) {
        outdatedBox.classList.add("hidden");
        return;
    }

    const fromVal = document.getElementById("from-input").value.trim();
    const toVal = document.getElementById("to-input").value.trim();
    const timeVal = document.getElementById("time-input").value.trim();

    const isSame =
        fromVal === baselineQuery.from &&
        toVal === baselineQuery.to &&
        selectedDate === baselineQuery.date &&
        timeVal === baselineQuery.time;

    if (!isSame) {
        outdatedBox.classList.remove("hidden");
    } else {
        outdatedBox.classList.add("hidden");
    }
}

/**
 * Clear error messages and invalid borders
 */
function clearFormError() {
    const errorBanner = document.getElementById("form-error");
    errorBanner.textContent = "";
    errorBanner.classList.add("hidden");

    document.getElementById("from-input").removeAttribute("aria-invalid");
    document.getElementById("to-input").removeAttribute("aria-invalid");
    document.getElementById("time-input").removeAttribute("aria-invalid");
    document.getElementById("calendar-box").classList.remove("invalid-box");
}

/**
 * Validate form submission and either show error or navigate to departures.html
 */
function handleTripSearch() {
    const query = {
        from: document.getElementById("from-input").value.trim(),
        to: document.getElementById("to-input").value.trim(),
        date: selectedDate,
        time: document.getElementById("time-input").value.trim()
    };

    const result = queryTrips(query);

    if (!result.ok) {
        clearFormError();
        const errorBanner = document.getElementById("form-error");
        errorBanner.textContent = result.error;
        errorBanner.classList.remove("hidden");

        if (result.field === "from") document.getElementById("from-input").setAttribute("aria-invalid", "true");
        if (result.field === "to") document.getElementById("to-input").setAttribute("aria-invalid", "true");
        if (result.field === "time") document.getElementById("time-input").setAttribute("aria-invalid", "true");
        if (result.field === "date") document.getElementById("calendar-box").classList.add("invalid-box");

        errorBanner.focus();
        return;
    }

    const params = new URLSearchParams({
        from: result.data.from,
        to: result.data.to,
        date: result.data.date,
        time: result.data.time
    });

    window.location.href = `./departures.html?${params.toString()}`;
}

/**
 * Update polite aria-live announcer text
 */
function announceMessage(text) {
    const announcer = document.getElementById("live-announcer");
    if (announcer) announcer.textContent = text;
}