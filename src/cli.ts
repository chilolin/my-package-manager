import { Command } from "commander";
import install from "./install.js";
const program = new Command();

program
  .command("install")
  .argument("[packageNames...]")
  .option("--production", "Install production dependencies only.")
  .option("--save-dev", "Install as devDependencies.")
  .action(async (str, options) => {
    await install(str, options);

    process.exit(0);
  });

program.parse();
