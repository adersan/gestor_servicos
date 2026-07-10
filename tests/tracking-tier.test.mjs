import assert from "node:assert/strict";
import { accessCodeHash, identifierHash, passwordHash, resolveTrackingTier } from "../netlify/functions/_shared/server.mjs";

// Legacy link (no identifier_hash nor full_token_hash) always resolves to full-legacy, regardless of credentials
const legacyLink = { identifier_hash: null, password_hash: null, full_token_hash: null };
assert.equal(resolveTrackingTier(legacyLink, {}), "full-legacy");
assert.equal(resolveTrackingTier(legacyLink, { fullAccessCode: "anything" }), "full-legacy");

// Gated link (embedded full-access code) with no credentials at all is restricted
const embeddedLink = { identifier_hash: null, password_hash: null, full_token_hash: accessCodeHash("full-secret") };
assert.equal(resolveTrackingTier(embeddedLink, {}), "restricted");

// Gated link: correct fullAccessCode unlocks full access
assert.equal(resolveTrackingTier(embeddedLink, { fullAccessCode: "full-secret" }), "full");

// Gated link: wrong fullAccessCode stays restricted
assert.equal(resolveTrackingTier(embeddedLink, { fullAccessCode: "wrong-secret" }), "restricted");

// Gated link (typed identifier/password)
const typedLink = {
  identifier_hash: identifierHash("GS-12345678"),
  password_hash: passwordHash("Senha123"),
  full_token_hash: null
};
assert.equal(resolveTrackingTier(typedLink, {}), "restricted");
assert.equal(resolveTrackingTier(typedLink, { identifier: "GS-12345678", password: "Senha123" }), "full");
assert.equal(resolveTrackingTier(typedLink, { identifier: "gs-12345678", password: "Senha123" }), "full");
assert.equal(resolveTrackingTier(typedLink, { identifier: "GS-12345678", password: "wrong" }), "restricted");
assert.equal(resolveTrackingTier(typedLink, { identifier: "GS-00000000", password: "Senha123" }), "restricted");

console.log("tracking tier test passed");
