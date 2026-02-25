/**
 * Responsive grid layout for template cards.
 * Each card displays the template name and description with a context menu for deletion.
 */
import {
  Grid,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import InventoryIcon from '@mui/icons-material/Inventory';
import { MouseEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export interface Template {
  templateId: string;
  name: string;
  description?: string;
  status?: string;
  createdAt?: string;
}

interface TemplatesGridProps {
  templates: Template[];
  onDelete: (templateId: string, templateName: string) => void;
}

function TemplateCard({
  template,
  onDelete,
}: {
  template: Template;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const borderColor = alpha(theme.palette.text.primary, 0.1);

  const handleMenu = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

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
        <CardActionArea
          onClick={() => navigate(`/templates/${template.templateId}`)}
          sx={{ borderRadius: 3, width: '100%' }}
        >
          <CardContent sx={{ p: { xs: 1.5, sm: 2.2 } }}>
            <Stack alignItems="center" spacing={1.8} sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.warning.main, 0.12),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <InventoryIcon
                  sx={{
                    fontSize: 28,
                    color: theme.palette.warning.main,
                  }}
                />
              </Box>

              <Tooltip title={template.name}>
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
                  {template.name}
                </Typography>
              </Tooltip>

              <Tooltip title={template.description || 'No description'}>
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.secondary,
                    fontSize: 'clamp(10px, 1.1vw, 13px)',
                    maxWidth: 200,
                  }}
                  noWrap
                >
                  {template.description || 'No description'}
                </Typography>
              </Tooltip>
            </Stack>
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
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            handleClose();
            onDelete();
          }}
        >
          Delete Template
        </MenuItem>
      </Menu>
    </>
  );
}

export default function TemplatesGrid({ templates, onDelete }: TemplatesGridProps) {
  return (
    <Grid
      container
      spacing={{ xs: 2, sm: 2.5, md: 3 }}
      sx={{
        px: { xs: 1.5, sm: 2, md: 3 },
      }}
    >
      {templates.map((template) => (
        <Grid key={template.templateId} size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}>
          <Box
            sx={{
              width: '100%',
              aspectRatio: '1 / 1',
              display: 'flex',
              '& > *': {
                width: '100%',
                height: '100%',
                minWidth: 0,
              },
            }}
          >
            <TemplateCard
              template={template}
              onDelete={() => onDelete(template.templateId, template.name)}
            />
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}
