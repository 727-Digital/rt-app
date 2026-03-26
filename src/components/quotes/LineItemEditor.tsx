import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { formatCurrency } from '@/lib/utils';
import type { LineItem } from '@/lib/types';

interface LineItemEditorProps {
  lineItems: LineItem[];
  onChange: (items: LineItem[]) => void;
}

const DEFAULT_DETAILS = [
  'Complete excavation of designed area and removal',
  'Installation of footings/edging',
  'Installation of weed barrier',
  'Installation of base material at 2-3 inches',
  'Installation of Turf & Infill',
  'Power Broom finish',
];

function createDefaultItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: 'Turf Installation',
    details: [...DEFAULT_DETAILS],
    qty: 1,
    unit_price: 0,
    total: 0,
  };
}

function LineItemEditor({ lineItems, onChange }: LineItemEditorProps) {
  function updateItem(id: string, updates: Partial<LineItem>) {
    onChange(
      lineItems.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        updated.total = updated.qty * updated.unit_price;
        return updated;
      }),
    );
  }

  function removeItem(id: string) {
    onChange(lineItems.filter((item) => item.id !== id));
  }

  function addItem() {
    onChange([...lineItems, createDefaultItem()]);
  }

  return (
    <div className="flex flex-col gap-4">
      {lineItems.map((item, index) => (
        <div
          key={item.id}
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="mt-2.5 text-xs font-medium text-slate-400">
              #{index + 1}
            </span>
            <div className="flex flex-1 flex-col gap-3">
              <Input
                placeholder="Description"
                value={item.description}
                onChange={(e) =>
                  updateItem(item.id, { description: e.target.value })
                }
              />
              <Textarea
                placeholder="Details (one per line)"
                value={item.details.join('\n')}
                onChange={(e) =>
                  updateItem(item.id, {
                    details: e.target.value.split('\n'),
                  })
                }
                className="min-h-[120px]"
              />
              <div className="flex items-end gap-3">
                <Input
                  label="Qty"
                  type="number"
                  min={1}
                  value={item.qty}
                  onChange={(e) =>
                    updateItem(item.id, {
                      qty: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-20"
                />
                <Input
                  label="Unit Price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.unit_price || ''}
                  onChange={(e) =>
                    updateItem(item.id, {
                      unit_price: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-32"
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    Total
                  </span>
                  <span className="flex h-10 items-center text-sm font-semibold text-slate-900">
                    {formatCurrency(item.qty * item.unit_price)}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeItem(item.id)}
              className="mt-1 text-slate-400 hover:text-red-500"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addItem}>
        <Plus size={16} />
        Add Line Item
      </Button>
    </div>
  );
}

export { LineItemEditor, createDefaultItem };
