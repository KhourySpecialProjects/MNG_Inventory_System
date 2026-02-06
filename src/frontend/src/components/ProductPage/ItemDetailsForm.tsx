/**
 * Comprehensive form for item/kit details with dynamic field visibility.
 * Handles kit vs. item type switching, NSN autocomplete with cross-team suggestions, and field validation.
 * Manages hierarchical parent selection, status updates, damage reports, and quantity tracking.
 */
/* eslint-disable */
import React from 'react';
import {
  TextField,
  Autocomplete,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Grid,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import WarningIcon from '@mui/icons-material/Warning';
import PendingIcon from '@mui/icons-material/Pending';
import InventoryIcon from '@mui/icons-material/Inventory';
import CategoryIcon from '@mui/icons-material/Category';
import DamageReportsSection from './DamageReportsSection';
import { getAllItemsByNSN } from '../../api/items';

interface ItemDetailsFormProps {
  editedProduct: any;
  setEditedProduct: (v: any) => void;
  itemsList: any[];
  isEditMode: boolean;
  isCreateMode?: boolean;
  alwaysEditableFields?: string[];
  damageReports?: string[];
  setDamageReports?: (r: string[]) => void;
  errors?: Record<string, boolean>;
  teamId?: string;
  setImagePreview?: (url: string) => void;
  setSelectedImageFile?: (file: File | null) => void;
}

export default function ItemDetailsForm({
  editedProduct,
  setEditedProduct,
  itemsList,
  isEditMode,
  isCreateMode = false,
  alwaysEditableFields = [],
  damageReports = [],
  setDamageReports,
  errors = {},
  teamId,
  setImagePreview,
  setSelectedImageFile,
}: ItemDetailsFormProps) {
  const [itemType, setItemType] = React.useState<'item' | 'kit'>(
    editedProduct?.isKit ? 'kit' : 'item',
  );
  const [nsnOptions, setNsnOptions] = React.useState<any[]>([]);
  const [nsnLoading, setNsnLoading] = React.useState(false);
  const [nsnInputValue, setNsnInputValue] = React.useState('');
  // const [parentError, setParentError] = React.useState(false);

  if (!editedProduct) {
    return null;
  }

  const handleChange = (field: string, value: any) => {
    setEditedProduct({ ...editedProduct, [field]: value });

    // if (field === 'parent' && value) {
    //   setParentError(false);
    // }
  };

  const handleItemTypeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newType: 'item' | 'kit' | null,
  ) => {
    if (newType !== null) {
      setItemType(newType);
      setEditedProduct({ ...editedProduct, isKit: newType === 'kit' });

      // if (newType === 'kit') {
      //   setParentError(false);
      // }
    }
  };

  const copyToClipboard = (text: string) => {
    try {
      void navigator.clipboard.writeText(text);
    } catch {}
  };

  const alwaysEditable = (field: string) => alwaysEditableFields.includes(field);

  const statuses = [
    { value: 'To Review', label: 'To Review', icon: <PendingIcon />, color: '#9e9e9e' },
    { value: 'Completed', label: 'Completed', icon: <CheckCircleIcon />, color: '#4caf50' },
    { value: 'Damaged', label: 'Damaged', icon: <ReportProblemIcon />, color: '#f44336' },
    { value: 'Shortages', label: 'Shortages', icon: <WarningIcon />, color: '#ff9800' },
  ];

  // Fetch NSN suggestions when user types
  React.useEffect(() => {
    const fetchNSNSuggestions = async () => {
      if (nsnInputValue.length >= 2) {
        setNsnLoading(true);
        try {
          const result = await getAllItemsByNSN(nsnInputValue);

          if (result.success && result.items) {
            // Filter out items from the current team
            const filteredItems = result.items.filter((item: any) => {
              const itemTeamId = item.teamId || item.PK?.replace('TEAM#', '');
              return itemTeamId !== teamId;
            });
            setNsnOptions(filteredItems);
          } else {
            setNsnOptions([]);
          }
        } catch (error) {
          console.error('Error fetching NSN suggestions:', error);
          setNsnOptions([]);
        } finally {
          setNsnLoading(false);
        }
      } else {
        setNsnOptions([]);
      }
    };

    const debounceTimer = setTimeout(fetchNSNSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [nsnInputValue, teamId]);

  // React.useEffect(() => {
  //   if (isCreateMode && itemType === 'item' && !editedProduct.parent) {
  //     //setParentError(true);
  //   }
  // }, [isCreateMode, itemType, editedProduct.parent]);

  // Find the parent object from itemsList if parent is just an ID
  const getParentObject = () => {
    if (!editedProduct.parent) return null;

    // If parent is already an object with itemId, return it
    if (typeof editedProduct.parent === 'object' && editedProduct.parent.itemId) {
      return editedProduct.parent;
    }

    // If parent is a string (ID), find the full object
    if (typeof editedProduct.parent === 'string') {
      return itemsList.find((item: any) => item.itemId === editedProduct.parent) || null;
    }

    return null;
  };

  return (
    <Stack spacing={2} sx={{ mb: 2, width: '100%' }}>
      {/* Type Selector */}
      {isCreateMode && isEditMode && (
        <Box>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Type
          </Typography>
          <ToggleButtonGroup
            value={itemType}
            exclusive
            onChange={handleItemTypeChange}
            fullWidth
            color="primary"
          >
            <ToggleButton value="item" sx={{ textTransform: 'none', py: 1.5 }}>
              <CategoryIcon sx={{ mr: 1 }} />
              Item
            </ToggleButton>
            <ToggleButton value="kit" sx={{ textTransform: 'none', py: 1.5 }}>
              <InventoryIcon sx={{ mr: 1 }} />
              Kit
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {/* 1. Display Name - Full Width */}
      {isEditMode ? (
        <TextField
          label="Display Name"
          size="small"
          fullWidth
          value={editedProduct.productName || ''}
          onChange={(e) => handleChange('productName', e.target.value)}
          required
          error={errors.productName}
          helperText={errors.productName ? 'Display Name is required' : ''}
        />
      ) : (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Display Name
          </Typography>
          <Typography variant="body1" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
            {editedProduct.productName || '-'}
          </Typography>
        </Box>
      )}

      {/* 2. Authorized Quantity + Kit From (side by side) */}
      <Grid container spacing={2}>
        {itemType === 'item' && (
          <Grid size={{ xs: 12, sm: 6 }}>
            {isEditMode || isCreateMode ? (
              <TextField
                label="Authorized Quantity"
                type="text"
                size="small"
                fullWidth
                value={editedProduct.authQuantity || ''}
                onChange={(e) => handleChange('authQuantity', e.target.value)}
                required
                error={errors.authQuantity}
                helperText={errors.authQuantity ? 'Must be a number ≥ 0' : ''}
              />
            ) : (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Authorized Quantity
                </Typography>
                <Typography>{editedProduct.authQuantity || 0}</Typography>
              </Box>
            )}
          </Grid>
        )}

        <Grid size={{ xs: 12, sm: itemType === 'item' ? 6 : 12 }}>
          {isEditMode || isCreateMode ? (
            <Autocomplete
              options={[
                { itemId: 'NO_KIT', name: 'No Kit', actualName: '' },
                ...itemsList.filter((item: any) => item.isKit !== false),
              ]}
              getOptionLabel={(option: any) => {
                if (option.itemId === 'NO_KIT') return 'No Kit';
                return `${option.name || option.productName || ''} (${option.actualName || 'No name'})`;
              }}
              value={
                editedProduct.parent === null || editedProduct.parent === 'NO_KIT'
                  ? { itemId: 'NO_KIT', name: 'No Kit', actualName: '' }
                  : getParentObject()
              }
              onChange={(_e, val) => {
                if (val) {
                  if (val.itemId === 'NO_KIT') {
                    handleChange('parent', null);
                    //setParentError(false);
                  } else {
                    const cleanParent = typeof val === 'string' ? val : val.itemId || val;
                    handleChange('parent', cleanParent);
                  }
                } else {
                  handleChange('parent', null);
                  //setParentError(false);
                }
              }}
              isOptionEqualToValue={(o, v) => {
                const oId = typeof o === 'string' ? o : o.itemId;
                const vId = typeof v === 'string' ? v : v?.itemId;
                return oId === vId;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Kit From"
                  placeholder="Select parent kit or 'No Kit'"
                  required={itemType === 'item' && isCreateMode}
                  error={errors.parent}
                  helperText={
                    itemType === 'kit'
                      ? 'Optional - leave empty if this is a top-level kit'
                      : itemType === 'item' && isCreateMode
                        ? 'Required - select a kit or "No Kit" for standalone items'
                        : ''
                  }
                  size="small"
                />
              )}
            />
          ) : (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Kit From
              </Typography>
              <Typography sx={{ wordBreak: 'break-word' }}>
                {editedProduct.parent === null
                  ? 'No Kit'
                  : getParentObject()?.name || getParentObject()?.productName || 'N/A'}
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* 3. Status Buttons (moved up from bottom, only shown when not in create mode) */}
      {!isCreateMode && (isEditMode || alwaysEditable('status')) && (
        <Box>
          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
            Status
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
            {statuses.map((s) => (
              <Button
                key={s.value}
                onClick={() => handleChange('status', s.value)}
                variant={editedProduct.status === s.value ? 'contained' : 'outlined'}
                startIcon={s.icon}
                size="small"
                sx={{
                  textTransform: 'none',
                  fontSize: { xs: '0.625rem', sm: '0.75rem' },
                  px: { xs: 0.5, sm: 1 },
                  py: { xs: 0.4, sm: 0.75 },
                  minWidth: 'auto',
                  fontWeight: editedProduct.status === s.value ? 700 : 500,
                  bgcolor: editedProduct.status === s.value ? s.color : 'transparent',
                  color: editedProduct.status === s.value ? 'white' : s.color,
                  borderColor: s.color,
                  '&:hover': {
                    bgcolor: editedProduct.status === s.value ? s.color : `${s.color}20`,
                    borderColor: s.color,
                  },
                  '& .MuiButton-startIcon': {
                    marginRight: { xs: '2px', sm: '4px' },
                  },
                }}
              >
                {s.label}
              </Button>
            ))}
          </Stack>
        </Box>
      )}

      {/* Damage Reports Section (only shown when status is "Damaged") */}
      {!isCreateMode && editedProduct.status === 'Damaged' && setDamageReports && (
        <DamageReportsSection
          damageReports={damageReports}
          setDamageReports={setDamageReports}
          isEditMode={true}
        />
      )}

      {/* 4. OH Quantity (only shown when status is "Shortages" for items) */}
      {!isCreateMode &&
        itemType === 'item' &&
        editedProduct.status === 'Shortages' &&
        (isEditMode || alwaysEditable('ohQuantity') ? (
          <TextField
            label="OH Quantity"
            type="text"
            size="small"
            fullWidth
            value={editedProduct.ohQuantity || ''}
            onChange={(e) => handleChange('ohQuantity', e.target.value)}
          />
        ) : (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              OH Quantity
            </Typography>
            <Typography>
              {editedProduct.ohQuantity || 0}/{editedProduct.authQuantity || 0}
            </Typography>
          </Box>
        ))}

      {/* 5. Notes / Last Known Location - Full Width */}
      {(isEditMode || alwaysEditable('notes')) && (
        <TextField
          label="Notes / Last Known Location"
          size="small"
          fullWidth
          multiline
          rows={3}
          value={editedProduct.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Add notes..."
        />
      )}

      {/* 6. Army Nomenclature - Full Width */}
      {isEditMode ? (
        <TextField
          label="Army Nomenclature"
          size="small"
          fullWidth
          value={editedProduct.actualName || ''}
          onChange={(e) => handleChange('actualName', e.target.value)}
          required
          error={errors.actualName}
          helperText={errors.actualName ? 'Army Nomenclature is required' : ''}
        />
      ) : (
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Army Nomenclature
          </Typography>
          <Typography variant="body1" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
            {editedProduct.actualName || '-'}
          </Typography>
        </Box>
      )}

      {/* 7. NSN + Serial Number (side by side) for Items */}
      {itemType === 'item' && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              {isEditMode ? (
                <Autocomplete
                  freeSolo
                  fullWidth
                  options={nsnOptions}
                  loading={nsnLoading}
                  inputValue={nsnInputValue}
                  onInputChange={(_e, newValue) => {
                    setNsnInputValue(newValue);
                    handleChange('nsn', newValue);
                  }}
                  getOptionLabel={(option: any) => {
                    if (typeof option === 'string') return option;
                    return option.nsn || '';
                  }}
                  getOptionKey={(option: any) => {
                    if (typeof option === 'string') return option;
                    return option.itemId || option.SK || `${option.nsn}-${option.teamId}`;
                  }}
                  isOptionEqualToValue={(option: any, value: any) => {
                    if (typeof option === 'string' || typeof value === 'string') {
                      return option === value;
                    }
                    return option.itemId === value.itemId || option.nsn === value.nsn;
                  }}
                  renderOption={(props, option: any) => {
                    const { key, ...otherProps } = props;
                    return (
                      <Box component="li" key={key} {...otherProps}>
                        <Stack spacing={0.5} sx={{ width: '100%' }}>
                          <Typography variant="body2" fontWeight={600}>
                            {option.nsn}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.name || option.actualName} • Team:{' '}
                            {option.teamName || 'Unknown'}
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  }}
                  onChange={async (_e, value) => {
                    if (value && typeof value === 'object') {
                      // Fill all fields from the selected item (except kit/parent)
                      setEditedProduct({
                        ...editedProduct,
                        nsn: value.nsn || '',
                        productName: value.name || value.productName || '',
                        actualName: value.actualName || '',
                        description: value.description || '',
                        serialNumber: value.serialNumber || '',
                        authQuantity: value.authQuantity || 1,
                        ohQuantity: value.ohQuantity || 1,
                      });
                      setNsnInputValue(value.nsn || '');

                      // Fetch and set the image if available
                      if (value.imageLink && setImagePreview && setSelectedImageFile) {
                        try {
                          setImagePreview(value.imageLink);

                          // Only fetch and convert if it's an HTTP URL (not base64 data URL)
                          if (value.imageLink.startsWith('http')) {
                            const response = await fetch(value.imageLink);
                            const blob = await response.blob();
                            const fileName = `${value.nsn || 'item'}.jpg`;
                            const file = new File([blob], fileName, { type: blob.type });
                            setSelectedImageFile(file);
                          }
                          // For base64 data URLs in local dev, skip file conversion
                        } catch (error) {
                          console.error('Error fetching image:', error);
                        }
                      }
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="National Serial Number"
                      size="small"
                      
                      error={errors.nsn}
                      helperText={errors.nsn ? 'NSN must be unique if provided' : ''}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {nsnLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              ) : (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    National Serial Number
                  </Typography>
                  <Typography sx={{ wordBreak: 'break-all' }}>
                    {editedProduct.nsn || '-'}
                  </Typography>
                </Box>
              )}
              {editedProduct.nsn && !isEditMode && (
                <Tooltip title="Copy">
                  <IconButton size="small" onClick={() => copyToClipboard(editedProduct.nsn)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              {isEditMode ? (
                <TextField
                  label="Serial Number"
                  size="small"
                  fullWidth
                  value={editedProduct.serialNumber || ''}
                  onChange={(e) => handleChange('serialNumber', e.target.value)}
                  error={errors.serialNumber}
                  helperText={errors.serialNumber ? 'Must be unique if provided' : ''}
                />
              ) : (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Serial Number
                  </Typography>
                  <Typography sx={{ wordBreak: 'break-all' }}>
                    {editedProduct.serialNumber || '-'}
                  </Typography>
                </Box>
              )}
              {editedProduct.serialNumber && (
                <Tooltip title="Copy">
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(editedProduct.serialNumber)}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* LIIN + End Item NIIN (side by side) for Kits */}
      {itemType === 'kit' && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              {isEditMode ? (
                <TextField
                  label="LIIN"
                  size="small"
                  fullWidth
                  value={editedProduct.liin || ''}
                  onChange={(e) => handleChange('liin', e.target.value)}
                  
                  error={errors.liin}
                  helperText={errors.liin ? 'LIIN must be unique' : ''}
                />
              ) : (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    LIIN
                  </Typography>
                  <Typography sx={{ wordBreak: 'break-all' }}>
                    {editedProduct.liin || '-'}
                  </Typography>
                </Box>
              )}
              {editedProduct.liin && (
                <Tooltip title="Copy">
                  <IconButton size="small" onClick={() => copyToClipboard(editedProduct.liin)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              {isEditMode ? (
                <TextField
                  label="End Item NIIN"
                  size="small"
                  fullWidth
                  value={editedProduct.endItemNiin || ''}
                  onChange={(e) => handleChange('endItemNiin', e.target.value)}
                  
                  error={errors.endItemNiin}
                  helperText={
                    errors.endItemNiin ? 'End Item NIIN must be unique' : ''
                  }
                />
              ) : (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    End Item NIIN
                  </Typography>
                  <Typography sx={{ wordBreak: 'break-all' }}>
                    {editedProduct.endItemNiin || '-'}
                  </Typography>
                </Box>
              )}
              {editedProduct.endItemNiin && (
                <Tooltip title="Copy">
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(editedProduct.endItemNiin)}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Grid>
        </Grid>
      )}

      {/* NSN + Serial Number (side by side) for Kits */}
{itemType === 'kit' && (
  <Grid container spacing={2}>
    <Grid size={{ xs: 12, sm: 6 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        {isEditMode ? (
          <TextField
            label="National Serial Number"
            size="small"
            fullWidth
            value={editedProduct.nsn || ''}
            onChange={(e) => handleChange('nsn', e.target.value)}
            error={errors.nsn}
            helperText={errors.nsn ? 'NSN must be unique if provided' : ''}
          />
        ) : (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" color="text.secondary">
              National Serial Number
            </Typography>
            <Typography sx={{ wordBreak: 'break-all' }}>
              {editedProduct.nsn || '-'}
            </Typography>
          </Box>
        )}
        {editedProduct.nsn && !isEditMode && (
          <Tooltip title="Copy">
            <IconButton size="small" onClick={() => copyToClipboard(editedProduct.nsn)}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Grid>

    <Grid size={{ xs: 12, sm: 6 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        {isEditMode ? (
          <TextField
            label="Serial Number"
            size="small"
            fullWidth
            value={editedProduct.serialNumber || ''}
            onChange={(e) => handleChange('serialNumber', e.target.value)}
            error={errors.serialNumber}
            helperText={errors.serialNumber ? 'Must be unique if provided' : ''}
          />
        ) : (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Serial Number
            </Typography>
            <Typography sx={{ wordBreak: 'break-all' }}>
              {editedProduct.serialNumber || '-'}
            </Typography>
          </Box>
        )}
        {editedProduct.serialNumber && !isEditMode && (
          <Tooltip title="Copy">
            <IconButton
              size="small"
              onClick={() => copyToClipboard(editedProduct.serialNumber)}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Grid>
  </Grid>
)}

      {/* 8. Description - Full Width (at the bottom) */}
      {itemType === 'item' &&
        (isEditMode || alwaysEditable('description') ? (
          <TextField
            label="Description"
            size="small"
            fullWidth
            multiline
            rows={4}
            value={editedProduct.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            error={errors.description}
          
          />
        ) : (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Description
            </Typography>
            <Typography sx={{ wordBreak: 'break-word' }}>
              {editedProduct.description || 'No description'}
            </Typography>
          </Box>
        ))}
    </Stack>
  );
}
