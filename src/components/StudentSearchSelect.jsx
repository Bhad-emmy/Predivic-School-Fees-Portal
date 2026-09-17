import { useEffect, useMemo, useRef, useState } from "react";

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const defaultGetSearchText = (option) =>
  [
    option?.fullName,
    option?.firstName,
    option?.middleName,
    option?.lastName,
    option?.admissionNo,
    option?.className,
  ]
    .filter(Boolean)
    .join(" ");

const defaultGetLabel = (option) =>
  [
    option?.fullName ||
      [option?.firstName, option?.middleName, option?.lastName]
        .filter(Boolean)
        .join(" "),
    option?.admissionNo,
    option?.className,
  ]
    .filter(Boolean)
    .join(" — ") || "Unnamed Student";

export default function StudentSearchSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Search student by name, admission number, or class...",
  getSearchText = defaultGetSearchText,
  getLabel = defaultGetLabel,
  renderOption,
  disabled = false,
  emptyMessage = "No matching students found.",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);

  const selectedOption = useMemo(
    () =>
      options.find(
        (option) => String(option?.id) === String(value)
      ) || null,
    [options, value]
  );

  useEffect(() => {
    if (!selectedOption) {
      setQuery("");
      return;
    }

    setQuery(getLabel(selectedOption));
  }, [selectedOption, getLabel]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery || (selectedOption && getLabel(selectedOption) === query)) {
      return options.slice(0, 10);
    }

    return options
      .filter((option) =>
        normalize(getSearchText(option)).includes(normalizedQuery)
      )
      .slice(0, 10);
  }, [options, query, selectedOption, getSearchText, getLabel]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
        if (selectedOption) setQuery(getLabel(selectedOption));
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [selectedOption, getLabel]);

  const selectOption = (option) => {
    onChange?.(option?.id || "", option);
    setQuery(option ? getLabel(option) : "");
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((current) =>
        Math.min(current + 1, Math.max(filteredOptions.length - 1, 0))
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      if (open && filteredOptions[highlightedIndex]) {
        event.preventDefault();
        selectOption(filteredOptions[highlightedIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      if (selectedOption) setQuery(getLabel(selectedOption));
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        className="search-input"
        style={{ width: "100%", boxSizing: "border-box" }}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={() => {
          if (!disabled) setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (value) onChange?.("");
        }}
        onKeyDown={handleKeyDown}
      />

      {open && !disabled && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 1000,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: "280px",
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
          }}
        >
          {filteredOptions.length === 0 ? (
            <div style={{ padding: "14px", color: "#64748b" }}>
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={String(option.id) === String(value)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                style={{
                  display: "block",
                  width: "100%",
                  border: "none",
                  borderBottom:
                    index === filteredOptions.length - 1
                      ? "none"
                      : "1px solid #f1f5f9",
                  background: index === highlightedIndex ? "#f8fafc" : "#fff",
                  padding: "11px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {renderOption ? renderOption(option) : getLabel(option)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
