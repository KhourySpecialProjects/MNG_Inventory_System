/**
 * Header component with teamspace management actions.
 * Provides navigation to admin panel and actions for creating teams and inviting members.
 */
import { Stack, Typography, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink } from 'react-router-dom';

interface TeamsHeaderProps {
  onCreateTeam: () => void;
  onInviteMember: () => void;
}

export default function TeamsHeader({ onCreateTeam, onInviteMember }: TeamsHeaderProps) {
  const theme = useTheme();

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      gap={2}
      sx={{ mb: 3 }}
    >
      <Typography
        variant="h4"
        sx={{
          fontWeight: 700,
          color: theme.palette.text.primary,
        }}
      >
        Teamspaces
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ width: { xs: '100%', sm: 'auto' } }}
      >
        <Button
          variant="contained"
          color="warning"
          component={RouterLink}
          to="/admin"
          startIcon={<AdminPanelSettingsIcon />}
          sx={{
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            px: 2,
            transition: 'all 0.2s ease',
          }}
        >
          Management
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={onCreateTeam}
          startIcon={<AddIcon />}
          sx={{
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            px: 2,
            transition: 'all 0.2s ease',
          }}
        >
          Create Team
        </Button>
        <Button
          variant="contained"
          color="warning"
          onClick={onInviteMember}
          startIcon={<GroupAddIcon />}
          sx={{
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            px: 2,
            transition: 'all 0.2s ease',
          }}
        >
          Invite Member
        </Button>
      </Stack>
    </Stack>
  );
}
