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
                            className={`grid size-5 place-items-center rounded-full border text-[9px] transition-[background-color,border-color,color] duration-[140ms] motion-reduce:transition-none ${
                                index === current
                                    ? "border-nx-accent bg-nx-accent text-nx-on-accent"
                                    : index < current
                                      ? "border-nx-accent text-nx-accent"
                                      : "border-nx-border text-nx-text-2"
                            }`}
                        >
                            {index < current ? <Check className="size-3" strokeWidth={2.5} /> : index + 1}
                        </span>
                        {index < STEPS.length - 1 && (
                            <span
                                aria-hidden="true"
                                className={`h-px w-8 sm:w-12 ${index < current ? "bg-nx-accent" : "bg-nx-border"}`}
                            />
                        )}
                    </li>
                ))}
            </ol>
        </div>
    );
}
