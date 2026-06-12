const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

http.createServer((request, response) => {
  const requestPath = request.url === "/" ? "index.html" : request.url.split("?")[0];
  const filePath = path.join(root, decodeURIComponent(requestPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Acesso negado");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Arquivo não encontrado");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
}).listen(8080, "0.0.0.0", () => {
  console.log("Gestor disponível na porta 8080");
});
