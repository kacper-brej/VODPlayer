import { Check } from "lucide-react";

const STEPS = ["Powitanie", "Profile", "Preferencje"] as const;

interface StepIndicatorProps {
    current: number;
}

export function StepIndicator({ current }: StepIndicatorProps) {
    return (
        <div className="flex items-center gap-5">
            <span className="shrink-0 font-mono text-[10px] tracking-[0.18em] text-nx-text-2 sm:text-[11px]">
                KROK {String(current + 1).padStart(2, "0")} / 03
            </span>
            <ol aria-label="Postęp konfiguracji" className="flex items-center">
                {STEPS.map((label, index) => (
                    <li key={label} className="flex items-center">
                        <span
                            aria-current={index === current ? "step" : undefined}
                            aria-label={`${label}${index < current ? ", ukończono" : index === current ? ", bieżący krok" : ""}`}
                            className={`grid size-5 place-items-center rounded-full border text-[9px] transition-[background-color,border-color,color,transform] duration-[240ms] motion-reduce:transition-none ${
                                index === current
                                    ? "scale-110 border-nx-accent bg-nx-accent text-nx-on-accent motion-reduce:scale-100"
                                    : index < current
                                      ? "border-nx-accent text-nx-accent"
                                      : "border-nx-border text-nx-text-2"
                            }`}
                        >
                            {index < current ? <Check className="size-3" strokeWidth={2.5} /> : index + 1}
                        </span>
                        {index < STEPS.length - 1 && (
                            <span aria-hidden="true" className="relative h-px w-8 overflow-hidden bg-nx-border sm:w-12">
                                <span className={`absolute inset-0 origin-left bg-nx-accent transition-transform duration-300 ease-out motion-reduce:transition-none ${index < current ? "scale-x-100" : "scale-x-0"}`} />
                            </span>
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
}
