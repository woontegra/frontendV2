/**
 * Ev işçileri fazla mesai — v1 ile aynı içerik; hesaplama aracı yok (yalnız bilgilendirme).
 */
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { usePageStyle } from "@/hooks/usePageStyle";
import { getVideoLink } from "@/config/videoLinks";

export default function EvIsciPage() {
  const pageStyle = usePageStyle();
  const videoLink = getVideoLink("fazla-ev");

  return (
    <div className={`min-h-screen ${pageStyle.bg} ${pageStyle.text} transition-colors`} data-page="fazla-mesai-ev">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {videoLink && (
          <div className="flex justify-end mb-4">
            <a
              href={videoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Kullanım Videosu İzle
            </a>
          </div>
        )}

        <div className="space-y-6">
          <section className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/25 p-4 sm:p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" aria-hidden />
              <div>
                <h1 className="text-base font-semibold text-orange-900 dark:text-orange-100">Önemli bilgilendirme</h1>
                <div className="mt-3 space-y-3 text-sm text-orange-900/90 dark:text-orange-100/90 leading-relaxed">
                  <p>
                    Ev işçileri bakımından yapılan hesaplamalarda işçinin çalışma hayatı ve ev hayatının birlikte olup
                    olmamasına göre değerlendirme yapılması gerektiğine dair Yargıtay yerleşik içtihatlarının uygulanması
                    halinde aşağıda verilen örneklemeler dahilinde ev ve çalışma hayatının iç içe geçtiği çalışmalarda
                    fazla çalışma hesaplaması yapılıp yapılmaması gerektiğine ilişkin değerlendirme siz hukukçuların —
                    profesyonellerin takdirine sunulur.
                  </p>
                  <p>
                    Ev ve çalışma hayatı ayrı olan fazla çalışmaların deliller ile ispatlandığı durumlarda{" "}
                    <Link to="/fazla-mesai/standart" className="font-medium text-orange-800 dark:text-orange-200 underline underline-offset-2">
                      standart hesaplama
                    </Link>{" "}
                    veya{" "}
                    <Link
                      to="/fazla-mesai/tanikli-standart"
                      className="font-medium text-orange-800 dark:text-orange-200 underline underline-offset-2"
                    >
                      tanıklı standart
                    </Link>{" "}
                    araçlarını kullanabilirsiniz.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Yargıtay içtihatları</h2>
            </div>
            <div className="p-4 sm:p-5 space-y-6">
              <article className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40 p-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2.5 py-1 rounded-md">
                    9. Hukuk Dairesi
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">Esas:</span> 2016/28557 E.{" "}
                    <span className="font-semibold ml-2">Karar:</span> 2016/16963 K.
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">Gerekçe</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  Davacının davalı ...'ın yönetim kurulu başkanı olduğu ... Şirketi'nde sigortalı olarak gösterilip
                  Mevlüt'ün yazlık evinde çalıştığı, o evin müştemilatında ikamet ettiği, çalışma şekil ve şartları
                  dikkate alındığında davacının ev ve çalışma hayatının iç içe geçtiği, bu tür çalışmada fazla mesai
                  olamayacağının Dairemizin yerleşik bir içtihatı olduğu, kaldı ki davacının dahi çalışma saatleri
                  konusunda bir açıklamasının bulunmadığı, anlaşıldığından fazla mesai alacağı talebinin reddi gerekirken
                  kabulü hatalıdır.
                </p>
              </article>

              <article className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40 p-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2.5 py-1 rounded-md">
                    22. Hukuk Dairesi
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">Esas:</span> 2015/21212 E.{" "}
                    <span className="font-semibold ml-2">Karar:</span> 2017/31087 K.
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">Gerekçe</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                  Davacı işçinin fazla çalışma ücreti ile genel tatil ücreti ve hafta tatili ücretine hak kazanıp
                  kazanmadığı hususu taraflar arasında uyuşmazlık konusudur.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  Somut olayda, mahkemece, davacının, haftalık ellialtıbuçuk saat fazla çalışma yaptığı, hafta tatili izni
                  kullanmadığı ve genel tatil günlerinde çalıştığı kabul edilmiştir. Davacı, davalı ...'a ait evde
                  01.11.1997-17.04.2014 tarihleri arasında temizlik, ev ve bahçe bakımı ile bekçilik işlerinde
                  çalışmıştır. Davacının çalışma şekli kendine özgü çalışma şartları olan, serbest zaman kullanma imkanı
                  bulunan ve çalıştığı evin müştemilatında ikamet edilmesi sebebiyle özel hayat ve iş hayatının iç içe
                  geçtiği bir çalışma biçimidir. Dosya kapsamında dinlenen davacı tanıklarının tamamının davacı ile
                  birlikte çalışan kişiler olmadıkları ve davacının tam gün ve sürekli olarak çalışma yerinde kaldığından
                  özel hayat ve iş hayatının iç içe geçtiği dikkate alındığında davacının fazla çalışma yaptığı, hafta
                  tatili ve genel tatil günlerinde çalıştığı yeterli ve inandırıcı delillerle ispat edilemediğinden bu
                  taleplerin reddi yerine kabulüne karar verilmesi usul ve kanuna aykırı olup bozmayı gerekmiştir.
                </p>
              </article>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
