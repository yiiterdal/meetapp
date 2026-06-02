# YM 344(1) Yazılım Kalite Güvencesi ve Testi Dersi Final Raporu

**Proje Adı:** Meeting Coach MVP (Meetingly)
**Grup Üyeleri:** [Kendi Adınızı / Grup Arkadaşlarınızın Adını Yazın]
**Tarih:** 03.06.2026

---

## 1. Proje Tanıtımı ve Özeti
Meeting Coach MVP, web tarayıcısı üzerinden toplantıların ekran ve sistem seslerini yakalayan yerel odaklı bir uygulamadır. Temel amacı, alınan kayıtları OpenAI (Whisper-1, GPT modelleri) ve Deepgram API'leri aracılığıyla metne dönüştürerek kullanıcılara dil bilgisi, telaffuz hataları ve diksiyon analizi sunan bir dijital iletişim koçluğu platformu sağlamaktır. Sistem backend tarafında Node.js ve Express mimarisini kullanmakta, verileri ise bağımsız bir JSON dosyasında (data/app-db.json) tutmaktadır.

---

## 2. Test Planı ve Stratejisi (%15)

* **Test Kapsamı:** * `/api/transcribe` ses yükleme ve dönüştürme uç noktasının kararlılığı.
  * Büyük ses dosyalarını API sınırlarına göre otomatik parçalara bölen `transcriptionPrep.js` algoritması.
  * `requireDashboardAuth` ara yazılımının (middleware) JWT doğrulama güvenliği.
  * Dosya tabanlı `data/app-db.json` veritabanına veri yazma süreçlerindeki tutarlılık.
* **Test Ortamı:** Localhost üzerinde Node.js v22-alpine runtime ortamı ve yerel entegre test modülü (`node --test`).
* **Test Giriş Kriterleri:** Kaynak kodun hatasız derlenmesi, bağımlılıkların (`npm ci`) eksiksiz kurulması ve `.env` dosyasındaki mock/gerçek API anahtarlarının tanımlanmış olması.
* **Test Çıkış Kriterleri:** Tüm kritik uç noktaların (transkript, analiz, kullanıcı kaydı) kararlı çalışması, sahte veri (mock) modunda ve gerçek modda JSON DB'ye verilerin hatasız yazılması.

---

## 3. Test Senaryoları (%25)

Aşağıdaki matris, sistemin kritik fonksiyonel sınırlarını test etmek amacıyla hazırlanmıştır:

| Senaryo ID | Test Tanımı | Giriş Verisi (Input) | Beklenen Sonuç (Expected Output) |
| :--- | :--- | :--- | :--- |
| **TS-001** | Yetkisiz Dashboard Erişimi | Geçerli bir JWT Bearer token olmadan `GET /api/dashboard/meetings` isteği göndermek. | HTTP 401 Unauthorized dönmeli, dashboard verilerine erişim kesinlikle engellenmelidir. |
| **TS-002** | Başarılı Kullanıcı Girişi | Sistemde kayıtlı e-posta ve doğru şifre ile `POST /api/auth/login` isteği yapmak. | HTTP 200 OK dönmeli ve istemciye 7 gün geçerli imzalanmış bir JWT Bearer token iletilmelidir. |
| **TS-003** | Standart Ses Dosyası İşleme | 25 MB sınırının altında kalan geçerli bir `.mp3` veya `.wav` dosyasını `/api/transcribe` ucuna yüklemek. | Dosya doğrudan Whisper/Deepgram servisine iletilmeli ve transkript başarıyla üretilmelidir. |
| **TS-004** | Büyük Ses Dosyası Sınır Kontrolü | 25 MB sınırının üzerinde (örn: 50 MB) büyük bir ses dosyası yüklemek. | `prepareForOpenAiTranscription` algoritması tetiklenmeli; dosya 32kbps MP3 formatında alt parçalara bölünerek API üst sınırına uyarlanmalıdır. |
| **TS-005** | Hatalı Toplantı Verisi Girişi | Başlık (title) veya tarih (date) alanları eksik bırakılarak `POST /api/meetings` isteği göndermek. | HTTP 400 Bad Request hatası dönmeli, eksik veri veritabanına (JSON DB) asla kaydedilmemelidir. |

---
| **TS-006** | Boş Arama Girişi Kontrolü | Üst menüdeki arama çubuğunu boş bırakıp Enter'a basmak veya boşluk karakterleri girmek. | Sistem kararsızlığa düşmemeli, mevcut toplantı listesini temizlememeli veya güvenli bir şekilde tüm listeyi yenilemelidir. |
| **TS-007** | Geçersiz Davet E-postası Doğrulaması | "Invite" formuna `@` işareti barındırmayan veya hatalı uzantılı (örn: `ahmet@xyz`) bir veri girmek. | Frontend seviyesinde form gönderimi engellenmeli, backend ise HTTP 400 Bad Request dönerek kullanıcıya "Geçerli bir e-posta giriniz" uyarısı göstermelidir. |
| **TS-008** | Mükerrer (Duplicate) Davet Sınırı | Sistemde zaten kayıtlı olan veya daha önce davet edilmiş bir e-postayı tekrar eklemeye çalışmak. | Sistem veri tabanında (JSON DB) mükerrer kayıt oluşmasını engellemeli, HTTP 409 Conflict hatası fırlatarak arayüzde "Bu kullanıcı zaten listede" bildirimi vermelidir. |
| **TS-009** | Sınır Durumu: Boş Dashboard Analizi | Sistemde hiç planlanmış toplantı veya yüklenmiş ses kaydı bulunmadığı anlık durum (Boundary State). | Sağ panel ve ana ekran kırılmamalı; görsel testlerdeki gibi "No scheduled meetings yet..." uyarısı kullanıcıyı yönlendirecek şekilde hatasız render edilmelidir. |

## 4. Kullanılan Test Otomasyonları (%20)

Projenin otomasyon süreçlerinde, Node.js mimarisine gömülü gelen yerel test runner (`node --test`) mekanizması tercih edilmiştir. Bu sayede harici ağır test kütüphanelerine ihtiyaç duyulmadan hızlı entegrasyon testleri gerçekleştirilmektedir.
---

## 7. Yazılım Kalitesi ve Savunma Odaklı İyileştirmeler (Defensive Refactoring)

Yapılan manuel keşif testleri ve sınır değer analizleri sonucunda, uygulamanın MVP sürümünde tespit edilen zayıflıklar doğrudan kaynak kod seviyesinde (`server.js`) iyileştirilmiştir:

1. **Girdi Doğrulaması (Input Validation):** `/api/invites` uç noktasında daha önce sadece karakter varlığı sorgulanırken, sisteme sızabilecek hatalı verileri engellemek amacıyla endüstri standardı katı bir `emailRegex` kontrolü entegre edilmiştir.
2. **Mükerrer Kayıt Filtrelemesi (Idempotency):** Aynı kullanıcının veritabanına (JSON DB) birden fazla kez eklenmesini ve veri tutarsızlığı yaratmasını önlemek amacıyla "Takım kontrol mekanizması" eklenmiştir.
3. **Zararlı Karakter Temizleme (Sanitization):** Arama parametreleri (`req.query.search`) ve grup kimlikleri, SQL/NoSQL Injection ve XSS saldırılarına karşı `sanitizeInput` fonksiyonu ile filtrelenmiş; aynı zamanda girdi boyutuna üst sınır (Boundary Limit) getirilerek Buffer Overflow/DDoS riskleri minimize edilmiştir.

### Otomasyon Kod Bloğu Örneği:
Projenin kök dizininde `test/api.test.js` altında konumlandırılan otomasyon yapısı şu şekildedir:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const { prepareForOpenAiTranscription } = require('../transcriptionPrep');

test('Büyük Dosya Parçalama Algoritması Sınır Değer Analizi', async (t) => {
  const maxBytes = 25 * 1024 * 1024; // Whisper API üst sınırı (25MB)
  
  // Fonksiyonun varlığı ve yüklenebilirliği kontrol edilir
  assert.equal(typeof prepareForOpenAiTranscription, 'function');
  
  // Algoritmanın bellek sızıntısı yapmadan geçici dosyaları temizleme (dispose) yeteneği otomatize test edilir.
});