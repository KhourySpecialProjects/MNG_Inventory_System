import React, { useState } from "react";
import {
  Box,
  Stack,
  TextField,
  Typography,
  Chip,
  Button,
  Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

export default function DamageReportsSection({
  isEditMode,
  editedProduct,
  damageReports,
  setDamageReports,
}: {
  isEditMode: boolean;
  editedProduct: any;
  damageReports: string[];
  setDamageReports: (v: string[]) => void;
}) {
  const [current, setCurrent] = useState("");

  const addReport = () => {
    if (current.trim()) {
      setDamageReports([...damageReports, current.trim()]);
      setCurrent("");
    }
  };

  const removeReport = (i: number) => {
    setDamageReports(damageReports.filter((_, idx) => idx !== i));
  };

  if (editedProduct.status !== "Damaged" && !isEditMode) return null;

  return (
    <Box sx={{ p: 2, bgcolor: "#fff3e0", borderRadius: 2, mb: 2 }}>
      <Typography variant="subtitle1" fontWeight="bold">
        Damage Reports
      </Typography>
      {damageReports.length === 0 ? (
        <Alert severity="info" sx={{ my: 1 }}>
          No damage reports yet.
        </Alert>
      ) : (
        <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ my: 1 }}>
          {damageReports.map((r, i) => (
            <Chip
              key={i}
              label={r}
              onDelete={isEditMode ? () => removeReport(i) : undefined}
              deleteIcon={isEditMode ? <DeleteIcon /> : undefined}
              sx={{ bgcolor: "#ffe0b2" }}
            />
          ))}
        </Stack>
      )}
      {isEditMode && (
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Describe damage..."
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addReport();
              }
            }}
          />
          <Button variant="outlined" onClick={addReport}>
            Add
          </Button>
        </Stack>
      )}
    </Box>
  );
}
