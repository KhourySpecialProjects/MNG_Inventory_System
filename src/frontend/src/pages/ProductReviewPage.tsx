import React, { useEffect, useState } from 'react';
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
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';

interface ItemViewModel {
  productName: string;
  actualName: string;
  level: string;
  description: string;
  imageLink: string;
  serialNumber: string;
  AuthQuantity: number;
}

interface ProductCardProps {
  product: ItemViewModel;
}

const FAKE_ITEM: ItemViewModel = {
  productName: "M4 Carbine Rifle",
  actualName: "5.56mm Rifle, M4A1",
  level: "Sensitive",
  description: "Standard issue carbine rifle for infantry units. Regular maintenance required.",
  imageLink: "https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=800",
  serialNumber: "W123456789",
  AuthQuantity: 1
};

const PercentageBar = () => <Box sx={{ height: 4, bgcolor: '#e0e0e0', mb: 2 }} />;
const NavBar = () => <Box sx={{ height: 56, bgcolor: '#f5f5f5', position: 'fixed', bottom: 0, left: 0, right: 0 }} />;

const ProductCard = ({ product: initialProduct }: ProductCardProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [product, setProduct] = useState(initialProduct);
  const [status, setStatus] = useState('Found');
  const [notes, setNotes] = useState(initialProduct.description);
  const [damageReports, setDamageReports] = useState<string[]>([]);
  const [currentDamageReport, setCurrentDamageReport] = useState('');
  const [showError, setShowError] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(initialProduct.imageLink);

  const handleFieldChange = (field: keyof ItemViewModel, value: string | number) => {
    setProduct(prev => ({ ...prev, [field]: value }));
  };

  const handleAddDamageReport = () => {
    if (currentDamageReport.trim()) {
      setDamageReports(prev => [...prev, currentDamageReport.trim()]);
      setCurrentDamageReport('');
    }
  };

  const handleRemoveDamageReport = (index: number) => {
    setDamageReports(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }

      setSelectedImageFile(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToS3 = async (file: File): Promise<string> => {
    // TODO: Implement S3 upload logic
    // This is a placeholder for the actual S3 upload implementation
    // Return the S3 URL after upload
    console.log('Uploading file to S3:', file.name);

    // Placeholder - replace with actual S3 upload
    // const formData = new FormData();
    // formData.append('file', file);
    // const response = await fetch('/api/upload-to-s3', {
    //   method: 'POST',
    //   body: formData
    // });
    // const data = await response.json();
    // return data.s3Url;

    return 'https://example-bucket.s3.amazonaws.com/' + file.name;
  };

  const handleSave = async () => {
    // Check if status is Damaged and no damage reports
    if (status === 'Damaged' && damageReports.length === 0) {
      setShowError(true);
      return;
    }

    // Upload image to S3 if a new image was selected
    let finalImageUrl = product.imageLink;
    if (selectedImageFile) {
      try {
        finalImageUrl = await uploadImageToS3(selectedImageFile);
        handleFieldChange('imageLink', finalImageUrl);
      } catch (error) {
        console.error('Failed to upload image:', error);
        alert('Failed to upload image. Please try again.');
        return;
      }
    }

    // TODO: Implement save logic with API
    console.log('Saving product:', { ...product, imageLink: finalImageUrl });
    console.log('Status:', status);
    console.log('Notes:', notes);
    console.log('Damage Reports:', damageReports);
    setIsEditMode(false);
    setSelectedImageFile(null);
  };

  const handleCancel = () => {
    setProduct(initialProduct);
    setNotes(initialProduct.description);
    setSelectedImageFile(null);
    setImagePreview(initialProduct.imageLink);
    setIsEditMode(false);
  };

  return (
    <div>
      <PercentageBar />
      <Container maxWidth="md" sx={{
        px: { xs: 0, sm: 2, md: 3 },
        pb: 10,
      }}>
        <Card sx={{
          '&:hover': {
            transform: 'none',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }
        }}>
          {/* Product Image */}
          <Box sx={{ position: 'relative' }}>
            <CardMedia
              component="img"
              image={imagePreview}
              alt={product.productName}
              sx={{
                maxHeight: '45vh',
                objectFit: 'contain',
                bgcolor: '#f5f5f5'
              }}
            />
            {isEditMode && (
              <Box sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                display: 'flex',
                gap: 1
              }}>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="image-upload-button"
                  type="file"
                  onChange={handleImageChange}
                />
                <label htmlFor="image-upload-button">
                  <Button
                    variant="contained"
                    component="span"
                    size="small"
                    startIcon={<EditIcon />}
                    sx={{
                      bgcolor: 'rgba(255, 255, 255, 0.95)',
                      color: 'primary.main',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 1)',
                      },
                      textTransform: 'none',
                      boxShadow: 2
                    }}
                  >
                    Change Image
                  </Button>
                </label>
              </Box>
            )}
          </Box>

          <CardContent>
            {/* Edit Mode Toggle */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              {!isEditMode ? (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => setIsEditMode(true)}
                  sx={{
                    textTransform: 'none',
                    color: 'primary.main',
                    borderColor: 'primary.main'
                  }}
                >
                  Edit
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleCancel}
                  sx={{
                    textTransform: 'none',
                    color: 'error.main',
                    borderColor: 'error.main'
                  }}
                >
                  Cancel
                </Button>
              )}
            </Box>

            {/* Product Name */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Product Name:
              </Typography>
              {isEditMode ? (
                <TextField
                  fullWidth
                  value={product.productName}
                  onChange={(e) => handleFieldChange('productName', e.target.value)}
                  size="small"
                />
              ) : (
                <Typography variant="h6" fontWeight="bold">
                  {product.productName}
                </Typography>
              )}
            </Box>

            {/* Actual Name */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Actual Name:
              </Typography>
              {isEditMode ? (
                <TextField
                  fullWidth
                  value={product.actualName}
                  onChange={(e) => handleFieldChange('actualName', e.target.value)}
                  size="small"
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {product.actualName}
                </Typography>
              )}
            </Box>

            {/* Description */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Description:
              </Typography>
              {isEditMode ? (
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={product.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  size="small"
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {product.description}
                </Typography>
              )}
            </Box>

            {/* Selected Image File Indicator */}
            {isEditMode && selectedImageFile && (
              <Box sx={{ mb: 2, p: 1, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                <Typography variant="body2" color="primary">
                  New image selected: {selectedImageFile.name}
                </Typography>
              </Box>
            )}

            {/* Serial Number */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Serial Number:
              </Typography>
              {isEditMode ? (
                <TextField
                  fullWidth
                  value={product.serialNumber}
                  onChange={(e) => handleFieldChange('serialNumber', e.target.value)}
                  size="small"
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {product.serialNumber || 'N/A'}
                </Typography>
              )}
            </Box>

            {/* Auth Quantity */}
            {isEditMode && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Authorized Quantity:
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  value={product.AuthQuantity}
                  onChange={(e) => handleFieldChange('AuthQuantity', parseInt(e.target.value) || 0)}
                  size="small"
                />
              </Box>
            )}

            {/* Additional Info (Read-only) */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Date Last Scanned: N/A
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last Known Location: N/A
              </Typography>
            </Box>

            {/* Notes Section */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Notes:
              </Typography>
              <TextField
                multiline
                fullWidth
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes here..."
                sx={{
                  borderRadius: 2,
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '0.75rem', sm: '0.9rem', md: '1rem' }
                  }
                }}
              />
            </Box>

            {/* Status Dropdown */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Status:
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  sx={{ bgcolor: 'white' }}
                >
                  <MenuItem value="Found">Found</MenuItem>
                  <MenuItem value="Damaged">Damaged</MenuItem>
                  <MenuItem value="Missing">Missing</MenuItem>
                  <MenuItem value="In Repair">In Repair</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Damage Reports Section (Only shows when status is Damaged) */}
            {status === 'Damaged' && (
              <Box sx={{ mb: 2, p: 2, bgcolor: '#fff3e0', borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Damage Reports:
                </Typography>

                {/* Display existing damage reports */}
                <Box sx={{ mb: 2 }}>
                  {damageReports.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No damage reports added yet
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {damageReports.map((report, index) => (
                        <Chip
                          key={index}
                          label={report}
                          onDelete={() => handleRemoveDamageReport(index)}
                          deleteIcon={<DeleteIcon />}
                          sx={{ width: '100%', justifyContent: 'space-between' }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>

                {/* Add new damage report */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={currentDamageReport}
                    onChange={(e) => setCurrentDamageReport(e.target.value)}
                    placeholder="Describe damage..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDamageReport();
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleAddDamageReport}
                    sx={{ textTransform: 'none', minWidth: 'auto', px: 2 }}
                  >
                    Add
                  </Button>
                </Box>
              </Box>
            )}

            {/* Save Button */}
            <Button
              variant="contained"
              fullWidth
              onClick={handleSave}
              sx={{
                mt: 2,
                bgcolor: '#6ec972',
                '&:hover': { bgcolor: '#39c03f' },
                textTransform: 'none',
                fontWeight: 'bold'
              }}
            >
              Save
            </Button>
          </CardContent>
        </Card>

        {/* Error Snackbar */}
        <Snackbar
          open={showError}
          autoHideDuration={4000}
          onClose={() => setShowError(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setShowError(false)}
            severity="error"
            sx={{ width: '100%' }}
          >
            Please add at least one damage report before saving
          </Alert>
        </Snackbar>
      </Container>
      <NavBar />
    </div>
  );
};

const ProductDisplay = () => {
  const [product, setProduct] = useState<ItemViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        setProduct(FAKE_ITEM);

        // Fetch item data (TODO comment back in when api works!)
        // const itemData = await getItem();
        // if (itemData) {
        //   setProduct(itemData);
        // }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!product) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="info">No product data available</Alert>
      </Container>
    );
  }

  return <ProductCard product={product} />;
};

export default ProductDisplay;