/**
 * Notlar - Akordiyon (çok metin olduğu için)
 */
function Section({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm">
        {icon}
      </div>
      <div className="text-[11px] font-light text-gray-600 dark:text-gray-400 leading-relaxed">{children}</div>
    </div>
  );
}

export function NotlarAccordion() {
  return (
    <details className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden shadow-sm bg-white dark:bg-gray-800 group">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-slate-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between list-none hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
        <span className="flex items-center gap-2">
          <span className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white text-xs">📝</span>
          Notlar
        </span>
        <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </summary>
      <div className="p-4 max-h-[420px] overflow-y-auto space-y-4">
        <Section icon="📌">
          Fazla çalışma alacağının hesaplanmasında birden fazla değişken dikkate alınmaktadır. Hesaplama süreci, öncelikle işçinin fiili çalışma döneminin belirlenmesi ile başlamakta olup; bu kapsamda davacının işe giriş ve işten ayrılış tarihleri esas alınarak çalışma aralığı tespit edilmektedir.
        </Section>
        <Section icon="💰">
          Ücret hesabına esas olmak üzere işçinin çıplak brüt ücreti dikkate alınmakta; bu ücretin tespit edilememesi hâlinde ilgili dönem için geçerli olan asgari ücret üzerinden hesaplama yapılmaktadır. Ayrıca bilinen ücretin asgari ücretin üzerinde olması ve geçmiş dönem ücret bilgilerinin bulunmaması hâlinde, sistem içerisinde yer alan katsayı hesaplama modülü aracılığıyla ücret çarpanı belirlenerek geçmiş dönem ücretlerinin oransal şekilde hesaplanabilmesine imkân tanınmaktadır.
        </Section>
        <Section icon="⏱️">
          Fazla mesai saatlerinin belirlenmesinde günlük fiili çalışma süresi esas alınmaktadır. Günlük çalışma süresi, işçinin işe giriş saati ile işten çıkış saati arasındaki sürenin tespiti ve bu süreden 4857 sayılı İş Kanunu&apos;nun 68. maddesi kapsamında öngörülen ara dinlenme sürelerinin düşülmesi suretiyle hesaplanmaktadır.
        </Section>
        <Section icon="📈">
          Uzun süreli fiili çalışmalarda (özellikle 11 saat ve üzeri çalışmalarda) ara dinlenme süresi kademeli olarak artırılmakta (örneğin 1,5 saat ve üzeri) ve net günlük çalışma süresi bu şekilde belirlenmektedir.
        </Section>
        <Section icon="🗓️">
          Net günlük çalışma süresi, haftalık çalışma günü sayısı ile çarpılarak haftalık fiili çalışma süresine ulaşılmakta; çıkan çalışma süresinden haftalık yasal çalışma süresi olan 45 saat çıkarılarak haftalık fazla çalışma süresi hesap edilmektedir.
        </Section>
        <Section icon="⚠️">
          İşçinin haftada 7 gün çalıştığına ilişkin iddia bulunması ve ayrıca hafta tatili ücreti talebinin mevcut olması hâlinde, hesaplamada hafta tatili günü ayrıca ele alınmakta; haftalık fazla çalışma hesabı yapılırken: Günlük 7,5 saatlik yasal çalışma süresi dışlanmakta, 6 günlük fiili çalışma toplamı esas alınmakta, bu toplamdan haftalık 45 saatlik yasal çalışma süresi çıkarılarak haftalık fazla mesai süresi belirlenmektedir. Hafta tatiline denk gelen 1 günlük çalışma ise ayrıca hesaplama konusu yapılmaktadır.
        </Section>
        <Section icon="🔄">
          Vardiyalı çalışma, gece çalışması ve farklı günlerde değişken süreli çalışmalar bakımından hesaplama işlemleri, sistem içerisinde ayrı hesaplama modülleri üzerinden yürütülmektedir.
        </Section>
        <Section icon="📋">
          Hesaplama sürecinde; işçinin kullandığı yıllık izin günleri, ücretli veya ücretsiz izin süreleri, sağlık raporu nedeniyle çalışılmayan günler vb. istenildiği takdirde toplam çalışma süresinden dışlanarak hesaplama yapılabilmektedir.
        </Section>
        <Section icon="⏳">
          Ayrıca zamanaşımı bakımından ilgili dönemlerin ayrıştırılması suretiyle hesaplama yapılmasına imkân tanınmaktadır.
        </Section>
        <Section icon="⚖️">
          İş sözleşmesinde fazla çalışma ücretinin aylık ücrete dâhil olduğuna ilişkin hüküm bulunan işçiler bakımından, sistem içerisinde yıllık 270 saatlik fazla çalışma süresinin dışlanmasına yönelik seçenekli hesaplama yöntemleri yer almaktadır. Bu kapsamda; işçinin iş akdinin başlangıcından itibaren toplam 270 saatin tek seferde dışlanması (işe giriş tarihinden itibaren haftalık fazla mesai hesabının dışlanarak kalan haftalar için hesap yapılması; 270 / hesaplanan haftalık fazla mesai saati = çıkan hafta sayısının dışlanması) veya 270/52 hafta = 5,2 fazla çalışma saati haftalık fazla çalışma saatinden düşülmek suretiyle uygulanmaktadır.
        </Section>
        <Section icon="📚">
          Hakkaniyet indirimi yönünden, ilgili yargı kararları doğrultusunda belirlenen 1/3 oranındaki indirim, sistem tarafından otomatik olarak uygulanabilmektedir.
        </Section>
        <Section icon="🔁">
          İşçiye ödenmiş fazla mesai ücretlerinin mevcut olması hâlinde; mahsup ve dönemsel ayrıştırmalar bakımından 12&apos;şer aylık periyotlar hâlinde ayrı ayrı hesaplama tablolarına veri girişi yapılabilmektedir.
        </Section>
        <Section icon="💳">
          Ücret hesaplamalarında brüt tutardan net tutara geçiş süreci sistem tarafından otomatik olarak gerçekleştirilmekte olup; gelir vergisi oranları, hesaplama yapılan yılın vergi dilimleri ve kademeli vergi sistemi dikkate alınarak net ücret hesaplaması yapılmaktadır.
        </Section>
      </div>
    </details>
  );
}
