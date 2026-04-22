import http from "node:http";
import handler from "serve-handler";

const port = Number(process.env.PORT) || 8080;

const server = http.createServer((req, res) =>
  handler(req, res, {
    public: "dist",
    rewrites: [{ source: "**", destination: "/index.html" }],
  }),
);

server.listen(port, "0.0.0.0", () => {
  console.log(`Listening on 0.0.0.0:${port}`);
});
