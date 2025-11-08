import React from "react";
import {
  TextField,
  Autocomplete,
  Stack,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

export default function ItemDetailsForm({
  editedProduct,
  setEditedProduct,
  itemsList,
  isEditMode,
}: {
  editedProduct: any;
  setEditedProduct: (v: any) => void;
  itemsList: any[];
  isEditMode: boolean;
}) {
  const handleChange = (field: string, value: any) => {
    setEditedProduct({ ...editedProduct, [field]: value });
  };

  const copyToClipboard = (text: string) => {
    try {
      void navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      {isEditMode ? (
        <>
          <TextField
            label="Product Name"
            size="small"
            fullWidth
            value={editedProduct.productName || ""}
            onChange={(e) => handleChange("productName", e.target.value)}
            required
          />
          <TextField
            label="Item Name"
            size="small"
            fullWidth
            value={editedProduct.actualName || ""}
            onChange={(e) => handleChange("actualName", e.target.value)}
            required
          />
          <Stack direction="row" alignItems="center" spacing={1}>
            <TextField
              label="Serial Number (NSN)"
              size="small"
              fullWidth
              value={editedProduct.serialNumber || ""}
              onChange={(e) => handleChange("serialNumber", e.target.value)}
              required
            />
            {editedProduct.serialNumber && (
              <Tooltip title="Copy">
                <IconButton onClick={() => copyToClipboard(editedProduct.serialNumber)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          <TextField
            label="Quantity"
            type="number"
            size="small"
            fullWidth
            value={editedProduct.quantity || 1}
            onChange={(e) => handleChange("quantity", parseInt(e.target.value) || 1)}
          />
          <TextField
            label="Description"
            size="small"
            fullWidth
            multiline
            rows={3}
            value={editedProduct.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            required
          />
          <Autocomplete
            options={itemsList}
            getOptionLabel={(option: any) =>
              `${option.name || ""} (${option.actualName || "No name"})`
            }
            value={editedProduct.parent || null}
            onChange={(_e, val) => handleChange("parent", val)}
            isOptionEqualToValue={(o, v) => o.itemId === v?.itemId}
            renderInput={(params) => (
              <TextField {...params} label="Kit From" placeholder="Select parent item" />
            )}
          />
        </>
      ) : (
        <>
          <Typography variant="subtitle2" color="text.secondary">
            Item Name
          </Typography>
          <Typography>{editedProduct.actualName || "-"}</Typography>
          <Typography variant="subtitle2" color="text.secondary">
            Serial Number
          </Typography>
          <Typography>{editedProduct.serialNumber || "-"}</Typography>
          <Typography variant="subtitle2" color="text.secondary">
            Quantity
          </Typography>
          <Typography>{editedProduct.quantity}</Typography>
          <Typography variant="subtitle2" color="text.secondary">
            Description
          </Typography>
          <Typography>{editedProduct.description || "No description"}</Typography>
          {editedProduct.parent && (
            <>
              <Typography variant="subtitle2" color="text.secondary">
                Part of Kit
              </Typography>
              <Typography>{editedProduct.parent.name || "Unknown Kit"}</Typography>
            </>
          )}
        </>
      )}
    </Stack>
  );
}
