import type { ButtonHTMLAttributes, ReactNode } from "react";
import ReportPreviewButton from "./ReportPreviewButton";

type DesktopActionBarProps = {
  leftContent?: ReactNode;
  onPrint?: () => void;
  onSave?: () => void;
  printLabel?: string;
  saveLabel?: string;
  printButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  saveButtonProps?: Partial<ButtonHTMLAttributes<HTMLButtonElement>>;
  previewButton?: {
    title: string;
    copyTargetId: string;
    renderContent: () => ReactNode;
    onPdf?: () => Promise<void> | void;
    onWord?: () => Promise<void> | void;
    onButtonClick?: () => void;
    autoOpen?: boolean;
    hideWordDownload?: boolean;
  };
  onPrintClick: () => void;
  replacePrintWith?: { label: string; onClick: () => void };
};

const compactBtnCls =
  "flex flex-col items-center justify-center gap-0.5 py-2 px-5 rounded-lg min-w-[80px] bg-white dark:bg-gray-800 border shadow-sm hover:shadow transition-shadow disabled:opacity-70 disabled:cursor-not-allowed";

export default function DesktopActionBar({
  leftContent,
  onPrint,
  onSave,
  printLabel = "Yazdır",
  saveLabel = "Kaydet",
  printButtonProps,
  saveButtonProps,
  previewButton,
  onPrintClick,
  replacePrintWith,
}: DesktopActionBarProps) {
  const showPrintSlot = replacePrintWith ? true : (onPrint || previewButton);
  return (
    <div className="hidden lg:flex fixed bottom-0 left-0 right-0 lg:left-56 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200/60 dark:border-gray-800/60 py-3 pl-4 pr-8">
      <div className="w-full flex items-center justify-between gap-6">
        {leftContent && <div className="flex items-center gap-2 flex-wrap">{leftContent}</div>}
        <div className="flex items-center gap-6 ml-auto">
        {previewButton && (
          <ReportPreviewButton
            title={previewButton.title}
            copyTargetId={previewButton.copyTargetId}
            compact={true}
            buttonClassName={`${compactBtnCls} text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30`}
            renderContent={previewButton.renderContent}
            onPdf={previewButton.onPdf}
            onButtonClick={previewButton.onButtonClick}
            autoOpen={previewButton.autoOpen}
            hideWordDownload={previewButton.hideWordDownload}
          />
        )}
        {showPrintSlot && replacePrintWith && (
          <button
            type="button"
            onClick={replacePrintWith.onClick}
            title={replacePrintWith.label}
            className={`${compactBtnCls} text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[10px] font-medium leading-tight">{replacePrintWith.label}</span>
          </button>
        )}
        {showPrintSlot && !replacePrintWith && (onPrint || previewButton) && (
          <button
            type="button"
            onClick={onPrintClick}
            disabled={printButtonProps?.disabled}
            title={printButtonProps?.title ?? printLabel}
            className={`${compactBtnCls} text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 ${printButtonProps?.className ?? ""}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span className="text-[10px] font-medium leading-tight">{printLabel}</span>
          </button>
        )}
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saveButtonProps?.disabled}
            title={saveButtonProps?.title ?? saveLabel}
            className={`${compactBtnCls} text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/30 ${saveButtonProps?.className ?? ""}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span className="text-[10px] font-medium leading-tight">{saveLabel}</span>
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
