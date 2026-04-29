"use client";

import { Loader2, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type TickerSearchSelection = {
  symbol: string;
  description: string;
};

interface TickerSearchProps {
  onSelect: (result: TickerSearchSelection) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Reusable ticker autocomplete. Implements the WAI-ARIA combobox pattern
 * (role="combobox" on the input, role="listbox" on the dropdown,
 * role="option" + aria-selected on each item, aria-activedescendant
 * tracking the keyboard-focused option).
 *
 * Debounce: 300ms. Calls GET /api/market/search?q=. Empty input collapses
 * the listbox so screen readers don't announce a stale state.
 */
export function TickerSearch({
  onSelect,
  placeholder = "search tickers...",
  autoFocus,
}: TickerSearchProps) {
  const listboxId = useId();
  const optionIdPrefix = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerSearchSelection[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Debounced fetch. Reset the active row whenever the query changes
  // so the highlight doesn't stick to the wrong index after re-querying.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/market/search?q=${encodeURIComponent(q)}`
        );
        const data = (await res.json()) as {
          results?: TickerSearchSelection[];
        };
        setResults(data.results ?? []);
        setOpen(true);
        setActiveIndex(data.results?.length ? 0 : -1);
      } catch {
        setResults([]);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const select = useCallback(
    (result: TickerSearchSelection) => {
      onSelect(result);
      setQuery("");
      setResults([]);
      setOpen(false);
      setActiveIndex(-1);
    },
    [onSelect]
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open && results.length) setOpen(true);
      setActiveIndex((i) => (i + 1 >= results.length ? 0 : i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        select(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const activeOptionId =
    open && activeIndex >= 0 && results[activeIndex]
      ? `${optionIdPrefix}-${activeIndex}`
      : undefined;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--dopl-cream)]/40 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg pl-9 pr-9 py-2.5 text-sm font-mono uppercase tracking-wider text-[color:var(--dopl-cream)] placeholder:text-[color:var(--dopl-cream)]/30 placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-[color:var(--dopl-lime)]/50"
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--dopl-cream)]/40 animate-spin"
          />
        )}
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 mt-1 z-30 max-h-72 overflow-y-auto rounded-lg border border-[color:var(--dopl-sage)]/30 bg-[color:var(--dopl-deep-2)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]"
        >
          {results.length === 0 && !loading ? (
            <li
              role="option"
              aria-selected={false}
              aria-disabled
              className="px-3 py-2.5 text-xs text-[color:var(--dopl-cream)]/40"
            >
              no matches
            </li>
          ) : (
            results.map((r, i) => {
              const id = `${optionIdPrefix}-${i}`;
              const active = i === activeIndex;
              return (
                <li
                  key={`${r.symbol}-${i}`}
                  id={id}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(r);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`px-3 py-2 text-sm cursor-pointer flex items-baseline gap-3 ${
                    active
                      ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-cream)]"
                      : "text-[color:var(--dopl-cream)]/80 hover:bg-[color:var(--dopl-sage)]/25"
                  }`}
                >
                  <span className="font-mono font-bold tracking-tight text-[color:var(--dopl-lime)] min-w-[60px]">
                    {r.symbol}
                  </span>
                  <span className="text-xs text-[color:var(--dopl-cream)]/50 truncate">
                    {r.description}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
