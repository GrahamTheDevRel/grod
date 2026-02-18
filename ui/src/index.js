import React from "react"
import ReactDOM from "react-dom/client"
import Dashboard from "./pages/Dashboard.jsx"
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material"

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
})

const root = ReactDOM.createRoot(document.getElementById("root"))
root.render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Dashboard />
    </ThemeProvider>
  </React.StrictMode>,
)
