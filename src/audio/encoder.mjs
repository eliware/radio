import OpusScript from "opusscript";
import { SAMPLE_RATE } from "./codec.mjs";

export default function createEncoder() {
  return new OpusScript(SAMPLE_RATE, 1, OpusScript.Application.VOIP);
}
