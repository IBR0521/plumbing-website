"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const db = require("./db");

const PORT = Number(process.env.PORT) || 4173;
const ROOT = path.resolve(__dirname, "..", "ridgeback");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const lookups = new Map();

function limited(ip) {
  const now = Date.now();
  const hit = lookups.get(ip) || { n: 0, reset: now + 60000 };
  if (now > hit.reset) {
    hit.n = 0;
    hit.reset = now + 60000;
  }
  hit.n += 1;
  lookups.set(ip, hit);
  return hit.n > 40;
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
    "Cache-Control": "no-store"
  });
  res.end(json);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on("data", function (chunk) {
      size += chunk.length;
      if (size > 32768) {
        reject(Object.assign(new Error("The booking is too large."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(Object.assign(new Error("The booking was not valid JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function serveFile(res, urlPath) {
  const rel = urlPath === "/" ? "/index.html" : decodeURIComponent(urlPath.split("?")[0]);
  const file = path.resolve(ROOT, "." + rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    send(res, 403, { error: "That path is not available." });
    return;
  }
  fs.readFile(file, function (err, buf) {
    if (err) {
      send(res, 404, { error: "Not found." });
      return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(buf);
  });
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  const route = url.pathname;

  if (route.startsWith("/api/")) {
    const ip = req.socket.remoteAddress || "local";
    Promise.resolve().then(function () {
      if (req.method === "GET" && route === "/api/health") {
        return send(res, 200, { ok: true, database: "sqlite" });
      }
      if (req.method === "GET" && route === "/api/availability") {
        return send(res, 200, db.countsFrom(url.searchParams.get("start"), url.searchParams.get("days")));
      }
      if (req.method === "GET" && route === "/api/bookings/lookup") {
        if (limited(ip)) return send(res, 429, { error: "Too many lookups. Wait a minute and try again." });
        return send(res, 200, { bookings: db.lookup(url.searchParams.get("q")) });
      }
      if (req.method === "POST" && route === "/api/bookings") {
        return readBody(req).then(function (body) {
          send(res, 201, db.createBooking(body));
        });
      }
      const one = route.match(/^\/api\/bookings\/(\d{4})$/);
      if (one && (req.method === "PATCH" || req.method === "DELETE")) {
        return readBody(req).then(function (body) {
          if (req.method === "DELETE") send(res, 200, db.deleteBooking(one[1], body.phone));
          else send(res, 200, db.updateBooking(one[1], body));
        });
      }
      send(res, 404, { error: "Not found." });
    }).catch(function (err) {
      if (res.headersSent) return;
      send(res, err.status || 500, { error: err.status ? err.message : "The booking board failed." });
    });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, { error: "That method is not supported." });
    return;
  }
  serveFile(res, route);
});

server.listen(PORT, function () {
  console.log("Ridgeback booking board at http://127.0.0.1:" + PORT + "/");
  console.log("SQLite database: data/ridgeback.sqlite");
});
