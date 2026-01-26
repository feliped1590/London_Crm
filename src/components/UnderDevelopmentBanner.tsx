import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Construction } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnderDevelopmentBannerProps {
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
}

export function UnderDevelopmentBanner({
  title = "Em Desenvolvimento",
  description = "Esta funcionalidade está sendo aprimorada para facilitar a configuração da integração. Em breve estará disponível!",
  className,
  compact = false,
}: UnderDevelopmentBannerProps) {
  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
        "bg-amber-50 text-amber-800 border border-amber-200",
        "dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800/50",
        className
      )}>
        <Construction className="h-4 w-4 shrink-0" />
        <span className="font-medium">{title}</span>
      </div>
    );
  }

  return (
    <Alert className={cn(
      "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/50",
      className
    )}>
      <Construction className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">{title}</AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        {description}
      </AlertDescription>
    </Alert>
  );
}
