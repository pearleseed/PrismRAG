import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const languages = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const currentLanguage = languages.find((l) => l.code === i18n.language) || languages[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          title="Switch language"
        >
          <Languages className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{currentLanguage.name}</span>
          <span className="sm:hidden">{currentLanguage.flag}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-40 p-1">
        <div className="flex flex-col gap-0.5">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
                i18n.language === lang.code
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
