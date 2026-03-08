import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, User } from "lucide-react";
import ReportPreviewButton from "./ReportPreviewButton";

type MobileActionBarProps = {
  onSave?: () => void;
  saveLabel?: string;
  saveButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  previewButton?: {
    hideWordDownload?: boolean;
    title: string;
    copyTargetId: string;
    renderContent: () => ReactNode;
    buttonClassName?: string;
    onPdf?: () => Promise<void> | void;
    onWord?: () => Promise<void> | void;
    onButtonClick?: () => void;
    autoOpen?: boolean;
    compact?: boolean; // Mobil: küçük ikon+etiket buton
  };
};

export default function MobileActionBar({
  onSave,
  saveLabel = "Kaydet",
  saveButtonProps,
  previewButton,
}: MobileActionBarProps) {
  if (!previewButton && !onSave) return null;

  const compactBtnCls =
    "flex flex-col items-center justify-center gap-0.5 py-2 px-4 rounded-lg min-w-[72px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm active:scale-95 transition-transform";

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200/60 dark:border-gray-800/60 px-3 py-2 safe-area-pb">
      <div className="flex items-center justify-center gap-6 max-w-md mx-auto">
        {previewButton && (
          <ReportPreviewButton
            title={previewButton.title}
            copyTargetId={previewButton.copyTargetId}
            compact={true}
            buttonClassName={
              previewButton.buttonClassName ||
              `${compactBtnCls} text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30`
            }
            renderContent={previewButton.renderContent}
            onPdf={previewButton.onPdf}
            onButtonClick={previewButton.onButtonClick}
            autoOpen={previewButton.autoOpen}
            hideWordDownload={previewButton.hideWordDownload}
          />
        )}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saveButtonProps?.disabled}
            title={saveButtonProps?.title ?? saveLabel}
            className={`${compactBtnCls} text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            <span className="text-[10px] font-medium leading-tight">{saveLabel}</span>
          </button>
        )}
        <Link
          to="/profile/saved-calculations"
          className={`${compactBtnCls} text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/30 no-underline`}
          aria-label="Kayıtlı hesaplamalar"
        >
          <FolderOpen className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          <span className="text-[10px] font-medium leading-tight">Kayıtlar</span>
        </Link>
        <Link
          to="/profile"
          className={`${compactBtnCls} text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 no-underline`}
          aria-label="Profil"
        >
          <User className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          <span className="text-[10px] font-medium leading-tight">Profil</span>
        </Link>
      </div>
    </div>
  );
}
