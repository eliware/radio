import { expect, jest, test } from "@jest/globals";
import { readChannelConfigFile } from "../../src/config/file-reader.mjs";

test("reads a channel file as UTF-8 and parses environment values", async () => {
  const read = jest.fn(async () => "CHANNEL=Police\nUDP_PORT=15581\n");
  await expect(readChannelConfigFile("police.env", read)).resolves.toEqual({
    CHANNEL: "Police",
    UDP_PORT: "15581",
  });
  expect(read).toHaveBeenCalledWith("police.env", "utf8");
});
