import { useState } from "react";
import { Box, Button, Paper, Typography, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";

interface RestartProcessCardProps {
  onRestart?: () => void; // optional callback for when the restart is confirmed
}

export default function RestartProcess ({ onRestart }: RestartProcessCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);

  const handleRestartProcess = () => {
    console.log("Restart Process triggered — reset all inventory data.");
    if (onRestart) onRestart();
  };

  const openWizard = () => {
    setWizardStep(1);
    setIsDialogOpen(true);
  };

  const closeWizard = () => {
    setIsDialogOpen(false);
  };

  return (
    <>
      {/* Restart Process Card */}
      <Paper elevation={0} sx={{ p: 3, bgcolor: "#FFFFFF", textAlign: "center", border: "1px solid rgba(0,0,0,0.08)" }}>
        <Typography variant="h6" fontWeight={800} mb={2}>
          Restart Inventory Process
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Time to conduct inventory again?
        </Typography>
        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2, bgcolor: "#F44336", color: "#FFFFFF !important", fontWeight: 700, ":hover": { bgcolor: "#D32F2F" } }}
          onClick={openWizard}
        >
          Restart Process
        </Button>
      </Paper>

      {/* Two-Step Wizard */}
      <Dialog open={isDialogOpen} onClose={closeWizard}>
        <DialogTitle sx={{ bgcolor: "#FFFFFF", color: "#000000" }}>Restart Process</DialogTitle>
        <DialogContent sx={{ bgcolor: "#FFFFFF", color: "#000000" }}>
          {wizardStep === 1 ? (
            <Typography>
              Are you sure you want to restart the process? This will reset all progress.
            </Typography>
          ) : (
            <Typography>
              ⚠️ Final confirmation: This action will move all items to "To Review", reset "% Reviewed" to 0%, and clear all completed, shortages, damaged, and notes data. This cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ bgcolor: "#FFFFFF" }}>
          <Button onClick={closeWizard}>Cancel</Button>
          {wizardStep === 1 ? (
            <Button variant="contained" color="warning" onClick={() => setWizardStep(2)}>
              Continue
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                handleRestartProcess();
                closeWizard();
              }}
            >
              Confirm Restart
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
