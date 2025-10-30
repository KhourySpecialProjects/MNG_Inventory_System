import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import { Link } from "react-router-dom";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import SecurityIcon from "@mui/icons-material/Security";
import CircularProgressBar from "../components/CircularProgressBar";
import NavBar from "../components/NavBar";
import RestartProcess from "../components/RestartProcess";
import {
  AppBar,
  Box,
  Button,
  Card,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function HomePage() {
  const tasksCompleted = 30;
  const cardBorder = `1px solid ${alpha("#000", 0.08)}`;

  // TODO: should connect to actual counts in terms of data that was moved to "Reviewed"; is hourly a good frequency?
  const reviewData = [
    { hour: "1h ago", reviewed: 3 },
    { hour: "2h ago", reviewed: 4 },
    { hour: "3h ago", reviewed: 1 },
    { hour: "4h ago", reviewed: 5 },
    { hour: "5h ago", reviewed: 2 },
  ];

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* === Top NavBar === */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "#283996",
          borderBottom: `1px solid ${alpha("#000", 0.1)}`,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 60 } }}>
          <Stack
            direction="row"
            spacing={1.2}
            alignItems="center"
            sx={{ flexGrow: 1, color: "#FFFFFF", textDecoration: "none" }}
            component={Link}
            to="/"
          >
            <MilitaryTechIcon sx={{ color: "#FFFFFF" }} />
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, letterSpacing: 0.5, color: "#FFFFFF" }}
            >
              SupplyNet
            </Typography>
          </Stack>

          <Button
            component={Link}
            to="/signin"
            variant="contained"
            startIcon={<SecurityIcon />}
            sx={{
              bgcolor: "#D0A139",
              color: "#101214",
              ":hover": { bgcolor: "#B58827" },
              fontWeight: 800,
            }}
          >
            Sign In
          </Button>
        </Toolbar>
      </AppBar>

      {/* === Dashboard Content === */}
      <Box
        sx={{
          flex: 1,
          bgcolor: "#F4F4F1",
          p: { xs: 2, sm: 3, md: 4 },
          "&, & *": { color: "#000000 !important" }, // 🔥 All text black
        }}
      >
        <Grid container spacing={3}>
          {/* LEFT SIDE */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={3}>
              {/* Inventory Status */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: "#FFFFFF", border: cardBorder }}>
                <Typography variant="h6" fontWeight={800} mb={2}>
                  MNG Inventory's Inventory Status
                </Typography>

                <Grid container spacing={2}>
                  {[
                    { title: "To Review", value: "70" },
                    { title: "Completed", value: "25" },
                    { title: "Shortages", value: "3" },
                    { title: "Damaged", value: "2" },
                  ].map((item, i) => (
                    <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                      <Card
                        elevation={0}
                        sx={{
                          p: 3,
                          textAlign: "center",
                          border: cardBorder,
                          bgcolor: "#FFFFFF",
                        }}
                      >
                        <Typography variant="subtitle2">{item.title}</Typography>
                        <Typography variant="h4" fontWeight={800}>
                          {item.value}
                        </Typography>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Paper>

              {/* Inventory Reviewed */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: "#FFFFFF", border: cardBorder }}>
                <Typography variant="h6" fontWeight={800} mb={2}>
                  Inventory Reviewed
                </Typography>

                <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" spacing={3}>
                  <CircularProgressBar value={tasksCompleted} />

                  <Box sx={{ flex: 1, minHeight: 180 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                      Reviews in Last 5 Hours
                    </Typography>

                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={reviewData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E0E0E0" />
                        <XAxis dataKey="hour" tick={{ fill: "#000000", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#000000", fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip
                          cursor={{ fill: "rgba(40, 57, 150, 0.05)" }}
                          contentStyle={{ backgroundColor: "#FFFFFF", border: cardBorder, borderRadius: 6 }}
                          labelStyle={{ color: "#000000", fontWeight: 700 }}
                          itemStyle={{ color: "#000000" }}
                        />
                        <Bar dataKey="reviewed" fill="#283996" radius={[4, 4, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                    <Typography variant="caption" sx={{ mt: 1, display: "block", textAlign: "right" }}>
                      Last updated 1 hr ago
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              {/* Follow-Ups */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: "#FFFFFF", border: cardBorder }}>
                <Typography variant="h6" fontWeight={800} mb={2}>
                  Follow-Ups
                </Typography>
                <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", "& th, & td": { textAlign: "left", padding: "8px", borderBottom: "1px solid #E0E0E0", color: "#000000 !important" }, "& th": { bgcolor: "#F9F9F9", fontWeight: 700 } }}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Kit</th>
                      <th>Status</th>
                      <th>Reviewd On</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Bandages</td>
                      <td>First Aid Kit</td>
                      <td>Shortages</td>
                      <td>10/19/25</td>
                      <td>Missing one stack from kit</td>
                    </tr>
                    <tr>
                      <td>Robot</td>
                      <td>Robot</td>
                      <td>Damaged</td>
                      <td>10/18/25</td>
                      <td>Dent in the right side, sent to maintenance</td>
                    </tr>
                  </tbody>
                </Box>
              </Paper>
            </Stack>
          </Grid>

          {/* RIGHT SIDE */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              {/* Recent Notes */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: "#FFFFFF", border: cardBorder }}>
                <Typography variant="h6" fontWeight={800} mb={2}>
                  Recent Notes
                </Typography>
                <List dense>
                  <ListItem disableGutters>
                    <ListItemText primary="Microphone: Inspected and verified (10/25/25)" />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText primary="Travel Case: All contents present (10/23/25)" />
                  </ListItem>
                  <ListItem disableGutters>
                    <ListItemText primary="Micro USB Cable: Tested and verified (10/21/25)" />
                  </ListItem>
                </List>
              </Paper>

              {/* Team Activity */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: "#FFFFFF", border: cardBorder }}>
                <Typography variant="h6" fontWeight={800} mb={2}>
                  Team Activity
                </Typography>

                <Box sx={{ width: "100%", height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: "Charlie", completed: 2, shortages: 1, damaged: 0 },
                        { name: "Dana", completed: 3, shortages: 0, damaged: 1 },
                        { name: "Alice", completed: 1, shortages: 1, damaged: 0 },
                        { name: "Bob", completed: 2, shortages: 0, damaged: 0 },
                      ]}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E0E0E0" />
                      <XAxis dataKey="name" tick={{ fill: "#000000", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#000000", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: "rgba(40, 57, 150, 0.05)" }}
                        contentStyle={{ backgroundColor: "#FFFFFF", border: cardBorder, borderRadius: 6 }}
                        labelStyle={{ color: "#000000", fontWeight: 700 }}
                        itemStyle={{ color: "#000000" }}
                      />
                      <Bar dataKey="completed" stackId="a" fill="#4CAF50" name="Completed" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="shortages" stackId="a" fill="#FFEB3B" name="Shortages" />
                      <Bar dataKey="damaged" stackId="a" fill="#F44336" name="Damaged" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>

                <Stack direction="row" justifyContent="center" spacing={3} sx={{ mt: 2, flexWrap: "wrap" }}>
                  {[
                    { label: "Completed", color: "#4CAF50" },
                    { label: "Shortages", color: "#FFEB3B" },
                    { label: "Damaged", color: "#F44336" },
                  ].map((item, i) => (
                    <Stack key={i} direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: 16, height: 16, bgcolor: item.color, borderRadius: 0.5 }} />
                      <Typography variant="body2">{item.label}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>

              {/* Add Inventory */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: "#FFFFFF", border: cardBorder, textAlign: "center" }}>
                <Typography variant="h6" fontWeight={800} mb={2}>
                  Add Inventory
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Register new inventory items to be reviewed
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  sx={{ bgcolor: "#283996", color: "#FFFFFF !important", fontWeight: 700, ":hover": { bgcolor: "#1f2d7d" } }}
                >
                  Add New Inventory Item
                </Button>
              </Paper>

              {/* Restart Inventory Process */}
              <RestartProcess />
            </Stack>
          </Grid>
        </Grid>
      </Box>

      <NavBar />
    </Box>
  );
}
