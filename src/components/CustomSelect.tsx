import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { playSFX, SFX } from '../lib/sounds';

export interface SelectOption {
    value: string;
    label: string | React.ReactNode;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    style?: React.CSSProperties;
    className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, style, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div
            className={`custom-select-container ${className || ''}`}
            ref={containerRef}
            style={style}
            onMouseEnter={() => playSFX(SFX.HOVER)}
            onClick={() => { if (!isOpen) playSFX(SFX.ENTER_MENU); setIsOpen(!isOpen); }}
        >
            <div className={`custom-select-value ${isOpen ? 'open' : ''}`}>
                <span>{selectedOption?.label}</span>
                <ChevronDown size={16} />
            </div>
            {isOpen && (
                <div className="custom-select-dropdown">
                    {options.map((opt) => (
                        <div
                            key={opt.value}
                            className={`custom-select-option ${opt.value === value ? 'selected' : ''}`}
                            onMouseEnter={() => playSFX(SFX.HOVER)}
                            onClick={(e) => {
                                e.stopPropagation();
                                playSFX(SFX.CHECK);
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
