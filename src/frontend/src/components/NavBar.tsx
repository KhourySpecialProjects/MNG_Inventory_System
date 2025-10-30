import React from "react";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import CheckBoxBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import OutboxIcon from "@mui/icons-material/Outbox";
import { useNavigate, useLocation } from "react-router-dom";

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Highlight "Home" when on /home
  const currentValue = location.pathname === "/home" ? "home" : "";

  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    if (newValue === "home") {
      navigate("/home");
    }
  };

  return (
    <Paper
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        "& .MuiBottomNavigationAction-label": {
          fontSize: "0.75rem",
          transition: "none",
        },
      }}
      elevation={3}
    >
      <BottomNavigation showLabels value={currentValue} onChange={handleChange}>
        <BottomNavigationAction label="Home" value="home" icon={<HomeIcon />} />
        <BottomNavigationAction label="To Review" value="toReview" icon={<CheckBoxBlankIcon />} />
        <BottomNavigationAction label="Reviewed" value="reviewed" icon={<CheckBoxIcon />} />
        <BottomNavigationAction label="Send" value="send" icon={<OutboxIcon />} />
      </BottomNavigation>
    </Paper>
  );
}
