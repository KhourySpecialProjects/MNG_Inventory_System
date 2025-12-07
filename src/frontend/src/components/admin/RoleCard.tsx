/**
 * Role card component displaying role summary with edit/delete actions.
 * Shows role name, description, permission count, and default/current user badges.
 * Prevents modification of default roles and the user's own role to maintain system integrity.
 */
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Box,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Permission } from './PermissionCheckboxGroup';

interface RoleCardProps {
  name: string;
  description?: string;
  permissions: Permission[];
  isDefault?: boolean;
  isMyRole?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export default function RoleCard({
  name,
  description,
  permissions,
  isDefault = false,
  isMyRole = false,
  onEdit,
  onDelete,
}: RoleCardProps) {
  const theme = useTheme();

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
          borderColor: theme.palette.primary.main,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {name}
          </Typography>
          {isDefault && <Chip label="Default" size="small" color="primary" variant="outlined" />}
        </Box>

        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
          {permissions.length} Permission{permissions.length !== 1 ? 's' : ''}
        </Typography>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
        <Tooltip title={isDefault ? 'View permissions' : 'Edit role'} arrow>
          <span>
            <IconButton
              size="small"
              onClick={onEdit}
              color="primary"
              disabled={isMyRole}
              sx={{
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              }}
            >
              {isDefault ? <VisibilityIcon fontSize="small" /> : <EditIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={isDefault ? 'Default roles cannot be deleted' : 'Delete role'} arrow>
          <span>
            <IconButton
              size="small"
              onClick={onDelete}
              color="error"
              disabled={isDefault || isMyRole}
              sx={{
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  );
}
