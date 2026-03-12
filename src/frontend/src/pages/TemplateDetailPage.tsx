/**
 * Template detail page showing the template's name, description, and current item list.
 * Allows adding items from any team via AddItemsDialog and removing individual items.
 */
import { useEffect, useMemo, useState } from 'react';
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
  IconButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import TopBar from '../components/TopBar';
import Profile from '../components/Profile';
import AddItemsDialog from '../components/TemplatesPage/AddItemsDialog';
import CreateTemplateItemDialog from '../components/TemplatesPage/CreateTemplateItemDialog';
import EditTemplateItemDialog from '../components/TemplatesPage/EditTemplateItemDialog';
import ItemListComponent, { ItemListItem } from '../components/ProductPage/ItemListComponent';
import { getTemplate, getTemplateItems, removeItemFromTemplate } from '../api/templates';

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
  createdAt?: string;
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
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<TemplateItem | null>(null);

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

  async function handleRemoveKit(kit: ItemListItem) {
    if (!templateId) return;
    const kitId = String(kit.id);
    const children = items.filter((i) => i.parent === kitId);
    try {
      await Promise.all(
        children.map((c) => removeItemFromTemplate(templateId, c.templateItemId)),
      );
      await removeItemFromTemplate(templateId, kitId);
      setItems((prev) =>
        prev.filter(
          (i) => i.templateItemId !== kitId && i.parent !== kitId,
        ),
      );
      const childCount = children.length;
      showSnackbar(
        `"${kit.productName}" and ${childCount} child item${childCount !== 1 ? 's' : ''} removed`,
        'success',
      );
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to remove kit', 'error');
    }
  }

  // Convert flat template items into hierarchical ItemListItem tree
  const itemListItems = useMemo((): ItemListItem[] => {
    const map: Record<string, ItemListItem> = {};
    const roots: ItemListItem[] = [];

    // First pass: create all ItemListItem entries
    for (const item of items) {
      map[item.templateItemId] = {
        id: item.templateItemId,
        productName: item.name,
        actualName: item.actualName || item.name,
        subtitle: item.description || 'No description',
        image:
          item.imageLink &&
          (item.imageLink.startsWith('http') || item.imageLink.startsWith('data:'))
            ? item.imageLink
            : '',
        date: item.createdAt
          ? new Date(item.createdAt).toLocaleDateString('en-US', {
              month: '2-digit',
              day: '2-digit',
              year: '2-digit',
            })
          : '',
        parent: item.parent,
        isKit: item.isKit,
        children: [],
      };
    }

    // Second pass: build parent-child relationships
    for (const item of items) {
      const mapped = map[item.templateItemId];
      if (item.parent && map[item.parent]) {
        map[item.parent].children!.push(mapped);
      } else {
        roots.push(mapped);
      }
    }

    return roots;
  }, [items]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      <TopBar isLoggedIn={true} onProfileClick={() => setProfileOpen(true)} />
      <Profile open={profileOpen} onClose={() => setProfileOpen(false)} />

      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4, md: 6 } }}>
        

        {/* Page header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 4 }}>
          {/* Left: back + title */}
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <IconButton onClick={() => navigate('/templates')} size="small">
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                {loading ? 'Loading…' : templateName}
              </Typography>
              {!loading && templateDescription && (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
                  {templateDescription}
                </Typography>
              )}
            </Box>
          </Stack>

          {/* Right: action buttons — always rendered */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<AddIcon />}
              onClick={() => setCreateItemOpen(true)}
              sx={{ fontWeight: 600, textTransform: 'none', borderRadius: 2, px: 2 }}
            >
              Create New Template Item
            </Button>
            <Button
              variant="contained"
              color="warning"
              startIcon={<AddIcon />}
              onClick={() => setAddItemsOpen(true)}
              sx={{ fontWeight: 600, textTransform: 'none', borderRadius: 2, px: 2 }}
            >
              Add from Team
            </Button>
          </Box>
        </Box>

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
            No items yet. Click &quot;Create New Template Item&quot; to build one from scratch, or &quot;Add
            from Team&quot; to source from an existing team.
          </Typography>
        )}

        {/* Item list (reuses ItemListComponent in template mode) */}
        {!loading && !error && itemListItems.length > 0 && (
          <ItemListComponent
            items={itemListItems}
            isTemplateMode
            onEditItem={(itemId) => {
              const found = items.find((i) => i.templateItemId === String(itemId));
              if (found) setEditItem(found);
            }}
            onRemoveItem={(itemId, name) => void handleRemoveItem(String(itemId), name)}
            onRemoveKit={(kit) => void handleRemoveKit(kit)}
          />
        )}
      </Container>

      <AddItemsDialog
        open={addItemsOpen}
        templateId={templateId ?? ''}
        templateItems={items}
        onClose={() => setAddItemsOpen(false)}
        onSuccess={(count) => {
          showSnackbar(`${count} item${count !== 1 ? 's' : ''} added`, 'success');
          void refreshItems();
        }}
      />

      <CreateTemplateItemDialog
        open={createItemOpen}
        templateId={templateId ?? ''}
        templateItems={items}
        onClose={() => setCreateItemOpen(false)}
        onSuccess={() => {
          showSnackbar('Template item created', 'success');
          void refreshItems();
        }}
      />

      <EditTemplateItemDialog
        open={editItem !== null}
        templateId={templateId ?? ''}
        templateItems={items}
        item={editItem}
        onClose={() => setEditItem(null)}
        onSuccess={() => {
          showSnackbar('Template item updated', 'success');
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