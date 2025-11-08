import React from "react";
import { Button, Card, CardHeader, CardContent, Stack } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { createItem, updateItem, uploadImage, deleteItem } from "../api/items";

export default function ActionPanel({
  isCreateMode,
  isEditMode,
  setIsEditMode,
  product,
  editedProduct,
  teamId,
  itemId,
  selectedImageFile,
  imagePreview,
  setShowSuccess,
}: any) {
  const handleSave = async () => {
    try {
      let finalImage = imagePreview;
      if (selectedImageFile) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((res) => {
          reader.onloadend = () => res(reader.result as string);
          reader.readAsDataURL(selectedImageFile);
        });
        const up = await uploadImage(teamId, editedProduct.serialNumber, base64);
        finalImage = up.imageLink;
      }

      if (isCreateMode) {
        const res = await createItem(
          teamId,
          editedProduct.productName,
          editedProduct.actualName,
          editedProduct.serialNumber,
          editedProduct.serialNumber,
          undefined,
          finalImage
        );
        if (res.success) setShowSuccess(true);
      } else {
        const res = await updateItem(teamId, itemId, {
          name: editedProduct.productName,
          actualName: editedProduct.actualName,
          nsn: editedProduct.serialNumber,
          serialNumber: editedProduct.serialNumber,
          quantity: editedProduct.quantity,
          description: editedProduct.description,
          imageLink: finalImage,
          status: editedProduct.status,
          parent: editedProduct.parent?.itemId || null,
        });
        if (res.success) setShowSuccess(true);
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save item");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this item?")) return;
    await deleteItem(teamId, itemId);
  };

  return (
    <Card variant="outlined" sx={{ position: "sticky", top: 16 }}>
      <CardHeader title="Actions" />
      <CardContent>
        <Stack spacing={1}>
          {(isEditMode || isCreateMode) && (
            <>
              <Button
                fullWidth
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                sx={{ bgcolor: "#6ec972", "&:hover": { bgcolor: "#39c03f" } }}
              >
                {isCreateMode ? "Create Item" : "Save Changes"}
              </Button>
              {!isCreateMode && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={() => setIsEditMode(false)}
                  sx={{ bgcolor: "#fff8e1", "&:hover": { bgcolor: "#ffecb3" } }}
                >
                  Cancel
                </Button>
              )}
            </>
          )}
          {!isEditMode && !isCreateMode && (
            <>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setIsEditMode(true)}
              >
                Edit
              </Button>
              <Button
                fullWidth
                color="error"
                variant="outlined"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
