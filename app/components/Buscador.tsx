'use client';
import React, { ChangeEvent } from 'react';

interface BuscadorProps {
  placeholder: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  className?: string;
}

export default function Buscador({
  placeholder,
  value,
  onChange,
  onClear,
  className = ''
}: BuscadorProps) {
  return (
    <div className={`bg-[#0f172a] p-1 rounded-xl border border-white/5 flex items-center ${className}`}>
      <span className="text-white/40 ml-2 text-xs">🔍</span>
      <input
        type="text"
        placeholder={placeholder}
        className="w-full bg-transparent px-2 py-1.5 text-[11px] font-bold uppercase outline-none text-white"
        value={value}
        onChange={onChange}
      />
      {value && (
        <button onClick={onClear} className="mr-1 text-white/60 hover:text-white text-xs">
          ✕
        </button>
      )}
    </div>
  );
}