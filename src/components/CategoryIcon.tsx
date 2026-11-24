import {
  FileSignature,
  FileSpreadsheet,
  FolderOpen,
  Gift,
  HeartHandshake,
  Receipt,
  ShieldCheck,
  TicketPercent,
} from "lucide-react";
import { CATEGORY_META, type DocumentCategory } from "@/lib/constants";

interface CategoryIconProps {
  category: DocumentCategory;
  size?: number;
  withTile?: boolean;
  className?: string;
}

export function CategoryIcon({
  category,
  size = 16,
  withTile = false,
  className = "",
}: CategoryIconProps) {
  const meta = CATEGORY_META[category] || CATEGORY_META["Other personal documents"];

  const renderIcon = () => {
    const props = {
      size,
      strokeWidth: 1.85,
      style: { color: meta.accentColor },
      className: withTile ? "" : className,
    };

    switch (meta.icon) {
      case "ShieldCheck":
        return <ShieldCheck {...props} />;
      case "HeartHandshake":
        return <HeartHandshake {...props} />;
      case "Gift":
        return <Gift {...props} />;
      case "TicketPercent":
        return <TicketPercent {...props} />;
      case "FileSpreadsheet":
        return <FileSpreadsheet {...props} />;
      case "Receipt":
        return <Receipt {...props} />;
      case "FileSignature":
        return <FileSignature {...props} />;
      default:
        return <FolderOpen {...props} />;
    }
  };

  if (!withTile) {
    return renderIcon();
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] ${className}`}
      style={{
        backgroundColor: meta.tintBg,
        width: size + 16,
        height: size + 16,
      }}
    >
      {renderIcon()}
    </span>
  );
}
