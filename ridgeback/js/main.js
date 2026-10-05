(function () {
  "use strict";

  var PHONE_DISPLAY = "(555) 010-4417";
  var PHONE_TEL = "tel:+15550104417";

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");

  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    };

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });

    window.matchMedia("(min-width: 901px)").addEventListener("change", function (e) {
      if (e.matches) setOpen(false);
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Quote form ---------- */
  var form = document.getElementById("quote-form");
  if (!form) return;

  var MAX_FILES = 5;
  var MAX_BYTES = 10 * 1024 * 1024;

  var statusEl = document.getElementById("form-status");
  var submitBtn = form.querySelector(".btn-submit");
  var submitLabel = submitBtn.querySelector(".label");
  var fileInput = document.getElementById("photos");
  var fileList = document.getElementById("file-list");
  var urgentAlert = document.getElementById("urgent-alert");
  var emailInput = document.getElementById("email");
  var emailOpt = document.getElementById("email-opt");

  var preset = new URLSearchParams(window.location.search).get("service");
  var serviceSelect = document.getElementById("service");
  if (preset && serviceSelect.querySelector('option[value="' + preset.replace(/[^a-z-]/g, "") + '"]')) {
    serviceSelect.value = preset;
  }

  function groupOf(el) {
    return el.closest(".form-group, .field");
  }

  function setError(el, message) {
    var group = groupOf(el);
    var msg = group.querySelector(".error-msg");
    group.classList.add("has-error");
    msg.textContent = message;
    group.querySelectorAll("input, select, textarea").forEach(function (i) {
      if (i.type !== "radio" && i.type !== "file") i.setAttribute("aria-invalid", "true");
    });
  }

  function clearError(el) {
    var group = groupOf(el);
    if (!group) return;
    group.classList.remove("has-error");
    var msg = group.querySelector(".error-msg");
    if (msg) msg.textContent = "";
    group.querySelectorAll("[aria-invalid]").forEach(function (i) {
      i.removeAttribute("aria-invalid");
    });
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function checkedValue(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  }

  // Emergency choice: tell them to call instead of waiting on a form.
  form.querySelectorAll('input[name="urgency"]').forEach(function (r) {
    r.addEventListener("change", function () {
      urgentAlert.classList.toggle("is-visible", checkedValue("urgency") === "leaking-now");
      clearError(r);
    });
  });

  // Email becomes required when it's the preferred contact method.
  form.querySelectorAll('input[name="contact_pref"]').forEach(function (r) {
    r.addEventListener("change", function () {
      var needsEmail = checkedValue("contact_pref") === "email";
      emailInput.required = needsEmail;
      emailOpt.textContent = needsEmail ? "(required for email replies)" : "(optional)";
      clearError(r);
    });
  });

  fileInput.addEventListener("change", function () {
    clearError(fileInput);
    fileList.innerHTML = "";
    var files = Array.prototype.slice.call(fileInput.files);
    files.forEach(function (f) {
      var li = document.createElement("li");
      var name = document.createElement("span");
      name.textContent = f.name;
      var size = document.createElement("span");
      size.className = "size";
      size.textContent = formatSize(f.size);
      li.appendChild(name);
      li.appendChild(size);
      fileList.appendChild(li);
    });
    validateFiles();
  });

  function validateFiles() {
    var files = Array.prototype.slice.call(fileInput.files);
    if (files.length > MAX_FILES) {
      setError(fileInput, "That's " + files.length + " photos. Pick up to " + MAX_FILES + ".");
      return false;
    }
    var big = files.filter(function (f) { return f.size > MAX_BYTES; });
    if (big.length) {
      setError(fileInput, big[0].name + " is over 10 MB. Try a smaller photo or a screenshot of it.");
      return false;
    }
    var notImage = files.filter(function (f) { return f.type && f.type.indexOf("image/") !== 0; });
    if (notImage.length) {
      setError(fileInput, notImage[0].name + " isn't a photo. Use JPG, PNG or HEIC.");
      return false;
    }
    return true;
  }

  form.querySelectorAll("input, select, textarea").forEach(function (el) {
    if (el.type === "radio" || el.type === "file") return;
    el.addEventListener("input", function () { clearError(el); });
  });

  function validate() {
    var firstBad = null;
    function fail(el, msg) {
      setError(el, msg);
      if (!firstBad) firstBad = el;
    }

    var service = document.getElementById("service");
    if (!service.value) fail(service, "Choose the closest match. \"Something else\" is fine.");

    if (!checkedValue("urgency")) fail(form.querySelector('input[name="urgency"]'), "Tell us how soon you need someone.");

    var address = document.getElementById("address");
    if (address.value.trim().length < 5) fail(address, "We need the street address of the job.");

    var name = document.getElementById("name");
    if (!name.value.trim()) fail(name, "Add a name so we know who to ask for.");

    var phone = document.getElementById("phone");
    var digits = phone.value.replace(/\D/g, "");
    if (digits.length < 10) fail(phone, "Enter a 10-digit phone number, area code first.");

    var pref = checkedValue("contact_pref");
    if (!pref) fail(form.querySelector('input[name="contact_pref"]'), "Pick how you'd like us to reply.");

    var email = emailInput.value.trim();
    if (pref === "email" && !email) fail(emailInput, "Add an email address, or choose call or text.");
    else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(emailInput, "That email address looks incomplete.");

    if (!validateFiles() && !firstBad) firstBad = fileInput;

    if (firstBad) {
      (firstBad.type === "file" ? firstBad.closest(".file-drop").querySelector("input") : firstBad).focus();
      return false;
    }
    return true;
  }

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.setAttribute("aria-busy", String(busy));
    submitLabel.textContent = busy ? "Sending\u2026" : "Send request";
  }

  function showError() {
    statusEl.innerHTML =
      '<div class="status-panel status-error" role="alert" tabindex="-1">' +
        "<h3>That didn\u2019t send.</h3>" +
        "<p>Your details are still in the form. Check your connection and try again. If water is coming in, don\u2019t wait on this, call us.</p>" +
        '<div class="actions">' +
          '<button type="submit" form="quote-form" class="btn btn-ink">Try again</button>' +
          '<a class="btn btn-call" href="' + PHONE_TEL + '"><span class="num">' + PHONE_DISPLAY + "</span></a>" +
        "</div>" +
      "</div>";
    statusEl.firstChild.focus();
  }

  function showSuccess(data, demo) {
    var pref = data.get("contact_pref");
    var how = pref === "text" ? "text" : pref === "email" ? "email" : "call";
    var where = pref === "email" ? data.get("email") : data.get("phone");
    var urgency = data.get("urgency");
    var when = urgency === "leaking-now"
      ? "Because you said water is leaking now, please also call us. Don\u2019t wait for a reply."
      : "TODO: state your real reply time (e.g. \u201cwithin 2 business hours\u201d).";

    var panel = document.createElement("div");
    panel.className = "status-panel status-success";
    panel.setAttribute("role", "status");
    panel.setAttribute("tabindex", "-1");
    panel.innerHTML =
      '<span class="tagno">OK</span>' +
      "<h3>Request received.</h3>" +
      '<p>We\u2019ll <span data-how></span> you at <strong data-where></strong>. <span data-when></span></p>' +
      (demo ? '<p><span class="todo">Demo mode: nothing was sent. TODO: connect a form backend.</span></p>' : "") +
      '<div class="actions"><button type="button" class="btn btn-line" data-reset>Send another request</button></div>';
    panel.querySelector("[data-how]").textContent = how;
    panel.querySelector("[data-where]").textContent = where;
    panel.querySelector("[data-when]").textContent = when;

    form.hidden = true;
    statusEl.innerHTML = "";
    statusEl.appendChild(panel);
    panel.focus();

    panel.querySelector("[data-reset]").addEventListener("click", function () {
      form.reset();
      fileList.innerHTML = "";
      urgentAlert.classList.remove("is-visible");
      emailInput.required = false;
      emailOpt.textContent = "(optional)";
      statusEl.innerHTML = "";
      form.hidden = false;
      document.getElementById("service").focus();
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitBtn.disabled) return;
    statusEl.innerHTML = "";
    if (!validate()) return;

    var data = new FormData(form);
    var endpoint = form.getAttribute("data-endpoint");
    var forceError = /[?&]demo=error\b/.test(window.location.search);
    setBusy(true);

    var request;
    if (endpoint) {
      request = fetch(endpoint, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" }
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
      });
    } else {
      // No backend configured yet: simulate a round trip.
      request = new Promise(function (resolve, reject) {
        setTimeout(function () {
          forceError ? reject(new Error("demo error")) : resolve();
        }, 1200);
      });
    }

    request
      .then(function () { showSuccess(data, !endpoint); })
      .catch(function () { showError(); })
      .then(function () { setBusy(false); });
  });
})();
