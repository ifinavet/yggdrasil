import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({
	path: fileURLToPath(new URL("../.env.local", import.meta.url)),
});

const turboBin = fileURLToPath(new URL("../node_modules/turbo/bin/turbo", import.meta.url));
const child = spawn(process.execPath, [turboBin, "dev", ...process.argv.slice(2)], {
	stdio: "inherit",
	env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));