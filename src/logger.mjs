import { knownSecrets } from "./logging/error-details.mjs";
import { createRadioLogger } from "./logging/logger.mjs";

export { createRadioLogger } from "./logging/logger.mjs";
export const logger = createRadioLogger({ secrets: knownSecrets });
