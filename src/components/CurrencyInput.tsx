import React from 'react';
import { formatRupiah, parseRupiah } from '../services/formatters.js';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'Rp 0',
  ...props
}) => {
  const displayValue = value ? formatRupiah(value) : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawNum = parseRupiah(e.target.value);
    onChange(rawNum);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={`px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all ${className}`}
      {...props}
    />
  );
};
