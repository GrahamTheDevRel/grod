import React, { useState, useEffect } from "react"
import {
  Container,
  Grid,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Card,
  CardContent,
} from "@mui/material"
import { io } from "socket.io-client"
import axios from "axios"

const socket = io("http://localhost:3001")

function Dashboard() {
  const [jobs, setJobs] = useState([])
  const [metrics, setMetrics] = useState({
    performance: {},
    budget: { totalSpend: 0 },
  })

  useEffect(() => {
    // Initial fetch
    axios.get("http://localhost:3001/api/jobs").then((res) => setJobs(res.data))
    axios
      .get("http://localhost:3001/api/metrics")
      .then((res) => setMetrics(res.data))

    // Listen for updates
    socket.on("job:updated", (updatedJob) => {
      setJobs((prevJobs) => {
        const index = prevJobs.findIndex((j) => j.id === updatedJob.id)
        if (index >= 0) {
          const newJobs = [...prevJobs]
          newJobs[index] = updatedJob
          return newJobs
        }
        return [updatedJob, ...prevJobs]
      })
    })

    return () => socket.off("job:updated")
  }, [])

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Grod Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* Metrics Cards */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Jobs
              </Typography>
              <Typography variant="h5">
                {jobs.filter((j) => j.status === "running").length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Spend
              </Typography>
              <Typography variant="h5">
                ${metrics.budget.totalSpend?.toFixed(4) || "0.0000"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Error Rate
              </Typography>
              <Typography variant="h5">
                {metrics.performance.errorRate?.toFixed(2) || "0.00"}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Job List */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: "flex", flexDirection: "column" }}>
            <Typography variant="h6" gutterBottom>
              Recent Jobs
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>Duration</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>{job.id}</TableCell>
                      <TableCell>{job.status}</TableCell>
                      <TableCell>
                        {new Date(job.startTime).toLocaleTimeString()}
                      </TableCell>
                      <TableCell>
                        {job.duration
                          ? `${(job.duration / 1000).toFixed(2)}s`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}

export default Dashboard
