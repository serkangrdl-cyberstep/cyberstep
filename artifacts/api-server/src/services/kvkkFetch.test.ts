import test from "node:test";
import assert from "node:assert/strict";
import tls from "node:tls";
import { derToPem } from "./kvkkFetch";

test("DER sertifika PEM'e çevrilir", () => {
  const pem = tls.rootCertificates[0];
  const der = Buffer.from(pem.replace(/-----[A-Z ]+-----|\s/g, ""), "base64");
  const out = derToPem(der);
  assert.match(out, /^-----BEGIN CERTIFICATE-----/);
});
