import { useState, useEffect, useRef } from 'react';

export function useCountUp(target: number, duration = 3000): number {
    const [value, setValue] = useState(0);
    const rafRef = useRef<number | null>(null);
    const startRef = useRef<number | null>(null);

    useEffect(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        startRef.current = null;

        if (target === 0) {
            setValue(0);
            return;
        }

        const animate = (timestamp: number) => {
            if (!startRef.current) startRef.current = timestamp;
            const progress = Math.min((timestamp - startRef.current) / duration, 1);
            // ease-out quad
            const eased = 1 - (1 - progress) * (1 - progress);
            setValue(Math.round(eased * target));
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate);
            }
        };

        rafRef.current = requestAnimationFrame(animate);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [target, duration]);

    return value;
}
