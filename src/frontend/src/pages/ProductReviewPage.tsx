import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getItem, updateItem, createItem, uploadImage } from "../api/items";
import { me } from "../api/auth";
import NavBar from "../components/NavBar";

interface ItemViewModel {
  productName: string;
  actualName: string;
  description: string;
  imageLink: string;
  serialNumber: string;
  quantity: number;
  status: string;
}

const PercentageBar = () => <Box sx={{ height: 4, bgcolor: "#e0e0e0", mb: 2 }} />;

const ProductReviewPage = () => {
  const { teamId, itemId } = useParams<{ teamId: string; itemId: string }>();
  const navigate = useNavigate();
  const isCreateMode = itemId === "new";

  const [product, setProduct] = useState<ItemViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditMode, setIsEditMode] = useState(isCreateMode);
  const [editedProduct, setEditedProduct] = useState<ItemViewModel | null>(null);
  const [notes, setNotes] = useState("");
  const [damageReports, setDamageReports] = useState<string[]>([]);
  const [currentDamageReport, setCurrentDamageReport] = useState("");
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // -------------------- Fetch Item --------------------
  useEffect(() => {
    const fetchData = async () => {
      console.log("🌀 Fetching item data...");
      if (!teamId) {
        console.error("❌ Missing team ID");
        setError("Missing team ID");
        setLoading(false);
        return;
      }

      if (isCreateMode) {
        console.log("🆕 Entered Create Mode");
        const placeholder: ItemViewModel = {
          productName: "",
          actualName: "",
          description: "",
          imageLink:
            "https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=800",
          serialNumber: "",
          quantity: 1,
          status: "Incomplete",
        };
        setProduct(placeholder);
        setEditedProduct(placeholder);
        setImagePreview(placeholder.imageLink);
        setLoading(false);
        console.log("✅ Placeholder item set for new item creation");
        return;
      }

      if (!itemId) {
        console.error("❌ Missing item ID");
        setError("Missing item ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log(`📡 Calling getItem(${teamId}, ${itemId})`);
        const result = await getItem(teamId, itemId);
        console.log("🧩 getItem result:", result);

        if (result.success && result.item) {
          const itemData: ItemViewModel = {
            productName: result.item.name,
            actualName: result.item.actualName || result.item.name,
            description: result.item.description || "",
            imageLink: result.item.imageLink || "",
            serialNumber: result.item.serialNumber || "",
            quantity: result.item.quantity || 1,
            status: result.item.status || "Found",
          };
          console.log("✅ Item loaded:", itemData);
          setProduct(itemData);
          setEditedProduct(itemData);
          setNotes(itemData.description);
          setImagePreview(itemData.imageLink);
        } else {
          console.warn("⚠️ Item not found:", result.error);
          setError(result.error || "Item not found");
        }
      } catch (err) {
        console.error("❌ Error fetching item:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId, itemId, isCreateMode]);

  // -------------------- Helpers --------------------
  const handleFieldChange = (field: keyof ItemViewModel, value: string | number) => {
    console.log(`✏️ Field updated: ${field} =`, value);
    if (editedProduct) {
      setEditedProduct({ ...editedProduct, [field]: value });
    }
  };

  const handleAddDamageReport = () => {
    if (currentDamageReport.trim()) {
      console.log("➕ Adding damage report:", currentDamageReport);
      setDamageReports((prev) => [...prev, currentDamageReport.trim()]);
      setCurrentDamageReport("");
    }
  };

  const handleRemoveDamageReport = (index: number) => {
    console.log("🗑️ Removing damage report:", index);
    setDamageReports((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file");
        return;
      }
      console.log("🖼️ Image selected:", file.name);
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToS3 = async (file: File): Promise<string> => {
    console.log("🚀 Starting upload to S3:", file.name);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          const nsn =
            editedProduct?.serialNumber ||
            (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 12));
          console.log("🧾 Uploading with NSN:", nsn);
          const res = await uploadImage(teamId!, nsn, base64Data);
          console.log("✅ Upload success:", res);
          if (!res.success) throw new Error(res.error || "Upload failed");
          resolve(res.imageLink);
        } catch (err) {
          console.error("❌ Upload failed:", err);
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  // -------------------- Save Handler --------------------
  const handleSave = async () => {
    console.log("💾 handleSave triggered");
    if (!teamId || !editedProduct) {
      console.error("❌ Missing required data before save");
      alert("Missing required data");
      return;
    }

    if (editedProduct.status === "Damaged" && damageReports.length === 0) {
      console.warn("⚠️ Attempted to save damaged item without reports");
      setShowError(true);
      return;
    }

    try {
      const currentUser = await me();
      const userId = currentUser?.userId || "unknown-user";
      console.log("👤 Authenticated user:", userId);

      let finalImageUrl = editedProduct.imageLink;
      if (selectedImageFile) {
        try {
          finalImageUrl = await uploadImageToS3(selectedImageFile);
          console.log("🖼️ Image uploaded. URL:", finalImageUrl);
        } catch (err) {
          console.error("❌ Image upload error:", err);
          alert("Image upload failed.");
          return;
        }
      }

      if (isCreateMode) {
        console.log("🆕 Creating new item...");
        const result = await createItem(
          teamId,
          editedProduct.productName,
          editedProduct.actualName,
          editedProduct.serialNumber,
          editedProduct.serialNumber,
          userId,
          finalImageUrl
        );
        console.log("📤 Create result:", result);

        if (result.success) {
          console.log("✅ Item created successfully:", result.itemId);
          setShowSuccess(true);
          setTimeout(
            () =>
              navigate(`/teams/${teamId}/items/${result.itemId}`, {
                replace: true,
              }),
            1500
          );
        } else {
          console.error("❌ Create failed:", result.error);
          alert("Create failed: " + result.error);
        }
      } else {
        console.log("📝 Updating item:", itemId);
        const result = await updateItem(teamId, itemId!, {
          name: editedProduct.productName,
          actualName: editedProduct.actualName,
          serialNumber: editedProduct.serialNumber,
          quantity: editedProduct.quantity,
          description: notes,
          imageLink: finalImageUrl,
          status: editedProduct.status,
          damageReports,
        });
        console.log("📤 Update result:", result);

        if (result.success) {
          console.log("✅ Item updated successfully!");
          setProduct({ ...editedProduct, description: notes });
          setIsEditMode(false);
          setShowSuccess(true);
        } else {
          console.error("❌ Update failed:", result.error);
          alert("Update failed: " + result.error);
        }
      }
    } catch (err) {
      console.error("❌ Save process crashed:", err);
      alert("Failed to save item.");
    }
  };

  const handleCancel = () => {
    console.log("↩️ Cancel changes");
    if (product) {
      setEditedProduct(product);
      setNotes(product.description);
      setSelectedImageFile(null);
      setImagePreview(product.imageLink);
      setIsEditMode(false);
    }
  };

  // -------------------- UI --------------------
  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );

  if (error)
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );

  if (!product || !editedProduct)
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="info">No product data available</Alert>
      </Container>
    );

  return (
    <div>
      <PercentageBar />
      <Container maxWidth="md" sx={{ px: { xs: 0, sm: 2, md: 3 }, pb: 10 }}>
        <Box sx={{ mb: 2, pt: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => {
              console.log("⬅️ Back clicked");
              navigate(-1);
            }}
            sx={{
              textTransform: "none",
              color: "text.secondary",
              "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
            }}
          >
            Back
          </Button>
        </Box>

        <Card>
          <Box sx={{ position: "relative" }}>
            <CardMedia
              component="img"
              image={imagePreview}
              alt={editedProduct.productName}
              sx={{ maxHeight: "45vh", objectFit: "contain", bgcolor: "#f5f5f5" }}
            />
            {isEditMode && (
              <Box sx={{ position: "absolute", bottom: 8, right: 8 }}>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleImageChange}
                />
                <label htmlFor="image-upload">
                  <Button component="span" variant="contained" size="small" startIcon={<EditIcon />}>
                    Change Image
                  </Button>
                </label>
              </Box>
            )}
          </Box>

          <CardContent>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
              {isCreateMode ? "Create New Item" : editedProduct.productName}
            </Typography>

            {isEditMode && (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label="Product Name"
                  value={editedProduct.productName}
                  onChange={(e) => handleFieldChange("productName", e.target.value)}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Item Name"
                  value={editedProduct.actualName}
                  onChange={(e) => handleFieldChange("actualName", e.target.value)}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Serial Number"
                  value={editedProduct.serialNumber}
                  onChange={(e) => handleFieldChange("serialNumber", e.target.value)}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Quantity"
                  type="number"
                  value={editedProduct.quantity}
                  onChange={(e) => handleFieldChange("quantity", parseInt(e.target.value) || 0)}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={editedProduct.description}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  sx={{ mb: 2 }}
                />
              </>
            )}

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              sx={{ mb: 2 }}
            />

            {!isCreateMode && (
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <Select
                  value={editedProduct.status}
                  onChange={(e) => handleFieldChange("status", e.target.value)}
                >
                  <MenuItem value="Incomplete">Incomplete</MenuItem>
                  <MenuItem value="Found">Found</MenuItem>
                  <MenuItem value="Damaged">Damaged</MenuItem>
                  <MenuItem value="Missing">Missing</MenuItem>
                  <MenuItem value="In Repair">In Repair</MenuItem>
                </Select>
              </FormControl>
            )}

            {editedProduct.status === "Damaged" && (
              <Box sx={{ mb: 2, p: 2, bgcolor: "#fff3e0", borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Damage Reports
                </Typography>
                {damageReports.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                    No damage reports added yet
                  </Typography>
                ) : (
                  damageReports.map((report, i) => (
                    <Chip
                      key={i}
                      label={report}
                      onDelete={() => handleRemoveDamageReport(i)}
                      deleteIcon={<DeleteIcon />}
                      sx={{ m: 0.5 }}
                    />
                  ))
                )}
                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={currentDamageReport}
                    onChange={(e) => setCurrentDamageReport(e.target.value)}
                    placeholder="Describe damage..."
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddDamageReport();
                      }
                    }}
                  />
                  <Button variant="outlined" onClick={handleAddDamageReport}>
                    Add
                  </Button>
                </Box>
              </Box>
            )}

            <Button
              fullWidth
              variant="contained"
              sx={{ mt: 2, bgcolor: "#6ec972", "&:hover": { bgcolor: "#39c03f" } }}
              onClick={handleSave}
            >
              {isCreateMode ? "Create Item" : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        <Snackbar open={showError} autoHideDuration={4000} onClose={() => setShowError(false)}>
          <Alert severity="error">Add at least one damage report</Alert>
        </Snackbar>

        <Snackbar open={showSuccess} autoHideDuration={3000} onClose={() => setShowSuccess(false)}>
          <Alert severity="success">Item updated successfully!</Alert>
        </Snackbar>
      </Container>
      <NavBar />
    </div>
  );
};

export default ProductReviewPage;
