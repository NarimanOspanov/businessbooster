// Ping IndexNow (Bing) with all storefront URLs on a host.
// Usage: node scripts/ping-indexnow.js <host>
const fs = require("fs");
const path = require("path");

const KEY = "8c2f1e4b9a374d5f8b6a1c0d2e3f4a5b"; // must match server.js
const host = process.argv[2];
if (!host) {
  console.error("Usage: node scripts/ping-indexnow.js <host>");
  process.exit(1);
}

const slugs = fs
  .readdirSync(path.join(__dirname, "..", "data", "merchants"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5));

const urls = ["https://" + host + "/", "https://" + host + "/ru/"];
for (const s of slugs) {
  urls.push("https://" + host + "/store/" + s);
  urls.push("https://" + host + "/store/" + s + "/feed-google.xml");
}

(async () => {
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: KEY,
      keyLocation: "https://" + host + "/" + KEY + ".txt",
      urlList: urls,
    }),
  });
  console.log("IndexNow: HTTP " + res.status + " for " + urls.length + " URLs on " + host);
  const text = await res.text();
  if (text) console.log(text);
})();
