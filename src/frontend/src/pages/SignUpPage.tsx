import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
  Link as MuiLink,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { Visibility, VisibilityOff, CheckCircle, Cancel } from "@mui/icons-material";

function SignUpPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  // === Live validation logic ===
  const emailValid = email.endsWith("@military.gov");

  const passwordRequirements = {
    minLength: password.length >= 10,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };

  const allPasswordValid = Object.values(passwordRequirements).every(Boolean);
  const passwordsMatch = password !== "" && password === confirmPassword;

  // ✅ Removed username length requirement
  const allValid = emailValid && allPasswordValid && passwordsMatch;

  const handleSignUp = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!allValid) return;
    navigate("/");
  };

  const renderRequirement = (label: string, met: boolean) => (
    <Box display="flex" alignItems="center" gap={1}>
      {met ? (
        <CheckCircle fontSize="small" color="success" />
      ) : (
        <Cancel fontSize="small" color="error" />
      )}
      <Typography
        variant="body2"
        color={met ? "success.main" : "text.secondary"}
      >
        {label}
      </Typography>
    </Box>
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        bgcolor: "#f5f6fa",
        p: 2,
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 420,
          boxShadow: 3,
          borderRadius: 3,
          p: 2,
          backgroundColor: "white",
        }}
      >
        <CardContent>
          <Typography variant="h4" fontWeight="bold" align="center" mb={1}>
            Create Account
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            align="center"
            mb={3}
          >
            Please fill in your details to sign up
          </Typography>

          <Box
            component="form"
            display="flex"
            flexDirection="column"
            gap={2}
            onSubmit={handleSignUp}
          >
            {/* Username */}
            <TextField
              label="Username"
              variant="outlined"
              fullWidth
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              slotProps={{
                input: { sx: { bgcolor: "#fafafa", borderRadius: 2 } },
              }}
            />

            {/* Email */}
            <TextField
              label="Email"
              type="email"
              variant="outlined"
              fullWidth
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={!emailValid && email !== ""}
              slotProps={{
                input: { sx: { bgcolor: "#fafafa", borderRadius: 2 } },
              }}
            />

            {/* Email requirement display */}
            <Box sx={{ ml: 1, mb: 1 }}>
              {renderRequirement(
                "Ends with @military.gov",
                email === "" ? false : emailValid
              )}
            </Box>

            {/* Password */}
            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              variant="outlined"
              fullWidth
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              slotProps={{
                input: {
                  sx: { bgcolor: "#fafafa", borderRadius: 2 },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Password requirements */}
            <Box sx={{ ml: 1, mb: 1 }}>
              {renderRequirement("At least 10 characters", passwordRequirements.minLength)}
              {renderRequirement("At least one uppercase letter", passwordRequirements.uppercase)}
              {renderRequirement("At least one lowercase letter", passwordRequirements.lowercase)}
              {renderRequirement("At least one number", passwordRequirements.number)}
            </Box>

            {/* Confirm Password */}
            <TextField
              label="Confirm Password"
              type={showConfirmPassword ? "text" : "password"}
              variant="outlined"
              fullWidth
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              slotProps={{
                input: {
                  sx: { bgcolor: "#fafafa", borderRadius: 2 },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        edge="end"
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Password match indicator */}
            <Box sx={{ ml: 1, mb: 1 }}>
              {renderRequirement("Passwords match", passwordsMatch)}
            </Box>

            {/* Submit */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={!allValid}
              sx={{
                borderRadius: 2,
                bgcolor: allValid ? "#1976d2" : "grey.400",
                textTransform: "none",
                fontSize: "1rem",
                py: 1,
                "&:hover": {
                  bgcolor: allValid ? "#1565c0" : "grey.500",
                },
              }}
            >
              Sign Up
            </Button>

            {/* Sign-in link */}
            <Typography variant="body2" align="center" mt={1}>
              <Box component="span" fontWeight="bold">
                Already have an account?
              </Box>{" "}
              <MuiLink
                component={Link}
                to="/signin"
                underline="none"
                sx={{ color: "#1976d2" }}
              >
                Login
              </MuiLink>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default SignUpPage;
