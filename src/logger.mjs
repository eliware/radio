import { knownSecrets } from "./logging/secrets.mjs";
import createRadioLogger from "./logging/logger.mjs";

export { default as createRadioLogger } from "./logging/logger.mjs";
export const logger = createRadioLogger({ secrets: knownSecrets });
