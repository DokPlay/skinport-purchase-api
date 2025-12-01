import { mkdir, cp } from "node:fs/promises";

async function main() {
  // копируем из src/data -> dist/data
  await mkdir("dist/data", { recursive: true });
  await cp("src/data", "dist/data", { recursive: true });
  console.log("Copied assets: src/data -> dist/data");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
