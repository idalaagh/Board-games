'use strict';

const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function elements(value) { return value ? (Array.isArray(value) ? value : [value]) : []; }
function attribute(node, name) { return node && node['@_' + name]; }
function numeric(value) {
  const n = Number(value);
  return value !== undefined && value !== null && value !== '' && Number.isFinite(n) ? n : null;
}
function text(value) { return typeof value === 'string' ? value : ''; }

function cleanDescription(value) {
  return text(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#(?:10|13);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);
}

function bestPlayers(item) {
  const poll = elements(item.poll).find(p => attribute(p, 'name') === 'suggested_numplayers');
  if (!poll) return '';
  let best = '', count = 0;
  for (const group of elements(poll.results)) {
    const players = String(attribute(group, 'numplayers') || '');
    if (!/^\d+$/.test(players)) continue;
    const votes = elements(group.result).find(r => attribute(r, 'value') === 'Best');
    const n = numeric(attribute(votes, 'numvotes')) || 0;
    if (n > count) { count = n; best = players; }
  }
  return best;
}

function parseGameFromXml(xml, expectedId) {
  const document = parser.parse(xml);
  const item = elements(document && document.items && document.items.item)
    .find(entry => Number(attribute(entry, 'id')) === Number(expectedId));
  if (!item) throw new Error('لم يتم العثور على اللعبة في BGG.');
  const type = attribute(item, 'type');
  if (type !== 'boardgame' && type !== 'boardgameexpansion')
    throw new Error('الرابط لا يشير إلى لعبة بورد قيمز أو توسعتها.');

  const nameNode = elements(item.name).find(n => attribute(n, 'type') === 'primary') || elements(item.name)[0];
  const name = text(attribute(nameNode, 'value')).trim();
  if (!name) throw new Error('BGG لم يرجع اسم اللعبة.');
  const ratings = item.statistics && item.statistics.ratings;
  const categories = [...new Set(elements(item.link)
    .filter(link => attribute(link, 'type') === 'boardgamecategory')
    .map(link => text(attribute(link, 'value')).trim())
    .filter(Boolean))].slice(0, 15);
  const image = text(item.image || item.thumbnail).trim();
  const result = {
    bggId: Number(expectedId),
    name: name.slice(0, 160),
    categories,
    bestP: bestPlayers(item),
    desc: cleanDescription(item.description),
  };
  const values = {
    year: attribute(item.yearpublished, 'value'),
    minP: attribute(item.minplayers, 'value'),
    maxP: attribute(item.maxplayers, 'value'),
    minT: attribute(item.minplaytime, 'value'),
    maxT: attribute(item.maxplaytime, 'value'),
    weight: attribute(ratings && ratings.averageweight, 'value'),
    bggRating: attribute(ratings && ratings.average, 'value'),
  };
  for (const [key, value] of Object.entries(values)) {
    const num = numeric(value);
    if (num !== null && num > 0) result[key] = key === 'weight' || key === 'bggRating' ? Math.round(num * 100) / 100 : num;
  }
  if (/^https:\/\/[^\s]+$/i.test(image)) result.imgUrl = image;
  return result;
}

module.exports = { parseGameFromXml };
