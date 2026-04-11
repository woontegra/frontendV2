import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldX, Home } from "lucide-react";

export default function AdminAccessDeniedPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
            <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">Erişim Reddedildi</CardTitle>
          <CardDescription>
            Bu sayfaya erişmek için admin yetkisine sahip olmanız gerekmektedir.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Admin paneline erişim için lütfen sistem yöneticinizle iletişime geçin.
          </p>
          <div className="flex gap-3 justify-center pt-4">
            <Link to="/dashboard">
              <Button variant="outline">
                <Home className="h-4 w-4 mr-2" />
                Ana Sayfaya Dön
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
