
let hasInteracted = false;

if (typeof window !== 'undefined') {
    const markInteracted = () => {
        hasInteracted = true;
    };
    window.addEventListener('pointerdown', markInteracted, { once: true });
    window.addEventListener('keydown', markInteracted, { once: true });
}

export const hasPageInteraction = () => hasInteracted;
