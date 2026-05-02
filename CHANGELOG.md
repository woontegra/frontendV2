# Changelog

Bu dosya `frontendV2` için sürüm notlarını ve bu sohbet sırasında yapılan değişiklikleri takip eder.

## [2.0.0] - 2026-05-01

### Neden 2.0?
- Eski sürümdeki oturum sürekliliği sorunlarını azaltmak (erken logout / refresh başarısızlığı sonrası kopma).
- Fazla mesai hesaplamalarında yeni ihtiyaçları devreye almak (özellikle UBGT düşümü).
- v2 arayüzünü eski sürümden daha net ayrıştırmak.

### Hesaplama ve sayfa davranışı değişiklikleri (detay)

#### Fazla Mesai modülleri
- **UBGT düşümü eklendi.** Eski akışta olmayan UBGT etkisi, yeni sürümde fazla mesai hesap akışına dahil edildi.
- UBGT gün seçimi ile exclusions veri modeli entegre edildi (UBGT tipi exclusions kayıtlarıyla birlikte çalışır hale getirildi).
- UBGT satırlarının güncelleme/yeniden yazım davranışı iyileştirildi; eski/ghost UBGT kayıtlarının taşınması engellendi.

#### Exclusion panelleri
- Yıllık izin / rapor / diğer / UBGT / puantaj-bordro satırlarının tek panel üzerinden yönetimi geliştirildi.
- Kayıt yükleme/saklama akışlarında exclusion set kullanımı standartlaştırıldı.

#### Vardiya 24/48 altyapısı
- Vardiya 24/48 hesaplama akışları için yeni yardımcı dosyalar, durum yönetimi ve kural katmanları eklendi.
- Hafta gruplama, workday üretimi ve exclusion uygulama tarafı ayrıştırılarak hesap adımları daha okunur hale getirildi.

### Oturum ve token yönetimi (detay)
- `App.tsx` içine global `auth-expired` dinleyicisi eklendi.
  - Refresh başarısızsa kullanıcıya bildirim gösterilir ve login'e güvenli yönlendirme yapılır.
- Aktif oturumda periyodik heartbeat eklendi (`POST /api/heartbeat`).
- Arka planda periyodik token kontrol/yenileme eklendi (expire olmadan refresh).
- `refreshAccessToken()` tek-uçuş (single-flight) hale getirildi.
  - Eşzamanlı API çağrılarında birden fazla refresh isteğinin yarışması engellendi.

### Düzen / UX iyileştirmeleri (detay)

#### Header / Sidebar
- Eski sürümle uyumlu logo ve sidebar toggle davranışı `frontendV2`ye taşındı.
- Header-sidebar katman (z-index) çakışması düzeltildi.
- Sidebar altına sürüm alanı eklendi ve masaüstü hizası düzeltildi.
  - Metin: `Bilirkişi Hesaplama Araçları` / `Sürüm 2.0`.

#### Login sayfası
- Sayfa eski tasarım diline yakın bırakıldı; yalnızca küçük v2 ayrıştırıcı dokunuşlar uygulandı.
- Sağ üst `v2` rozeti eklendi.
- Alt bilgi sürüm metni `2.0` olarak güncellendi.
- `Şifremi unuttum` linki eklendi.
- Görsel merkezleme (logo/başlık) rozet sonrası tekrar dengelendi.

#### Yıllık izin / Basın İşçileri (günlük gazete)
- Mesleğe başlangıç tarihi değiştirildiğinde yeniden hesaplamanın atlanabildiği durum düzeltildi.
  - Backend hesap effect bağımlılıkları yalnızca toplu hak (`totalEntitlement`) değişimine bağlı kalmayacak şekilde genişletildi.
- `Meslekteki kıdem süresi` alanının boş görünmesi önlendi.
  - Geçersiz/ters tarih kombinasyonunda boş string yerine `-` gösterimi standardize edildi.
- Geçersiz tarih senaryolarında kullanıcıya görünür uyarı eklendi.
  - `Mesleğe başlangıç tarihi` geçersizse veya `işten çıkış` tarihinden sonraysa alan altında kırmızı uyarı metni gösterilir.
  - Aynı kontroller `onBlur` anında toast ile de kullanıcıya bildirilir.
  - Tarayıcıların `type="date"` alanında geçersiz değeri state'e boş string olarak düşürme davranışı için ek validity kontrolü eklendi (uyarının kaçması engellendi).
- Günlük ve günlük olmayan Basın İşçileri yıllık izin sayfalarında üst başlık/açıklama bloğu kaldırıldı.
  - Form alanı daha sade görünüm için doğrudan kart yapısından başlar.
- Basın İşçileri yıllık izin not alanı, eski sürümdeki hukuk notu metniyle birebir uyumlu hale getirildi.
  - "Not: Basın İş Kanunu – Yıllık İzin 21. Madde" içeriği günlük ve günlük olmayan sayfalarda aynı metinle gösterilir.
- Basın not bloğunda okunabilirliği koruyarak daha sade görünüm için puntolar küçültüldü.
  - Not başlığı `13px`, açıklama metinleri `text-xs` ve `leading-relaxed` olarak güncellendi.
- Günlük basın yıllık izin backend isteğinde `brutUcret` gönderimi normalize edildi.
  - Ham string yerine günlük olmayan sayfayla aynı biçimde sayısal değer (`toDays(brutUcret)`) gönderilir.
  - Brüt izin alacağı hesaplarında olası 10x sapma riski azaltıldı.
- Günlük basın hesaplama akışında hızlı tarih değişimlerinde oluşan response yarış durumu düzeltildi.
  - Sadece son isteğin yanıtı state'e yazılır (stale response guard).
  - Üstte görünen izin hakkı ile alttaki hesap tablosu arasındaki sapma riski azaltıldı.
- Günlük basın hesaplama pipeline'ı stateless/deterministik akışa yaklaştırıldı.
  - Hesap çıktıları her input değişiminde önce sıfırlanır, ardından yalnızca güncel input snapshot'ı ile yeniden üretilir.
  - Hesaplamada önceki output state'ini taşıma/pratikte yeniden kullanma kaldırıldı.
  - Kritik hesap adımlarında memo/cache bağımlılığı azaltıldı (doğrudan input -> compute -> output).

#### Global form doğrulama
- `App.tsx` seviyesinde tüm `type="date"` alanları için global geçersiz tarih uyarısı eklendi.
  - `blur` ve `invalid` event'leri capture modda dinlenir.
  - Geçersiz tarih girildiğinde tüm sayfalarda ortak toast gösterilir: `Geçersiz tarih / Lütfen geçerli bir tarih girin.`
  - Kullanıcı deneyimi için kısa süreli tekrar-toast throttle uygulanır.

#### Yıllık izin / Kısmi süreli
- Notlar bloğunun en üstüne kanun/madde satırı eklendi:
  - `İş Kanunu – Yıllık İzin 14. Madde`
- Form üstündeki başlık/açıklama metni kaldırıldı:
  - `Kısmi Süreli / Part Time Yıllık İzin Hesaplama`
  - `4857 — çoklu çalışma dönemi, standart izin dilimleri`

#### Yıllık izin / Belirli süreli
- Form üstündeki başlık/açıklama metni kaldırıldı:
  - `Belirli Süreli Yıllık İzin Hesaplama`
  - `4857 — belirli süreli sözleşme, çoklu dönem ve standart izin dilimleri`

#### Önizleme modalları
- Tüm rapor önizleme modallarındaki kopya ikonu için görsel geri bildirim eklendi (merkezi helper).
  - Kopyalama başarılı olduğunda ikon kısa süreli yeşil `check` işaretine döner.
  - Yaklaşık 1.2 sn sonra ikon tekrar eski `copy` haline gelir.

#### UBGT Standart / tablo birliği
- UBGT standart hesap tablosu ortak tablo stil sistemine taşındı.
  - Tablo görünümü merkezi `calcPageFormStyles` sınıflarıyla yönetilir.
  - Tarih, ücret ve UBGT gün alanları düzenlenebilir kalacak şekilde korunmuştur.
  - Amaç: tablo kullanan diğer sayfalara aynı stilin kademeli ve tutarlı taşınması.
- UBGT standart tabloda backend'den gelen satırlar da düzenlenebilir hale getirildi.
  - Sadece manuel satırlar değil, tüm satırlarda tarih aralığı inputları aktif.
  - `UBGT Günleri` alanı tüm satırlarda editable olacak şekilde açıldı.
- Satır sonu `+ / -` aksiyon ikonları arasındaki boşluk artırıldı (görsel okunabilirlik iyileştirmesi).
- `UBGT Bilirkişi` sayfasındaki hafta günü dışlama özelliği `UBGT Standart`a fonksiyonel olarak taşındı.
  - Hafta günleri checkbox alanı eklendi.
  - Hesaplama payload'ına `excludedWeekdays` dahil edildi.
  - Backend'den dönen `excludedWeekdayHolidays` listesi UI'da gösterilir.
  - Kayıt yükleme/kaydetme akışında hafta günü dışlama verileri persist edilir.
- UBGT önizleme modalı PDF indirme hedef id'leri düzeltildi.
  - `UbgtStandartPage`: `report-content` → `ubgt-print-wrapper`
  - `UbgtBilirkisiPage`: `report-content` → `ubgt-bilirkisi-print-wrapper`
  - Böylece PDF tıklamasında beyaz sayfaya düşme sorunu giderildi.

#### UBGT Bilirkişi / notlar
- `UBGT Bilirkişi` sayfasındaki not alanı, verilen tam metinle güncellendi:
  - Başlık: `Ulusal Bayram ve Genel Tatil Günleri Hakkında Kanun`
  - İçerik: `Madde 1`, `Madde 2`, A/B/C/D bentleri ve ilgili açıklamalar (birebir metin).

#### Hafta Tatili Standart / tablo birliği
- `Standart Hafta Tatili Alacağı` tablosunda görsel çerçeve ve hücre çizgileri güçlendirildi.
  - Başlık, gövde ve toplam satırlarında hücre bazlı border uygulanarak tablo bütünlüğü netleştirildi.
- Tarih (ücret dönemi) kolonu satır bazında düzenlenebilir hale getirildi.
  - Her satıra başlangıç/bitiş `date` inputları eklendi; period metni otomatik güncellenir.
  - Tarih değişince ilgili satırın hafta sayısı/tatil günü/toplamı güncel input ile yeniden hesaplanır.
- Bu sayfa da diğer hesap tablolarındaki düzenlenebilir tablo standardına yaklaştırıldı.
- Satır aksiyonları `UBGT Standart` ile birebir hizalandı.
  - Tablo altındaki `+ Satır Ekle` kaldırıldı.
  - Satır sonu aksiyonları hover'da görünen `+ / −` ikonlarına çevrildi.
  - `+` artık satır kopyalamaz; ilgili satırın altına boş satır ekler.

#### Hafta Tatili Gemi ve Basın / satır aksiyon standardı
- `HaftaTatiliGemiPage` ve `HaftaTatiliBasinPage` tabloları da aynı satır aksiyon davranışına taşındı.
  - Çöp kutusu butonu kaldırıldı, hover'da `+ / −` ikonları kullanıldı.
  - Tablo altındaki `+ Satır Ekle` linki kaldırıldı.
  - `+` aksiyonu satırın altına boş satır ekler; `−` en az 1 satır kuralıyla çalışır.

#### Hafta Tatili / dışlanabilir günler aksiyonları
- `HaftaTatiliExcludeDays` paneline eksik olan aksiyonlar eklendi:
  - `Kaydet`
  - `İçe aktar`
  - `Tümünü sil`
- UBGT ile uyumlu kayıt modalı ve içe aktar modalı eklendi.
  - Kayıtlı exclusion set listesi görüntüleme, yükleme ve set silme akışı aktif.
- Panel düzeni `UBGT` ile birebir hizalandı:
  - `calcSectionBoxCls` kartı içinde başlık, açıklama ve üst şerit butonları.
  - Üst satırda iki tarih + gün + `+ Ekle`; liste satırlarında düzenlenebilir alanlar ve `Sil` (UBGT ile aynı ızgara).

### Bu sohbette yapılan değişiklikleri takip kuralı
- Bu dosya bundan sonra **her sayfa/modül düzenlemesinden sonra** güncellenecek.
- Yeni maddeler önce ilgili sürüm başlığı altına, gerekirse `### [Güncelleme - saat]` şeklinde eklenecek.
- Özellikle hesap sonucunu etkileyen değişiklikler (kural, düşüm, yuvarlama, exclusion davranışı) ayrı madde olarak yazılacak.

### Not
- Bu doküman fonksiyonel değişikliği özetler; tam teknik diff için git geçmişi referans alınmalıdır.
