import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { getBreadcrumbs, shouldShowBreadcrumb } from "@/utils/breadcrumbUtils";

type Props = {
  hideOn?: string[];
};

export default function Breadcrumb({ hideOn = [] }: Props) {
  const location = useLocation();
  const pathname = location.pathname;

  if (!shouldShowBreadcrumb(pathname)) return null;
  if (hideOn.some((p) => pathname.startsWith(p) || pathname === p)) return null;

  const items = getBreadcrumbs(pathname);
  if (items.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 pb-3 text-sm text-gray-600 dark:text-gray-400 overflow-x-auto -mt-1 mb-1"
    >
      {items.map((item, idx) => (
        <span key={`${idx}-${item.label}`} className="flex items-center gap-1.5 shrink-0">
          {idx > 0 && (
            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" aria-hidden />
          )}
          {item.isCurrent ? (
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.label}</span>
          ) : item.to ? (
            <Link
              to={item.to}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate inline-flex items-center gap-1"
            >
              {idx === 0 && item.label === "Ana Sayfa" ? (
                <>
                  <Home className="w-4 h-4 shrink-0" aria-hidden />
                  {item.label}
                </>
              ) : (
                item.label
              )}
            </Link>
          ) : (
            <span>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
