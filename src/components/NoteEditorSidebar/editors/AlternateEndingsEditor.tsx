import { Button } from "@/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

const ENDING_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function alternateEndingsSummary(value: number, noneLabel: string): string {
  const endings = ENDING_NUMBERS.filter((ending) =>
    (value & (1 << (ending - 1))) !== 0);
  return endings.length > 0 ? endings.join(", ") : noneLabel;
}

export function AlternateEndingsEditor({
  value,
  clearLabel,
  onChange,
}: {
  value: number;
  clearLabel: string;
  onChange: (value: number) => void;
}) {
  const selected = ENDING_NUMBERS
    .filter((ending) => (value & (1 << (ending - 1))) !== 0)
    .map(String);

  return (
    <div className="space-y-3">
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        spacing={1}
        value={selected}
        className="grid w-full grid-cols-4 gap-1"
        onValueChange={(next) => {
          const bitmask = next.reduce(
            (result, ending) => result | (1 << (Number(ending) - 1)),
            0,
          );
          onChange(bitmask);
        }}
      >
        {ENDING_NUMBERS.map((ending) => (
          <ToggleGroupItem
            key={ending}
            value={String(ending)}
            className="h-8 justify-center rounded-md border-l px-0 text-xs data-[state=on]:border-primary/40 data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
            aria-label={String(ending)}
          >
            {ending}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="w-full"
        disabled={value === 0}
        onClick={() => onChange(0)}
      >
        {clearLabel}
      </Button>
    </div>
  );
}
