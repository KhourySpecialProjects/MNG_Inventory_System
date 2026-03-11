/**
 * Dialog for creating a brand-new item or kit directly within a template.
 * Uses ItemDetailsForm in create mode and strips template-irrelevant fields
 * (serialNumber, ohQuantity, status) before saving.
 */
import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import ItemDetailsForm from '../ProductPage/ItemDetailsForm';
import { createTemplateItem } from '../../api/templates';

interface TemplateItem {
  templateItemId: string;
  name: string;
  actualName?: string;
  isKit?: boolean;
  parent?: string | null;
  nsn?: string;
  endItemNiin?: string;
  liin?: string;
}

interface ProductForm {
  productName: string;
  actualName: string;
  isKit: boolean;
  parent: string | null;
  nsn: string;
  liin: string;
  endItemNiin: string;
  description: string;
  notes: string;
}

interface CreateTemplateItemDialogProps {
  open: boolean;
  templateId: string;
  templateItems: TemplateItem[];
  onClose: () => void;
  onSuccess: () => void;
}

const emptyProduct = () => ({
  productName: '',
  actualName: '',
  isKit: false,
  parent: null as string | null,
  nsn: '',
  liin: '',
  endItemNiin: '',
  description: '',
  notes: '',
});

export default function CreateTemplateItemDialog({
  open,
  templateId,
  templateItems,
  onClose,
  onSuccess,
}: CreateTemplateItemDialogProps) {
  const [editedProduct, setEditedProduct] = useState<ProductForm>(emptyProduct());
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Map templateItems to the shape ItemDetailsForm expects for the Kit From selector.
  const itemsList = templateItems.map((item) => ({
    itemId: item.templateItemId,
    name: item.name,
    actualName: item.actualName ?? '',
    isKit: item.isKit ?? false,
  }));

  function handleClose() {
    setEditedProduct(emptyProduct());
    setErrors({});
    setSaveError(null);
    onClose();
  }

  async function handleSubmit() {
    const newErrors: Record<string, boolean> = {};
    if (!editedProduct.productName?.trim()) newErrors.productName = true;
    if (!editedProduct.actualName?.trim()) newErrors.actualName = true;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await createTemplateItem(templateId, {
        name: editedProduct.productName,
        actualName: editedProduct.actualName,
        description: editedProduct.description || undefined,
        isKit: editedProduct.isKit ?? false,
        parent: editedProduct.parent ?? null,
        nsn: editedProduct.nsn || undefined,
        liin: editedProduct.liin || undefined,
        endItemNiin: editedProduct.endItemNiin || undefined,
      });
      handleClose();
      onSuccess();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Item</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Serial numbers and quantities are not saved in templates.
        </Alert>
        <ItemDetailsForm
          editedProduct={editedProduct}
          setEditedProduct={setEditedProduct}
          itemsList={itemsList}
          isEditMode={true}
          isCreateMode={true}
          errors={errors}
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
          color="warning"
          onClick={() => void handleSubmit()}
          disabled={saving}
        >
          {saving ? 'Creating…' : 'Create Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}