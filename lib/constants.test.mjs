import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { PRODUCTION_APP_URL, LOCAL_APP_URL } from "@/lib/constants";

test("extension constants stay aligned with lib/constants.js", () => {
  const ext = fs.readFileSync(new URL("../extension/constants.js", import.meta.url), "utf8");
  assert.ok(ext.includes(PRODUCTION_APP_URL), "extension/constants.js must use PRODUCTION_APP_URL");
});

test("docs that publish the live URL mention PRODUCTION_APP_URL", () => {
  const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.ok(readme.includes(PRODUCTION_APP_URL));
});

test("local and production URLs are distinct https/http origins", () => {
  assert.equal(new URL(PRODUCTION_APP_URL).protocol, "https:");
  assert.equal(new URL(LOCAL_APP_URL).protocol, "http:");
  assert.notEqual(PRODUCTION_APP_URL, LOCAL_APP_URL);
});
