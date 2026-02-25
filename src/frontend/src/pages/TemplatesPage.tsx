/**
 * Templates management page displaying all inventory templates in a responsive grid.
 * Features template creation and deletion with snackbar feedback.
 */
import { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import TopBar from '../components/TopBar';
import Profile from '../components/Profile';
import TemplatesHeader from '../components/TemplatesPage/TemplatesHeader';
import TemplatesGrid, { Template } from '../components/TemplatesPage/TemplatesGrid';
import { getTemplates, createTemplate, deleteTemplate } from '../api/templates';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
}

export default function TemplatesPage() {
  const theme = useTheme();

  // Data state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile state
  const [profileOpen, setProfileOpen] = useState(false);

  // Create dialog state
  const [openCreate, setOpenCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete dialog state
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const [deleteName, setDeleteName] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Snackbar state
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

  async function refreshTemplates(): Promise<void> {
    try {
      setLoading(true);
      setError(null);
      const data = await getTemplates();
      setTemplates(data?.templates ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load templates';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshTemplates();
  }, []);

  async function handleCreate() {
    if (!createName.trim()) return;
    try {
      setCreating(true);
      await createTemplate(createName.trim(), createDescription.trim() || undefined);
      setOpenCreate(false);
      setCreateName('');
      setCreateDescription('');
      showSnackbar('Template created successfully', 'success');
      await refreshTemplates();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create template';
      showSnackbar(message, 'error');
    } finally {
      setCreating(false);
    }
  }

  function openDeleteFor(id: string, name: string) {
    setDeleteId(id);
    setDeleteName(name);
    setOpenDelete(true);
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      await deleteTemplate(deleteId);
      setOpenDelete(false);
      showSnackbar(`"${deleteName}" deleted`, 'success');
      await refreshTemplates();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete template';
      showSnackbar(message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      <TopBar isLoggedIn={true} onProfileClick={() => setProfileOpen(true)} />

      <Profile open={profileOpen} onClose={() => setProfileOpen(false)} />

      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4, md: 6 } }}>
        <TemplatesHeader onCreateTemplate={() => setOpenCreate(true)} />

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && error && (
          <Typography color="error" sx={{ textAlign: 'center', py: 4 }}>
            {error}
          </Typography>
        )}

        {!loading && !error && templates.length === 0 && (
          <Typography
            sx={{
              textAlign: 'center',
              py: 8,
              color: theme.palette.text.secondary,
            }}
          >
            No templates yet. Create one to get started.
          </Typography>
        )}

        {!loading && !error && templates.length > 0 && (
          <TemplatesGrid templates={templates} onDelete={openDeleteFor} />
        )}
      </Container>

      {/* Create Template Dialog */}
      <Dialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Create Template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Template Name"
            fullWidth
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            value={createDescription}
            onChange={(e) => setCreateDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleCreate()}
            disabled={!createName.trim() || creating}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteName}</strong>? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDelete(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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
