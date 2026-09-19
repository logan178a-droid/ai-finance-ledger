"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";

export interface CategoryRow {
  id: string;
  name: string;
  userId: string | null;
}

export function CategoriesTab({ initialCategories }: { initialCategories: CategoryRow[] }) {
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function load() {
    const res = await fetch("/api/categories");
    if (res.ok) {
      const data = await res.json();
      setCategories(data.categories);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't add that category.");
        return;
      }
      setNewName("");
      await load();
      showToast({ message: "Category added." });
    } finally {
      setAdding(false);
    }
  }

  async function saveRename(id: string) {
    if (!editValue.trim()) return;
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editValue.trim() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast({ message: body.error ?? "Couldn't rename that category." });
      return;
    }
    setEditingId(null);
    await load();
    showToast({ message: "Category renamed." });
  }

  async function remove(id: string) {
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast({ message: body.error ?? "Couldn't delete that category." });
      return;
    }
    await load();
    showToast({ message: "Category removed." });
  }

  const defaults = categories.filter((c) => c.userId === null);
  const custom = categories.filter((c) => c.userId !== null);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-1">Add a category</h2>
        <p className="text-xs text-muted mb-3">Custom categories show up alongside the defaults when logging a transaction.</p>
        <form onSubmit={addCategory} className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Pet Care" className="flex-1" />
          <Button type="submit" loading={adding} disabled={!newName.trim()}>
            <Plus size={14} /> Add
          </Button>
        </form>
        {error && <p className="text-xs text-danger mt-2">{error}</p>}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3">Your categories</h2>
        {custom.length === 0 ? (
          <p className="text-sm text-muted">No custom categories yet.</p>
        ) : (
          <ul className="space-y-1">
            {custom.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-background">
                {editingId === c.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus className="flex-1 py-1.5" />
                    <button onClick={() => saveRename(c.id)} className="p-1.5 rounded-md text-positive hover:bg-positive-soft" aria-label="Save">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded-md text-muted hover:bg-background" aria-label="Cancel">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm">{c.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setEditValue(c.name);
                        }}
                        className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-background"
                        aria-label={`Rename ${c.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => remove(c.id)}
                        className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-negative-soft"
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-1">Default categories</h2>
        <p className="text-xs text-muted mb-3">Shared, built-in categories — can&rsquo;t be renamed or removed.</p>
        <div className="flex flex-wrap gap-2">
          {defaults.map((c) => (
            <span key={c.id} className="text-xs px-2.5 py-1 rounded-full bg-background border border-border text-muted">
              {c.name}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
