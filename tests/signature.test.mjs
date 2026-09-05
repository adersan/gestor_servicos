import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function extractFunction(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start);
  assert.notEqual(start, -1, `Function ${name} was not found`);
  assert.notEqual(end, -1, `Function boundary ${nextName} was not found`);
  // Se a proxima funcao for "async function ...", o indexOf acha "function" depois do
  // "async" - remove o "async" solto que sobra no fim do trecho extraido.
  return source.slice(start, end).replace(/\basync\s*$/, "");
}

const context = {
  console,
  SIGNATURE_MAX_FONT_BYTES: 2 * 1024 * 1024,
  SIGNATURE_FONT_EXTENSIONS: [".ttf", ".otf", ".woff", ".woff2"]
};
vm.createContext(context);

// extrasTextWidthWithSpacing: with no letterSpacing, must equal ctx.measureText(text).width
// (identical to the pre-existing behavior); with letterSpacing, must add it between every
// character but not after the last one (n-1 gaps for n characters).
vm.runInContext(extractFunction("extrasTextWidthWithSpacing", "extrasRemeasureText"), context);
{
  const fakeCtx = { measureText: (text) => ({ width: text.length * 10 }) };
  assert.equal(context.extrasTextWidthWithSpacing(fakeCtx, "abc", 0), 30, "no spacing: same as measureText");
  assert.equal(context.extrasTextWidthWithSpacing(fakeCtx, "abc", 5), 40, "3 chars + 2 gaps of 5 = 30 + 10");
  assert.equal(context.extrasTextWidthWithSpacing(fakeCtx, "a", 5), 10, "single char: no gap added");
}

vm.runInContext(extractFunction("signatureFontMimeFor", "readFileAsDataUrl"), context);
{
  assert.equal(context.signatureFontMimeFor("assinatura.ttf"), "font/ttf");
  assert.equal(context.signatureFontMimeFor("Assinatura.OTF"), "font/otf");
  assert.equal(context.signatureFontMimeFor("cursive.woff2"), "font/woff2");
  assert.equal(context.signatureFontMimeFor("cursive.woff"), "font/woff");
}

vm.runInContext(extractFunction("signatureValidateFontFile", "signatureFontMimeFor"), context);
{
  assert.equal(context.signatureValidateFontFile({ name: "assinatura.ttf", size: 1000 }), null, "valid .ttf under the limit passes");
  assert.match(context.signatureValidateFontFile({ name: "assinatura.png", size: 1000 }), /não suportado/, "rejects non-font extension");
  assert.match(
    context.signatureValidateFontFile({ name: "assinatura.woff2", size: 3 * 1024 * 1024 }),
    /muito grande/,
    "rejects file over the 2MB limit"
  );
}

console.log("signature helpers test passed");
