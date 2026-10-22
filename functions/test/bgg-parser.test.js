'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGameFromXml } = require('../bgg-parser');

const fixture = `<?xml version="1.0" encoding="utf-8"?>
<items><item type="boardgame" id="266192">
<name type="alternate" value="Other title"/><name type="primary" value="Wingspan"/>
<yearpublished value="2019"/><minplayers value="1"/><maxplayers value="5"/>
<minplaytime value="40"/><maxplaytime value="70"/>
<image>https://cf.geekdo-images.com/example.jpg</image>
<description>Birds &amp; nature. &lt;br/&gt; A strategy game.</description>
<link type="boardgamecategory" value="Animals"/><link type="boardgamecategory" value="Card Game"/>
<poll name="suggested_numplayers"><results numplayers="1"><result value="Best" numvotes="1"/></results>
<results numplayers="3"><result value="Best" numvotes="40"/></results></poll>
<statistics><ratings><average value="8.1194"/><averageweight value="2.4746"/></ratings></statistics>
</item></items>`;

test('reads BoardGameGeek metadata into existing card fields', () => {
  assert.deepEqual(parseGameFromXml(fixture, 266192), {
    bggId:266192,name:'Wingspan',categories:['Animals','Card Game'],bestP:'3',
    desc:'Birds & nature. A strategy game.',year:2019,minP:1,maxP:5,minT:40,maxT:70,
    weight:2.47,bggRating:8.12,imgUrl:'https://cf.geekdo-images.com/example.jpg',
  });
});

test('rejects missing game IDs and non-game content', () => {
  assert.throws(() => parseGameFromXml(fixture, 123), /لم يتم العثور/);
  assert.throws(() => parseGameFromXml('<items><item id="12" type="boardgameaccessory"><name type="primary" value="Dice"/></item></items>',12), /الرابط/);
});
