const LEVELS = ["Bardzo słabe", "Słabe", "Średnie", "Dobre", "Silne"] as const;

const scorePassword = (value: string): number => {
    if (!value) return 0;
    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)) score += 1;
    if (/[^\w\s]/.test(value)) score += 1;
    return Math.min(score, 4);
};

export function PasswordStrength({ value, id }: { value: string; id: string }) {
    const score = scorePassword(value);

    return (
        <div className="mt-2">
            <div aria-hidden="true" className="grid grid-cols-4 gap-1">
                {[0, 1, 2, 3].map((index) => (
                    <span key={index} className={`h-[3px] rounded-sm ${index < score ? "bg-nx-accent" : "bg-nx-border"}`} />
                ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11.5px] text-nx-text-2">
                <span>Minimum 8 znaków</span>
                <span id={id} aria-live="polite" className={value ? "text-nx-accent" : ""}>
                    {value ? LEVELS[score] : ""}
                </span>
            </div>
        </div>
    );
}
