import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";
import React from "react";
import SignInPage from "../src/pages/SignInPage";

const renderWithRouter = (ui: React.ReactNode) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("SignInPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("renders all input fields and login button", () => {
    renderWithRouter(<SignInPage />);
    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  test("login button is disabled initially", () => {
    renderWithRouter(<SignInPage />);
    const button = screen.getByRole("button", { name: /login/i });
    expect(button).toBeDisabled();
  });

  test("login button enables when both fields are filled", () => {
    renderWithRouter(<SignInPage />);
    const identifierInput = screen.getByLabelText(/username or email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const button = screen.getByRole("button", { name: /login/i });

    fireEvent.change(identifierInput, { target: { value: "john_doe" } });
    expect(button).toBeDisabled(); // still disabled, password empty

    fireEvent.change(passwordInput, { target: { value: "MyPassword123" } });
    expect(button).not.toBeDisabled(); // both filled → enabled

    fireEvent.change(identifierInput, { target: { value: "" } });
    expect(button).toBeDisabled(); // one field cleared → disabled again
  });

  test("allows any input for email or username", () => {
    renderWithRouter(<SignInPage />);
    const identifierInput = screen.getByLabelText(/username or email/i);

    fireEvent.change(identifierInput, { target: { value: "invalid@@@" } });
    expect(identifierInput).toHaveValue("invalid@@@");

    fireEvent.change(identifierInput, { target: { value: "john@example.com" } });
    expect(identifierInput).toHaveValue("john@example.com");
  });

  test("navigates to home page on form submit when all fields filled", async () => {
    const mockNavigate = vi.fn();

    vi.mock("react-router-dom", async () => {
      const actual = (await vi.importActual<typeof import("react-router-dom")>(
        "react-router-dom"
      )) as typeof import("react-router-dom");
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });

    // Use dynamic import for mocked module to take effect
    const { default: SignInPageMocked } = await import("../src/pages/SignInPage");

    renderWithRouter(<SignInPageMocked />);

    fireEvent.change(screen.getByLabelText(/username or email/i), {
      target: { value: "john_doe" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "MyPassword123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
