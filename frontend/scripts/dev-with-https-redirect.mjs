import http from "node:http";
import { spawn } from "node:child_process";

const httpsHost = process.env.DEV_HOST ?? "0.0.0.0";
const httpsPort = Number.parseInt(process.env.DEV_HTTPS_PORT ?? "5173", 10);
const redirectHost = process.env.REDIRECT_HOST ?? "0.0.0.0";
const redirectPort = Number.parseInt(process.env.REDIRECT_PORT ?? "5172", 10);

if (Number.isNaN(httpsPort) || Number.isNaN(redirectPort)) {
  console.error("DEV_HTTPS_PORT and REDIRECT_PORT must be valid numbers.");
  process.exit(1);
}

const vite = spawn(
  "vite",
  ["--host", httpsHost, "--port", String(httpsPort)],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

const redirectServer = http.createServer((request, response) => {
  const requestHost = request.headers.host?.split(":")[0] || "localhost";
  const requestUrl = request.url || "/";
  const location = `https://${requestHost}:${httpsPort}${requestUrl}`;

  response.writeHead(308, {
    Location: location,
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(`Redirecting to ${location}\n`);
});

redirectServer.listen(redirectPort, redirectHost, () => {
  console.log(
    `HTTP redirect server listening on http://${redirectHost}:${redirectPort} -> https://<same-host>:${httpsPort}`,
  );
});

redirectServer.on("error", (error) => {
  console.error(`Failed to start HTTP redirect server on port ${redirectPort}:`);
  console.error(error);
  shutdown(1);
});

vite.on("exit", (code, signal) => {
  if (signal) {
    shutdown(0);
    return;
  }

  shutdown(code ?? 0);
});

vite.on("error", (error) => {
  console.error("Failed to start Vite:");
  console.error(error);
  shutdown(1);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

let shuttingDown = false;
function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  redirectServer.close();

  if (!vite.killed) {
    vite.kill();
  }

  process.exit(exitCode);
}
