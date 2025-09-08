'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Check, Folder, Server, Code, Flask, Database, Activity, Shield, Cloud, Cpu, HardDrive } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
}

const AVAILABLE_ICONS = [
  { name: 'folder', icon: Folder, label: 'Folder' },
  { name: 'server', icon: Server, label: 'Server' },
  { name: 'code', icon: Code, label: 'Code' },
  { name: 'flask', icon: Flask, label: 'Testing' },
  { name: 'database', icon: Database, label: 'Database' },
  { name: 'activity', icon: Activity, label: 'Activity' },
  { name: 'shield', icon: Shield, label: 'Security' },
  { name: 'cloud', icon: Cloud, label: 'Cloud' },
  { name: 'cpu', icon: Cpu, label: 'CPU' },
  { name: 'hard-drive', icon: HardDrive, label: 'Storage' }
];

const PRESET_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#64748b', // slate
  '#f97316', // orange
  '#a855f7'  // purple
];

export default function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    color: '#22c55e',
    icon: 'folder'
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm)
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.message || 'Failed to create category');
        return;
      }
      
      setShowAddCategory(false);
      resetCategoryForm();
      fetchCategories();
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Failed to create category');
    }
  };

  const handleUpdateCategory = async (id: number) => {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryForm)
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.message || 'Failed to update category');
        return;
      }
      
      setEditingCategory(null);
      resetCategoryForm();
      fetchCategories();
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!confirm(`Delete category "${name}"? Nodes in this category will be moved to "Uncategorized".`)) return;
    
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        const error = await res.json();
        alert(error.message || 'Failed to delete category');
        return;
      }
      
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category');
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      color: '#22c55e',
      icon: 'folder'
    });
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category.id);
    setCategoryForm({
      name: category.name,
      color: category.color,
      icon: category.icon
    });
  };

  const getIconComponent = (iconName: string) => {
    const iconData = AVAILABLE_ICONS.find(i => i.name === iconName);
    return iconData ? iconData.icon : Folder;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading categories...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Categories</h3>
        <button
          onClick={() => setShowAddCategory(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {showAddCategory && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h4 className="text-base font-semibold mb-4">New Category</h4>
          <form onSubmit={handleAddCategory} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                required
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g., Production"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCategoryForm({ ...categoryForm, color })}
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      categoryForm.color === color ? 'border-foreground scale-110' : 'border-border'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  className="w-10 h-10 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Icon</label>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_ICONS.map(({ name, icon: IconComponent, label }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setCategoryForm({ ...categoryForm, icon: name })}
                    className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                      categoryForm.icon === name ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Create Category
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddCategory(false);
                  resetCategoryForm();
                }}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {categories.map(category => {
          const IconComponent = getIconComponent(category.icon);
          const isEditing = editingCategory === category.id;

          return (
            <div
              key={category.id}
              className="bg-card border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors"
            >
              {isEditing ? (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      className="flex-1 px-3 py-2 bg-input border border-border rounded-lg"
                    />
                    <input
                      type="color"
                      value={categoryForm.color}
                      onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                      className="w-20 h-10 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateCategory(category.id)}
                      className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingCategory(null);
                        resetCategoryForm();
                      }}
                      className="p-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: category.color + '20', color: category.color }}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{category.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Created {new Date(category.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(category)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id, category.name)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {categories.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No categories yet. Create your first category to organize your nodes.
          </div>
        )}
      </div>
    </div>
  );
}