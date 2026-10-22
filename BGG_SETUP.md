# تفعيل استيراد الألعاب من BoardGameGeek

واجهة إضافة اللعبة الآن تقبل رابط BGG، وتعبّئ الاسم والصورة وعدد اللاعبين والمدة والسنة والتعقيد والتقييم والتصنيفات والوصف تلقائيًا. لا تحفظ اللعبة حتى تضغط صاحبة الحساب على «إضافة اللعبة».

يلزم تفعيل وظيفة Firebase الخلفية حتى تعمل الميزة على GitHub Pages. بدءًا من 2025، لا يقبل BGG XML API الطلبات غير الموثّقة؛ لا تضع رمز BGG في `index.html` أو `firebase-config.js` أو أي ملف منشور.

1. سجّلي تطبيقًا لدى [BGG](https://boardgamegeek.com/using_the_xml_api) وانتظري اعتماده، ثم أنشئي Bearer Token.
2. تأكدي من إمكانية نشر Cloud Functions في مشروع Firebase الحالي `aaa-space` (قد يتطلب خطة Blaze وتفعيل الفوترة).
3. على جهاز لديه Firebase CLI وصلاحيات المشروع، من جذر المستودع:

   ```sh
   cd functions && npm install && npm test && cd ..
   firebase functions:secrets:set BGG_API_TOKEN --project aaa-space
   firebase deploy --only functions:bggGame --project aaa-space
   ```

   أدخلي رمز BGG عند مطالبة الأداة به، وليس داخل أوامر محفوظة في Git.

4. بعد نشر وظيفة `bggGame` في `europe-west1`، انشري تغييرات `index.html` على GitHub Pages.
5. سجّلي الدخول من الموقع بحساب يملك صلاحية التعديل، الصقي رابطًا مثل `https://boardgamegeek.com/boardgame/266192/wingspan` ثم انتظري تعبئة الحقول وراجعيها قبل الحفظ.

تقرأ الوظيفة صلاحية `collections/home/editorAccess` **بهوية المستخدم نفسه** عبر قواعد Realtime Database الموجودة؛ لذلك لا تتجاوز صلاحيات «آلاء وأحمد». يُحفظ مفتاح BGG في Firebase Secret Manager، ولا يظهر في كود GitHub Pages العام.
