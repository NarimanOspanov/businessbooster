const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    let filePath = path.normalize(path.join(ROOT, urlPath));

    // Не выходить за пределы корня проекта
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA-стиль: на неизвестные пути отдаём главную
        fs.readFile(path.join(ROOT, "index.html"), (err2, home) => {
          if (err2) {
            res.writeHead(404).end("Not found");
          } else {
            res.writeHead(200, { "Content-Type": MIME[".html"] }).end(home);
          }
        });
        return;
      }
      const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type }).end(data);
    });
  })
  .listen(PORT, () => console.log(`Business Booster running on port ${PORT}`));
