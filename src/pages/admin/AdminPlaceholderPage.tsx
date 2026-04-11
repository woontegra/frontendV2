import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

type Props = {
  title: string;
  description?: string;
};

export default function AdminPlaceholderPage({ title, description }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description ?? `${title} yönetim sayfası`}</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Construction className="h-8 w-8 text-amber-500" />
            <div>
              <CardTitle>Bu sayfa hazırlanıyor</CardTitle>
              <CardDescription>İçerik yakında eklenecektir</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Eski sayfadaki {title} özellikleri bu sayfaya taşınacaktır.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
