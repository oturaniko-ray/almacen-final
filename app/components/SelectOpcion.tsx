'use client';
import React, { ChangeEvent } from 'react';

interface Option {
  value: string | number;
  label: string;
}

interface SelectOpcionProps {
  value: string | number;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: Option[];
  label: string;
  className?: string;
}

export default function SelectOpcion({
  value,
  onChange,
  options,
  label,
  className = ''
}: SelectOpcionProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <label className="text-[9px] font-black text-slate-500 uppercase ml-1">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="w-full bg-white/5 border border-white/10 p-2 rounded-xl text-[11px] font-bold text-white outline-none focus:border-blue-500/50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-gray-800 text-white">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}