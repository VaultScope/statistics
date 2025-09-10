import { Router, Request, Response } from 'express';
import alertModel from '../models/alerts';
import alertEngine from '../services/alertEngine';
import authenticate from '../functions/auth';

const router = Router();

// Middleware to check permissions - using authenticate middleware
const requireAlertPermission = authenticate(['viewStats']);

// Get all alerts
router.get('/alerts', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const alerts = alertModel.getAllAlerts();
    res.json(alerts);
  } catch (error) {
    console.error('Failed to get alerts:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Get alerts for a specific node
router.get('/alerts/node/:nodeId', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const nodeId = parseInt(req.params.nodeId);
    const alerts = alertModel.getAlertsByNode(nodeId);
    res.json(alerts);
  } catch (error) {
    console.error('Failed to get node alerts:', error);
    res.status(500).json({ error: 'Failed to get node alerts' });
  }
});

// Get a specific alert
router.get('/alerts/:id', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const alert = alertModel.getAlert(id);
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(alert);
  } catch (error) {
    console.error('Failed to get alert:', error);
    res.status(500).json({ error: 'Failed to get alert' });
  }
});

// Create a new alert
router.post('/alerts', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const { nodeId, metric, condition, threshold, severity, enabled = true, cooldown = 5 } = req.body;
    
    if (!nodeId || !metric || !condition || threshold === undefined || !severity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const alert = alertModel.createAlert({
      nodeId,
      metric,
      condition,
      threshold,
      severity,
      enabled,
      cooldown,
      lastTriggered: undefined
    });
    
    res.status(201).json(alert);
  } catch (error) {
    console.error('Failed to create alert:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Update an alert
router.patch('/alerts/:id', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    
    const success = alertModel.updateAlert(id, updates);
    
    if (!success) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    const updatedAlert = alertModel.getAlert(id);
    res.json(updatedAlert);
  } catch (error) {
    console.error('Failed to update alert:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Delete an alert
router.delete('/alerts/:id', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const success = alertModel.deleteAlert(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// Get alert history
router.get('/alerts/history/recent', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const history = alertModel.getRecentAlerts(limit);
    res.json(history);
  } catch (error) {
    console.error('Failed to get alert history:', error);
    res.status(500).json({ error: 'Failed to get alert history' });
  }
});

// Acknowledge an alert
router.post('/alerts/history/:id/acknowledge', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { acknowledgedBy } = req.body;
    
    if (!acknowledgedBy) {
      return res.status(400).json({ error: 'acknowledgedBy is required' });
    }
    
    const success = alertModel.acknowledgeAlert(id, acknowledgedBy);
    
    if (!success) {
      return res.status(404).json({ error: 'Alert history not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to acknowledge alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Get all notification channels
router.get('/notification-channels', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const channels = alertModel.getAllChannels();
    res.json(channels);
  } catch (error) {
    console.error('Failed to get notification channels:', error);
    res.status(500).json({ error: 'Failed to get notification channels' });
  }
});

// Create a notification channel
router.post('/notification-channels', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const { name, type, config, enabled = true } = req.body;
    
    if (!name || !type || !config) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate config is valid JSON
    try {
      JSON.parse(config);
    } catch {
      return res.status(400).json({ error: 'Config must be valid JSON' });
    }
    
    const channel = alertModel.createChannel({
      name,
      type,
      config,
      enabled
    });
    
    res.status(201).json(channel);
  } catch (error) {
    console.error('Failed to create notification channel:', error);
    res.status(500).json({ error: 'Failed to create notification channel' });
  }
});

// Update a notification channel
router.patch('/notification-channels/:id', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    
    // Validate config if provided
    if (updates.config) {
      try {
        JSON.parse(updates.config);
      } catch {
        return res.status(400).json({ error: 'Config must be valid JSON' });
      }
    }
    
    const success = alertModel.updateChannel(id, updates);
    
    if (!success) {
      return res.status(404).json({ error: 'Notification channel not found' });
    }
    
    const updatedChannel = alertModel.getChannel(id);
    res.json(updatedChannel);
  } catch (error) {
    console.error('Failed to update notification channel:', error);
    res.status(500).json({ error: 'Failed to update notification channel' });
  }
});

// Delete a notification channel
router.delete('/notification-channels/:id', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const success = alertModel.deleteChannel(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Notification channel not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete notification channel:', error);
    res.status(500).json({ error: 'Failed to delete notification channel' });
  }
});

// Link alert to notification channel
router.post('/alerts/:alertId/channels/:channelId', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const alertId = parseInt(req.params.alertId);
    const channelId = parseInt(req.params.channelId);
    
    const success = alertModel.linkAlertToChannel(alertId, channelId);
    
    if (!success) {
      return res.status(400).json({ error: 'Failed to link alert to channel (may already exist)' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to link alert to channel:', error);
    res.status(500).json({ error: 'Failed to link alert to channel' });
  }
});

// Unlink alert from notification channel
router.delete('/alerts/:alertId/channels/:channelId', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const alertId = parseInt(req.params.alertId);
    const channelId = parseInt(req.params.channelId);
    
    const success = alertModel.unlinkAlertFromChannel(alertId, channelId);
    
    if (!success) {
      return res.status(404).json({ error: 'Link not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Failed to unlink alert from channel:', error);
    res.status(500).json({ error: 'Failed to unlink alert from channel' });
  }
});

// Get channels for an alert
router.get('/alerts/:id/channels', requireAlertPermission, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const channels = alertModel.getChannelsForAlert(id);
    res.json(channels);
  } catch (error) {
    console.error('Failed to get alert channels:', error);
    res.status(500).json({ error: 'Failed to get alert channels' });
  }
});

// Alert engine control endpoints
router.post('/alerts/engine/start', requireAlertPermission, (req: Request, res: Response) => {
  try {
    alertEngine.start();
    res.json({ status: 'started' });
  } catch (error) {
    console.error('Failed to start alert engine:', error);
    res.status(500).json({ error: 'Failed to start alert engine' });
  }
});

router.post('/alerts/engine/stop', requireAlertPermission, (req: Request, res: Response) => {
  try {
    alertEngine.stop();
    res.json({ status: 'stopped' });
  } catch (error) {
    console.error('Failed to stop alert engine:', error);
    res.status(500).json({ error: 'Failed to stop alert engine' });
  }
});

export default router;