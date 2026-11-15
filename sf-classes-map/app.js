(function () {
  "use strict";

  var data = window.APP_DATA;
  if (!data || !Array.isArray(data.locations)) {
    document.getElementById("results-count").textContent = "Could not load class data.";
    return;
  }

  var locations = data.locations;
  var filters = {
    neighborhood: "",
    type: "",
    day: "",
    time: "",
    intro: false,
    includeUnknown: true
  };

  var map = L.map("map", { scrollWheelZoom: true, tap: true });
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
  }).addTo(map);
  map.setView([37.792, -122.43], 13);

  var markers = {};
  var markerLayer = L.layerGroup().addTo(map);
  var activeId = null;

  function pinLetter(type) {
    if (type === "Yoga") return "Y";
    if (type === "Pilates") return "P";
    return "B";
  }

  function iconFor(type) {
    var key = type.toLowerCase();
    return L.divIcon({
      className: "",
      html: '<div class="place-pin ' + key + '"><span>' + pinLetter(type) + "</span></div>",
      iconSize: [28, 28],
      iconAnchor: [14, 26],
      popupAnchor: [0, -24]
    });
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function classList(loc) {
    return (loc.beginnerClasses || []).map(escapeHtml).join("<br>");
  }

  function popupHtml(loc) {
    var typeClass = loc.type.toLowerCase();
    var when = loc.hasPostedTimes ? loc.scheduleLabel : "Times not posted — see schedule";
    var note = loc.addressNote ? '<p class="note">' + escapeHtml(loc.addressNote) + "</p>" : "";
    var site = loc.website
      ? '<a href="' + escapeHtml(loc.website) + '" target="_blank" rel="noopener noreferrer">Studio site</a>'
      : "";
    return (
      '<div class="popup-card">' +
      "<h3>" + escapeHtml(loc.name) + "</h3>" +
      '<p class="meta"><span class="badge ' + typeClass + '">' + escapeHtml(loc.type) + "</span> · " +
      escapeHtml(loc.neighborhood) + "</p>" +
      "<p><strong>Beginner classes.</strong><br>" + (classList(loc) || "not shown") + "</p>" +
      "<p><strong>Price / intro.</strong> " + escapeHtml(loc.price || "not shown") + "</p>" +
      "<p><strong>Schedule.</strong> " + escapeHtml(when) + "</p>" +
      note +
      '<p class="links">' +
      '<a href="' + escapeHtml(loc.mapsUrl) + '" target="_blank" rel="noopener noreferrer">Directions</a>' +
      (site ? " " + site : "") +
      "</p></div>"
    );
  }

  function cardHtml(loc) {
    var typeClass = loc.type.toLowerCase();
    var when = loc.hasPostedTimes ? loc.scheduleLabel : "Times not posted — see schedule";
    var note = loc.addressNote ? '<p class="note">' + escapeHtml(loc.addressNote) + "</p>" : "";
    var site = loc.website
      ? '<a href="' + escapeHtml(loc.website) + '" target="_blank" rel="noopener noreferrer" data-external="1">Studio site</a>'
      : "";
    return (
      '<article class="card" data-id="' + escapeHtml(loc.id) + '" tabindex="0" role="button" aria-label="' + escapeHtml(loc.name) + '">' +
      '<div class="card-top"><h2>' + escapeHtml(loc.name) + '</h2><span class="badge ' + typeClass + '">' + escapeHtml(loc.type) + "</span></div>" +
      '<p class="meta">' + escapeHtml(loc.neighborhood) + " · " +
      '<a href="' + escapeHtml(loc.mapsUrl) + '" target="_blank" rel="noopener noreferrer" data-external="1">' + escapeHtml(loc.address) + "</a></p>" +
      '<p class="classes"><strong>Beginner classes.</strong> ' + (classList(loc) || "not shown") + "</p>" +
      '<p class="price"><strong>Price / intro.</strong> ' + escapeHtml(loc.price || "not shown") + "</p>" +
      '<p class="when"><strong>Schedule.</strong> ' + escapeHtml(when) + "</p>" +
      note +
      '<p class="links">' +
      '<a href="' + escapeHtml(loc.mapsUrl) + '" target="_blank" rel="noopener noreferrer" data-external="1">Directions</a>' +
      (site ? " " + site : "") +
      "</p></article>"
    );
  }

  function matches(loc) {
    if (filters.neighborhood && loc.neighborhood !== filters.neighborhood) return false;
    if (filters.type === "Yoga" && loc.type !== "Yoga" && loc.type !== "Both") return false;
    if (filters.type === "Pilates" && loc.type !== "Pilates" && loc.type !== "Both") return false;
    if (filters.type === "Both" && loc.type !== "Both") return false;
    if (filters.intro && !loc.hasIntroOrFree) return false;

    var dayOrTime = !!(filters.day || filters.time);
    if (dayOrTime) {
      if (!loc.hasPostedTimes) return filters.includeUnknown;
      if (filters.day && loc.days.indexOf(filters.day) === -1) return false;
      if (filters.time && loc.timesOfDay.indexOf(filters.time) === -1) return false;
    }
    return true;
  }

  function visibleLocations() {
    return locations.filter(matches);
  }

  function fillNeighborhoods() {
    var sel = document.getElementById("filter-neighborhood");
    var names = [];
    locations.forEach(function (loc) {
      if (names.indexOf(loc.neighborhood) === -1) names.push(loc.neighborhood);
    });
    names.sort();
    names.forEach(function (n) {
      var opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      sel.appendChild(opt);
    });
  }

  function updateUnknownToggle() {
    var wrap = document.getElementById("unknown-wrap");
    var show = !!(filters.day || filters.time);
    wrap.classList.toggle("is-hidden", !show);
  }

  function setActive(id) {
    activeId = id;
    document.querySelectorAll(".card").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-id") === id);
    });
  }

  function focusLocation(id, openPopup) {
    var marker = markers[id];
    if (!marker) return;
    setActive(id);
    var latlng = marker.getLatLng();
    map.setView(latlng, Math.max(map.getZoom(), 15), { animate: true });
    if (openPopup) marker.openPopup();
    var card = document.querySelector('.card[data-id="' + id + '"]');
    if (card && card.scrollIntoView) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function render() {
    updateUnknownToggle();
    var visible = visibleLocations();
    var countEl = document.getElementById("results-count");
    var n = visible.length;
    countEl.textContent = n === 1 ? "1 place" : n + " places";

    markerLayer.clearLayers();
    markers = {};
    visible.forEach(function (loc) {
      var marker = L.marker([loc.lat, loc.lng], { icon: iconFor(loc.type), title: loc.name, riseOnHover: true });
      marker.bindPopup(popupHtml(loc), { maxWidth: 300 });
      marker.on("click", function () {
        setActive(loc.id);
        var card = document.querySelector('.card[data-id="' + loc.id + '"]');
        if (card && card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      marker.addTo(markerLayer);
      markers[loc.id] = marker;
    });

    var results = document.getElementById("results");
    if (!visible.length) {
      results.innerHTML = '<p class="empty">No classes match these filters. Try “Any” for day or time, or leave “Include studios without posted times” on — most studios did not publish a usable timetable on Nov 14, 2026.</p>';
    } else {
      results.innerHTML = visible.map(cardHtml).join("");
    }

    if (activeId && !markers[activeId]) {
      activeId = null;
      map.closePopup();
    } else if (activeId) {
      setActive(activeId);
    }

    if (visible.length === 0) {
      map.setView([37.792, -122.43], 13);
    } else if (visible.length === 1) {
      map.setView([visible[0].lat, visible[0].lng], 15);
    } else {
      var group = L.featureGroup(Object.keys(markers).map(function (id) { return markers[id]; }));
      map.fitBounds(group.getBounds().pad(0.18));
    }
  }

  document.getElementById("results").addEventListener("click", function (e) {
    var external = e.target.closest("[data-external]");
    if (external) return;
    var card = e.target.closest(".card");
    if (!card) return;
    focusLocation(card.getAttribute("data-id"), true);
  });
  document.getElementById("results").addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var card = e.target.closest(".card");
    if (!card) return;
    e.preventDefault();
    focusLocation(card.getAttribute("data-id"), true);
  });

  function readFilters() {
    filters.neighborhood = document.getElementById("filter-neighborhood").value;
    filters.type = document.getElementById("filter-type").value;
    filters.day = document.getElementById("filter-day").value;
    filters.time = document.getElementById("filter-time").value;
    filters.intro = document.getElementById("filter-intro").checked;
    filters.includeUnknown = document.getElementById("filter-unknown").checked;
  }

  document.getElementById("filters").addEventListener("change", function () {
    readFilters();
    render();
  });

  var omitted = document.getElementById("omitted-note");
  if (data.omitted && data.omitted.length) {
    omitted.textContent = data.omitted.map(function (o) {
      return o.name + " (" + o.address + ") was left off the map: " + o.reason;
    }).join(" ");
  }

  fillNeighborhoods();
  readFilters();
  render();
  setTimeout(function () { map.invalidateSize(); }, 200);
  window.addEventListener("resize", function () { map.invalidateSize(); });
})();
