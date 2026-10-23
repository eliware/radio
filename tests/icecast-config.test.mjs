import { expect, test } from "@jest/globals";
import { createIcecastConfig } from "../src/icecast-config.mjs";

test("writes Icecast settings and safely escapes the source password", () => {
  const config = createIcecastConfig(`long<&>"'password`);

  expect(config).toContain(
    "<source-password>long&lt;&amp;&gt;&quot;&apos;password</source-password>",
  );
  expect(config).toContain("<port>8000</port>");
  expect(config).toContain("<hostname>radio</hostname>");
});

test.each([undefined, "short"])("rejects an invalid source password", (password) => {
  expect(() => createIcecastConfig(password)).toThrow(
    "ICECAST_SOURCE_PASSWORD must contain at least 16 characters",
  );
});
