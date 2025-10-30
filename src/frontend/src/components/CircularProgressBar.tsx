import { useState, useEffect } from "react";
import {
  Box,
  CircularProgress,
  Typography,
} from "@mui/material";

// TODO: split up into a pie chart with different Reviewed statuses (completed, shortages, damaged)
export default function CircularProgressBar({ value = 30 }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 800;
    const steps = 30;
    const stepTime = duration / steps;
    const increment = value / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        start = value;
        clearInterval(timer);
      }
      setProgress(Math.round(start));
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <Box
        sx={{
          width: { xs: 100, sm: 120, md: 140 },
          height: { xs: 100, sm: 120, md: 140 },
          position: "relative",
        }}
      >
        {/* Background track */}
        <CircularProgress
          variant="determinate"
          value={100}
          thickness={6}
          sx={{
            width: "100% !important",
            height: "100% !important",
            color: "#e8f5e9", // ✅ lighter background track
          }}
        />

        {/* Animated green progress */}
        <CircularProgress
          variant="determinate"
          value={progress}
          thickness={6}
          sx={{
            width: "100% !important",
            height: "100% !important",
            position: "absolute",
            left: 0,
            top: 0,
            "& .MuiCircularProgress-circle": {
              stroke: "#66bb6a", // green progress
              strokeLinecap: "round",
            },
          }}
        />

        {/* Centered Text */}
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <Typography
            sx={{
              color: "#000000",
              fontWeight: 800,
              fontSize: { xs: "1.1rem", sm: "1.3rem", md: "1.5rem" },
            }}
          >
            {progress}%
          </Typography>
          <Typography
            sx={{
              color: "#000000",
              fontWeight: 600,
              fontSize: { xs: "0.75rem", sm: "0.9rem", md: "1rem" },
              textTransform: "lowercase",
            }}
          >
            reviewed
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}