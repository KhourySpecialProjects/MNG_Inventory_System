/**
 * Empty state component for teams list with loading, error, and no-results states.
 * Displays contextual messages and loading indicators during data fetch operations.
 */
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface EmptyStateProps {
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
}

export default function EmptyState({ loading, error, isEmpty }: EmptyStateProps) {
  const theme = useTheme();

  if (loading) {
    return (
      <Box textAlign="center" sx={{ mt: 6, mb: 6 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2, color: theme.palette.text.secondary }}>
          Loading your teams...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" sx={{ mt: 6, mb: 6 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (isEmpty) {
    return (
      <Box textAlign="center" sx={{ mt: 6, mb: 6 }}>
        <Typography variant="h6" sx={{ color: theme.palette.text.secondary }}>
          No teams found
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: theme.palette.text.secondary }}>
          Try adjusting your search or create a new teamspace
        </Typography>
      </Box>
    );
  }

  return null;
}
