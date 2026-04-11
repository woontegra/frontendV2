/**
 * Kıdem Tazminatı — Belirli Süreli İş Sözleşmesi (v1 KidemBelirliSureliIndependent ile aynı: yalnızca mevzuat metni)
 */

import { getVideoLink } from "@/config/videoLinks";
import { usePageStyle } from "@/hooks/usePageStyle";
import { Youtube } from "lucide-react";

const KIDEM_GRADIENT = "linear-gradient(90deg, #1E88E5, #42A5F5)";

const bodyCls =
  "text-justify mb-6 text-gray-800 dark:text-gray-200 leading-relaxed [font-family:'Times_New_Roman',Times,serif] text-[10pt]";

export default function KidemBelirliSureliPage() {
  const pageStyle = usePageStyle();
  const videoLink = getVideoLink("kidem-belirli");

  return (
    <>
      <div style={{ height: "2px", background: pageStyle?.color || "#1E88E5" }} />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-16">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
          <div className="mb-4 flex justify-end">
            {videoLink ? (
              <button
                type="button"
                onClick={() => window.open(videoLink, "_blank")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 transition-colors"
              >
                <Youtube className="w-4 h-4" />
                Kullanım Videosu İzle
              </button>
            ) : null}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="h-1 rounded-t-2xl" style={{ background: KIDEM_GRADIENT }} />
            <div className="p-6 sm:p-8 lg:p-10">
                <p className={bodyCls}>
                  4857 s. İş K. &quot;Belirli ve belirsiz süreli iş sözleşmesi&quot; başlıklı 11. Maddesinde;
                  &quot;İş ilişkisinin bir süreye bağlı olarak yapılmadığı halde sözleşme belirsiz süreli sayılır.
                  Belirli süreli işlerde veya belli bir işin tamamlanması veya belirli bir olgunun ortaya çıkması gibi
                  objektif koşullara bağlı olarak işveren ile işçi arasında yazılı şekilde yapılan iş sözleşmesi belirli
                  süreli iş sözleşmesidir.
                </p>

                <p className={bodyCls}>
                  Belirli süreli iş sözleşmesi, esaslı bir neden olmadıkça, birden fazla üst üste (zincirleme)
                  yapılamaz. Aksi halde iş sözleşmesi başlangıçtan itibaren belirsiz süreli kabul edilir.
                </p>

                <p className={bodyCls}>
                  Esaslı nedene dayalı zincirleme iş sözleşmeleri, belirli süreli olma özelliğini korurlar.&quot;
                  Şeklinde düzenlenmiştir.
                </p>

                <p className={bodyCls}>
                  4857 s. İş K. &quot;Belirli ve belirsiz süreli iş sözleşmesi ayırımın sınırları&quot; başlıklı 12.
                  Maddesinde; &quot;Belirli süreli iş sözleşmesi ile çalıştırılan işçi, ayırımı haklı kılan bir neden
                  olmadıkça, salt iş sözleşmesinin süreli olmasından dolayı belirsiz süreli iş sözleşmesiyle çalıştırılan
                  emsal işçiye göre farklı işleme tâbi tutulamaz.
                </p>

                <p className={bodyCls}>
                  Belirli süreli iş sözleşmesi ile çalışan işçiye, belirli bir zaman ölçüt alınarak ödenecek ücret ve
                  paraya ilişkin bölünebilir menfaatler, işçinin çalıştığı süreye orantılı olarak verilir. Herhangi bir
                  çalışma şartından yararlanmak için aynı işyeri veya işletmede geçirilen kıdem arandığında belirli süreli
                  iş sözleşmesine göre çalışan işçi için farklı kıdem uygulanmasını haklı gösteren bir neden olmadıkça,
                  belirsiz süreli iş sözleşmesi ile çalışan emsal işçi hakkında esas alınan kıdem uygulanır.
                </p>

                <p className={bodyCls}>
                  Emsal işçi, işyerinde aynı veya benzeri işte belirsiz süreli iş sözleşmesiyle çalıştırılan işçidir.
                  İşyerinde böyle bir işçi bulunmadığı takdirde, o işkolunda şartlara uygun bir işyerinde aynı veya benzer
                  işi üstlenen belirsiz süreli iş sözleşmesiyle çalıştırılan işçi dikkate alınır.&quot; Şeklinde
                  düzenlenmiştir.
                </p>

                <p className={bodyCls}>
                  1475 s. İş Kanunun (22.05.2003 tarihli 4857 s. İş Kanunun 120. Maddesi ile 14. Maddesi hariç diğer
                  maddeleri yürürlükten kaldırılmıştır.) &quot;Kıdem tazminatı&quot; başlıklı 14. Maddesi; &quot;(Değişik
                  birinci fıkra: 29/7/1983 - 2869/3 md.) Bu Kanuna tabi işçilerin hizmet akitlerinin:
                </p>

                <p className={`${bodyCls} mb-4 pl-4`}>
                  1. İşveren tarafından bu Kanunun 17 nci maddesinin II numaralı bendinde gösterilen sebepler dışında,
                </p>

                <p className={`${bodyCls} mb-4 pl-4`}>
                  2. İşçi tarafından bu Kanunun 16 ncı maddesi uyarınca,
                </p>

                <p className={`${bodyCls} mb-4 pl-4`}>3. Muvazzaf askerlik hizmeti dolayısıyle,</p>

                <p className={`${bodyCls} mb-4 pl-4`}>
                  4. Bağlı bulundukları kanunla veya Cumhurbaşkanlığı kararnamesiyle kurulu kurum veya sandıklardan
                  yaşlılık, emeklilik veya malullük aylığı yahut toptan ödeme almak amacıyla;
                </p>

                <p className={`${bodyCls} mb-4 pl-4`}>
                  5. (Ek: 25/8/1999 - 4447/45 md.) 506 Sayılı Kanunun 60 ıncı maddesinin birinci fıkrasının (A) bendinin
                  (a) ve (b) alt bentlerinde öngörülen yaşlar dışında kalan diğer şartları veya aynı Kanunun Geçici 81
                  inci maddesine göre yaşlılık aylığı bağlanması için öngörülen sigortalılık süresini ve prim ödeme gün
                  sayısını tamamlayarak kendi istekleri ile işten ayrılmaları nedeniyle,
                </p>

                <p className={bodyCls}>
                  Feshedilmesi veya kadının evlendiği tarihten itibaren bir yıl içerisinde kendi arzusu ile sona erdirmesi
                  veya işçinin ölümü sebebiyle son bulması hallerinde işçinin işe başladığı tarihten itibaren hizmet
                  aktinin devamı süresince her geçen tam yıl için işverence işçiye 30 günlük ücreti tutarında kıdem
                  tazminatı ödenir. Bir yıldan artan süreler için de aynı oran üzerinden ödeme yapılır.
                </p>

                <p className={bodyCls}>(Değişik fıkralar: 17/10/1980 - 2320/1 md.):</p>

                <p className={bodyCls}>
                  İşçilerin kıdemleri, hizmet akdinin devam etmiş veya fasılalarla yeniden akdedilmiş olmasına
                  bakılmaksızın aynı işverenin bir veya değişik işyerlerinde çalıştıkları süreler gözönüne alınarak
                  hesaplanır. İşyerlerinin devir veya intikali yahut herhangi bir suretle bir işverenden başka bir
                  işverene geçmesi veya başka bir yere nakli halinde işçinin kıdemi, işyeri veya işyerlerindeki hizmet
                  akitleri sürelerinin toplamı üzerinden hesaplanır. 12/7/1975 tarihinden, itibaren işyerinin devri veya
                  herhangi bir suretle el değiştirmesi halinde işlemiş kıdem tazminatlarından her iki işveren sorumludur.
                  Ancak, işyerini devreden işverenlerin bu sorumlulukları işçiyi çalıştırdıkları sürelerle ve devir
                  esnasındaki işçinin aldığı ücret seviyesiyle sınırlıdır. 12/7/1975 tarihinden evvel işyeri devrolmuş
                  veya herhangi bir suretle el değiştirmişse devir mukavelesinde aksine bir hüküm yoksa işlemiş kıdem
                  tazminatlarından yeni işveren sorumludur.
                </p>

                <p className={bodyCls}>
                  İşçinin birinci bendin 4 üncü fıkrası hükmünden faydalanabilmesi için aylık veya toptan ödemeye hak
                  kazanmış bulunduğunu ve kendisine aylık bağlanması veya toptan ödeme yapılması için yaşlılık sigortası
                  bakımından bağlı bulunduğu kuruma veya sandığa müracaat etmiş olduğunu belgelemesi şarttır. İşçinin
                  ölümü halinde bu şart aranmaz.
                </p>

                <p className={bodyCls}>
                  T.C. Emekli Sandığı Kanunu ve Sosyal Sigortalar Kanununa veya yalnız Sosyal Sigortalar Kanununa tabi
                  olarak sadece aynı ya da değişik kamu kuruluşlarında geçen hizmet sürelerinin birleştirilmesi suretiyle
                  Sosyal Sigortalar Kanununa göre yaşlılık veya malullük aylığına ya da toptan ödemeye hak kazanmış
                  işçiye, bu kamu kuruluşlarında geçirdiği hizmet sürelerinin toplamı üzerinden son kamu kuruluşu
                  işverenince kıdem tazminatı ödenir.
                </p>

                <p className={bodyCls}>
                  Yukarıda belirtilen kamu kuruluşlarında işçinin hizmet akdinin evvelce bu maddeye göre kıdem tazminatı
                  ödenmesini gerektirmeyecek şekilde sona ermesi suretiyle geçen hizmet süreleri kıdem tazminatının
                  hesabında dikkate alınmaz.
                </p>

                <p className={bodyCls}>
                  Ancak, bu tazminatın T.C. Emekli Sandığına tabi olarak geçen hizmet süresine ait kısmı için ödenecek
                  miktar, yaşlılık veya malullük aylığının başlangıç tarihinde T.C. Emekli Sandığı Kanununun yürürlükteki
                  hükümlerine göre emeklilik ikramiyesi için öngörülen miktardan fazla olamaz.
                </p>

                <p className={bodyCls}>
                  Bu maddede geçen kamu kuruluşları deyimi, genel, katma ve özel bütçeli idareler ile 468 sayılı Kanunun 4
                  üncü maddesinde sayılan kurumları kapsar.
                </p>

                <p className={bodyCls}>Aynı kıdem süresi için bir defadan fazla kıdem tazminatı veya ikramiye ödenmez.</p>

                <p className={bodyCls}>
                  Kıdem tazminatının hesaplanması, son ücret üzerinden yapılır. Parça başı, akort, götürü veya yüzde usulü
                  gibi ücretin sabit olmadığı hallerde son bir yıllık süre içinde ödenen ücretin o süre içinde çalışılan
                  günlere bölünmesi suretiyle bulunacak ortalama ücret bu tazminatın hesabına esas tutulur.
                </p>

                <p className={bodyCls}>
                  Ancak, son bir yıl içinde işçi ücretine zam yapıldığı takdirde, tazminata esas ücret, işçinin işten
                  ayrılma tarihi ile zammın yapıldığı tarih arasında alınan ücretin aynı süre içinde çalışılan günlere
                  bölünmesi suretiyle hesaplanır.
                </p>

                <p className={bodyCls}>
                  (Değişik: 29/7/1983 – 2869/3 md.) 13 üncü maddesinde sözü geçen tazminat ile bu maddede yer alan kıdem
                  tazminatına esas olacak ücretin hesabında 26 ncı maddenin birinci fıkrasında yazılı ücrete ilaveten
                  işçiye sağlanmış olan para ve para ile ölçülmesi mümkün akdi ve kanundan doğan menfaatler de gözönünde
                  tutulur. Kıdem tazminatının zamanında ödenmemesi sebebiyle açılacak davanın sonunda hakim gecikme süresi
                  için, ödenmeyen süreye göre mevduata uygulanan en yüksek faizin ödenmesine hükmeder. İşçinin mevzuattan
                  doğan diğer hakları saklıdır.
                </p>

                <p className={bodyCls}>
                  (Değişik: 17/10/1980 - 2320/1 md.) Bu maddede belirtilen kıdem tazminatı ile ilgili 30 günlük süre
                  hizmet akidleri veya toplu iş sözleşmeleri ile işçi lehine değiştirilebilir.
                </p>

                <p className={bodyCls}>
                  (Değişik: 10/12/1982 - 2762/1 md.) Ancak, toplu sözleşmelerle ve hizmet akitleriyle belirlenen kıdem
                  tazminatlarının yıllık miktarı, Devlet Memurları Kanununa tabi en yüksek Devlet memuruna 5434 sayılı T.C.
                  Emekli Sandığı Kanunu hükümlerine göre bir hizmet yılı için ödenecek azami emeklilik ikramiyesini geçemez.
                </p>

                <p className={bodyCls}>(Değişik fıkralar: 17/10/1980 - 2320/1 md.):</p>

                <p className={bodyCls}>
                  İşçinin ölümü halinde yukarıdaki hükümlere göre doğan tazminat tutarı, kanuni mirasçılarına ödenir.
                </p>

                <p className={bodyCls}>
                  Kıdem tazminatından doğan sorumluluğu işveren şahıslara veya sigorta şirketlerine sigorta ettiremez.
                </p>

                <p className={bodyCls}>
                  İşveren sorumluluğu altında ve sadece yaşlılık, emeklilik, malullük, ölüm ve toptan ödeme hallerine
                  mahsus olmak kaydiyle Devlet veya kanunla veya Cumhurbaşkanlığı kararnamesiyle kurulu kurumlarda veya %
                  50 hisseden fazlası Devlete ait bir bankada veya bir kurumda işveren tarafından kıdem tazminatı ile
                  ilgili bir fon tesis edilir.
                </p>

                <p className="text-justify mb-8 text-gray-800 dark:text-gray-200 leading-relaxed [font-family:'Times_New_Roman',Times,serif] text-[10pt]">
                  Fon tesisi ile ilgili hususlar kanunla düzenlenir.&quot; Şeklinde düzenlenmiştir.
                </p>

                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 [font-family:'Times_New_Roman',Times,serif] text-[10pt]">
                  Sonuç İtibariyle;
                </h3>

                <p className={bodyCls}>
                  Belirli süreli iş sözleşmeleri, sözleşmede belirtilen sürenin dolması ile kendiliğinden sona ermektedir.
                  Bu sona erme şekli, işçi ve işverenin tek taraflı tasarrufu ve/veya eylemine bağlı değildir. Taraflar
                  arasında imza edile belirli süreli iş sözleşmeleri taraflar arasında ki ortak irade ve tasarruflarıyla
                  belirlenmiş bir son bulma şeklidir.
                </p>

                <p className={bodyCls}>
                  Belirli süreli iş sözleşmesinin süresinin bitimi ile kendiliğinden sona ermesi hali, yukarıda 1475
                  sayılı Kanun&apos;un 14. maddesinde sayılan 7 ayrı kıdem tazminatı ödeme hallerine girmediğinden, belirli
                  süreli iş sözleşmesiyle çalışan işçilere sürenin bitiminde kıdem tazminatı ödenmemektedir.
                </p>

                <p className="text-justify mb-8 text-gray-800 dark:text-gray-200 leading-relaxed [font-family:'Times_New_Roman',Times,serif] text-[10pt]">
                  Bu hususlar dahilinde belirli süreli iş sözleşmesinde 1475 s. Kanunun 14. Maddesindeki şartlar oluşur ise
                  kıdem tazminatı hesaplaması yapılabilmektedir.
                </p>

                <p className="text-justify font-semibold text-red-600 dark:text-red-400 [font-family:'Times_New_Roman',Times,serif] text-[10pt]">
                  Hesaplama yapılması gereken durumlarda diğer kıdem tazminatı hesaplama araçları ile hesaplama
                  yapabilirsiniz.
                </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
