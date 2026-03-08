import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { Upload, X, User } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { API_BASE_URL, apiClient } from "@/utils/apiClient";

interface UploadAvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatarUrl?: string | null;
  onAvatarChange?: (url: string | null) => void;
  userName?: string;
}

export default function UploadAvatarDialog({
  open,
  onOpenChange,
  currentAvatarUrl,
  onAvatarChange,
  userName = "U",
}: UploadAvatarDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error } = useToast();
  const { user, setUser, refreshUser } = useAuth();

  // Dialog açıldığında veya currentAvatarUrl değiştiğinde preview'ı güncelle
  useEffect(() => {
    if (open && !selectedFile) {
      // Eğer yeni dosya seçilmemişse, mevcut profil resmini göster
      console.log('[UploadAvatarDialog] Dialog opened, currentAvatarUrl:', currentAvatarUrl);
      if (currentAvatarUrl) {
        setPreviewUrl(currentAvatarUrl);
      } else {
        setPreviewUrl(null);
      }
    }
  }, [open, currentAvatarUrl, selectedFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      error("Lütfen bir resim dosyası seçin");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      error("Dosya boyutu 5MB'dan küçük olmalıdır");
      return;
    }

    setSelectedFile(file);

    // Create preview and save base64 to localStorage
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPreviewUrl(base64);
      
      // Base64'i localStorage'a kaydet (kullanıcı ID'si ile)
      if (user?.id) {
        try {
          localStorage.setItem(`avatar_base64_${user.id}`, base64);
          console.log('[UploadAvatarDialog] Avatar base64 saved to localStorage');
        } catch (err) {
          console.error('[UploadAvatarDialog] Failed to save base64 to localStorage:', err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', selectedFile);

      const response = await apiClient("/api/user/upload-avatar", {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Profil resmi yüklenemedi.");
      }

      const data = await response.json();
      
      if (data.success) {
        const profilePicturePath = data.data.profilePicture;
        const fullAvatarUrl = `${API_BASE_URL}${profilePicturePath}`;
        
        // Base64'i localStorage'a kaydet (eğer previewUrl base64 ise)
        if (previewUrl && previewUrl.startsWith('data:image/') && user?.id) {
          try {
            localStorage.setItem(`avatar_base64_${user.id}`, previewUrl);
            console.log('[UploadAvatarDialog] Avatar base64 saved to localStorage after upload');
          } catch (err) {
            console.error('[UploadAvatarDialog] Failed to save base64 to localStorage:', err);
          }
        }
        
        // Önce AuthContext'teki user'ı güncelle (hemen görünsün)
        if (user && profilePicturePath) {
          const updatedUser = {
            ...user,
            profilePicture: profilePicturePath,
          };
          setUser(updatedUser);
          // localStorage'ı da hemen güncelle
          localStorage.setItem("current_user", JSON.stringify(updatedUser));
        }
        
        // Update parent component - base64'i kullan (eğer varsa)
        const base64Avatar = user?.id ? localStorage.getItem(`avatar_base64_${user.id}`) : null;
        if (base64Avatar) {
          onAvatarChange?.(base64Avatar);
        } else {
          onAvatarChange?.(`${fullAvatarUrl}?t=${Date.now()}`);
        }
        
        // Backend'den güncel kullanıcı bilgilerini çek (profil resmi dahil) - arka planda
        refreshUser().catch(err => {
          console.error("Refresh user error (non-critical):", err);
        });
        
        success("Profil resmi başarıyla güncellendi");
        setIsUploading(false);
        onOpenChange(false);
        setSelectedFile(null);
        // Preview'ı temizleme - base64'i koru
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      error(err.message || "Resim yüklenirken bir hata oluştu");
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      const response = await apiClient("/api/user/delete-avatar", {
        method: 'DELETE',
      });

      if (response.ok) {
        // Base64'i de localStorage'dan sil
        if (user?.id) {
          try {
            localStorage.removeItem(`avatar_base64_${user.id}`);
            console.log('[UploadAvatarDialog] Avatar base64 removed from localStorage');
          } catch (err) {
            console.error('[UploadAvatarDialog] Failed to remove base64 from localStorage:', err);
          }
        }
        
        // Önce AuthContext'teki user'ı güncelle (hemen görünsün)
        if (user) {
          const updatedUser = {
            ...user,
            profilePicture: undefined,
          };
          setUser(updatedUser);
          // localStorage'ı da hemen güncelle
          localStorage.setItem("current_user", JSON.stringify(updatedUser));
        }
        
        setSelectedFile(null);
        setPreviewUrl(null);
        onAvatarChange?.(null);
        
        // Backend'den güncel kullanıcı bilgilerini çek (profil resmi kaldırıldı) - arka planda
        refreshUser().catch(err => {
          console.error("Refresh user error (non-critical):", err);
        });
        
        success("Profil resmi kaldırıldı");
        onOpenChange(false);
      } else {
        error("Profil resmi kaldırılırken bir hata oluştu");
      }
    } catch (err) {
      console.error("Remove avatar error:", err);
      error("Profil resmi kaldırılırken bir hata oluştu");
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    // Cancel edildiğinde mevcut profil resmine geri dön
    setPreviewUrl(currentAvatarUrl || null);
    onOpenChange(false);
  };

  // Dialog kapandığında state'i temizle
  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      // Dialog kapandığında preview'ı mevcut profil resmine geri döndür
      setPreviewUrl(currentAvatarUrl || null);
    }
  }, [open, currentAvatarUrl]);

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profil Resmi Yükle</DialogTitle>
          <DialogDescription>
            Profil resminizi yükleyin veya güncelleyin. Maksimum dosya boyutu 5MB.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Avatar Preview */}
          <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-white dark:border-gray-700 shadow-lg ring-2 ring-blue-100 dark:ring-gray-700">
              {previewUrl ? (
                <AvatarImage 
                  src={previewUrl} 
                  alt="Profil resmi" 
                  className="object-cover"
                  onError={(e) => {
                    console.error('[UploadAvatarDialog] Preview image failed to load:', previewUrl);
                    // Resim yüklenemezse fallback'e geç
                    setPreviewUrl(null);
                  }}
                />
              ) : (
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-3xl font-semibold">
                  {initials}
                </AvatarFallback>
              )}
            </Avatar>
          </div>

          {/* File Input */}
          <div className="w-full">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              disabled={isUploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {selectedFile ? "Resmi Değiştir" : "Resim Seç"}
            </Button>
            {selectedFile && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                Seçili: {selectedFile.name}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentAvatarUrl && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              disabled={isUploading}
              className="w-full sm:w-auto"
            >
              <X className="mr-2 h-4 w-4" />
              Resmi Kaldır
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isUploading}
              className="flex-1 sm:flex-initial"
            >
              İptal
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="flex-1 sm:flex-initial"
            >
              {isUploading ? "Yükleniyor..." : "Yükle"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

