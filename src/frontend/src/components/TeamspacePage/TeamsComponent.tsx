import {
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  CircularProgress,
  Box,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { MouseEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface TeamIconProps {
  id: string;
  name: string;
  description?: string;
  percent?: number;
  onInvite?: (teamName: string) => void;
  onRemove?: (teamName: string) => void;
  onDelete?: (teamName: string) => void;
  onViewMembers?: (teamId: string, teamName: string) => void;
}

export default function TeamIcon({
  id,
  name,
  description,
  percent = 0,
  onInvite,
  onRemove,
  onDelete,
  onViewMembers,
}: TeamIconProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenu = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);
  const handleOpenTeam = () => navigate(`/teams/home/${id}`);

  const borderColor = alpha(theme.palette.text.primary, 0.1);
  const hoverShadow = alpha(theme.palette.primary.main, 0.25);

  // background color behind the % circle
  const bgColor = alpha(theme.palette.success.main, 0.15);

  return (
    <>
      <Card
        sx={{
          position: 'relative',
          borderRadius: 3,
          bgcolor: theme.palette.background.paper,
          border: `1px solid ${borderColor}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          transition: 'all 0.25s ease',
          cursor: 'pointer',
          '&:hover': {
            transform: 'translateY(-5px)',
            borderColor: theme.palette.primary.main,
            boxShadow: `0 8px 24px ${hoverShadow}`,
          },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          p: 2,
        }}
      >
        <CardActionArea
          onClick={handleOpenTeam}
          sx={{
            borderRadius: 3,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CardContent>
            <Stack alignItems="center" spacing={1.4}>

              <Box
                sx={{
                  position: 'relative',
                  width: 80,
                  height: 80,
                  borderRadius: 2,
                  backgroundColor: bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress
                  variant="determinate"
                  value={percent}
                  size={80}
                  thickness={5}
                  sx={{
                    color: theme.palette.success.main,
                    position: 'absolute',
                    '& .MuiCircularProgress-circle': {
                      strokeLinecap: 'round',
                    },
                  }}
                />

                <Typography
                  variant="subtitle1"
                  fontWeight={800}
                  sx={{ color: theme.palette.text.primary, position: 'relative' }}
                >
                  {percent}%
                </Typography>
              </Box>

              {/* NAME */}
              <Tooltip title={name}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 800,
                    color: theme.palette.text.primary,
                    textAlign: 'center',  
                    maxWidth: 180,
                  }}
                  noWrap
                >
                  {name}
                </Typography>
              </Tooltip>

              {/* DESCRIPTION */}
              <Tooltip title={description || 'No description'}>
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.secondary,
                    fontSize: 13,
                    textAlign: 'center',
                    maxWidth: 200,
                  }}
                  noWrap
                >
                  {description || 'No description'}
                </Typography>
              </Tooltip>
            </Stack>
          </CardContent>
        </CardActionArea>

        {/* MENU */}
        <IconButton
          size="small"
          onClick={handleMenu}
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            color: theme.palette.text.secondary,
            '&:hover': { color: theme.palette.primary.main },
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Card>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { handleClose(); handleOpenTeam(); }}>Open</MenuItem>

        <MenuItem onClick={() => { handleClose(); onViewMembers?.(id, name); }}>
          View Members
        </MenuItem>

        <MenuItem onClick={() => { handleClose(); onInvite?.(name); }}>
          Invite Member
        </MenuItem>

        <Divider />

        <MenuItem sx={{ color: 'error.main' }} onClick={() => { handleClose(); onRemove?.(name); }}>
          Remove Member
        </MenuItem>

        <MenuItem sx={{ color: 'error.main' }} onClick={() => { handleClose(); onDelete?.(name); }}>
          Delete Teamspace
        </MenuItem>
      </Menu>
    </>
  );
}