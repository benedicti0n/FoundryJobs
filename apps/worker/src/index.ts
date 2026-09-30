import { APP_NAME } from "@foundryjobs/shared";

const heartbeat = setInterval(() => undefined, 30_000);

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${APP_NAME} worker received ${signal}, shutting down`);
  clearInterval(heartbeat);
  process.exit(0);
}

console.log(`${APP_NAME} worker booted`);
console.log("No scheduled jobs registered yet");

process.once("SIGINT", () => {
  shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  shutdown("SIGTERM");
});
