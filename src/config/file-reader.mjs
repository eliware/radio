import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

export default async function readChannelConfigFile(path, read = readFile) {
  return parseEnv(await read(path, "utf8"));
}
