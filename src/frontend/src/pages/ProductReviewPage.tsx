/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardHeader,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  Link as MLink,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import ImageNotSupportedIcon from "@mui/icons-material/ImageNotSupported";
import DeleteIcon from "@mui/icons-material/Delete";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CancelIcon from "@mui/icons-material/Cancel";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SettingsBackupRestoreIcon from "@mui/icons-material/SettingsBackupRestore";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import {
  getItem,
  getItems,
  createItem,
  updateItem,
  uploadImage,
  deleteItem,
} from "../api/items";
import NavBar from "../components/NavBar";

/** ============================= Types ============================= */
interface ItemViewModel {
  productName: string;
  actualName: string;
  description: string;
  imageLink: string;
  serialNumber: string; // used for nsn+serial for backend
  quantity: number;
  status: string;
  parent?: any | null;
  children?: any[];
}

type FieldErrors = Record<string, boolean>;

type ApiResult<T = any> = {
  success: boolean;
  item?: T;
  items?: T[];
  itemId?: string;
  error?: string;
  imageLink?: string | null;
};

/** ============================= Constants ============================= */
const STATUSES = ["Incomplete", "Found", "Damaged", "Missing", "In Repair"] as const;
const NO_IMAGE_BG = "#f5f5f5";

const PercentageBar = () => <Box sx={{ height: 4, bgcolor: "#e0e0e0", mb: 2 }} />;

/** Badge by status */
const StatusChip: React.FC<{ value?: string }> = ({ value }) => {
  if (!value) return null;
  let color:
    | "default"
    | "success"
    | "error"
    | "warning"
    | "info"
    | "primary"
    | "secondary" = "default";
  if (value === "Found") color = "success";
  else if (value === "Damaged") color = "error";
  else if (value === "Missing") color = "warning";
  else if (value === "In Repair") color = "info";
  else color = "default";
  return <Chip size="small" label={value} color={color} sx={{ ml: 1 }} />;
};

/** ============================= Helpers ============================= */
function flattenTree(items: any[]): any[] {
  const out: any[] = [];
  const walk = (list: any[]) => {
    for (const i of list) {
      out.push(i);
      if (i.children?.length) walk(i.children);
    }
  };
  walk(items);
  return out;
}

function copyToClipboard(text: string) {
  try {
    void navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

/** ============================= Main Component ============================= */
const ProductReviewPage: React.FC = () => {
  const { teamId, itemId } = useParams<{ teamId: string; itemId: string }>();
  const navigate = useNavigate();
  const isCreateMode = itemId === "new";

  /** Data */
  const [product, setProduct] = useState<ItemViewModel | null>(null);
  const [editedProduct, setEditedProduct] = useState<ItemViewModel | null>(null);
  const [itemsList, setItemsList] = useState<any[]>([]);
  const [notes, setNotes] = useState("");

  /** Image */
  const [imagePreview, setImagePreview] = useState<string>("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** UX */
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(isCreateMode);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showErrorBar, setShowErrorBar] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  /** Validation */
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [damageReports, setDamageReports] = useState<string[]>([]);
  const [currentDamageReport, setCurrentDamageReport] = useState("");

  /** ============================= Effects: Load ============================= */
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!teamId) throw new Error("Missing team ID");

        // Parent list
        const all: ApiResult = await getItems(teamId);
        if (all.success && Array.isArray(all.items)) {
          const flat = flattenTree(all.items);
          setItemsList(flat.filter((x: any) => x.itemId !== itemId));
        }

        if (isCreateMode) {
          const draft: ItemViewModel = {
            productName: "",
            actualName: "",
            description: "",
            imageLink: "",
            serialNumber: "",
            quantity: 1,
            status: "Incomplete",
            parent: null,
            children: [],
          };
          setProduct(draft);
          setEditedProduct(draft);
          setNotes("");
          setImagePreview(""); // no preset image
          return;
        }

        // Existing item
        const res: ApiResult = await getItem(teamId, itemId!);
        if (!res.success || !res.item) throw new Error(res.error || "Item not found");

        const i = res.item;
        const mapped: ItemViewModel = {
          productName: i.name,
          actualName: i.actualName || i.name,
          description: i.description || "",
          imageLink: i.imageLink || "",
          serialNumber: i.serialNumber || "",
          quantity: i.quantity || 1,
          status: i.status || "Incomplete",
          parent: i.parent || null,
          children: i.children || [],
        };
        setProduct(mapped);
        setEditedProduct(mapped);
        setNotes(mapped.description);
        setImagePreview(mapped.imageLink || "");
        if (Array.isArray(i.damageReports)) setDamageReports(i.damageReports);
      } catch (err: any) {
        setError(err.message || "Failed to load item");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teamId, itemId, isCreateMode]);

  /** ============================= Derived ============================= */
  const canSave = useMemo(() => {
    if (!editedProduct) return false;
    const required = ["productName", "actualName", "serialNumber", "description"] as const;
    const missingText = required.some((k) => !editedProduct[k]);
    const requireImage = isCreateMode && !selectedImageFile; // enforce image on create
    return !missingText && !requireImage;
  }, [editedProduct, isCreateMode, selectedImageFile]);

  /** ============================= Handlers ============================= */
  const handleFieldChange = (field: keyof ItemViewModel, value: any) => {
    if (!editedProduct) return;
    setEditedProduct({ ...editedProduct, [field]: value });
    setFieldErrors((prev) => ({ ...prev, [field]: false }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(String(reader.result || ""));
    reader.readAsDataURL(file);
    setFieldErrors((prev) => ({ ...prev, imageLink: false }));
  };

  const triggerPickImage = () => fileInputRef.current?.click();

  const handleAddDamageReport = () => {
    const v = currentDamageReport.trim();
    if (!v) return;
    setDamageReports((d) => [...d, v]);
    setCurrentDamageReport("");
  };

  const handleRemoveDamageReport = (idx: number) => {
    setDamageReports((d) => d.filter((_, i) => i !== idx));
  };

  const uploadImageToS3 = async (file: File): Promise<string> => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onloadend = async () => {
        try {
          const base64 = String(reader.result || "");
          // nsn: use serialNumber consistently
          const nsn = editedProduct?.serialNumber || Math.random().toString(36).slice(2, 10);
          const res: ApiResult = await uploadImage(teamId!, nsn, base64);
          if (!res.success || !res.imageLink) throw new Error(res.error || "Upload failed");
          resolve(res.imageLink!);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const validateBeforeSave = (): boolean => {
    if (!editedProduct) return false;
    const required: (keyof ItemViewModel)[] = [
      "productName",
      "actualName",
      "serialNumber",
      "description",
    ];
    const errs: FieldErrors = {};
    for (const k of required) {
      if (!editedProduct[k]) errs[k as string] = true;
    }
    if (isCreateMode && !selectedImageFile) errs.imageLink = true;

    if (editedProduct.status === "Damaged" && damageReports.length === 0) {
      setShowErrorBar(true);
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0 && !(editedProduct.status === "Damaged" && damageReports.length === 0);
  };

  const handleSave = async () => {
    if (!teamId || !editedProduct) return;
    if (!validateBeforeSave()) return;

    try {
      setBusy(true);

      let finalImage = editedProduct.imageLink;
      if (selectedImageFile) {
        finalImage = await uploadImageToS3(selectedImageFile);
      }

      if (isCreateMode) {
        // name, actualName, nsn, serialNumber (you’re using serialNumber both places)
        const res: ApiResult = await createItem(
          teamId,
          editedProduct.productName,
          editedProduct.actualName,
          editedProduct.serialNumber, // nsn
          editedProduct.serialNumber, // serialNumber
          undefined,
          finalImage
        );

        if (!res.success) throw new Error(res.error || "Create failed");
        // Some implementations return { itemId }, others return item: {...}
        const newId = (res.item?.itemId as string) || (res.itemId as string);
        setShowSuccess(true);
        setTimeout(() => {
          navigate(`/teams/${teamId}/items/${newId}`, { replace: true });
        }, 1200);
      } else {
        // update item
        const res: ApiResult = await updateItem(teamId, itemId!, {
          name: editedProduct.productName,
          actualName: editedProduct.actualName,
          nsn: editedProduct.serialNumber,
          serialNumber: editedProduct.serialNumber,
          quantity: editedProduct.quantity,
          description: editedProduct.description,
          imageLink: finalImage,
          status: editedProduct.status,
          parent: editedProduct.parent?.itemId || null,
          damageReports,
        });
        if (!res.success) throw new Error(res.error || "Update failed");
        setProduct(editedProduct);
        setIsEditMode(false);
        setShowSuccess(true);
      }
    } catch (err) {
      console.error("[save] error:", err);
      setError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelEdit = () => {
    if (product) {
      setEditedProduct(product);
      setImagePreview(product.imageLink || "");
      setSelectedImageFile(null);
      setFieldErrors({});
    }
    setIsEditMode(false);
  };

  const handleDelete = async () => {
    if (!teamId || !itemId) return;
    try {
      setBusy(true);
      const res: ApiResult = await deleteItem(teamId, itemId);
      if (!res.success) throw new Error(res.error || "Delete failed");
      navigate(`/teams/${teamId}/items`, { replace: true });
    } catch (err) {
      console.error("[delete] error:", err);
      setError(err instanceof Error ? err.message : "Failed to delete item");
    } finally {
      setBusy(false);
      setDeleteOpen(false);
    }
  };

  /** ============================= Render Helpers ============================= */
  const renderChildren = (children: any[], level = 0): React.ReactNode => {
    if (!children?.length) return null;
    return (
      <Stack spacing={1} sx={{ ml: level * 2 }}>
        {children.map((child: any) => (
          <Box key={child.itemId}>
            <Card
              variant="outlined"
              sx={{
                p: 1.25,
                cursor: "pointer",
                bgcolor: level === 0 ? "white" : `rgba(25,118,210,${0.05 * (level + 1)})`,
                borderLeft: level > 0 ? `3px solid rgba(25,118,210,${0.25 + level * 0.15})` : "none",
                "&:hover": { bgcolor: "#eaf3ff" },
              }}
              onClick={() => navigate(`/teams/${teamId}/items/${child.itemId}`)}
            >
              <Typography variant="body2" fontWeight={600}>
                {"  ".repeat(level)}├─ {child.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {"  ".repeat(level)} {child.actualName || child.name}
              </Typography>
              {child.status && <StatusChip value={child.status} />}
            </Card>
            {child.children?.length ? renderChildren(child.children, level + 1) : null}
          </Box>
        ))}
      </Stack>
    );
  };

  const ImagePanel = (
    <Box sx={{ position: "relative", bgcolor: NO_IMAGE_BG, minHeight: 240 }}>
      {loading ? (
        <Skeleton variant="rectangular" height={320} />
      ) : imagePreview ? (
        <CardMedia
          component="img"
          image={imagePreview}
          alt={editedProduct?.productName || "Item image"}
          sx={{ maxHeight: "45vh", objectFit: "contain" }}
        />
      ) : (
        <Box display="flex" alignItems="center" justifyContent="center" height={240}>
          <Stack alignItems="center" spacing={1}>
            <ImageNotSupportedIcon sx={{ fontSize: 64, color: "gray" }} />
            <Typography variant="caption" color="text.secondary">
              No image available
            </Typography>
          </Stack>
        </Box>
      )}

      {isEditMode && (
        <Box sx={{ position: "absolute", bottom: 8, right: 8 }}>
          <input
            ref={fileInputRef}
            id="image-upload"
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageChange}
          />
          <Stack direction="row" spacing={1}>
            <Button
              onClick={triggerPickImage}
              variant="contained"
              size="small"
              startIcon={<AddPhotoAlternateIcon />}
            >
              {imagePreview ? "Change Image" : "Add Image"}
            </Button>
            {isCreateMode && fieldErrors.imageLink && (
              <Tooltip title="Image is required for new items">
                <Avatar sx={{ width: 28, height: 28, bgcolor: "warning.main" }}>
                  <WarningAmberIcon fontSize="small" />
                </Avatar>
              </Tooltip>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );

  /** ============================= Loading & Errors ============================= */
  if (loading) {
    return (
      <Box minHeight="60vh" display="flex" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Box mt={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Back
          </Button>
        </Box>
      </Container>
    );
  }

  if (!product || !editedProduct) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="info">No product data available</Alert>
        <Box mt={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Back
          </Button>
        </Box>
      </Container>
    );
  }

  /** ============================= Render ============================= */
  return (
    <div>
      <PercentageBar />

      <Container maxWidth="lg" sx={{ px: { xs: 0, sm: 2, md: 3 }, pb: 12 }}>
        {/* Breadcrumbs / Back */}
        <Box sx={{ mb: 2, pt: 2, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{ textTransform: "none", color: "text.secondary", "&:hover": { bgcolor: "rgba(0,0,0,0.04)" } }}
          >
            Back
          </Button>
          <Breadcrumbs separator="›" sx={{ ml: 1 }}>
            <MLink component={RouterLink} to="/teams" underline="hover" color="inherit">
              Teams
            </MLink>
            {teamId && (
              <MLink component={RouterLink} to={`/teams/${teamId}/items`} underline="hover" color="inherit">
                Items
              </MLink>
            )}
            <Typography color="text.primary">
              {isCreateMode ? "New Item" : editedProduct.productName || "Item"}
            </Typography>
          </Breadcrumbs>
        </Box>

        {/* Header Card */}
        <Card sx={{ mb: 2 }} variant="outlined">
          <CardHeader
            avatar={<Avatar><Inventory2OutlinedIcon /></Avatar>}
            title={
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                <Typography variant="h6" fontWeight={700}>
                  {isCreateMode ? "Create New Item" : editedProduct.productName}
                </Typography>
                {!isCreateMode && <StatusChip value={editedProduct.status} />}
              </Stack>
            }
            subheader={
              editedProduct.actualName ? (
                <Typography variant="body2" color="text.secondary">
                  {editedProduct.actualName}
                </Typography>
              ) : null
            }
            action={
              !isCreateMode && (
                <Stack direction="row" spacing={1} alignItems="center">
                  {!isEditMode ? (
                    <>
                      <Tooltip title="Edit">
                        <IconButton onClick={() => setIsEditMode(true)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton color="error" onClick={() => setDeleteOpen(true)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : (
                    <>
                      <Tooltip title="Cancel">
                        <span>
                          <IconButton onClick={handleCancelEdit} disabled={busy}>
                            <CancelIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Save">
                        <span>
                          <IconButton color="primary" onClick={handleSave} disabled={busy || !canSave}>
                            <SaveIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  )}
                </Stack>
              )
            }
          />

          {/* Image */}
          {ImagePanel}
        </Card>

        {/* Body */}
        <Grid container spacing={2}>
          {/* Left: Details */}
          <Grid item xs={12} md={7}>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardHeader
                title="Details"
                action={
                  !isCreateMode && !isEditMode ? (
                    <Button size="small" variant="outlined" onClick={() => setIsEditMode(true)} startIcon={<EditIcon />}>
                      Edit
                    </Button>
                  ) : null
                }
              />
              <CardContent>
                {isEditMode || isCreateMode ? (
                  <>
                    <TextField
                      fullWidth
                      size="small"
                      label="Product Name"
                      value={editedProduct.productName}
                      onChange={(e) => handleFieldChange("productName", e.target.value)}
                      sx={{ mb: 2 }}
                      error={fieldErrors.productName}
                      helperText={fieldErrors.productName ? "Required" : ""}
                      required
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Item Name"
                      value={editedProduct.actualName}
                      onChange={(e) => handleFieldChange("actualName", e.target.value)}
                      sx={{ mb: 2 }}
                      error={fieldErrors.actualName}
                      helperText={fieldErrors.actualName ? "Required" : ""}
                      required
                    />
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Serial Number (NSN)"
                        value={editedProduct.serialNumber}
                        onChange={(e) => handleFieldChange("serialNumber", e.target.value)}
                        error={fieldErrors.serialNumber}
                        helperText={fieldErrors.serialNumber ? "Required" : ""}
                        required
                      />
                      {!!editedProduct.serialNumber && (
                        <Tooltip title="Copy">
                          <IconButton onClick={() => copyToClipboard(editedProduct.serialNumber)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                    <TextField
                      fullWidth
                      size="small"
                      label="Quantity"
                      type="number"
                      inputProps={{ min: 0 }}
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
                      error={fieldErrors.description}
                      helperText={fieldErrors.description ? "Required" : ""}
                      required
                    />
                    <Autocomplete
                      options={itemsList}
                      getOptionLabel={(option: any) => `${option.name} (${option.actualName || "No name"})`}
                      value={editedProduct.parent || null}
                      onChange={(_e, val) => handleFieldChange("parent", val)}
                      isOptionEqualToValue={(o, v) => o.itemId === v?.itemId}
                      renderInput={(params) => (
                        <TextField {...params} label="Kit From" placeholder="Select parent item" />
                      )}
                      sx={{ mb: 2 }}
                    />
                  </>
                ) : (
                  <>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Item Name
                        </Typography>
                        <Typography variant="body1">{editedProduct.actualName || "-"}</Typography>
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Serial Number (NSN)
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body1">{editedProduct.serialNumber || "—"}</Typography>
                          {!!editedProduct.serialNumber && (
                            <Tooltip title="Copy">
                              <IconButton onClick={() => copyToClipboard(editedProduct.serialNumber)}>
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Quantity
                        </Typography>
                        <Typography variant="body1">{editedProduct.quantity}</Typography>
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Description
                        </Typography>
                        <Typography variant="body1">
                          {editedProduct.description || <em>No description</em>}
                        </Typography>
                      </Box>

                      {editedProduct.parent && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary">
                            Part of Kit
                          </Typography>
                          <Typography variant="body1">{editedProduct.parent.name || "Unknown Kit"}</Typography>
                        </Box>
                      )}
                    </Stack>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardHeader title="Notes" />
              <CardContent>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </CardContent>
            </Card>

            {/* Damage Reports */}
            {(isEditMode || editedProduct.status === "Damaged") && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardHeader
                  title={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        Damage Reports
                      </Typography>
                      <Tooltip title="Add details about item damage">
                        <InfoOutlinedIcon fontSize="small" />
                      </Tooltip>
                    </Stack>
                  }
                />
                <CardContent>
                  {editedProduct.status !== "Damaged" ? (
                    <Alert severity="info" icon={<AutoFixHighIcon />}>
                      Only required when status is <b>Damaged</b>.
                    </Alert>
                  ) : damageReports.length === 0 ? (
                    <Alert severity="warning" icon={<WarningAmberIcon />}>
                      No damage reports added yet
                    </Alert>
                  ) : (
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                      {damageReports.map((r, i) => (
                        <Chip
                          key={`${r}-${i}`}
                          label={r}
                          onDelete={isEditMode ? () => handleRemoveDamageReport(i) : undefined}
                          deleteIcon={isEditMode ? <DeleteIcon /> : undefined}
                          sx={{ m: 0.3 }}
                          color="warning"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  )}

                  {isEditMode && (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Describe damage..."
                        value={currentDamageReport}
                        onChange={(e) => setCurrentDamageReport(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddDamageReport();
                          }
                        }}
                      />
                      <Button variant="outlined" onClick={handleAddDamageReport}>
                        Add
                      </Button>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* Right: Status, Kit, Children */}
          <Grid item xs={12} md={5}>
            {/* Status */}
            {!isCreateMode && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardHeader title="Status" />
                <CardContent>
                  {isEditMode ? (
                    <FormControl fullWidth size="small">
                      <Select
                        value={editedProduct.status}
                        onChange={(e) => handleFieldChange("status", e.target.value)}
                      >
                        {STATUSES.map((s) => (
                          <MenuItem key={s} value={s}>
                            {s}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body1">{editedProduct.status}</Typography>
                      <StatusChip value={editedProduct.status} />
                    </Stack>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Kit children */}
            {!isCreateMode && editedProduct.children?.length ? (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardHeader title={`📦 Kit Contents (${editedProduct.children.length})`} />
                <CardContent>{renderChildren(editedProduct.children, 0)}</CardContent>
              </Card>
            ) : null}

            {/* Actions */}
            <Card variant="outlined" sx={{ position: "sticky", top: 16 }}>
              <CardHeader title="Actions" />
              <CardContent>
                <Stack spacing={1}>
                  {isEditMode || isCreateMode ? (
                    <>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={handleSave}
                        disabled={busy || !canSave}
                        sx={{
                          bgcolor: "#6ec972",
                          "&:hover": { bgcolor: "#39c03f" },
                        }}
                      >
                        {isCreateMode ? "Create Item" : "Save Changes"}
                      </Button>
                      {!isCreateMode && (
                        <Button
                          fullWidth
                          variant="outlined"
                          startIcon={<CancelIcon />}
                          onClick={handleCancelEdit}
                          disabled={busy}
                          sx={{ bgcolor: "#fff8e1", "&:hover": { bgcolor: "#ffecb3" } }}
                        >
                          Cancel
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => setIsEditMode(true)}
                        disabled={busy}
                      >
                        Edit
                      </Button>
                      <Button
                        fullWidth
                        color="error"
                        variant="outlined"
                        startIcon={<DeleteIcon />}
                        onClick={() => setDeleteOpen(true)}
                        disabled={busy}
                      >
                        Delete
                      </Button>
                      <Button
                        fullWidth
                        variant="text"
                        startIcon={<SettingsBackupRestoreIcon />}
                        onClick={() => {
                          setEditedProduct(product);
                          setImagePreview(product.imageLink || "");
                          setSelectedImageFile(null);
                          setFieldErrors({});
                        }}
                        disabled={busy}
                      >
                        Reset Changes
                      </Button>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Delete dialog */}
        <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
          <DialogTitle>Delete Item</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will permanently remove this item (and its children). This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button color="error" onClick={handleDelete} disabled={busy} startIcon={<DeleteIcon />}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbars */}
        <Snackbar open={showErrorBar} autoHideDuration={4000} onClose={() => setShowErrorBar(false)}>
          <Alert severity="error" icon={<WarningAmberIcon />}>
            Add at least one damage report when status is <b>Damaged</b>.
          </Alert>
        </Snackbar>

        <Snackbar open={showSuccess} autoHideDuration={2500} onClose={() => setShowSuccess(false)}>
          <Alert severity="success" icon={<CheckCircleIcon />}>
            Item saved successfully!
          </Alert>
        </Snackbar>
      </Container>

      <NavBar />
    </div>
  );
};

export default ProductReviewPage;
