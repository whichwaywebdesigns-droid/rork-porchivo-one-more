import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Globe, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { LANGUAGES, getLanguageMeta, type LanguageMeta } from "@/i18n/languages";
import { changeLanguageWithTransition } from "@/i18n";

interface LanguageSelectorProps {
  /** Render compact (icon-only trigger) — useful inside the header */
  compact?: boolean;
  className?: string;
}

/**
 * Searchable language selector backed by the full language registry.
 * Selecting a language switches i18next, which persists to localStorage
 * and updates <html lang>/dir via the i18n side effects.
 */
export default function LanguageSelector({ compact = false, className }: LanguageSelectorProps) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState<boolean>(false);

  const current: LanguageMeta = getLanguageMeta(i18n.language);

  const handleSelect = useCallback(
    async (code: string) => {
      await changeLanguageWithTransition(code);
      setOpen(false);
    },
    [],
  );

  const renderItem = (lang: LanguageMeta) => {
    const isActive = lang.code === current.code;
    return (
      <CommandItem
        key={lang.code}
        // Include searchable tokens so users can type English or native name or code.
        value={`${lang.englishName} ${lang.nativeName} ${lang.code}`}
        onSelect={() => handleSelect(lang.code)}
        className={cn(
          "flex items-center gap-3 py-2.5 cursor-pointer transition-colors",
          isActive && "bg-brand-orange/10",
        )}
      >
        <span className="text-lg leading-none" aria-hidden>
          {lang.flag}
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <span className={cn(
            "text-sm truncate",
            isActive ? "font-bold text-brand-orange" : "font-medium text-foreground",
          )}>
            {lang.nativeName}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {lang.englishName}
            {lang.rtl ? ` · ${t("settings.language.rtl")}` : ""}
          </span>
          <span className="text-xs italic text-muted-foreground/70 truncate">
            &ldquo;{lang.hello}&rdquo;
          </span>
        </div>
        {isActive && <Check className="w-4 h-4 text-brand-orange flex-shrink-0" />}
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t("settings.language.label")}
          className={cn(
            "justify-between bg-brand-navy-800/60 border-brand-navy-500/50 text-brand-text-primary hover:bg-brand-navy-700/70 hover:text-brand-text-primary",
            compact ? "w-auto px-2.5" : "w-full sm:w-[340px] h-12",
            className,
          )}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            {compact ? (
              <Globe className="w-4 h-4 flex-shrink-0" />
            ) : (
              <span className="text-lg leading-none" aria-hidden>
                {current.flag}
              </span>
            )}
            {!compact && (
              <span className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium truncate">{current.nativeName}</span>
                <span className="text-xs text-brand-text-muted truncate">{current.englishName}</span>
              </span>
            )}
            {compact && <span className="text-sm font-medium uppercase">{current.code}</span>}
          </span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 flex-shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={compact ? "end" : "start"}
        className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0 bg-brand-navy-800 border-brand-navy-500/60"
      >
        <Command
          // Custom filter so the language code & both names are matched.
          filter={(value, search) => {
            return value.toLowerCase().includes(search.toLowerCase().trim()) ? 1 : 0;
          }}
          className="bg-transparent"
        >
          <CommandInput placeholder={t("settings.language.search")} className="text-brand-text-primary" />
          <CommandList>
            <CommandEmpty className="text-brand-text-muted">{t("settings.language.empty")}</CommandEmpty>
            <CommandGroup
              heading={
                <span className="flex items-center gap-1.5 text-brand-text-muted">
                  <Languages className="w-3 h-3" /> {t("settings.language.translated")}
                </span>
              }
            >
              {LANGUAGES.map(renderItem)}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
