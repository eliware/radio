import { expect, test } from "@jest/globals";
import { path } from "@eliware/common";
import getAirbandConfigPath from "../../src/runtime-paths/airband.mjs";

test("places the Airband config in the temporary directory", () => {
  expect(getAirbandConfigPath("/tmp")).toBe(path("/tmp", "rtl_airband.conf"));
});
