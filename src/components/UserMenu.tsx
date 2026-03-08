import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { 
  User, 
  FileText, 
  CreditCard, 
  Settings, 
  LogOut,
  ChevronDown,
  Camera
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/context/AuthContext";
import UploadAvatarDialog from "@/components/profile/UploadAvatarDialog";
import { API_BASE_URL } from "@/utils/apiClient";

interface UserMenuProps {
  user: AuthUser;
  logout: () => void;
}

export default function UserMenu({ user, logout }: UserMenuProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  // Load avatar - önce base64'ten, yoksa backend'den
  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(null);
      return;
    }

    // Önce localStorage'dan base64'i kontrol et
    try {
      const base64Avatar = localStorage.getItem(`avatar_base64_${user.id}`);
      if (base64Avatar && base64Avatar.startsWith('data:image/')) {
        console.log('[UserMenu] Using base64 avatar from localStorage');
        setAvatarUrl(base64Avatar);
        return;
      }
    } catch (err) {
      console.error('[UserMenu] Failed to read base64 from localStorage:', err);
    }

    // Base64 yoksa backend path'ini kullan
    if (user?.profilePicture) {
      let profilePath = user.profilePicture;
      
      // Eğer path / ile başlamıyorsa ekle
      if (!profilePath.startsWith('/')) {
        profilePath = '/' + profilePath;
      }
      
      const baseUrl = `${API_BASE_URL}${profilePath}`;
      
      console.log('[UserMenu] Using backend avatar URL:', baseUrl);
      
      if (avatarUrl !== baseUrl) {
        setAvatarUrl(baseUrl);
      }
    } else {
      setAvatarUrl(null);
    }
  }, [user?.id, user?.profilePicture]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const initials = (user?.name || user?.email || "U?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const displayName = user?.name || user?.email || "Kullanıcı";
  const displayEmail = user?.email || "";

  const handleAvatarChange = (url: string | null) => {
    setAvatarUrl(url);
  };

  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 1000) as unknown as number;
  };

  return (
    <div className="relative">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded-lg",
              "hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            )}
            aria-label="Kullanıcı menüsü"
          >
            <Avatar className="h-8 w-8">
              {avatarUrl ? (
                <AvatarImage 
                  src={avatarUrl} 
                  alt={displayName}
                  onLoad={() => {
                    console.log('[UserMenu] Avatar image loaded successfully:', avatarUrl);
                  }}
                  onError={(e) => {
                    console.error('[UserMenu] Avatar image failed to load:', avatarUrl);
                    console.error('[UserMenu] Error event:', e);
                    // Fallback'e geçmek için avatarUrl'i null yap
                    setAvatarUrl(null);
                  }}
                />
              ) : (
                <AvatarFallback>{initials}</AvatarFallback>
              )}
            </Avatar>
            <span className="hidden md:inline text-sm text-gray-700 dark:text-gray-200">{displayName}</span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className={cn(
            "w-[320px] p-0 mt-2",
            "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl",
            "backdrop-blur-sm bg-opacity-95"
          )}
          sideOffset={8}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* User Info Section */}
          <div className="px-5 py-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700 rounded-t-xl">
            <div className="flex items-start gap-3">
              <div 
                className="relative group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDialogOpen(true);
                }}
              >
                <Avatar className="h-12 w-12 border-2 border-white shadow-md ring-2 ring-gray-100 transition-all duration-200 group-hover:ring-blue-300 dark:group-hover:ring-blue-500 group-hover:scale-105">
                  {avatarUrl ? (
                    <AvatarImage 
                      src={avatarUrl} 
                      alt={displayName}
                      onLoad={() => {
                        if (process.env.NODE_ENV === 'development') {
                          console.log('[UserMenu] Avatar image loaded successfully:', avatarUrl);
                        }
                      }}
                      onError={(e) => {
                        console.error('[UserMenu] Avatar image failed to load:', avatarUrl);
                        console.error('[UserMenu] Error event:', e);
                        // Fallback'e geç
                        setAvatarUrl(null);
                      }}
                    />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-base font-semibold">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                {/* Hover Overlay */}
                <div className={cn(
                  "absolute inset-0 rounded-full bg-black/50 dark:bg-black/70",
                  "flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                  "cursor-pointer"
                )}
                onClick={() => setIsDialogOpen(true)}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Camera className="h-5 w-5 text-white" />
                    <span className="text-xs text-white font-medium">Profil resmi yükle</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{displayName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{displayEmail}</div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <DropdownMenuItem asChild>
              <Link
                to="/profile"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span>Profilim</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                to="/profile?tab=saved"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span>Kayıtlı Hesaplamalarım</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                to="/profile?tab=subscription"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <CreditCard className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span>Abonelik Bilgilerim</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                to="/profile"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <Settings className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span>Ayarlar</span>
              </Link>
            </DropdownMenuItem>
          </div>

          {/* Separator */}
          <Separator className="bg-gray-200 dark:bg-gray-700" />

          {/* Logout Button */}
          <div className="p-2">
            <DropdownMenuItem asChild>
              <button
                onClick={() => logout()}
                className={cn(
                  "w-full flex items-center justify-start gap-3 px-4 py-2.5 text-sm",
                  "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20",
                  "transition-colors cursor-pointer"
                )}
              >
                <LogOut className="h-4 w-4" />
                <span>Çıkış Yap</span>
              </button>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <UploadAvatarDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        currentAvatarUrl={avatarUrl}
        onAvatarChange={handleAvatarChange}
        userName={displayName}
      />
    </div>
  );
}

