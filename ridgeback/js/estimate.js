(function () {
  "use strict";

  var CAPACITY = 2;
  var DAY_COUNT = 21;

  var WINDOWS = [
    { id: "am", label: "8:00–12:00", days: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 } },
    { id: "pm", label: "12:00–4:00", days: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 } }
  ];

  var JOBS = {
    "burst-pipe": {
      tag: "01",
      name: "Burst or leaking pipe",
      includes: [
        "Shut the water off and isolate the leak",
        "Cut out the bad section and splice in new pipe",
        "Pressure-test the line before anything is closed up"
      ],
      caveat: "If the rest of that run is about to fail, we stop and price it before we continue.",
      factors: [
        {
          id: "where",
          legend: "Where is the water showing up?",
          options: [
            { value: "open", label: "Out in the open", hint: "Basement, crawlspace, or under a sink", low: 280, high: 650 },
            { value: "closed", label: "Inside a wall or ceiling", hint: "We open only the spot we need", low: 520, high: 1450 },
            { value: "unsure", label: "Not sure yet", hint: "Finding it, plus a straightforward repair", low: 350, high: 1450 }
          ]
        },
        {
          id: "count",
          legend: "How many places are leaking?",
          options: [
            { value: "one", label: "One", hint: "A single joint or split", add: [0, 0] },
            { value: "few", label: "Two or three", hint: "Same line, a few bad spots", add: [220, 580] },
            { value: "many", label: "The whole run looks bad", hint: "This may turn into a partial repipe once we see it", add: [700, 2200] }
          ]
        }
      ]
    },
    "water-heater": {
      tag: "02",
      name: "No hot water",
      includes: [
        "Test the burner or elements, thermostat, and relief valve",
        "Tell you the repair cost and the replacement cost side by side",
        "Haul the old tank away if you replace it"
      ],
      caveat: "A new circuit, a gas line we can't see, or a code upgrade is priced after we look.",
      factors: [
        {
          id: "path",
          legend: "What should the visit cover?",
          options: [
            { value: "repair", label: "Fix the one I have", hint: "Pilot, element, thermostat, or a flush", low: 190, high: 520 },
            { value: "tank", label: "Replace a tank", hint: "Standard 40 or 50 gallon, old one hauled away", low: 1450, high: 2650 },
            { value: "tankless", label: "Install tankless", hint: "Includes the vent or electrical we can already see", low: 2900, high: 5400 },
            { value: "unsure", label: "Diagnose it first", hint: "Repair versus replace, before any swap", low: 190, high: 2650 }
          ]
        },
        {
          id: "fuel",
          legend: "Gas or electric?",
          options: [
            { value: "gas", label: "Gas", hint: "Venting and the gas connector sit in the high end", add: [0, 180] },
            { value: "electric", label: "Electric", hint: "No vent. A new circuit, if you need one, is extra", add: [0, 0] },
            { value: "unsure", label: "Not sure", hint: "Look for a flue pipe, or a breaker labeled water heater", add: [0, 180] }
          ]
        }
      ]
    },
    repiping: {
      tag: "03",
      name: "Galvanized repipe",
      includes: [
        "Walk the house and map the runs",
        "A written scope before any wall is opened",
        "Water back on at the end of each working day"
      ],
      caveat: "Drywall patching and paint are not in this range.",
      factors: [
        {
          id: "scope",
          legend: "How much of the house?",
          options: [
            {
              value: "look",
              label: "Just the assessment",
              hint: "We walk it and leave a written scope",
              low: 0,
              high: 0,
              aside: "No charge for the walkthrough. On this sample card, a whole-house repipe usually lands between $6,500 and $16,000 once bathrooms and access are counted."
            },
            { value: "partial", label: "The bad section only", hint: "One stack, or the line that's failing", low: 2800, high: 6800 },
            { value: "whole", label: "The whole house", hint: "Supply lines, a new manifold, tagged shutoffs", low: 6500, high: 12000 }
          ]
        },
        {
          id: "baths",
          legend: "How many bathrooms?",
          when: function (a) { return a.scope === "partial" || a.scope === "whole"; },
          options: [
            { value: "1", label: "One", hint: "A smaller house, less pipe", add: [-600, -1200] },
            { value: "2", label: "Two", hint: "The sample card is built around two", add: [0, 0] },
            { value: "3", label: "Three or more", hint: "More fixtures, more wall openings", add: [1800, 4200] }
          ]
        },
        {
          id: "material",
          legend: "Pipe material",
          when: function (a) { return a.scope === "partial" || a.scope === "whole"; },
          options: [
            { value: "pex", label: "PEX", hint: "What we run in most older houses", mult: 1 },
            { value: "copper", label: "Copper", hint: "Longer install, higher material", mult: 1.35 },
            { value: "either", label: "Whichever you recommend", hint: "Priced as PEX. Copper lands higher.", mult: 1 }
          ]
        }
      ]
    },
    drain: {
      tag: "04",
      name: "Drain or sewer line",
      includes: [
        "Clear the line with a cable, or jet it if that's what it needs",
        "Camera footage shown to you before anything bigger is recommended",
        "The problem spot marked if it would need digging"
      ],
      caveat: "Excavation, a spot repair, or a liner is priced after the camera. It is not in this range.",
      factors: [
        {
          id: "kind",
          legend: "What's going on?",
          options: [
            { value: "fixture", label: "One fixture is clogged", hint: "A sink, a tub, or a single toilet", low: 175, high: 375 },
            { value: "main", label: "The main line is backing up", hint: "Several drains, or the floor drain", low: 295, high: 680 },
            { value: "camera", label: "Camera the line", hint: "Footage first. No digging on this visit.", low: 275, high: 475 },
            { value: "repeat", label: "It keeps coming back", hint: "Clear it and camera it. A repair is only priced if the footage shows one.", low: 450, high: 1900 }
          ]
        },
        {
          id: "place",
          legend: "Inside the house, or out in the yard?",
          options: [
            { value: "in", label: "Inside", hint: "No digging", add: [0, 0] },
            { value: "out", label: "Yard or the street side", hint: "Digging, if the camera calls for it, is a separate price", add: [0, 400] },
            { value: "unsure", label: "Not sure", hint: "The high end leaves room for a yard line", add: [0, 400] }
          ]
        }
      ]
    },
    "leak-detection": {
      tag: "05",
      name: "Hidden leak",
      includes: [
        "A meter test with every tap shut",
        "Branches isolated until the leaking line is found",
        "The smallest access we can make if we're also repairing it"
      ],
      caveat: "Opening a slab, or a long ceiling run, is quoted after the leak is marked.",
      factors: [
        {
          id: "goal",
          legend: "What do you want from the visit?",
          options: [
            { value: "find", label: "Find it", hint: "Locate the line. The repair is a separate price.", low: 275, high: 575 },
            { value: "fix", label: "Find it and fix it if we can reach it", hint: "Accessible pipe only. A slab is repriced after we locate it.", low: 475, high: 1450 }
          ]
        },
        {
          id: "spread",
          legend: "Where do you think it is?",
          options: [
            { value: "room", label: "One room", hint: "A stain, a soft spot, a smell in one place", add: [0, 0] },
            { value: "house", label: "Could be anywhere", hint: "More time isolating branches", add: [80, 250] },
            {
              value: "slab",
              label: "Under the slab",
              hint: "We can mark it. Opening the slab is not in this range.",
              add: [150, 400],
              aside: "Slab opening and the repair under it are quoted after we mark the spot."
            }
          ]
        }
      ]
    },
    fixture: {
      tag: "06",
      name: "Fixture or shutoff valve",
      includes: [
        "The old part left out for you to see",
        "A quarter-turn ball valve wherever we retire a gate valve",
        "The main shutoff tagged before we leave"
      ],
      caveat: "Special finishes, a custom faucet, or a rotten subfloor are priced when we see them.",
      factors: [
        {
          id: "what",
          legend: "What needs replacing?",
          options: [
            { value: "faucet", label: "Faucet", hint: "Kitchen or bath, including the supply lines", low: 185, high: 450 },
            { value: "toilet", label: "Toilet", hint: "Pull the old one, set and seal the new one", low: 250, high: 620 },
            { value: "valve", label: "Shutoff valve", hint: "A seized gate valve swapped for a ball valve", low: 165, high: 390 },
            { value: "several", label: "A few of these", hint: "Up to three fixtures on one visit", low: 480, high: 1250 }
          ]
        },
        {
          id: "supply",
          legend: "Who's supplying the fixture?",
          when: function (a) { return a.what && a.what !== "valve"; },
          options: [
            { value: "us", label: "Bring a standard one", hint: "A plain, solid fixture. Special finishes cost more.", add: [0, 0] },
            { value: "them", label: "I already bought it", hint: "We install yours. The fixture price comes out.", add: [-70, -180] },
            { value: "unsure", label: "Not sure yet", hint: "Priced with a standard fixture included", add: [0, 0] }
          ]
        }
      ]
    }
  };

  var root = document.getElementById("estimator");
  if (!root) return;

  var state = {
    step: 0,
    job: "",
    answers: {},
    date: "",
    windowId: "",
    editingId: "",
    savedSlot: null,
    savedPhone: ""
  };

  var board = { ready: false, counts: {} };

  var steps = Array.prototype.slice.call(root.querySelectorAll("[data-step]"));
  var stepButtons = Array.prototype.slice.call(document.querySelectorAll("[data-goto]"));
  var ticketPrice = document.getElementById("ticket-price");
  var ticketJob = document.getElementById("ticket-job");
  var ticketLines = document.getElementById("ticket-lines");
  var ticketIncludes = document.getElementById("ticket-includes");
  var ticketWhen = document.getElementById("ticket-when");
  var ticketNote = document.getElementById("ticket-note");
  var jobList = document.getElementById("job-list");
  var detailFields = document.getElementById("detail-fields");
  var calGrid = document.getElementById("cal-grid");
  var slotList = document.getElementById("slot-list");
  var slotHint = document.getElementById("slot-hint");
  var holdForm = document.getElementById("hold-form");
  var donePanel = document.getElementById("done-panel");
  var lookupForm = document.getElementById("lookup-form");
  var lookupResults = document.getElementById("lookup-results");

  function money(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  function round10(n) {
    return Math.round(n / 10) * 10;
  }

  function isoDate(d) {
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function parseIso(iso) {
    var p = iso.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12);
  }

  function weekday(d) {
    return d.toLocaleDateString("en-US", { weekday: "short" });
  }

  function longDate(iso) {
    return parseIso(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }

  function windowById(id) {
    for (var i = 0; i < WINDOWS.length; i++) if (WINDOWS[i].id === id) return WINDOWS[i];
    return null;
  }

  function api(path, options) {
    return fetch(path, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) {
          var err = new Error(body.error || "The booking board didn't answer.");
          err.status = res.status;
          throw err;
        }
        return body;
      });
    });
  }

  function calendarStart() {
    var today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay(), 12);
  }

  function loadBoard() {
    var start = calendarStart();
    return api("/api/availability?start=" + isoDate(start) + "&days=" + DAY_COUNT).then(function (data) {
      board.ready = true;
      board.counts = data.counts || {};
      if (data.capacity) CAPACITY = data.capacity;
    });
  }

  function heldCount(date, windowId) {
    var n = board.counts[date + "|" + windowId] || 0;
    if (state.savedSlot && state.savedSlot.date === date && state.savedSlot.windowId === windowId) {
      n = Math.max(0, n - 1);
    }
    return n;
  }

  function spotsLeft(date, windowId) {
    return Math.max(0, CAPACITY - heldCount(date, windowId, state.editingId));
  }

  function visibleFactors(job, answers) {
    return job.factors.filter(function (f) {
      return !f.when || f.when(answers);
    });
  }

  function selectedOption(factor, answers) {
    var value = answers[factor.id];
    if (!value) return null;
    for (var i = 0; i < factor.options.length; i++) {
      if (factor.options[i].value === value) return factor.options[i];
    }
    return null;
  }

  function quote() {
    var job = JOBS[state.job];
    if (!job) return null;
    var factors = visibleFactors(job, state.answers);
    var low = 0;
    var high = 0;
    var hasBase = false;
    var mult = 1;
    var lines = [];
    var asides = [];
    var ready = true;

    factors.forEach(function (factor) {
      var opt = selectedOption(factor, state.answers);
      if (!opt) {
        ready = false;
        return;
      }
      if (opt.low != null) {
        low += opt.low;
        high += opt.high;
        hasBase = true;
        lines.push({ label: opt.label, text: opt.low === 0 && opt.high === 0 ? "No charge" : money(opt.low) + "–" + money(opt.high) });
      } else         if (opt.add) {
        low += opt.add[0];
        high += opt.add[1];
        if (opt.add[0] || opt.add[1]) {
          var bothDown = opt.add[0] < 0 && opt.add[1] < 0;
          lines.push({
            label: opt.label,
            text: bothDown
              ? "−" + money(Math.abs(opt.add[0])) + " to −" + money(Math.abs(opt.add[1]))
              : "+" + money(opt.add[0]) + "–" + money(opt.add[1])
          });
        }
      }
      if (opt.mult && opt.mult !== 1) {
        mult = opt.mult;
        lines.push({ label: opt.label, text: "×" + opt.mult });
      }
      if (opt.aside) asides.push(opt.aside);
    });

    if (hasBase && mult !== 1) {
      low *= mult;
      high *= mult;
    }

    var free = ready && low === 0 && high === 0;
    if (ready && !free) {
      low = Math.max(80, round10(low));
      high = Math.max(low + 40, round10(high));
    }

    return {
      job: job,
      ready: ready,
      free: free,
      low: low,
      high: high,
      lines: lines,
      asides: asides,
      includes: job.includes,
      caveat: job.caveat
    };
  }

  function formatRange(q) {
    if (!q || !q.ready) return "—";
    if (q.free) return "No charge";
    return money(q.low) + "–" + money(q.high);
  }

  function readAnswers() {
    var job = JOBS[state.job];
    if (!job) return;
    job.factors.forEach(function (factor) {
      var checked = detailFields.querySelector('input[name="' + factor.id + '"]:checked');
      if (checked) state.answers[factor.id] = checked.value;
      else delete state.answers[factor.id];
    });
  }

  function clearGroupError(group) {
    if (!group) return;
    group.classList.remove("has-error");
    var msg = group.querySelector(".error-msg");
    if (msg) msg.textContent = "";
    group.querySelectorAll("[aria-invalid]").forEach(function (el) {
      el.removeAttribute("aria-invalid");
    });
  }

  function setGroupError(group, message) {
    group.classList.add("has-error");
    var msg = group.querySelector(".error-msg");
    if (msg) msg.textContent = message;
  }

  function renderJobs() {
    jobList.innerHTML = "";
    Object.keys(JOBS).forEach(function (id) {
      var job = JOBS[id];
      var label = document.createElement("label");
      label.className = "choice";
      label.innerHTML =
        '<input type="radio" name="job" required>' +
        '<span class="choice-text"><strong></strong><small></small></span>';
      var input = label.querySelector("input");
      input.value = id;
      input.checked = state.job === id;
      label.querySelector("strong").textContent = job.name;
      label.querySelector("small").textContent = "Tag " + job.tag;
      input.addEventListener("change", function () {
        state.job = id;
        state.answers = {};
        clearGroupError(document.getElementById("job-group"));
        renderDetails();
        paintTicket();
      });
      jobList.appendChild(label);
    });
  }

  function renderDetails() {
    var job = JOBS[state.job];
    detailFields.innerHTML = "";
    if (!job) return;
    var factors = visibleFactors(job, state.answers);
    factors.forEach(function (factor) {
      var group = document.createElement("fieldset");
      group.className = "form-group";
      group.dataset.factor = factor.id;
      var legend = document.createElement("legend");
      legend.textContent = factor.legend;
      group.appendChild(legend);
      var choices = document.createElement("div");
      choices.className = "choices";
      factor.options.forEach(function (opt) {
        var label = document.createElement("label");
        label.className = "choice";
        var input = document.createElement("input");
        input.type = "radio";
        input.name = factor.id;
        input.value = opt.value;
        input.checked = state.answers[factor.id] === opt.value;
        input.addEventListener("change", function () {
          var before = visibleFactors(job, state.answers).map(function (f) { return f.id; }).join();
          state.answers[factor.id] = opt.value;
          var after = visibleFactors(job, state.answers).map(function (f) { return f.id; }).join();
          clearGroupError(group);
          if (before !== after) {
            var added = after.split(",").filter(function (id) {
              return before.split(",").indexOf(id) === -1;
            });
            renderDetails();
            if (added[0]) {
              var next = detailFields.querySelector('[data-factor="' + added[0] + '"] input');
              if (next) next.focus();
            }
          }
          paintTicket();
        });
        var text = document.createElement("span");
        text.className = "choice-text";
        var strong = document.createElement("strong");
        strong.textContent = opt.label;
        var small = document.createElement("small");
        small.textContent = opt.hint || "";
        text.appendChild(strong);
        text.appendChild(small);
        label.appendChild(input);
        label.appendChild(text);
        choices.appendChild(label);
      });
      group.appendChild(choices);
      var err = document.createElement("p");
      err.className = "error-msg";
      group.appendChild(err);
      detailFields.appendChild(group);
    });
    var title = document.getElementById("detail-title");
    if (title) title.textContent = job.name;
  }

  function dayWindows(dateObj) {
    var dow = dateObj.getDay();
    return WINDOWS.filter(function (w) { return w.days[dow]; });
  }

  function renderCalendar() {
    var today = new Date();
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay(), 12);
    var tomorrowIso = isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 12));
    calGrid.innerHTML = "";
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function (name) {
      var h = document.createElement("div");
      h.className = "cal-dow";
      h.textContent = name;
      calGrid.appendChild(h);
    });

    for (var i = 0; i < DAY_COUNT; i++) {
      var date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12);
      var iso = isoDate(date);
      var past = iso < tomorrowIso;
      var closed = dayWindows(date).length === 0;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-day";
      if (state.date === iso) btn.classList.add("is-selected");
      btn.disabled = past || closed;
      btn.setAttribute("aria-pressed", state.date === iso ? "true" : "false");
      var strong = document.createElement("strong");
      strong.textContent = String(date.getDate());
      var small = document.createElement("small");
      if (past) small.textContent = "Past";
      else if (closed) small.textContent = "Closed";
      else if (!board.ready) {
        small.textContent = "…";
        btn.disabled = true;
      } else {
        var open = dayWindows(date).some(function (w) { return spotsLeft(iso, w.id) > 0; });
        small.textContent = open ? weekday(date) : "Full";
        if (!open) btn.disabled = true;
      }
      btn.appendChild(strong);
      btn.appendChild(small);
      btn.addEventListener("click", function (isoValue) {
        return function () {
          state.date = isoValue;
          var stillOpen = dayWindows(parseIso(isoValue)).some(function (w) {
            return w.id === state.windowId && spotsLeft(isoValue, w.id) > 0;
          });
          if (!stillOpen) state.windowId = "";
          clearGroupError(document.getElementById("when-group"));
          renderCalendar();
          renderSlots();
          paintTicket();
        };
      }(iso));
      calGrid.appendChild(btn);
    }
    renderSlots();
  }

  function renderSlots() {
    slotList.innerHTML = "";
    if (!state.date) {
      slotHint.hidden = false;
      slotHint.textContent = "Pick a day, then an arrival window.";
      return;
    }
    slotHint.hidden = true;
    var date = parseIso(state.date);
    dayWindows(date).forEach(function (w) {
      var left = spotsLeft(state.date, w.id);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot";
      btn.setAttribute("aria-pressed", state.windowId === w.id ? "true" : "false");
      if (state.windowId === w.id) btn.classList.add("is-selected");
      btn.disabled = left === 0;
      var label = document.createElement("strong");
      label.textContent = w.label;
      var meta = document.createElement("span");
      meta.textContent = left === 0 ? "Full" : left === 1 ? "1 truck left" : "Open";
      btn.appendChild(label);
      btn.appendChild(meta);
      btn.addEventListener("click", function () {
        state.windowId = w.id;
        clearGroupError(document.getElementById("when-group"));
        renderSlots();
        paintTicket();
      });
      slotList.appendChild(btn);
    });
  }

  function paintTicket() {
    var q = quote();
    var job = JOBS[state.job];
    ticketJob.textContent = job ? job.name : "No job picked yet";
    ticketPrice.textContent = formatRange(q);
    ticketLines.innerHTML = "";
    if (q && q.lines.length) {
      q.lines.forEach(function (line) {
        var name = document.createElement("dt");
        name.textContent = line.label;
        var val = document.createElement("dd");
        val.textContent = line.text;
        ticketLines.appendChild(name);
        ticketLines.appendChild(val);
      });
    }
    ticketIncludes.innerHTML = "";
    var includeSource = q ? q.includes : [];
    includeSource.forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = item;
      ticketIncludes.appendChild(li);
    });
    document.getElementById("ticket-includes-wrap").hidden = !includeSource.length;

    if (state.date && state.windowId) {
      var w = windowById(state.windowId);
      ticketWhen.textContent = longDate(state.date) + ", " + (w ? w.label : "");
    } else {
      ticketWhen.textContent = "Not chosen yet";
    }

    var notes = [];
    if (q && q.asides.length) notes = notes.concat(q.asides);
    if (q && q.ready && q.caveat) notes.push(q.caveat);
    if (!q || !q.ready) notes.unshift("The range fills in once every question on this job has an answer.");
    ticketNote.innerHTML = "";
    notes.forEach(function (text) {
      var p = document.createElement("p");
      p.textContent = text;
      ticketNote.appendChild(p);
    });
    syncSteps();
  }

  function syncSteps() {
    var max = maxReachable();
    stepButtons.forEach(function (btn, i) {
      btn.disabled = i > max;
      if (i === state.step) btn.setAttribute("aria-current", "step");
      else btn.removeAttribute("aria-current");
    });
  }

  function showStep(index, moveFocus) {
    state.step = index;
    steps.forEach(function (panel, i) {
      panel.hidden = i !== index;
    });
    syncSteps();
    if (!moveFocus) return;
    var heading = steps[index].querySelector("h2");
    if (heading && !heading.closest("[hidden]")) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }

  function maxReachable() {
    var n = 0;
    if (state.job) n = 1;
    var q = quote();
    if (q && q.ready) n = 2;
    if (state.date && state.windowId) n = 3;
    if (state.editingId) n = 3;
    return n;
  }

  function go(index) {
    if (index > maxReachable()) return;
    if (index === 3 && state.step === 3 && !donePanel.hidden) return;
    if (index === 1) renderDetails();
    if (index === 2) {
      showStep(2, true);
      if (!board.ready) {
        slotHint.hidden = false;
        slotHint.textContent = "Checking which windows are still open…";
      }
      loadBoard().then(function () {
        renderCalendar();
      }).catch(function () {
        board.ready = false;
        renderCalendar();
        setGroupError(document.getElementById("when-group"), "The booking board didn't answer. Start the shop server, or call (555) 010-4417.");
      });
      return;
    }
    if (index === 3) {
      document.getElementById("hold-block").hidden = false;
      donePanel.hidden = true;
    }
    showStep(index, true);
  }

  function validateDetails() {
    var job = JOBS[state.job];
    var first = null;
    visibleFactors(job, state.answers).forEach(function (factor) {
      var group = detailFields.querySelector('[data-factor="' + factor.id + '"]');
      clearGroupError(group);
      if (!state.answers[factor.id]) {
        setGroupError(group, "Pick one. Your best guess is enough.");
        if (!first) first = group.querySelector("input");
      }
    });
    if (first) first.focus();
    return !first;
  }

  function validateWhen() {
    var group = document.getElementById("when-group");
    clearGroupError(group);
    if (!board.ready) {
      setGroupError(group, "The booking board hasn't loaded yet. Wait a second and try again.");
      return false;
    }
    if (!state.date || !state.windowId) {
      setGroupError(group, "Pick a day and an arrival window.");
      var target = slotList.querySelector("button:not([disabled])") || calGrid.querySelector("button:not([disabled])");
      if (target) target.focus();
      return false;
    }
    if (spotsLeft(state.date, state.windowId) <= 0) {
      setGroupError(group, "That window just filled. Pick another.");
      state.windowId = "";
      renderCalendar();
      return false;
    }
    return true;
  }

  function checkedValue(name) {
    var el = holdForm.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  }

  function validateHold() {
    var first = null;
    function fail(id, message) {
      var el = document.getElementById(id);
      var group = el.closest(".field, .form-group");
      setGroupError(group, message);
      el.setAttribute("aria-invalid", "true");
      if (!first) first = el;
    }
    ["name", "phone", "address"].forEach(function (id) {
      clearGroupError(document.getElementById(id).closest(".field"));
    });
    clearGroupError(document.getElementById("pref-group"));
    clearGroupError(document.getElementById("email").closest(".field"));

    var name = document.getElementById("name");
    if (!name.value.trim()) fail("name", "Add a name so we know who to ask for.");

    var phone = document.getElementById("phone");
    if (phone.value.replace(/\D/g, "").length < 10) fail("phone", "Enter a 10-digit phone number, area code first.");

    var address = document.getElementById("address");
    if (address.value.trim().length < 5) fail("address", "We need the street address of the job.");

    var email = document.getElementById("email");
    var emailVal = email.value.trim();
    var pref = checkedValue("contact_pref");
    if (!pref) {
      var prefGroup = document.getElementById("pref-group");
      setGroupError(prefGroup, "Pick how you'd like us to confirm.");
      if (!first) first = prefGroup.querySelector("input");
    }
    if (pref === "email" && !emailVal) fail("email", "Add an email address, or choose call or text.");
    else if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) fail("email", "That email address looks incomplete.");

    if (first) first.focus();
    return !first;
  }

  function currentRecord(id) {
    var q = quote();
    var w = windowById(state.windowId);
    return {
      id: id,
      job: state.job,
      jobName: q.job.name,
      answers: Object.assign({}, state.answers),
      low: q.low,
      high: q.high,
      free: q.free,
      range: formatRange(q),
      lines: q.lines,
      date: state.date,
      windowId: state.windowId,
      windowLabel: w ? w.label : "",
      name: document.getElementById("name").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      address: document.getElementById("address").value.trim(),
      email: document.getElementById("email").value.trim(),
      contactPref: checkedValue("contact_pref"),
      details: document.getElementById("details").value.trim(),
      created: new Date().toISOString()
    };
  }

  function fillHoldForm(record) {
    document.getElementById("name").value = record.name || "";
    document.getElementById("phone").value = record.phone || "";
    document.getElementById("address").value = record.address || "";
    document.getElementById("email").value = record.email || "";
    document.getElementById("details").value = record.details || "";
    if (record.contactPref) {
      var radio = holdForm.querySelector('input[name="contact_pref"][value="' + record.contactPref + '"]');
      if (radio) radio.checked = true;
    }
    syncEmailRequirement();
  }

  function showDone(record) {
    donePanel.hidden = false;
    document.getElementById("done-tag").textContent = record.id;
    document.getElementById("done-summary").textContent =
      "We'll " + (record.contactPref === "text" ? "text" : record.contactPref === "email" ? "email" : "call") +
      " you at " + (record.contactPref === "email" ? record.email : record.phone) +
      " to confirm " + longDate(record.date) + ", " + record.windowLabel +
      ", for " + record.jobName + ". Sample range: " + record.range + ".";
    document.getElementById("hold-submit-label").textContent = "Update this hold";
    document.getElementById("hold-block").hidden = true;
    donePanel.hidden = false;
    donePanel.querySelector("h2").focus();
  }

  holdForm.addEventListener("submit", function (e) {
    e.preventDefault();
    readAnswers();
    var readyQuote = quote();
    if (!readyQuote || !readyQuote.ready) {
      go(1);
      validateDetails();
      return;
    }
    if (!validateHold()) return;
    if (!validateWhen()) {
      go(2);
      return;
    }
    var record = currentRecord(state.editingId || "");
    var updating = !!state.editingId;
    if (updating && state.savedPhone) record.confirmPhone = state.savedPhone;
    var submitBtn = document.getElementById("hold-submit");
    var status = document.getElementById("hold-status");
    submitBtn.disabled = true;
    status.innerHTML = "";
    api(updating ? "/api/bookings/" + encodeURIComponent(state.editingId) : "/api/bookings", {
      method: updating ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    }).then(function (saved) {
      state.editingId = saved.id;
      state.date = saved.date;
      state.windowId = saved.windowId;
      state.savedSlot = { id: saved.id, date: saved.date, windowId: saved.windowId };
      state.savedPhone = saved.phone;
      showDone(saved);
      return loadBoard().catch(function () { return null; });
    }).then(function () {
      paintTicket();
      renderCalendar();
      showStep(3, false);
    }).catch(function (err) {
      var msg = err.status === 409
        ? "That window just filled. Go back and pick another."
        : (err.message || "The hold didn't save. Try again, or call (555) 010-4417.");
      var p = document.createElement("p");
      p.className = "error-msg";
      p.style.display = "block";
      p.textContent = msg;
      status.innerHTML = "";
      status.appendChild(p);
      if (err.status === 409) loadBoard().then(renderCalendar).catch(function () {});
    }).then(function () {
      submitBtn.disabled = false;
    });
  });

  function syncEmailRequirement() {
    var needs = checkedValue("contact_pref") === "email";
    var email = document.getElementById("email");
    var opt = document.getElementById("email-opt");
    email.required = needs;
    opt.textContent = needs ? "(required for email)" : "(optional)";
  }

  holdForm.querySelectorAll('input[name="contact_pref"]').forEach(function (r) {
    r.addEventListener("change", function () {
      syncEmailRequirement();
      clearGroupError(document.getElementById("pref-group"));
    });
  });

  holdForm.querySelectorAll("input, textarea").forEach(function (el) {
    if (el.type === "radio") return;
    el.addEventListener("input", function () {
      clearGroupError(el.closest(".field"));
    });
  });

  document.getElementById("to-details").addEventListener("click", function () {
    if (!state.job) {
      setGroupError(document.getElementById("job-group"), "Pick the closest job. You can change it.");
      jobList.querySelector("input").focus();
      return;
    }
    go(1);
  });

  document.getElementById("to-when").addEventListener("click", function () {
    readAnswers();
    if (!validateDetails()) return;
    go(2);
  });

  document.getElementById("to-who").addEventListener("click", function () {
    if (!validateWhen()) return;
    document.getElementById("hold-block").hidden = false;
    donePanel.hidden = true;
    go(3);
  });

  root.querySelectorAll("[data-back]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      go(Number(btn.getAttribute("data-back")));
    });
  });

  stepButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      go(Number(btn.getAttribute("data-goto")));
    });
  });

  document.getElementById("done-change").addEventListener("click", function () {
    donePanel.hidden = true;
    go(2);
  });

  document.getElementById("done-cancel").addEventListener("click", function () {
    var box = document.getElementById("done-confirm");
    box.hidden = false;
    box.querySelector("button").focus();
  });

  document.getElementById("done-keep").addEventListener("click", function () {
    document.getElementById("done-confirm").hidden = true;
  });

  document.getElementById("done-confirm-cancel").addEventListener("click", function () {
    if (!state.editingId) return;
    var phone = state.savedPhone || document.getElementById("phone").value.trim();
    api("/api/bookings/" + encodeURIComponent(state.editingId), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone })
    }).then(function () {
    state.editingId = "";
    state.savedSlot = null;
    state.savedPhone = "";
    state.date = "";
    state.windowId = "";
    document.getElementById("done-confirm").hidden = true;
    donePanel.hidden = true;
    document.getElementById("hold-block").hidden = false;
    holdForm.reset();
    syncEmailRequirement();
    document.getElementById("hold-submit-label").textContent = "Hold this window";
    paintTicket();
    return loadBoard();
    }).then(function () {
      renderCalendar();
      go(2);
    }).catch(function (err) {
      var p = document.getElementById("done-confirm").querySelector("p");
      p.textContent = err.message || "The hold was not cancelled. Try again.";
    });
  });

  function bookingCard(record) {
    var article = document.createElement("article");
    article.className = "held-card";
    var tag = document.createElement("span");
    tag.className = "tagno";
    tag.textContent = record.id;
    var title = document.createElement("h3");
    title.textContent = record.jobName;
    var p = document.createElement("p");
    p.textContent = longDate(record.date) + ", " + record.windowLabel + " · " + record.range;
    var who = document.createElement("p");
    who.textContent = record.name + " · " + record.address;
    var actions = document.createElement("div");
    actions.className = "actions";
    var open = document.createElement("button");
    open.type = "button";
    open.className = "btn btn-ink";
    open.textContent = "Change this hold";
    open.addEventListener("click", function () {
      loadRecord(record);
    });
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-line";
    cancel.textContent = "Cancel hold";
    cancel.addEventListener("click", function () {
      if (cancel.getAttribute("data-armed") !== "true") {
        cancel.setAttribute("data-armed", "true");
        cancel.textContent = "Click again to cancel";
        return;
      }
      api("/api/bookings/" + encodeURIComponent(record.id), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: record.phone })
      }).then(function () {
        if (state.editingId === record.id) {
          state.editingId = "";
          state.savedSlot = null;
          state.savedPhone = "";
          state.date = "";
          state.windowId = "";
          donePanel.hidden = true;
          document.getElementById("hold-submit-label").textContent = "Hold this window";
          paintTicket();
        }
        return loadBoard();
      }).then(function () {
        renderCalendar();
        runLookup(lookupForm.querySelector("input").value);
      }).catch(function (err) {
        cancel.textContent = err.message || "Cancel didn't go through. Try again.";
      });
    });
    actions.appendChild(open);
    actions.appendChild(cancel);
    article.appendChild(tag);
    article.appendChild(title);
    article.appendChild(p);
    article.appendChild(who);
    article.appendChild(actions);
    return article;
  }

  function loadRecord(record) {
    state.editingId = record.id;
    state.savedSlot = { id: record.id, date: record.date, windowId: record.windowId };
    state.savedPhone = record.phone || "";
    state.job = record.job;
    state.answers = Object.assign({}, record.answers || {});
    state.date = record.date;
    state.windowId = record.windowId;
    renderJobs();
    renderDetails();
    fillHoldForm(record);
    document.getElementById("hold-submit-label").textContent = "Update this hold";
    donePanel.hidden = true;
    paintTicket();
    go(2);
    root.scrollIntoView();
  }

  function runLookup(query) {
    var q = (query || "").trim();
    lookupResults.innerHTML = "";
    if (!q) {
      lookupResults.textContent = "";
      return;
    }
    lookupResults.textContent = "Looking that up…";
    api("/api/bookings/lookup?q=" + encodeURIComponent(query.trim())).then(function (data) {
      var matches = data.bookings || [];
      lookupResults.innerHTML = "";
      if (!matches.length) {
        var empty = document.createElement("p");
        empty.textContent = "No hold matches that tag or phone.";
        lookupResults.appendChild(empty);
        return;
      }
      matches.forEach(function (b) { lookupResults.appendChild(bookingCard(b)); });
    }).catch(function (err) {
      lookupResults.textContent = err.message || "The booking board didn't answer.";
    });
  }

  lookupForm.addEventListener("submit", function (e) {
    e.preventDefault();
    runLookup(document.getElementById("lookup-q").value);
  });

  var params = new URLSearchParams(window.location.search);
  var preset = params.get("job");
  if (preset && JOBS[preset]) {
    state.job = preset;
  }
  renderJobs();
  renderDetails();
  renderCalendar();
  paintTicket();
  showStep(state.job ? 1 : 0);

  var tag = params.get("tag");
  if (tag) {
    document.getElementById("lookup-q").value = tag;
    runLookup(tag);
    document.getElementById("lookup").scrollIntoView();
  }
})();
