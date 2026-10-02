"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Children, cloneElement, isValidElement, useLayoutEffect, useRef, useState } from "react";

/**
 * A table body that only mounts the rows near the viewport once a list gets
 * long, so 1,000 payments scroll as smoothly as 10. Rows stay real <tr>s in a
 * real <table> (screen readers still hear the row count via aria-rowcount on
 * the table and aria-rowindex here). Short lists render normally.
 *
 * `children` are the <tr> rows, rendered on the server.
 */
export function VirtualTbody({
  children,
  estimate,
  columns,
  threshold = 100,
}: {
  children: React.ReactNode;
  /** Typical row height in px; rows are measured once they mount. */
  estimate: number;
  columns: number;
  threshold?: number;
}) {
  const rows = Children.toArray(children);
  if (rows.length <= threshold) return <tbody>{rows}</tbody>;
  return <Virtual rows={rows} estimate={estimate} columns={columns} />;
}

function Virtual({ rows, estimate, columns }: { rows: React.ReactNode[]; estimate: number; columns: number }) {
  const ref = useRef<HTMLTableSectionElement>(null);
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    const top = () => setOffset((ref.current?.getBoundingClientRect().top ?? 0) + window.scrollY);
    top();
    window.addEventListener("resize", top);
    return () => window.removeEventListener("resize", top);
  }, []);

  const v = useWindowVirtualizer({ count: rows.length, estimateSize: () => estimate, overscan: 12, scrollMargin: offset });
  const items = v.getVirtualItems();
  const before = items.length ? items[0].start - offset : 0;
  const after = items.length ? v.getTotalSize() - (items.at(-1)!.end - offset) : 0;

  return (
    <tbody ref={ref}>
      {before > 0 && <Spacer height={before} columns={columns} />}
      {items.map((it) => {
        const row = rows[it.index];
        return isValidElement(row)
          ? cloneElement(row as React.ReactElement<Record<string, unknown>>, {
              key: it.key,
              ref: v.measureElement,
              "data-index": it.index,
              "aria-rowindex": it.index + 2, // 1-based, after the header row
            })
          : null;
      })}
      {after > 0 && <Spacer height={after} columns={columns} />}
    </tbody>
  );
}

function Spacer({ height, columns }: { height: number; columns: number }) {
  return (
    <tr aria-hidden="true">
      <td colSpan={columns} style={{ height, padding: 0, border: 0 }} />
    </tr>
  );
}
