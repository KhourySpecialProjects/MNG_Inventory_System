/**
 * Quick action card for adding new inventory items.
 * Provides a call-to-action button linking to the item creation form.
 */
import { Paper, Typography, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

interface AddInventoryCardProps {
  teamId: string;
  onImportFromTemplate?: () => void;
  onExtractAsTemplate?: () => void;
}

export default function AddInventoryCard({ teamId, onImportFromTemplate, onExtractAsTemplate }: AddInventoryCardProps) {
  const theme = useTheme();

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        textAlign: 'center',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Typography variant="h6" fontWeight={700} mb={1.5}>
        Inventory Actions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Add items, import from a template, or extract this team's inventory as a new template
      </Typography>
      <Button
        variant="contained"
        fullWidth
        color="primary"
        component={Link}
        to={`/teams/${teamId}/items/new`}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'scale(1.02)',
          },
        }}
      >
        Add New Inventory Item
      </Button>
      {onImportFromTemplate && (
        <Button
          variant="contained"
          fullWidth
          color="secondary"
          onClick={onImportFromTemplate}
          sx={{
            mt: 1.5,
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'scale(1.02)',
            },
          }}
        >
          Import from Template
        </Button>
      )}
      {onExtractAsTemplate && (
        <Button
          variant="contained"
          color="warning"
          fullWidth
          onClick={onExtractAsTemplate}
          sx={{
            mt: 1.5,
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'scale(1.02)',
            },
          }}
        >
          Extract as Template
        </Button>
      )}
    </Paper>
  );
}
