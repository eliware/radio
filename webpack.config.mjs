import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default {
  context: root,
  mode: "production",
  target: "web",
  entry: { client: "./src/client.mjs" },
  output: {
    path: resolve(root, "dist"),
    filename: "[name].js",
    clean: true,
  },
};
