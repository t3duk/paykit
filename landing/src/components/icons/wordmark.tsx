import { Logo } from "@/components/icons/logo";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-row items-center", className)}>
      <Logo />
      <span className="mb-1 ml-2 scale-115 leading-none font-medium select-none">paykit</span>
    </div>
  );
}
