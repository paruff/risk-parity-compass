import { useState, useId } from 'react';

export default function Tooltip({ children, tip }) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span
        className="sd-tooltip-trigger"
        tabIndex={0}
        aria-describedby={id}
        style={{ cursor: 'help', borderRadius: 2 }}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onClick={() => setShow(true)}
        onKeyDown={event => {
          if (event.key === 'Escape') setShow(false);
        }}
      >
        {children}
      </span>
      {show && (
        <div
          id={id}
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '120%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0d1424',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '10px 12px',
            fontSize: 13,
            lineHeight: 1.5,
            color: '#cbd5e1',
            width: 300,
            maxWidth: '80vw',
            zIndex: 10,
          }}
        >
          {tip}
        </div>
      )}
    </span>
  );
}
