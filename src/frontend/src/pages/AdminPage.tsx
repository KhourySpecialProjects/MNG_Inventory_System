import React, { useState } from 'react';
import { Box, Container, Tabs, Tab, Paper, Button } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TopBar from '../components/TopBar';
import Profile from '../components/Profile';
import RoleManagementTab from '../components/admin/RoleManagementTab';
import UserRoleAssignmentTab from '../components/admin/UserRoleAssignmentTab';
import { useNavigate } from 'react-router-dom';

export default function AdminPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: theme.palette.background.default }}>
      <TopBar isLoggedIn onProfileClick={() => setProfileOpen(true)} />

      <Box sx={{ m: { xs: 2, sm: 3, md: 4 } }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/teams')}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            color: theme.palette.text.primary,
            transition: 'all 0.2s ease',
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
          }}
        >
          Back to Teams
        </Button>
      </Box>
      <Container maxWidth="lg" sx={{ pb: 4 }}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: theme.palette.background.paper,
              px: 2,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
              },
            }}
          >
            <Tab label="Roles" />
            <Tab label="User Management" />
          </Tabs>

          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {activeTab === 0 && <RoleManagementTab />}
            {activeTab === 1 && <UserRoleAssignmentTab />}
          </Box>
        </Paper>
      </Container>

      <Profile open={profileOpen} onClose={() => setProfileOpen(false)} />
    </Box>
  );
}