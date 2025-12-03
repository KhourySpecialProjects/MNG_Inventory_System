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
import { MouseEvent, useState, useRef, useLayoutEffect } from 'react';
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

  function getColor(p: number) {
    const clamp = Math.max(0, Math.min(100, p));

    // 100% = Green
    if (clamp === 100) {
      return theme.palette.success.main;
    }

    // Red to Yellow (0% to 50%)
    if (clamp <= 50) {
      const t = clamp / 50;
      const r = Math.round(211 + (251 - 211) * t);
      const g = Math.round(47 + (192 - 47) * t);
      const b = Math.round(47 + (45 - 47) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }

    // Yellow to Light Green (50% to 99%)
    const t = (clamp - 50) / 50;
    const r = Math.round(251 - (251 - 139) * t); // 251 → 139
    const g = Math.round(192 - (192 - 195) * t); // 192 → 195
    const b = Math.round(45 + (71 - 45) * t);    // 45 → 71
    return `rgb(${r}, ${g}, ${b})`;
  }

  const ringColor = getColor(percent);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function updateScale() {
      const el = containerRef.current;
      if (!el) {
        setScale(1);
        return;
      }

      const { width } = el.getBoundingClientRect();
      const target = 200;
      const newScale = Math.min(Math.max(width / target, 0.9), 1.4);
      setScale(newScale);
    }

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const ringSize = Math.max(52, Math.min(72 * scale, 90));

  return (
    <>
      <Card
        sx={{
          position: 'relative',
          borderRadius: 3,
          bgcolor: theme.palette.background.paper,
          border: `1px solid ${borderColor}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          '&:hover': {
            transform: 'translateY(-4px)',
            borderColor: alpha(theme.palette.primary.main, 0.5),
            boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.15)}`,
          },
          p: { xs: 1.2, sm: 2 },
          width: '100%',
        }}
      >
        <CardActionArea onClick={handleOpenTeam} sx={{ borderRadius: 3, width: '100%' }}>
          <CardContent sx={{ p: { xs: 1.5, sm: 2.2 } }}>
            <Box
              ref={containerRef}
              sx={{
                width: '100%',
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
              }}
            >
              <Stack alignItems="center" spacing={1.8} sx={{ textAlign: 'center' }}>
                <Box 
                  sx={{ 
                    position: 'relative', 
                    width: ringSize, 
                    height: ringSize,
                  }}
                >
                  <CircularProgress
                    variant="determinate"
                    value={100}
                    size={ringSize}
                    thickness={4}
                    sx={{
                      color: alpha(theme.palette.text.primary, 0.1),
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }}
                  />

                  <CircularProgress
                    variant="determinate"
                    value={percent}
                    size={ringSize}
                    thickness={4}
                    sx={{
                      color: ringColor,
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      '& .MuiCircularProgress-circle': {
                        strokeLinecap: 'round',
                      },
                    }}
                  />

                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography
                      fontSize="clamp(11px, 1.5vw, 18px)"
                      fontWeight={800}
                      sx={{ 
                        color: theme.palette.text.primary,
                      }}
                    >
                      {percent}%
                    </Typography>
                  </Box>
                </Box>

                <Tooltip title={name}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      color: theme.palette.text.primary,
                      maxWidth: 180,
                      fontSize: 'clamp(13px, 1.4vw, 17px)',
                    }}
                    noWrap
                  >
                    {name}
                  </Typography>
                </Tooltip>

                <Tooltip title={description || 'No description'}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme.palette.text.secondary,
                      fontSize: 'clamp(10px, 1.1vw, 13px)',
                      maxWidth: 200,
                    }}
                  >
                    {description || 'No description'}
                  </Typography>
                </Tooltip>
              </Stack>
            </Box>
          </CardContent>
        </CardActionArea>

        <IconButton
          size="small"
          onClick={handleMenu}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: theme.palette.text.secondary,
            transition: 'color 0.2s ease',
            '&:hover': { 
              color: theme.palette.primary.main,
            },
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
        <MenuItem onClick={() => { handleClose(); onViewMembers?.(id, name); }}>View Members</MenuItem>
        <MenuItem onClick={() => { handleClose(); onInvite?.(name); }}>Invite Member</MenuItem>

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