/**
 * Template detail page showing the template's name, description, and current item list.
 * Allows adding items from any team via AddItemsDialog and removing individual items.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Snackbar,
  Alert,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  Divider,
  Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TopBar from '../components/TopBar';
import Profile from '../components/Profile';
import AddItemsDialog from '../components/TemplatesPage/AddItemsDialog';
import { getTemplate, getTemplateItems, removeItemFromTemplate } from '../api/templates';

interface TemplateItem {
  templateItemId: string;
  name: string;
  description?: string;
  isKit?: boolean;
  nsn?: string;
  endItemNiin?: string;
  liin?: string;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
}

export default function TemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [addItemsOpen, setAddItemsOpen] = useState(false);

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  function showSnackbar(message: string, severity: 'success' | 'error') {
    setSnackbar({ open: true, message, severity });
  }

  function closeSnackbar() {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }

  async function refreshItems(): Promise<void> {
    if (!templateId) return;
    try {
      const data = await getTemplateItems(templateId);
      setItems(data?.items ?? []);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to refresh items', 'error');
    }
  }

  useEffect(() => {
    if (!templateId) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [tmpl, itemsData] = await Promise.all([
          getTemplate(templateId!),
          getTemplateItems(templateId!),
        ]);
        setTemplateName(tmpl?.template?.name ?? 'Template');
        setTemplateDescription(tmpl?.template?.description ?? '');
        setItems(itemsData?.items ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load template');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [templateId]);

  async function handleRemoveItem(templateItemId: string, name: string) {
    if (!templateId) return;
    try {
      await removeItemFromTemplate(templateId, templateItemId);
      setItems((prev) => prev.filter((i) => i.templateItemId !== templateItemId));
      showSnackbar(`"${name}" removed`, 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to remove item', 'error');
    }
  }

  const borderColor = alpha(theme.palette.text.primary, 0.1);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      <TopBar isLoggedIn={true} onProfileClick={() => setProfileOpen(true)} />
      <Profile open={profileOpen} onClose={() => setProfileOpen(false)} />

      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4, md: 6 } }}>
        {/* Page header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={2}
          sx={{ mb: 4 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <IconButton onClick={() => navigate('/templates')} size="small">
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: theme.palette.text.primary }}
              >
                {loading ? 'Loading…' : templateName}
              </Typography>
              {!loading && templateDescription && (
                <Typography
                  variant="body2"
                  sx={{ color: theme.palette.text.secondary, mt: 0.5 }}
                >
                  {templateDescription}
                </Typography>
              )}
            </Box>
          </Stack>

          <Button
            variant="contained"
            color="warning"
            startIcon={<AddIcon />}
            onClick={() => setAddItemsOpen(true)}
            disabled={loading}
            sx={{
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              px: 2,
              transition: 'all 0.2s ease',
            }}
          >
            Add Items
          </Button>
        </Stack>

        {/* Loading */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error */}
        {!loading && error && (
          <Typography color="error" sx={{ textAlign: 'center', py: 4 }}>
            {error}
          </Typography>
        )}

        {/* Empty */}
        {!loading && !error && items.length === 0 && (
          <Typography sx={{ textAlign: 'center', py: 8, color: theme.palette.text.secondary }}>
            No items yet. Click "Add Items" to add inventory items to this template.
          </Typography>
        )}

        {/* Items list */}
        {!loading && !error && items.length > 0 && (
          <Box
            sx={{
              border: `1px solid ${borderColor}`,
              borderRadius: 3,
              bgcolor: theme.palette.background.paper,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <List disablePadding>
              {items.map((item, index) => (
                <Box key={item.templateItemId}>
                  {index > 0 && <Divider />}
                  <ListItem
                    secondaryAction={
                      <Tooltip title="Remove from template">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => void handleRemoveItem(item.templateItemId, item.name)}
                          sx={{
                            color: theme.palette.text.secondary,
                            transition: 'color 0.2s ease',
                            '&:hover': { color: 'error.main' },
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body1" fontWeight={600}>
                            {item.name}
                          </Typography>
                          {item.isKit && (
                            <Chip label="Kit" size="small" color="warning" variant="outlined" />
                          )}
                        </Stack>
                      }
                      secondary={
                        item.nsn ? `NSN: ${item.nsn}` : item.description || undefined
                      }
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </Box>
        )}
      </Container>

      <AddItemsDialog
        open={addItemsOpen}
        templateId={templateId ?? ''}
        onClose={() => setAddItemsOpen(false)}
        onSuccess={(count) => {
          showSnackbar(`${count} item${count !== 1 ? 's' : ''} added`, 'success');
          void refreshItems();
        }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={8000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
