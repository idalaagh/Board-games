'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { parseGameFromXml } = require('./bgg-parser');

const bggToken = defineSecret('BGG_API_TOKEN');
const databaseURL = 'https://aaa-space-default-rtdb.europe-west1.firebasedatabase.app';
const editorPath = '/collections/home/editorAccess.json';
const cache = new Map();
const cacheMs = 6 * 60 * 60 * 1000;

async function checkEditor(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'يرجى تسجيل الدخول أولًا.');
  // Check the SAME Firebase database permission used by the site's Add button.
  // An Admin SDK read would bypass those security rules.
  const header = request.rawRequest.headers.authorization || '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new HttpsError('unauthenticated', 'يرجى تسجيل الدخول مرة أخرى.');
  const url = databaseURL + editorPath + '?auth=' + encodeURIComponent(match[1]);
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(8000) }); }
  catch (_) { throw new HttpsError('unavailable', 'تعذّر التحقق من صلاحية التعديل.'); }
  if (!response.ok) throw new HttpsError('permission-denied', 'الاستيراد متاح للمحررين فقط.');
}

async function getBggXml(id, token) {
  const url = 'https://boardgamegeek.com/xmlapi2/thing?id=' + id + '&stats=1';
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/xml' },
        signal: AbortSignal.timeout(12000),
      });
    } catch (_) { throw new HttpsError('unavailable', 'تعذّر الاتصال بـ BGG.'); }
    if (response.status === 202 && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 1800));
      continue;
    }
    if (response.status === 401 || response.status === 403)
      throw new HttpsError('failed-precondition', 'رمز الوصول إلى BGG غير صالح أو غير معتمد.');
    if (response.status === 202 || response.status === 429 || response.status === 503)
      throw new HttpsError('resource-exhausted', 'BGG مشغول حاليًا؛ حاولي مرة أخرى بعد قليل.');
    if (!response.ok) throw new HttpsError('unavailable', 'تعذّر جلب بيانات اللعبة من BGG.');
    return response.text();
  }
  throw new HttpsError('unavailable', 'تعذّر جلب بيانات اللعبة من BGG.');
}

exports.bggGame = onCall({
  region: 'europe-west1',
  secrets: [bggToken],
  maxInstances: 3,
  timeoutSeconds: 60,
}, async request => {
  await checkEditor(request);
  const id = request.data && request.data.id;
  if (!Number.isSafeInteger(id) || id <= 0 || id > 1000000000)
    throw new HttpsError('invalid-argument', 'رابط BGG غير صالح.');

  const stored = cache.get(id);
  if (stored && stored.expires > Date.now()) return stored.data;
  const token = bggToken.value();
  if (!token) throw new HttpsError('failed-precondition', 'يجب إعداد رمز BGG أولًا.');
  try {
    const data = parseGameFromXml(await getBggXml(id, token), id);
    cache.set(id, { data, expires: Date.now() + cacheMs });
    if (cache.size > 150) cache.delete(cache.keys().next().value);
    return data;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('not-found', error.message || 'لم نجد اللعبة في BGG.');
  }
});
