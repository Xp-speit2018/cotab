import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, "type"> {
  revealLabel: string;
}

function PasswordInput({
  className,
  revealLabel,
  ...props
}: PasswordInputProps) {
  const [revealed, setRevealed] = React.useState(false);

  const hide = () => setRevealed(false);

  return (
    <div className="relative" data-slot="password-input">
      <Input
        {...props}
        type={revealed ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 cursor-default text-muted-foreground"
            aria-label={revealLabel}
            aria-pressed={revealed}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setRevealed(true);
            }}
            onPointerUp={hide}
            onPointerCancel={hide}
            onPointerLeave={hide}
            onLostPointerCapture={hide}
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") {
                setRevealed(true);
              }
            }}
            onKeyUp={hide}
            onBlur={hide}
          >
            {revealed
              ? <EyeOff className="h-4 w-4" />
              : <Eye className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{revealLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export { PasswordInput };
