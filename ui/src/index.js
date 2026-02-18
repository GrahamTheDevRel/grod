import React, { useState } from "react"
import ReactDOM from "react-dom/client"
import Dashboard from "./pages/Dashboard.jsx"
import Designer from "./pages/Designer.jsx"
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material"

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
})

const App = () => {
  const [view, setView] = useState("dashboard")

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {view === "dashboard" ? (
        <Dashboard onOpenDesigner={() => setView("designer")} />
      ) : (
        <Designer onBack={() => setView("dashboard")} />
      )}
    </ThemeProvider>
  )
}

const root = ReactDOM.createRoot(document.getElementById("root"))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
