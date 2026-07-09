/**
 * WebSocket handler — polls SABnzbd queue every 5s and emits queue_update events
 */
const SABNZBD_URL = process.env.SABNZBD_URL || 'http://127.0.0.1:8080';
const SABNZBD_API_KEY = process.env.SABNZBD_API_KEY || '';
const POLL_INTERVAL = 5000; // 5 seconds

async function fetchQueueStatus() {
  if (!SABNZBD_API_KEY) return null;

  try {
    const params = new URLSearchParams({
      apikey: SABNZBD_API_KEY,
      mode: 'queue',
      output: 'json',
    });

    const url = `${SABNZBD_URL}/api?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();
    clearTimeout(timer);

    if (!data || !data.queue) return null;

    const queue = data.queue;
    const active = [];
    const paused = [];

    if (queue.slots) {
      queue.slots.forEach(slot => {
        const item = {
          nzo_id: slot.nzo_id || '',
          filename: slot.filename || '',
          mb: parseFloat(slot.mb) || 0,
          mb_left: parseFloat(slot.mb_left) || 0,
          percentage: parseFloat(slot.percentage) || 0,
          speed: slot.status === 'Paused' ? '0' : (slot.speed || '0'),
          eta: slot.timeleft || '0:00:00',
          status: slot.status || 'unknown',
          category: slot.cat || '',
        };

        if (slot.status === 'Paused') {
          paused.push(item);
        } else {
          active.push(item);
        }
      });
    }

    return {
      active,
      paused,
      speed: queue.speed || '0 B/s',
      eta: queue.timeleft || '0:00:00',
      status: queue.status || 'Unknown',
      paused_status: queue.paused || false,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error('[ws:queue] fetch error:', err.message);
    return null;
  }
}

function initWebSocket(io) {
  let pollTimer = null;
  let clientCount = 0;

  const startPolling = () => {
    if (pollTimer) return;

    const poll = async () => {
      const status = await fetchQueueStatus();
      if (status) {
        io.emit('queue_update', status);
      }
    };

    // Initial poll
    poll();
    pollTimer = setInterval(poll, POLL_INTERVAL);
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  io.on('connection', (socket) => {
    clientCount++;

    // Send current status immediately on connect
    (async () => {
      const status = await fetchQueueStatus();
      if (status) {
        socket.emit('queue_update', status);
      }
    })();

    // Start global poll if not already running
    startPolling();

    socket.on('disconnect', () => {
      clientCount--;
      if (clientCount <= 0) {
        clientCount = 0;
        stopPolling();
      }
    });
  });
}

module.exports = { initWebSocket, fetchQueueStatus };