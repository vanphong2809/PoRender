import http from "node:http";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(
  readFileSync(new URL("./version.json", import.meta.url), "utf8"),
);
const port = Number(process.env.PORT || 10000);
const server = http.createServer((request, response) => {
  console.log(
    JSON.stringify({
      event: "request",
      version,
      path: request.url,
      deploymentId: process.env.PORENDER_DEPLOYMENT_ID,
    }),
  );
  response.writeHead(200, {
    "content-type": "application/json",
    "x-app-version": version,
  });
  response.end(
    JSON.stringify({
      version,
      deploymentId: process.env.PORENDER_DEPLOYMENT_ID,
    }),
  );
});
server.listen(port, "0.0.0.0", () =>
  console.log(JSON.stringify({ event: "started", version, port })),
);
process.once("SIGTERM", () => server.close(() => process.exit(0)));
