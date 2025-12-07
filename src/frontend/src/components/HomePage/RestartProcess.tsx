/**
 * Soft reset action card with two-step confirmation wizard.
 * Allows resetting all item statuses to "To Review" for starting a new inventory cycle.
 * Features destructive action warnings and error handling for safe bulk operations.
 */
import { useState } from 'react';
import {
  Button,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { softReset } from '../../api/home';

interface RestartProcessCardProps {
  teamId: string; // pass the current teamId
  onRestart?: () => void; // optional callback after restart
}

export default function RestartProcess({ teamId, onRestart }: RestartProcessCardProps) {
  const theme = useTheme();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRestartProcess = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await softReset(teamId);
      if (result?.success === false) {
        setError(result.error || 'Failed to restart process');
        return;
      }
      //console.log('Soft reset completed');
      setIsDialogOpen(false);
      if (onRestart) onRestart();
    } catch (err) {
      console.error('Failed to restart process:', err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while restarting process.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const openWizard = () => {
    setWizardStep(1);
    setError('');
    setIsDialogOpen(true);
  };

  const closeWizard = () => {
    setIsDialogOpen(false);
  };

  return (
    <>
      {/* Restart Process Card */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          bgcolor: theme.palette.background.paper,
          textAlign: 'center',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
            transform: 'translateY(-2px)',
          },
        }}
      >
        <Typography variant="h6" fontWeight={700} mb={1.5}>
          Restart Inventory Process
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Time to conduct inventory again?
        </Typography>
        <Button
          variant="contained"
          fullWidth
          color="error"
          sx={{
            fontWeight: 600,
            borderRadius: 8,
            color: theme.palette.error.contrastText,
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'scale(1.02)',
            },
          }}
          onClick={openWizard}
        >
          Restart Process
        </Button>
      </Paper>

      {/* Two-Step Wizard */}
      <Dialog open={isDialogOpen} onClose={() => !loading && closeWizard()}>
        <DialogTitle
          sx={{
            bgcolor: theme.palette.background.paper,
            color: theme.palette.text.primary,
          }}
        >
          Restart Process
        </DialogTitle>
        <DialogContent
          sx={{
            bgcolor: theme.palette.background.paper,
            color: theme.palette.text.primary,
          }}
        >
          {wizardStep === 1 ? (
            <Typography>
              Are you sure you want to restart the process? This will reset all progress.
            </Typography>
          ) : (
            <Typography>
              ⚠️ Final confirmation: This action will move all items to "To Review" and clear out
              all dashboard components related to reviewed items. This cannot be undone.
            </Typography>
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: theme.palette.background.paper }}>
          <Button onClick={closeWizard} disabled={loading}>
            Cancel
          </Button>
          {wizardStep === 1 ? (
            <Button
              variant="contained"
              color="warning"
              onClick={() => setWizardStep(2)}
              disabled={loading}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              onClick={handleRestartProcess}
              disabled={loading}
            >
              {loading ? 'Restarting...' : 'Confirm Restart'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
