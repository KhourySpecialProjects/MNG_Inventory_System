/**
 * Dialog for importing template items into a team.
 * Supports selecting items/kits with checkboxes, setting quantity and serial numbers.
 * Kits can be expanded with quantity > 1 to duplicate children.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Box,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import { getTemplates, getTemplateItems, importTemplateToTeam } from '../api/templates';

interface TemplateOption {
  templateId: string;
  name: string;
  itemCount: number;
}

interface TemplateItem {
  templateItemId: string;
  name: string;
  actualName?: string;
  description?: string;
  isKit: boolean;
  parent: string | null;
  nsn?: string;
  liin?: string;
  endItemNiin?: string;
  imageKey?: string;
}

interface Selection {
  checked: boolean;
  authQuantity: number;
  serialNumber: string;
}

interface ImportTemplateDialogProps {
  teamId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showSnackbar: (message: string, severity: 'success' | 'error') => void;
}

export default function ImportTemplateDialog({
  teamId,
  open,
  onClose,
  onSuccess,
  showSnackbar,
}: ImportTemplateDialogProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [selections, setSelections] = useState<Map<string, Selection>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState('');

  // Load templates on open
  useEffect(() => {
    if (!open) {
      setSelectedTemplateId('');
      setTemplateItems([]);
      setSelections(new Map());
      setError('');
      return;
    }

    async function loadTemplates() {
      try {
        const res = await getTemplates();
        if (res?.templates) {
          setTemplates(
            res.templates.map((t: any) => ({
              templateId: t.templateId,
              name: t.name,
              itemCount: t.itemCount ?? 0,
            })),
          );
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
        setError('Failed to load templates');
      }
    }
    loadTemplates();
  }, [open]);

  // Load template items when template is selected
  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplateItems([]);
      setSelections(new Map());
      return;
    }

    async function loadItems() {
      setLoadingItems(true);
      try {
        const res = await getTemplateItems(selectedTemplateId);
        const items: TemplateItem[] = res?.items ?? [];
        setTemplateItems(items);

        const newSelections = new Map<string, Selection>();
        for (const item of items) {
          newSelections.set(item.templateItemId, {
            checked: false,
            authQuantity: 1,
            serialNumber: '',
          });
        }
        setSelections(newSelections);
      } catch (err) {
        console.error('Failed to load template items:', err);
        setError('Failed to load template items');
      } finally {
        setLoadingItems(false);
      }
    }
    loadItems();
  }, [selectedTemplateId]);

  // Organize items hierarchically: kits first (with children directly below), then standalone items
  const orderedItems = useMemo(() => {
    const childrenMap = new Map<string, TemplateItem[]>();
    for (const item of templateItems) {
      if (item.parent) {
        const siblings = childrenMap.get(item.parent) ?? [];
        siblings.push(item);
        childrenMap.set(item.parent, siblings);
      }
    }

    const topLevel = templateItems.filter((i) => !i.parent);
    // Sort: kits first, then non-kits
    const kits = topLevel.filter((i) => i.isKit);
    const standalone = topLevel.filter((i) => !i.isKit);

    const result: { item: TemplateItem; depth: number }[] = [];
    for (const item of [...kits, ...standalone]) {
      result.push({ item, depth: 0 });
      const children = childrenMap.get(item.templateItemId) ?? [];
      for (const child of children) {
        result.push({ item: child, depth: 1 });
      }
    }
    return result;
  }, [templateItems]);

  // Batch-update selections (avoids multiple setState calls)
  const handleCheckToggle = useCallback(
    (item: TemplateItem, checked: boolean) => {
      setSelections((prev) => {
        const next = new Map(prev);
        const current = next.get(item.templateItemId);
        if (current) {
          next.set(item.templateItemId, { ...current, checked });
        }

        // If it's a kit, auto-check/uncheck all children in the same update
        if (item.isKit) {
          for (const ti of templateItems) {
            if (ti.parent === item.templateItemId) {
              const childSel = next.get(ti.templateItemId);
              if (childSel) {
                next.set(ti.templateItemId, { ...childSel, checked });
              }
            }
          }
        }

        return next;
      });
    },
    [templateItems],
  );

  function updateSelection(templateItemId: string, updates: Partial<Selection>) {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(templateItemId);
      if (current) {
        next.set(templateItemId, { ...current, ...updates });
      }
      return next;
    });
  }

  // Validation
  const checkedItems = useMemo(() => {
    return Array.from(selections.entries())
      .filter(([, sel]) => sel.checked)
      .map(([id, sel]) => {
        const ti = templateItems.find((i) => i.templateItemId === id);
        return { templateItemId: id, ...sel, isKit: ti?.isKit ?? false };
      });
  }, [selections, templateItems]);

  const isValid = useMemo(() => {
    if (checkedItems.length === 0) return false;
    return checkedItems.every((item) => {
      if (item.authQuantity < 1) return false;
      if (!item.isKit && !item.serialNumber.trim()) return false;
      return true;
    });
  }, [checkedItems]);

  const itemCountSummary = checkedItems.length;

  async function handleSubmit() {
    if (!isValid) return;

    setLoading(true);
    setError('');
    try {
      const selectionsPayload = checkedItems.map((item) => ({
        templateItemId: item.templateItemId,
        authQuantity: item.authQuantity,
        serialNumber: item.serialNumber,
      }));

      const res = await importTemplateToTeam(selectedTemplateId, teamId, selectionsPayload);

      if (res?.success) {
        showSnackbar(`Successfully imported ${res.itemsCreated} items`, 'success');
        onSuccess();
        onClose();
      } else {
        setError(res?.error || 'Failed to import items');
        showSnackbar(res?.error || 'Failed to import items', 'error');
      }
    } catch (err: any) {
      const msg = err?.message || 'An unexpected error occurred';
      setError(msg);
      showSnackbar(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: { borderRadius: 3, boxShadow: '0 24px 48px rgba(0,0,0,0.15)', minHeight: '60vh' },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: '1.5rem',
          pb: 1,
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}15 100%)`,
        }}
      >
        Import from Template
      </DialogTitle>

      <DialogContent sx={{ pt: '24px !important', pb: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Step 1: Template Selection */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel id="template-select-label">Select Template</InputLabel>
          <Select
            labelId="template-select-label"
            label="Select Template"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            sx={{ borderRadius: 2 }}
          >
            {templates.map((t) => (
              <MenuItem key={t.templateId} value={t.templateId}>
                {t.name} ({t.itemCount} items)
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Loading indicator */}
        {loadingItems && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Empty template message */}
        {selectedTemplateId && !loadingItems && templateItems.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            This template has no items
          </Typography>
        )}

        {/* Step 2: Item Selection & Configuration */}
        {orderedItems.length > 0 && !loadingItems && (
          <>
            {/* Header row */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr 160px 240px',
                gap: 1,
                px: 1,
                pb: 1,
                borderBottom: '2px solid',
                borderColor: 'divider',
                mb: 1,
              }}
            >
              <Box />
              <Typography variant="subtitle2" fontWeight={700}>
                Item
              </Typography>
              <Typography variant="subtitle2" fontWeight={700}>
                Quantity
              </Typography>
              <Typography variant="subtitle2" fontWeight={700}>
                Serial Number
              </Typography>
            </Box>

            {/* Item rows */}
            <Box sx={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {orderedItems.map(({ item, depth }) => {
                const sel = selections.get(item.templateItemId);
                if (!sel) return null;
                const isChild = depth > 0;

                return (
                  <Box
                    key={item.templateItemId}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '48px 1fr 160px 240px',
                      gap: 1,
                      px: 1,
                      py: 0.75,
                      alignItems: 'center',
                      ...(isChild
                        ? {
                            bgcolor: 'action.hover',
                            borderLeft: '3px solid',
                            borderColor: 'primary.main',
                            ml: 3,
                          }
                        : item.isKit
                          ? { bgcolor: 'primary.50', borderRadius: 1 }
                          : {}),
                      '&:hover': { bgcolor: 'action.selected' },
                    }}
                  >
                    <Checkbox
                      checked={sel.checked}
                      onChange={(e) => handleCheckToggle(item, e.target.checked)}
                      size="small"
                    />

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isChild && (
                        <Typography variant="caption" color="text.secondary" sx={{ userSelect: 'none' }}>
                          └
                        </Typography>
                      )}
                      <Typography
                        variant="body2"
                        fontWeight={item.isKit ? 700 : 400}
                        sx={{ color: item.isKit ? 'primary.main' : 'text.primary' }}
                      >
                        {item.name}
                      </Typography>
                      {item.isKit && (
                        <Typography
                          variant="caption"
                          sx={{
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            px: 0.75,
                            py: 0.125,
                            borderRadius: 1,
                            fontWeight: 600,
                            fontSize: '0.65rem',
                          }}
                        >
                          KIT
                        </Typography>
                      )}
                      {item.nsn && (
                        <Typography variant="caption" color="text.secondary">
                          (NSN: {item.nsn})
                        </Typography>
                      )}
                    </Box>

                    <TextField
                      type="number"
                      size="small"
                      value={sel.authQuantity}
                      onChange={(e) =>
                        updateSelection(item.templateItemId, {
                          authQuantity: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      disabled={!sel.checked}
                      inputProps={{ min: 1 }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                    />

                    <TextField
                      size="small"
                      placeholder="Serial #"
                      value={sel.serialNumber}
                      onChange={(e) =>
                        updateSelection(item.templateItemId, { serialNumber: e.target.value })
                      }
                      disabled={!sel.checked || item.isKit}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                    />
                  </Box>
                );
              })}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, gap: 1, justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
          {itemCountSummary > 0 ? `${itemCountSummary} items selected` : 'No items selected'}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            onClick={onClose}
            disabled={loading}
            sx={{ borderRadius: 2, px: 3, textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !isValid}
            sx={{
              borderRadius: 2,
              px: 3,
              textTransform: 'none',
              fontWeight: 600,
              background: (theme) =>
                `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => `0 6px 20px ${theme.palette.primary.main}40`,
              },
              '&:disabled': {
                background: (theme) => theme.palette.action.disabledBackground,
              },
            }}
          >
            {loading ? 'Importing...' : `Import ${itemCountSummary} Items`}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
