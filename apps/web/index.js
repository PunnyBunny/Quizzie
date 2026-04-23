const http = require("node:http");
const path = require("node:path");
const handler = require("serve-handler");

const port = Number(process.env.PORT) || 8080;
const publicDir = path.join(__dirname, "dist");

const server = http.createServer((req, res) =>
  handler(req, res, {
    public: publicDir,
    rewrites: [{ source: "**", destination: "/index.html" }],
  }),
);

server.listen(port, "0.0.0.0", () => {
  console.log(`Listening on 0.0.0.0:${port}`);
});
