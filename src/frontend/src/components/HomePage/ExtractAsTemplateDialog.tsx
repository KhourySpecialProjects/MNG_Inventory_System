/**
 * Dialog for extracting all team items into a new template.
 * Prompts for a template name, then creates the template pre-populated
 * with all items and kits from the team (serial numbers and quantities stripped).
 */
import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from '@mui/material';
import { createTemplate, addItemToTemplate } from '../../api/templates';

interface FlatItem {
  itemId: string;
  name: string;
  actualName?: string;
  description?: string;
  isKit?: boolean;
  parent?: string | null;
  // nsn intentionally excluded — template items do not carry stock numbers
  liin?: string;
  endItemNiin?: string;
}

interface ExtractAsTemplateDialogProps {
  open: boolean;
  items: FlatItem[];
  onClose: () => void;
  onSuccess: (templateId: string) => void;
}

export default function ExtractAsTemplateDialog({
  open,
  items,
  onClose,
  onSuccess,
}: ExtractAsTemplateDialogProps) {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleClose() {
    if (saving) return;
    setName('');
    setNameError(false);
    setSaveError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setSaving(true);
    setSaveError(null);

    try {
      // 1. Create the empty template
      const created = await createTemplate(name.trim());
      if (!created.templateId) {
        throw new Error('Failed to create template');
      }
      const templateId: string = created.templateId;

      // 2. Topological sort: roots first, then children in dependency order
      const sorted: FlatItem[] = [];
      const remaining = [...items];
      const addedIds = new Set<string>();

      // First pass: add all root items (no parent)
      for (let i = remaining.length - 1; i >= 0; i--) {
        if (!remaining[i].parent) {
          addedIds.add(remaining[i].itemId);
          sorted.push(...remaining.splice(i, 1));
        }
      }

      // Subsequent passes: add items whose parent has been added
      let prevLength = -1;
      while (remaining.length > 0 && remaining.length !== prevLength) {
        prevLength = remaining.length;
        for (let i = remaining.length - 1; i >= 0; i--) {
          if (remaining[i].parent && addedIds.has(remaining[i].parent!)) {
            addedIds.add(remaining[i].itemId);
            sorted.push(...remaining.splice(i, 1));
          }
        }
      }
      // Any orphans (parent not found) are appended as roots
      sorted.push(...remaining);

      // 3. Add items sequentially, mapping old itemIds to new templateItemIds
      const idMap = new Map<string, string>(); // teamItemId -> templateItemId
      for (const item of sorted) {
        const result = await addItemToTemplate(templateId, {
          name: item.name,
          actualName: item.actualName || undefined,
          description: item.description || undefined,
          isKit: item.isKit ?? false,
          parent: item.parent ? (idMap.get(item.parent) ?? null) : null,
          liin: item.liin || undefined,
          endItemNiin: item.endItemNiin || undefined,
        });
        if (result.templateItemId) {
          idMap.set(item.itemId, result.templateItemId);
        }
      }

      onSuccess(templateId);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to extract template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Extract as Template</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="Template Name"
          fullWidth
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim()) setNameError(false);
          }}
          error={nameError}
          helperText={nameError ? 'Template name is required' : undefined}
          disabled={saving}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {saveError && (
          <Typography color="error" variant="body2" sx={{ flex: '1 1 100%', px: 1 }}>
            {saveError}
          </Typography>
        )}
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={saving}
        >
          {saving ? 'Extracting…' : 'Extract'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
