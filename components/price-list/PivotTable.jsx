/**
 * components/price-list/PivotTable.jsx
 *
 * Renders the pivoted "subcategory × item" slice CategoryItem hands it
 * (see lib/utils/pivotTableUtils.js's buildPivotData) as an actual table,
 * with the two axes swappable via `transposed`. Scrolls horizontally on
 * its own — a category can easily have more subcategories than fit a
 * phone screen, and that overflow should stay contained here rather
 * than widening the whole page.
 */

import { ArrowLeftRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockBadge } from "./StockBadge";
import { formatCellValue } from "@/lib/utils/pivotTableUtils";

export const PivotTable = ({
  categoryName,
  data,
  transposed,
  onToggleTransposed,
  priceView,
  sellPriceMode,
  editMode,
  onEdit,
  onDelete,
  onViewDetails,
}) => {
  const { rows, columns, cells } = data;

  // Un-transposed: item names read down the left, subcategories across
  // the top (the shape in the original ask). Transposed just swaps
  // which axis is drawn as rows vs columns — cellAt always resolves
  // back to the real (rowKey, colKey) pair regardless of which way
  // round they're currently laid out.
  const outerAxis = transposed ? columns : rows;
  const innerAxis = transposed ? rows : columns;

  const cellAt = (outerKey, innerKey) => {
    const rowKey = transposed ? innerKey : outerKey;
    const colKey = transposed ? outerKey : innerKey;
    return cells.get(rowKey)?.get(colKey) ?? null;
  };

  // Solid (non-transparent) backgrounds only — the first column is
  // sticky, and a translucent bg-muted/40-style class would let columns
  // scrolling underneath bleed through it.
  const rowStripe = (idx) => (idx % 2 === 1 ? "bg-muted" : "bg-card");

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="sticky left-0 z-10 bg-muted text-left font-semibold px-3 py-2 border-b whitespace-nowrap">
              <div className="flex items-center gap-1.5">
                <span className="truncate">{categoryName}</span>
                <Button
                  type="button"
                  onClick={onToggleTransposed}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  title="Swap rows and columns"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </th>
            {innerAxis.map((col) => (
              <th
                key={col.key}
                className="text-right font-semibold px-3 py-2 border-b whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {outerAxis.map((row, rowIdx) => {
            const stripe = rowStripe(rowIdx);
            return (
              <tr key={row.key} className={stripe}>
                <th
                  className={`sticky left-0 z-10 text-left font-medium px-3 py-2 border-b whitespace-nowrap ${stripe}`}
                >
                  {row.label}
                </th>
                {innerAxis.map((col) => {
                  const cell = cellAt(row.key, col.key);

                  if (!cell) {
                    return (
                      <td
                        key={col.key}
                        className="text-right px-3 py-2 border-b text-muted-foreground"
                      >
                        —
                      </td>
                    );
                  }

                  const display = formatCellValue(
                    cell.item,
                    priceView,
                    sellPriceMode,
                  );

                  return (
                    <td
                      key={col.key}
                      className="relative px-3 py-2 border-b text-right align-top"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          editMode
                            ? onEdit(cell.path, cell.item)
                            : onViewDetails(cell.name, cell.item)
                        }
                        className="w-full text-right rounded px-1 -mx-1 hover:bg-primary/5 transition-colors"
                      >
                        {display ? (
                          <div className="whitespace-nowrap">
                            <span className="font-semibold">
                              {display.value}
                            </span>
                            <span className="text-muted-foreground text-[0.7em] ml-1">
                              /{display.unit}
                            </span>
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-sm">
                            N/A
                          </div>
                        )}
                        <div className="flex justify-end">
                          <StockBadge item={cell.item} className="mt-0.5" />
                        </div>
                      </button>
                      {editMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(cell.path, e);
                          }}
                          title="Delete item"
                          className="absolute top-0.5 right-0.5 p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
