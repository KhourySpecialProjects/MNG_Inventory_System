/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Typography,
  Box,
  Stack,
  Avatar,
  MenuItem,
  Select,
  Button,
  CircularProgress,
} from '@mui/material';

import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';

import { getTeamMembers, removeUserTeamspace } from '../../api/teamspace';
import { me } from '../../api/auth';

interface ViewMembersDialogProps {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  showSnackbar: (msg: string, sev: 'success' | 'error') => void;
}

export default function ViewMembersDialog({
  open,
  onClose,
  teamId,
  teamName,
  showSnackbar,
}: ViewMembersDialogProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    if (!open) return;

    async function load() {
      setLoading(true);
      try {
        const user = await me();
        setCurrentUserId(user.userId);

        const data = await getTeamMembers(teamId);

        if (data?.success) {
          const list = data.members;

          const sorted = [...list].sort((a, b) => {
            const pa = a.permissions?.length ?? 0;
            const pb = b.permissions?.length ?? 0;
            return pb - pa;
          });

          setMembers(sorted);
        }
      } catch {
        showSnackbar('Failed to load members', 'error');
      }
      setLoading(false);
    }

    void load();
  }, [open, teamId]);

  async function handleRemove(username: string) {
    try {
      await removeUserTeamspace(currentUserId, username, teamId);
      showSnackbar('Member removed', 'success');
      const updated = await getTeamMembers(teamId);
      setMembers(updated.members);
    } catch {
      showSnackbar('Failed to remove member', 'error');
    }
  }

  const filtered = members.filter((m) => {
    const t = search.toLowerCase();
    return (
      m.username?.toLowerCase().includes(t) ||
      m.name?.toLowerCase().includes(t) ||
      m.roleName?.toLowerCase().includes(t)
    );
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      TransitionProps={{
        timeout: 400,
      }}
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: `0 24px 48px rgba(0,0,0,0.15)`,
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 2,
          pt: 3,
          px: 3,
          background: (theme) => `linear-gradient(135deg, 
            ${theme.palette.primary.main}15 0%, 
            ${theme.palette.secondary.main}15 100%)`,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            sx={{
              bgcolor: (theme) => theme.palette.primary.main,
              width: 36,
              height: 36,
            }}
          >
            <Typography fontSize={14} fontWeight={700}>
              {teamName[0]?.toUpperCase()}
            </Typography>
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Members – {teamName}
            </Typography>
          </Box>
        </Stack>
        <IconButton
          onClick={onClose}
          sx={{
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'rotate(90deg)',
              bgcolor: (theme) => theme.palette.error.main + '15',
              color: (theme) => theme.palette.error.main,
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 3, py: 3 }}>
        <TextField
          fullWidth
          placeholder="Search by name, username, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}20`,
              },
              '&.Mui-focused': {
                boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}40`,
              },
            },
          }}
        />

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading &&
          filtered.map((m, index) => (
            <Stack
              key={m.userId}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                py: 2,
                px: 2,
                mb: 1,
                borderRadius: 2,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                transition: 'all 0.3s ease',
                animation: `fadeInUp 0.4s ease ${index * 0.05}s both`,
                '@keyframes fadeInUp': {
                  from: {
                    opacity: 0,
                    transform: 'translateY(10px)',
                  },
                  to: {
                    opacity: 1,
                    transform: 'translateY(0)',
                  },
                },
                '&:hover': {
                  bgcolor: (theme) => theme.palette.action.hover,
                  transform: 'translateX(4px)',
                  boxShadow: (theme) => `0 4px 12px ${theme.palette.primary.main}15`,
                },
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar
                  sx={{
                    width: 44,
                    height: 44,
                    fontWeight: 700,
                    bgcolor: (theme) => theme.palette.primary.main,
                    boxShadow: (theme) => `0 4px 12px ${theme.palette.primary.main}30`,
                  }}
                >
                  {m.name ? m.name[0].toUpperCase() : '?'}
                </Avatar>

                <Box>
                  <Typography fontWeight={700} fontSize={15}>
                    @{m.username}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontSize={13}>
                    {m.name}
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Select
                  size="small"
                  value={m.roleName}
                  sx={{
                    minWidth: 130,
                    borderRadius: 1.5,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: (theme) => theme.palette.divider,
                    },
                  }}
                >
                  <MenuItem value={m.roleName}>{m.roleName}</MenuItem>
                </Select>

                <IconButton
                  color="error"
                  onClick={() => handleRemove(m.username)}
                  sx={{
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      bgcolor: (theme) => theme.palette.error.main + '15',
                    },
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Stack>
            </Stack>
          ))}
      </DialogContent>

      <DialogActions sx={{ p: 2.5 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            borderRadius: 2,
            px: 3,
            py: 1,
            fontWeight: 600,
            textTransform: 'none',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: (theme) => `0 4px 12px ${theme.palette.primary.main}20`,
            },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
