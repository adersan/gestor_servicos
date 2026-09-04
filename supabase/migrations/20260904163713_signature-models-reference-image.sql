-- Fase 2 de "Escrita personalizada": campos para modelos do tipo "image" (assinatura
-- de referencia analisada por IA). reference_image_data segue o mesmo padrao ja usado
-- por font_data - base64, fora do fetchAll por economia de egress, carregado sob
-- demanda so quando realmente precisa (ver ensureSignatureFontData/ensureSignatureReferenceImageData
-- em app.js). analysis_summary guarda o resumo textual opcional devolvido pela Claude
-- (Anthropic) em analyze-signature-style.mjs. Os 10 parametros de estilo analisados
-- (slant, strokeWidth, letterSpacing etc.) vao no campo "style" jsonb que ja existe
-- desde a Fase 1 (reservado e nunca usado ate agora).
alter table public.signature_models
  add column if not exists reference_image_data text,
  add column if not exists reference_image_mime text,
  add column if not exists analysis_summary text;
