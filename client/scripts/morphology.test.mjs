import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as morphology from '../src/lib/morphology.ts';
import * as stock from '../src/lib/product-availability.ts';
import { readInlineImage } from '../src/lib/gemini-image.ts';

const source = await readFile(new URL('../src/lib/morphology-quiz.ts', import.meta.url), 'utf8');
const quizSource = stripTypeScriptTypes(source).replace(/^import .*$/gm, '').replace(/^export /gm, '');
const { getMorphologyRecommendations, parseMorphologyQuiz, rankMorphologyProducts } = runInNewContext(
  quizSource + '\n({ getMorphologyRecommendations, parseMorphologyQuiz, rankMorphologyProducts })', { ...morphology, ...stock },
);

test('normalizes Gemini and legacy labels while preserving multiple faces and unknown sizes', () => {
  assert.deepEqual(morphology.normalizeMorphology({
    frame_shape: 'Rectangulaire', style_vibe: 'Minimaliste', optical_fit: 'Moyen / Standard',
    ideal_faces: '["Rond", "Oval", "Carré", "Carré"]',
  }), { frame_shape: 'rectangle', style_vibe: 'minimalist', optical_fit: 'medium', ideal_faces: ['round', 'oval', 'square'] });
  assert.deepEqual(morphology.normalizeMorphology({ frame_shape: 'Non spécifié', optical_fit: 'Standard', ideal_faces: '{Tous}' }),
    { frame_shape: null, style_vibe: null, optical_fit: null, ideal_faces: [] });
  assert.equal(morphology.normalizeFrameShape('Œil-de-chat'), 'cat_eye');
  assert.equal(readInlineImage('data:image/png;base64,AA==').mimeType, 'image/png');
});

test('uses all quiz answers, keeps compatible sizes ahead of unknowns, and ranks unavailable products last', () => {
  const base = { title: 'Monture Optique Rectangulaire de vue chic', stock: 5, is_active: true };
  const round = { ...base, id: 'round', frame_shape: 'Rond Classique', style_vibe: 'Retro', optical_fit: 'small', ideal_faces: ['Carré'] };
  const rectangle = { ...base, id: 'rectangle', frame_shape: 'Rectangulaire', style_vibe: 'Minimaliste', optical_fit: 'medium', ideal_faces: 'Rond, Ovale, Carré' };
  const unknown = { ...rectangle, id: 'unknown', optical_fit: null };
  const soldOut = { ...rectangle, id: 'sold-out', color_options: [{ id: 'black', isAvailable: false }] };
  const watch = { ...rectangle, id: 'watch', title: 'Montre rectangulaire' };
  const products = [unknown, round, soldOut, rectangle, watch];
  const rank = token => Array.from(rankMorphologyProducts(products, parseMorphologyQuiz(token)), product => product.id);
  assert.deepEqual(rank('homme,round,angular,medium'), ['rectangle', 'unknown', 'round', 'sold-out']);
  assert.equal(rank('femme,square,soft,small')[0], 'round');
  assert.equal(parseMorphologyQuiz('homme,round,medium'), null);

  const unrelated = { ...base, id: 'unrelated', gender: 'homme' };
  const candidates = [
    { ...rectangle, gender: 'unisex' },
    { ...unknown, gender: 'homme' },
    { ...rectangle, id: 'wrong-face', gender: 'homme', ideal_faces: ['heart'] },
    { ...round, gender: 'homme' },
    { ...soldOut, gender: 'homme' },
    { ...rectangle, id: 'wrong-gender', gender: 'femme' },
    { ...watch, gender: 'unisex' },
    unrelated,
  ];
  const results = getMorphologyRecommendations(candidates, parseMorphologyQuiz('homme,round,angular,medium'));
  assert.deepEqual(Array.from(results.strong, product => product.id), ['rectangle']);
  assert.deepEqual(Array.from(results.alternatives, product => product.id), ['unknown', 'wrong-face']);

  const empty = getMorphologyRecommendations([unrelated], parseMorphologyQuiz('homme,heart,soft,large'));
  assert.equal(empty.strong.length + empty.alternatives.length, 0);
});
