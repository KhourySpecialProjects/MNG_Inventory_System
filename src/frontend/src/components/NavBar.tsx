// components/BottomNav.tsx
import React from "react";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import CheckBoxBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import OutboxIcon from "@mui/icons-material/Outbox";
import { useLocation, useNavigate } from "react-router-dom";

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Paper
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        // Prevents Font Size changing when highlighted
        "& .MuiBottomNavigationAction-label": {
        fontSize: "0.75rem",
        transition: "none",
        }
      }}
      elevation={3}
    >
      <BottomNavigation
        showLabels
        value={location.pathname}
        onChange={(event, newValue) => navigate(newValue)}
      >
        <BottomNavigationAction label="Home" value="/" icon={<HomeIcon />} />
        <BottomNavigationAction label="To Review" value="/to-review" icon={<CheckBoxBlankIcon />} />
        <BottomNavigationAction label="Reviewed" value="/reviewed" icon={<CheckBoxIcon />} />
        <BottomNavigationAction label="Send" value="/send" icon={<OutboxIcon />} />
      </BottomNavigation>
    </Paper>
  );
}
