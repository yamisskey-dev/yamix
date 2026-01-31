import type { ConsultType } from "@/types";

interface ConsultTypeIconProps {
  type: ConsultType;
  className?: string;
}

export function ConsultTypeIcon({ type, className = "w-4 h-4" }: ConsultTypeIconProps) {
  switch (type) {
    case "PRIVATE":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    case "DIRECTED":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V4zm2.5 1a.5.5 0 00-.5.5v1.077l4.146 2.907a1.5 1.5 0 001.708 0L15 6.577V5.5a.5.5 0 00-.5-.5h-9zM15 8.077l-3.854 2.7a2.5 2.5 0 01-2.848-.056L4.5 8.077V13.5a.5.5 0 00.5.5h9.5a.5.5 0 00.5-.5V8.077z" />
        </svg>
      );
    case "PUBLIC":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" />
        </svg>
      );
  }
}

const CONSULT_TYPE_LABELS: Record<ConsultType, string> = {
  PRIVATE: "プライベート相談",
  DIRECTED: "指名相談",
  PUBLIC: "公開相談",
};

export function getConsultTypeLabel(type: ConsultType): string {
  return CONSULT_TYPE_LABELS[type];
}
