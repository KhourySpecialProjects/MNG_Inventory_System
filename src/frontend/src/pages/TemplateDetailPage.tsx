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
import CreateTemplateItemDialog from '../components/TemplatesPage/CreateTemplateItemDialog';
import { getTemplate, getTemplateItems, removeItemFromTemplate } from '../api/templates';

interface TemplateItem {
  templateItemId: string;
  name: string;
  description?: string;
  isKit?: boolean;
  parent?: string | null;
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
  const [createItemOpen, setCreateItemOpen] = useState(false);

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

  async function handleRemoveKit(kit: TemplateItem) {
    if (!templateId) return;
    const children = items.filter((i) => i.parent === kit.templateItemId);
    try {
      await Promise.all(
        children.map((c) => removeItemFromTemplate(templateId, c.templateItemId)),
      );
      await removeItemFromTemplate(templateId, kit.templateItemId);
      setItems((prev) =>
        prev.filter(
          (i) => i.templateItemId !== kit.templateItemId && i.parent !== kit.templateItemId,
        ),
      );
      const childCount = children.length;
      showSnackbar(
        `"${kit.name}" and ${childCount} child item${childCount !== 1 ? 's' : ''} removed`,
        'success',
      );
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to remove kit', 'error');
    }
  }

  type ItemRow = { item: TemplateItem; isChild: boolean; addSpacerAbove: boolean };

  const { kitRows, standaloneRows } = useMemo(() => {
    const childMap: Record<string, TemplateItem[]> = {};
    for (const item of items) {
      if (item.parent) {
        if (!childMap[item.parent]) childMap[item.parent] = [];
        childMap[item.parent].push(item);
      }
    }
    for (const id of Object.keys(childMap)) {
      childMap[id].sort((a, b) => a.name.localeCompare(b.name));
    }

    const kits = items
      .filter((i) => i.isKit && !i.parent)
      .sort((a, b) => a.name.localeCompare(b.name));
    const standalones = items
      .filter((i) => !i.isKit && !i.parent)
      .sort((a, b) => a.name.localeCompare(b.name));

    const kitRowList: ItemRow[] = [];
    kits.forEach((kit, i) => {
      kitRowList.push({ item: kit, isChild: false, addSpacerAbove: i > 0 });
      for (const child of childMap[kit.templateItemId] ?? []) {
        kitRowList.push({ item: child, isChild: true, addSpacerAbove: false });
      }
    });

    const standaloneRowList: ItemRow[] = standalones.map((item, i) => ({
      item,
      isChild: false,
      addSpacerAbove: i > 0,
    }));

    return { kitRows: kitRowList, standaloneRows: standaloneRowList };
  }, [items]);

  const borderColor = alpha(theme.palette.text.primary, 0.1);

  function renderItemRows(rows: ItemRow[]) {
    return rows.map(({ item, isChild, addSpacerAbove }, index) => {
      if (!item) return null;
      const isKit = item.isKit && !item.parent;
      return (
        <Box key={item.templateItemId}>
          {index > 0 && <Divider sx={addSpacerAbove ? { my: 0.75 } : undefined} />}
          <ListItem
            secondaryAction={
              <Tooltip title={isKit ? 'Remove kit and child items' : 'Remove from template'}>
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() =>
                    isKit
                      ? void handleRemoveKit(item)
                      : void handleRemoveItem(item.templateItemId, item.name)
                  }
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
            sx={{
              pl: isChild ? 6 : 2,
              bgcolor: isChild ? alpha(theme.palette.text.primary, 0.02) : 'transparent',
            }}
          >
            <ListItemText
              primary={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body1" fontWeight={isKit ? 700 : 600}>
                    {item.name}
                  </Typography>
                  {isKit && (
                    <Chip label="Kit" size="small" color="warning" variant="outlined" />
                  )}
                </Stack>
              }
              secondary={item.nsn ? `NSN: ${item.nsn}` : item.description || undefined}
            />
          </ListItem>
        </Box>
      );
    });
  }

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
              Create New Item
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
            No items yet. Click "Create New Item" to build one from scratch, or "Add Items" to
            source from an existing team.
          </Typography>
        )}

        {/* Kits card */}
        {!loading && !error && kitRows.length > 0 && (
          <Box
            sx={{
              border: `1px solid ${borderColor}`,
              borderRadius: 3,
              bgcolor: theme.palette.background.paper,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              mb: 3,
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 0.75,
                bgcolor: alpha(theme.palette.text.primary, 0.03),
                borderBottom: `1px solid ${borderColor}`,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: theme.palette.text.secondary,
                }}
              >
                Kits
              </Typography>
            </Box>
            <List disablePadding>{renderItemRows(kitRows)}</List>
          </Box>
        )}

        {/* Standalone items card */}
        {!loading && !error && standaloneRows.length > 0 && (
          <Box
            sx={{
              border: `1px solid ${borderColor}`,
              borderRadius: 3,
              bgcolor: theme.palette.background.paper,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 0.75,
                bgcolor: alpha(theme.palette.text.primary, 0.03),
                borderBottom: `1px solid ${borderColor}`,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: theme.palette.text.secondary,
                }}
              >
                Items
              </Typography>
            </Box>
            <List disablePadding>{renderItemRows(standaloneRows)}</List>
          </Box>
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
          showSnackbar('Item created and added to template', 'success');
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