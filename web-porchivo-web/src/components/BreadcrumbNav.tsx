import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
}

export default function BreadcrumbNav({ items }: BreadcrumbNavProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-500">
      {items.map((item, idx) => (
        <span key={item.href} className="flex items-center gap-1.5">
          {idx > 0 && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
          {idx === items.length - 1 ? (
            <span className="text-slate-300" aria-current="page">
              {item.label}
            </span>
          ) : (
            <Link
              to={item.href}
              className="hover:text-slate-300 transition-colors"
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
