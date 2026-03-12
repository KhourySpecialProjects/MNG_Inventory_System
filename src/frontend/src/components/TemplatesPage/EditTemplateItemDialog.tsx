/**
 * Dialog for editing an existing template item.
 * Uses ItemDetailsForm in edit + template mode, pre-populated with current values.
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
} from '@mui/material';
import ItemDetailsForm from '../ProductPage/ItemDetailsForm';
import ImagePanel from '../ProductPage/ImagePanel';
import { updateTemplateItem } from '../../api/templates';

interface TemplateItem {
  templateItemId: string;
  name: string;
  actualName?: string;
  description?: string;
  isKit?: boolean;
  parent?: string | null;
  nsn?: string;
  endItemNiin?: string;
  liin?: string;
  imageLink?: string;
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

interface EditTemplateItemDialogProps {
  open: boolean;
  templateId: string;
  templateItems: TemplateItem[];
  item: TemplateItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditTemplateItemDialog({
  open,
  templateId,
  templateItems,
  item,
  onClose,
  onSuccess,
}: EditTemplateItemDialogProps) {
  const [editedProduct, setEditedProduct] = useState<ProductForm>({
    productName: '',
    actualName: '',
    isKit: false,
    parent: null,
    nsn: '',
    liin: '',
    endItemNiin: '',
    description: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // Pre-populate form when item changes
  useEffect(() => {
    if (item && open) {
      setEditedProduct({
        productName: item.name ?? '',
        actualName: item.actualName ?? '',
        isKit: item.isKit ?? false,
        parent: item.parent ?? null,
        nsn: item.nsn ?? '',
        liin: item.liin ?? '',
        endItemNiin: item.endItemNiin ?? '',
        description: item.description ?? '',
        notes: '',
      });
      setImagePreview(item.imageLink ?? '');
      setSelectedImageFile(null);
      setErrors({});
      setSaveError(null);
    }
  }, [item, open]);

  // Exclude the item being edited from the kit-from list
  const itemsList = templateItems
    .filter((ti) => ti.templateItemId !== item?.templateItemId)
    .map((ti) => ({
      itemId: ti.templateItemId,
      name: ti.name,
      actualName: ti.actualName ?? '',
      isKit: ti.isKit ?? false,
    }));

  function handleClose() {
    setErrors({});
    setSaveError(null);
    setImagePreview('');
    setSelectedImageFile(null);
    onClose();
  }

  async function handleSubmit() {
    if (!item) return;

    const newErrors: Record<string, boolean> = {};
    if (!editedProduct.productName?.trim()) newErrors.productName = true;
    if (!editedProduct.actualName?.trim()) newErrors.actualName = true;
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    let imageBase64: string | null | undefined;
    if (selectedImageFile) {
      const reader = new FileReader();
      imageBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedImageFile);
      });
    } else if (!imagePreview && item.imageLink) {
      // Image was removed
      imageBase64 = null;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await updateTemplateItem(templateId, item.templateItemId, {
        name: editedProduct.productName,
        actualName: editedProduct.actualName || null,
        description: editedProduct.description || null,
        isKit: editedProduct.isKit ?? false,
        parent: editedProduct.parent ?? null,
        nsn: editedProduct.nsn || null,
        liin: editedProduct.liin || null,
        endItemNiin: editedProduct.endItemNiin || null,
        imageBase64,
      });
      handleClose();
      onSuccess();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update template item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Template Item</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <ImagePanel
            imagePreview={imagePreview}
            setImagePreview={setImagePreview}
            setSelectedImageFile={setSelectedImageFile}
            isEditMode={true}
            isCreateMode={false}
          />
          <ItemDetailsForm
            editedProduct={editedProduct}
            setEditedProduct={setEditedProduct}
            itemsList={itemsList}
            isEditMode={true}
            isCreateMode={false}
            isTemplateMode={true}
            errors={errors}
          />
        </Stack>
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
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
