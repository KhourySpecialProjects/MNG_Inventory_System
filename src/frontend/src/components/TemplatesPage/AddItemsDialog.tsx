/**
 * Dialog for adding existing inventory items to a template.
 * Step 1: pick a team. Step 2: search and check items from that team's inventory.
 * Submits all selected items via addItemToTemplate, omitting serialNumber and quantities.
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem as MuiMenuItem,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  CircularProgress,
  Typography,
  Chip,
  Box,
} from '@mui/material';
import { me } from '../../api/auth';
import { getTeamspace } from '../../api/teamspace';
import { getItems } from '../../api/items';
import { addItemToTemplate } from '../../api/templates';

interface Team {
  teamId: string;
  GSI_NAME: string;
}

interface Item {
  itemId: string;
  name: string;
  actualName?: string;
  description?: string;
  isKit?: boolean;
  parent?: string | null;
  nsn?: string;
  liin?: string;
  endItemNiin?: string;
}

interface AddItemsDialogProps {
  open: boolean;
  templateId: string;
  templateItems: { nsn?: string; name: string }[];
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export default function AddItemsDialog({
  open,
  templateId,
  templateItems,
  onClose,
  onSuccess,
}: AddItemsDialogProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Load teams when dialog opens
  useEffect(() => {
    if (!open) return;
    async function loadTeams() {
      setTeamsLoading(true);
      try {
        const user = await me();
        const data = await getTeamspace(user.userId);
        setTeams(data?.teams ?? []);
      } catch {
        setTeams([]);
      } finally {
        setTeamsLoading(false);
      }
    }
    void loadTeams();
  }, [open]);

  // Load items when selected team changes
  useEffect(() => {
    if (!selectedTeamId) {
      setItems([]);
      return;
    }
    async function loadItems() {
      setItemsLoading(true);
      try {
        const data = await getItems(selectedTeamId);
        setItems(data?.items ?? []);
      } catch {
        setItems([]);
      } finally {
        setItemsLoading(false);
      }
    }
    void loadItems();
  }, [selectedTeamId]);

  function handleClose() {
    setSelectedTeamId('');
    setItems([]);
    setSearch('');
    setSelected(new Set());
    setAddError(null);
    onClose();
  }

  function toggleItem(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.nsn ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (item.endItemNiin ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  async function handleConfirm() {
    // Exclude a selected child only when its parent kit is also selected (it will be auto-added).
    // A child selected without its parent kit is included and added as a standalone item.
    const toAdd = items.filter(
      (item) => selected.has(item.itemId) && !(item.parent && selected.has(item.parent)),
    );
    if (toAdd.length === 0) return;

    // Detect duplicates: match by NSN (when both have one) or by name
    const duplicates = toAdd.filter((item) =>
      templateItems.some(
        (t) => (item.nsn && t.nsn && item.nsn === t.nsn) || item.name === t.name,
      ),
    );
    const toAddFiltered = toAdd.filter((item) => !duplicates.includes(item));

    if (duplicates.length > 0) {
      const names = duplicates.map((d) => d.name).join(', ');
      setAddError(`Already in template: ${names}`);
    } else {
      setAddError(null);
    }

    if (toAddFiltered.length === 0) return;

    setAdding(true);
    let totalAdded = 0;
    try {
      for (const item of toAddFiltered) {
        const result = await addItemToTemplate(templateId, {
          name: item.name,
          actualName: item.actualName,
          description: item.description,
          isKit: item.isKit,
          parent: null,
          nsn: item.nsn,
          liin: item.liin,
          endItemNiin: item.endItemNiin,
        });
        totalAdded++;

        if (item.isKit) {
          const newTemplateItemId = (result as { templateItemId: string }).templateItemId;
          const children = items.filter((i) => i.parent === item.itemId);
          await Promise.all(
            children.map((child) =>
              addItemToTemplate(templateId, {
                name: child.name,
                actualName: child.actualName,
                description: child.description,
                isKit: child.isKit,
                parent: newTemplateItemId,
                nsn: child.nsn,
                liin: child.liin,
                endItemNiin: child.endItemNiin,
              }),
            ),
          );
          totalAdded += children.length;
        }
      }
      // Only auto-close when everything succeeded with no duplicates to report
      if (duplicates.length === 0) {
        handleClose();
      }
      onSuccess(totalAdded);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add items');
    } finally {
      setAdding(false);
    }
  }

  const confirmLabel = adding
    ? 'Adding…'
    : `Add ${selected.size > 0 ? selected.size : ''} Item${selected.size !== 1 ? 's' : ''}`.trim();

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Items to Template</DialogTitle>

      <DialogContent>
        {/* Team selector */}
        <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
          <InputLabel>Select Team</InputLabel>
          <Select
            value={selectedTeamId}
            label="Select Team"
            onChange={(e) => {
              setSelectedTeamId(e.target.value);
              setSelected(new Set());
              setSearch('');
            }}
            disabled={teamsLoading}
          >
            {teams.map((team) => (
              <MuiMenuItem key={team.teamId} value={team.teamId}>
                {team.GSI_NAME}
              </MuiMenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Items checklist */}
        {selectedTeamId && (
          <>
            <TextField
              label="Search items"
              fullWidth
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ mb: 1 }}
            />

            {itemsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : filteredItems.length === 0 ? (
              <Typography sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                No items found.
              </Typography>
            ) : (
              <List dense sx={{ maxHeight: 320, overflowY: 'auto' }}>
                {filteredItems.map((item) => (
                  <ListItem key={item.itemId} disablePadding>
                    <ListItemButton onClick={() => toggleItem(item.itemId)}>
                      <ListItemIcon>
                        <Checkbox
                          edge="start"
                          checked={selected.has(item.itemId)}
                          tabIndex={-1}
                          disableRipple
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {item.name}
                            </Typography>
                            {item.isKit && (
                              <Chip
                                label="Kit"
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        }
                        secondary={item.nsn || item.endItemNiin || undefined}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}

      </DialogContent>

      <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {addError && (
          <Typography color="error" variant="body2" sx={{ flex: '1 1 100%', px: 1 }}>
            {addError}
          </Typography>
        )}
        <Button onClick={handleClose} disabled={adding}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={() => void handleConfirm()}
          disabled={selected.size === 0 || adding}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
