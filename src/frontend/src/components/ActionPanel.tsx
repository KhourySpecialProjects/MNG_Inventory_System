/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { createItem, deleteItem, updateItem, uploadImage } from "../api/items";
import { me } from "../api/auth";
import { useNavigate } from "react-router-dom";

async function getUserId(): Promise<string> {
  try {
    const user = await me();
    return user.userId;
  } catch {
    return "test-user";
  }
}

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
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await deleteItem(teamId, itemId);
      setDeleteOpen(false);
      navigate(`/teams/to-review/${teamId}`);
    } catch (err) {
      console.error("❌ Delete error:", err);
      alert("Failed to delete item");
    } finally {
      setDeleting(false);
    }
  };

  // your handleSave stays the same
  const handleSave = async (isQuickUpdate = false) => {
    try {
      const userId = await getUserId();

      let finalImage = imagePreview;
      if (selectedImageFile) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((res) => {
          reader.onloadend = () => res(reader.result as string);
          reader.readAsDataURL(selectedImageFile);
        });
        const up = await uploadImage(
          teamId,
          editedProduct.serialNumber,
          base64
        );
        finalImage = up.imageLink;
      }

      const nameValue =
        editedProduct.productName ||
        editedProduct.actualName ||
        `Item-${editedProduct.serialNumber || "Unknown"}`;

      const payload = {
        teamId,
        itemId: itemId || null,
        userId,
        name: nameValue,
        actualName: editedProduct.actualName || nameValue,
        nsn: editedProduct.nsn || editedProduct.serialNumber || "",
        serialNumber: editedProduct.serialNumber || "",
        quantity: Number(editedProduct.quantity) || 1,
        description: editedProduct.description || "",
        imageLink: finalImage || "",
        status: editedProduct.status || "To Review",
        notes: editedProduct.notes || "",
        parent: editedProduct.parent?.itemId || null,
        damageReports: editedProduct.damageReports || [],
      };

      if (isCreateMode) {
        const res = await createItem(
          teamId,
          payload.name,
          payload.actualName,
          payload.nsn,
          payload.serialNumber,
          finalImage,
          payload.description,
          payload.parent
        );
        if (res.success) {
          setShowSuccess(true);
          navigate(`/teams/to-review/${teamId}`, { replace: true });
        }
      } else {
        const res = await updateItem(teamId, itemId, payload);
        if (res.success) {
          if (!isQuickUpdate) setIsEditMode(false);
          setShowSuccess(true);
          navigate(`/teams/to-review/${teamId}`, { replace: true });
        }
      }
    } catch (err) {
      console.error("❌ Save error:", err);
      alert("Failed to save item");
    }
  };

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          position: "sticky",
          top: 16,
          borderRadius: 3,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        <CardHeader title="Actions" />
        <CardContent>
          <Stack spacing={1}>
            {(isEditMode || isCreateMode) && (
              <>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() => handleSave()}
                  sx={{
                    bgcolor: "#2e7d32",
                    "&:hover": { bgcolor: "#1b5e20" },
                    fontWeight: 600,
                  }}
                >
                  {isCreateMode ? "Create Item" : "Save Changes"}
                </Button>
                {!isCreateMode && (
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={() => setIsEditMode(false)}
                    sx={{
                      color: "#ef6c00",
                      borderColor: "#ef6c00",
                      "&:hover": { bgcolor: "#fff3e0" },
                    }}
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
                  variant="contained"
                  color="success"
                  startIcon={<SaveIcon />}
                  onClick={() => handleSave(true)}
                  sx={{
                    fontWeight: 600,
                    bgcolor: "#2e7d32",
                    "&:hover": { bgcolor: "#1b5e20" },
                  }}
                >
                  Save
                </Button>

                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  startIcon={<EditIcon />}
                  onClick={() => setIsEditMode(true)}
                  sx={{
                    bgcolor: "#1565c0",
                    "&:hover": { bgcolor: "#0d47a1" },
                    fontWeight: 600,
                  }}
                >
                  Edit
                </Button>

                <Button
                  fullWidth
                  variant="contained"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteOpen(true)}
                  sx={{
                    bgcolor: "#d32f2f",
                    "&:hover": { bgcolor: "#b71c1c" },
                    color: "white",
                    fontWeight: 600,
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* 🧩 Custom Delete Confirmation Popup */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1,
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            fontWeight: 800,
            color: "#b71c1c",
          }}
        >
          <WarningAmberIcon color="error" />
          Confirm Deletion
        </DialogTitle>

        <DialogContent dividers>
          <Typography>
            Are you sure you want to permanently delete this item? This action
            cannot be undone.
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => setDeleteOpen(false)}
            sx={{ color: "#555", fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleting}
            sx={{ fontWeight: 700 }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
