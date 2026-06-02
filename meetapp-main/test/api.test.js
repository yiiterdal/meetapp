const test = require('node:test');
const assert = require('node:assert');

test('Meetingly Gelişmiş Kalite Güvence ve Güvenlik Testleri', async (t) => {

  // 1. Girdi Validasyonu Testi (Boundary & Input Validation)
  await t.test('Senaryo 1: Endüstriyel E-posta Validasyon Doğruluğu', () => {
   
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    // Geçerli Sınır Değerler
    assert.strictEqual(emailRegex.test('software@keningfordpartners.com'), true);
    assert.strictEqual(emailRegex.test('demo@keningfordpartners.com'), true);
    
    // Geçersiz Sınır Değerler (Hata Yakalama Kontrolü)
    assert.strictEqual(emailRegex.test('yigit@'), false);
    assert.strictEqual(emailRegex.test('plainText'), false);
  });

  // 2. Girdi Temizleme (Sanitization) Testi
  await t.test('Senaryo 2: SQL/NoSQL Injection ve Karakter Sınırı Kontrolü', () => {
    function sanitizeInputSim(text, maxLength = 100) {
      if (typeof text !== "string") return "";
      return text.replace(/[$/\\{}]/g, "").trim().slice(0, maxLength);
    }

    const dangerousInput = "{ $regex: '.*' }\\/injectionText";
    const sanitized = sanitizeInputSim(dangerousInput, 15);

    // Zararlı karakterlerin temizlendiğini doğrula
    assert.strictEqual(sanitized.includes('$'), false);
    assert.strictEqual(sanitized.includes('{'), false);
    
    // DÜZELTME: Ok yönü mantık hatası giderildi (Karakter sınır kontrolü)
    assert.ok(sanitized.length <= 15);
  });
});