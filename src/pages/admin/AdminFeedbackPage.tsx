import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { apiClient } from "@/utils/apiClient";

interface FeedbackItem {
  id: number;
  userId: number | null;
  demoSessionId: string | null;
  rating: number;
  comment: string | null;
  pageOrContext: string | null;
  createdAt: string;
}

interface Summary {
  averageRating: number;
  totalCount: number;
  count5Star: number;
  count1Or2Star: number;
}

interface ListResponse {
  items: FeedbackItem[];
  total: number;
  summary: Summary;
}

export default function AdminFeedbackPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<string>("");
  const [userTypeFilter, setUserTypeFilter] = useState<string>("");

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (ratingFilter && ratingFilter !== "all") p.set("rating", ratingFilter);
    if (userTypeFilter && userTypeFilter !== "all") p.set("userType", userTypeFilter);
    p.set("limit", "50");
    return p.toString();
  }, [ratingFilter, userTypeFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient(`/api/admin/feedback?${queryParams}`)
      .then((res) => res.json())
      .then((body: ListResponse) => {
        if (!cancelled) setData(body);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [queryParams]);

  const summary = data?.summary;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const formatDate = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleString("tr-TR", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return s;
    }
  };

  const userType = (item: FeedbackItem) =>
    item.demoSessionId != null ? "Demo" : "Paid";

  const userTypeLabel = (type: "Demo" | "Paid") =>
    type === "Demo" ? "Demo Kullanıcı" : "Ücretli Kullanıcı";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Kullanıcı Geri Bildirimleri
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Ürün memnuniyet geri bildirimleri (tek seferlik, kullanıcı/session başına).
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            Yükleniyor…
          </CardContent>
        </Card>
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Ortalama Puan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold">{summary.averageRating.toFixed(1)}</span>
                    <span className="text-gray-500">/ 5</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    5 Yıldız
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{summary.count5Star}</span>
                  <span className="text-gray-500 text-sm ml-1">adet</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    1–2 Yıldız
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{summary.count1Or2Star}</span>
                  <span className="text-gray-500 text-sm ml-1">adet</span>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="filter-rating" className="text-sm">Puan</Label>
                  <select
                    id="filter-rating"
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value)}
                    className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
                  >
                    <option value="all">Tümü</option>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={String(r)}>{r} yıldız</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="filter-type" className="text-sm">Kullanıcı tipi</Label>
                  <select
                    id="filter-type"
                    value={userTypeFilter}
                    onChange={(e) => setUserTypeFilter(e.target.value)}
                    className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
                  >
                    <option value="all">Tümü</option>
                    <option value="demo">Demo Kullanıcı</option>
                    <option value="paid">Ücretli Kullanıcı</option>
                  </select>
                </div>
                <span className="text-sm text-gray-500">
                  Toplam: {total} kayıt
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium">Puan</th>
                      <th className="text-left py-2 font-medium">Tip</th>
                      <th className="text-left py-2 font-medium">Yorum</th>
                      <th className="text-left py-2 font-medium">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-gray-500">
                          Henüz geri bildirim yok.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-gray-100 dark:border-gray-800"
                        >
                          <td className="py-3">
                            <div className="flex items-center gap-0.5" aria-label={`${item.rating} yıldız`}>
                              {[1, 2, 3, 4, 5].map((r) => (
                                <Star
                                  key={r}
                                  className={`w-4 h-4 ${
                                    r <= item.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-gray-200 dark:text-gray-600"
                                  }`}
                                />
                              ))}
                            </div>
                          </td>
                          <td className="py-3">
                            <span
                              className={
                                userType(item) === "Demo"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-blue-600 dark:text-blue-400"
                              }
                            >
                              {userTypeLabel(userType(item))}
                            </span>
                          </td>
                          <td className="py-3 max-w-xs">
                            {item.comment ? (
                              <span className="text-gray-700 dark:text-gray-300 line-clamp-2">
                                {item.comment}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 text-gray-500 whitespace-nowrap">
                            {formatDate(item.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
