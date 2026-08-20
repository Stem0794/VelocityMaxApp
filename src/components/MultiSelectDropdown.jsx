import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export default function MultiSelectDropdown({ options, selected, onChange, placeholder = 'All statuses' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const menuId = useId();
  const allSelected = selected.length === 0;
  const label = allSelected ? placeholder : `${selected.length} selected`;

  useEffect(() => {
    const onPointer = event => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const toggle = option => onChange(selected.includes(option)
    ? selected.filter(item => item !== option)
    : [...selected, option]);

  return (
    <div className="multiselect" ref={ref}>
      <button
        type="button"
        className={`multiselect-btn${!allSelected ? ' has-selection' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(value => !value)}
      >
        <span>{label}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open ? (
        <div id={menuId} className="multiselect-dropdown" role="listbox" aria-multiselectable="true">
          <button type="button" className="multiselect-option" role="option" aria-selected={allSelected} onClick={() => onChange([])}>
            <span className="option-check">{allSelected ? <Check size={13} /> : null}</span>
            All statuses
          </button>
          {options.map(option => {
            const isSelected = selected.includes(option);
            return (
              <button key={option} type="button" className="multiselect-option" role="option" aria-selected={isSelected} onClick={() => toggle(option)}>
                <span className="option-check">{isSelected ? <Check size={13} /> : null}</span>
                {option}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
