'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const test = require('node:test');
const { join } = require('node:path');

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const linkPart = html.slice(html.indexOf('function parseBGGLink('), html.indexOf('function AddModal('));
const lookupPart = html.slice(
  html.indexOf('// ── No-key game lookup:'),
  html.indexOf('// ── BGG Image Fetcher')
);

function createContext(fetch) {
  const context = {
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch,
    BGG_DB: { 'Ark Nova': { name: 'Ark Nova', bggId: 342942, year: 2021, minP: 1, maxP: 4 } },
  };
  runInNewContext(linkPart + '\n' + lookupPart, context);
  return context;
}

test('only official HTTPS board-game links are accepted', () => {
  const { parseBGGLink, gameNameFromBGGLink } = createContext(async () => null);
  assert.equal(parseBGGLink('https://boardgamegeek.com/boardgame/266192/wingspan'), 266192);
  assert.equal(parseBGGLink('https://www.boardgamegeek.com/boardgameexpansion/1234/foo'), 1234);
  assert.equal(parseBGGLink('https://boardgamegeek.com.evil.test/boardgame/1'), null);
  assert.equal(parseBGGLink('http://boardgamegeek.com/boardgame/1'), null);
  assert.equal(gameNameFromBGGLink('https://boardgamegeek.com/boardgame/1/ticket-to-ride'), 'Ticket To Ride');
});

test('uses existing local game data without sending a network request', async () => {
  const { fetchBGGDetails } = createContext(() => { throw Error('must not request'); });
  const result = await fetchBGGDetails(342942, 'https://boardgamegeek.com/boardgame/342942/ark-nova');
  assert.equal(result.lookupSource, 'saved');
  assert.equal(result.name, 'Ark Nova');
});

test('uses anonymous Wikidata metadata and chooses a typical player count', async () => {
  const wikidataRows = [2, 5, 7].map(max => ({
    name: { value: 'Wingspan' },
    date: { value: '2019-03-08T00:00:00Z' },
    min: { value: '1' },
    max: { value: String(max) },
    image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Wingspan.jpg' },
  }));
  const context = createContext(async url => {
    assert.match(url, /^https:\/\/query\.wikidata\.org\/sparql\?/);
    assert.match(decodeURIComponent(url), /wdt:P2339 "266192"/);
    return { ok: true, json: async () => ({ results: { bindings: wikidataRows } }) };
  });
  const result = await context.fetchBGGDetails(266192, 'https://boardgamegeek.com/boardgame/266192/wingspan');
  assert.equal(result.lookupSource, 'wikidata');
  assert.equal(result.name, 'Wingspan');
  assert.equal(result.year, 2019);
  assert.equal(result.minP, 1);
  assert.equal(result.maxP, 5);
  assert.match(result.imgUrl, /^https:/);
});

test('falls back to the game name in the BGG link when not cataloged', async () => {
  const context = createContext(async () => ({ ok: true, json: async () => ({ results: { bindings: [] } }) }));
  const result = await context.fetchBGGDetails(999999, 'https://boardgamegeek.com/boardgame/999999/a-new-game');
  assert.equal(result.lookupSource, 'slug');
  assert.equal(result.name, 'A New Game');
  assert.equal(result.bggId, 999999);
});

test('network failure does not block adding a game manually', async () => {
  const context = createContext(async () => { throw Error('offline'); });
  const result = await context.fetchBGGDetails(999999, 'https://boardgamegeek.com/boardgame/999999/example-game');
  assert.equal(result.lookupSource, 'slug');
  assert.equal(result.name, 'Example Game');
});
