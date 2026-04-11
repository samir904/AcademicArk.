// In-memory job store (fine for single-server, single-admin use)
export const bulkJobs = new Map();
// shape: { total, done, current, results: { success[], failed[], skipped[] } }

export const bulkUploadProgress = (req, res) => {
  const { jobId } = req.params;

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const interval = setInterval(() => {
    const job = bulkJobs.get(jobId);
    if (!job) {
      send({ status: 'not_found' });
      return;
    }
    send({
      status:  job.done >= job.total ? 'complete' : 'in_progress',
      done:    job.done,
      total:   job.total,
      current: job.current,
      results: job.results,
    });
    if (job.done >= job.total) {
      clearInterval(interval);
      res.end();
      // Clean up after 60s
      setTimeout(() => bulkJobs.delete(jobId), 60_000);
    }
  }, 800);

  req.on('close', () => clearInterval(interval));
};