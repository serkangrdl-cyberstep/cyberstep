import { test } from "node:test";
import assert from "node:assert/strict";
import { grantState, clampHours, validReason, canRequestNew } from "./supportAccess";

const now = new Date("2026-11-19T12:00:00Z");
const at = (h: number) => new Date(now.getTime() + h * 3600_000);

test("izin durumu: onaylı ve süresi dolmamış aktif, dolmuşsa expired", () => {
  assert.equal(grantState({ status: "pending", expiresAt: null }, now), "pending");
  assert.equal(grantState({ status: "approved", expiresAt: at(2) }, now), "active");
  assert.equal(grantState({ status: "approved", expiresAt: at(-1) }, now), "expired");
  assert.equal(grantState({ status: "approved", expiresAt: null }, now), "expired");
  assert.equal(grantState({ status: "declined", expiresAt: at(5) }, now), "declined");
  assert.equal(grantState({ status: "revoked", expiresAt: at(5) }, now), "revoked");
});

test("süre 1–72 saate sınırlanır, varsayılan 24", () => {
  assert.equal(clampHours(undefined), 24);
  assert.equal(clampHours("abc"), 24);
  assert.equal(clampHours(0), 24);
  assert.equal(clampHours(500), 72);
  assert.equal(clampHours(0.2), 1);
  assert.equal(clampHours(48), 48);
});

test("gerekçe en az 10 karakter olmalı", () => {
  assert.equal(validReason("kısa"), null);
  assert.equal(validReason("   "), null);
  assert.equal(validReason(undefined), null);
  assert.equal(validReason("  Tarama hatası için destek talebi  "), "Tarama hatası için destek talebi");
  assert.equal(validReason("x".repeat(501)), null);
});

test("bekleyen veya aktif izin varken yeni istek açılamaz", () => {
  assert.equal(canRequestNew(["expired", "declined", "revoked"]), true);
  assert.equal(canRequestNew(["pending"]), false);
  assert.equal(canRequestNew(["expired", "active"]), false);
  assert.equal(canRequestNew([]), true);
});
