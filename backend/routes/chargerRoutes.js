const express = require('express');
const router = express.Router();
const db = require('../../database/db');

module.exports = function(broadcast, ocppServer) {
  // Get all chargers
  router.get('/', (req, res) => {
    const chargers = db.getAllChargers();
    res.json({
      success: true,
      count: chargers.length,
      chargers: chargers
    });
  });

  // Add new charger (from dedicated Add Charger page)
  router.post('/', (req, res) => {
    const { name, location, maxVoltage, maxCurrent, connectorType, username, password, ratePerKwh, rfidToken } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, error: 'Charger name is required.' });
    }

    const newCharger = db.addCharger({
      name,
      location,
      maxVoltage,
      maxCurrent,
      connectorType,
      username,
      password,
      ratePerKwh,
      rfidToken
    });

    broadcast({
      type: 'CHARGER_ADDED',
      charger: newCharger
    });

    res.status(201).json({
      success: true,
      message: 'Charger created successfully with unique PCB Key & Login credentials.',
      charger: newCharger
    });
  });

  // Get single charger
  router.get('/:id', (req, res) => {
    const charger = db.getChargerById(req.params.id);
    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found' });
    }
    res.json({ success: true, charger });
  });

  // Delete charger handler (supports both DELETE and POST /delete)
  const handleDelete = (req, res) => {
    const chargerId = req.params.id;
    const charger = db.getChargerById(chargerId);
    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found or already deleted.' });
    }

    const success = db.deleteCharger(chargerId);
    if (success) {
      broadcast({
        type: 'CHARGER_DELETED',
        chargerId: chargerId
      });

      return res.json({
        success: true,
        message: 'Charger removed successfully.',
        chargerId: chargerId
      });
    } else {
      return res.status(500).json({ success: false, error: 'Failed to delete charger.' });
    }
  };

  router.delete('/:id', handleDelete);
  router.post('/:id/delete', handleDelete);

  // Portal Remote Control (Turn Charger ON / OFF directly through portal)
  router.post('/:id/control', async (req, res) => {
    const { action, batteryConnected } = req.body; // 'ON', 'OFF', 'START', 'STOP'
    const chargerId = req.params.id;
    const charger = db.getChargerById(chargerId);

    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found' });
    }

    const isTurnOn = action === 'ON' || action === 'START';
    const isOcppActive = Boolean(ocppServer && (ocppServer.isChargerConnected(charger.id) || ocppServer.isChargerConnected(charger.apiKey)));

    // Allow explicit override if passed in request (e.g. from simulator or test suite)
    if (batteryConnected !== undefined) {
      charger.batteryConnected = Boolean(batteryConnected);
    }

    if (isTurnOn) {
      // 1. If connected via OCPP 1.6-J, dispatch RemoteStartTransaction to PCB
      if (isOcppActive) {
        try {
          const ocppRes = await ocppServer.remoteStart(charger.id, 1, 'PORTAL_REMOTE');
          if (ocppRes && (ocppRes.status === 'Accepted' || ocppRes.status === 'Scheduled')) {
            charger.batteryConnected = true;
            charger.status = 'CHARGING';
            charger.lastSeen = Date.now();
            if (!charger.telemetry) charger.telemetry = {};
            charger.telemetry.status = 'CHARGING';
            charger.telemetry.battery_connected = true;
            charger.telemetry.charging_mode = 'OCPP 1.6-J // REMOTE START';
            db.saveChargers();

            broadcast({
              type: 'CHARGER_UPDATED',
              charger
            });
            broadcast({
              type: 'TELEMETRY_UPDATE',
              chargerId: charger.id,
              telemetry: charger.telemetry,
              status: charger.status
            });

            return res.status(200).json({
              success: true,
              ocpp: true,
              protocol: 'OCPP 1.6-J',
              batteryConnected: true,
              authenticated: true,
              message: 'Charging begin (OCPP RemoteStartTransaction Accepted by PCB firmware).',
              status: charger.status,
              charger
            });
          } else {
            return res.status(200).json({
              success: false,
              ocpp: true,
              error: `PCB hardware rejected RemoteStartTransaction (${ocppRes?.status || 'Rejected'})`,
              message: `PCB hardware rejected RemoteStartTransaction (${ocppRes?.status || 'Rejected'}).`,
              charger
            });
          }
        } catch (err) {
          return res.status(500).json({
            success: false,
            ocpp: true,
            error: err.message,
            message: `OCPP error: ${err.message}`
          });
        }
      }

      const now = Date.now();
      const pcbHeartbeatTimeout = 90000; // 90s active communication window
      const isPcbOnline = Boolean(charger.lastSeen && (now - charger.lastSeen <= pcbHeartbeatTimeout));

      // 1. Verify whether a PCB authorizing this authentication key is actually ON & active
      // (If operator explicitly confirmed battery link, permit manual start)
      if (!isPcbOnline && batteryConnected !== true) {
        // NO PCB CONNECTED WITH THIS AUTHENTICATION KEY!
        charger.status = 'OFFLINE';
        if (!charger.telemetry) charger.telemetry = {};
        charger.telemetry.status = 'OFFLINE';
        charger.telemetry.power_kw = 0.0;
        charger.telemetry.charger_current = 0.0;
        charger.telemetry.battery_connected = false;
        charger.telemetry.charging_mode = 'OFFLINE // NO PCB CONNECTED';
        charger.batteryConnected = false;
        db.saveChargers();

        broadcast({
          type: 'CHARGER_UPDATED',
          charger
        });
        broadcast({
          type: 'TELEMETRY_UPDATE',
          chargerId: charger.id,
          telemetry: charger.telemetry,
          status: charger.status
        });

        return res.status(200).json({
          success: false,
          batteryConnected: false,
          pcbOnline: false,
          authenticated: false,
          apiKey: charger.apiKey,
          reason: 'NO_PCB_CONNECTED',
          title: "Battery Not Connected",
          message: "The battery isn't connected with the charger. Please connect the battery.",
          error: "No PCB hardware connected with authentication key. The battery isn't connected with the charger. Please connect the battery.",
          pcbStatus: "OFFLINE (No PCB with Auth Key)",
          batteryLink: "DISCONNECTED (No Auth Key Hardware Signal)",
          status: charger.status,
          charger
        });
      }

      // 2. PCB IS online with the auth key. Now check whether the authorized PCB confirms the battery is connected:
      const isBatteryConnected = charger.batteryConnected !== false &&
        (charger.telemetry ? charger.telemetry.battery_connected !== false : true);

      if (!isBatteryConnected) {
        // PCB is ON with the auth key, but reports that battery is not connected!
        charger.status = 'ONLINE';
        if (!charger.telemetry) charger.telemetry = {};
        charger.telemetry.status = 'ONLINE';
        charger.telemetry.power_kw = 0.0;
        charger.telemetry.charger_current = 0.0;
        charger.telemetry.charging_mode = 'STANDBY // NO BATTERY';
        charger.telemetry.battery_connected = false;
        db.saveChargers();

        broadcast({
          type: 'CHARGER_UPDATED',
          charger
        });
        broadcast({
          type: 'TELEMETRY_UPDATE',
          chargerId: charger.id,
          telemetry: charger.telemetry,
          status: charger.status
        });

        return res.status(200).json({
          success: false,
          batteryConnected: false,
          pcbOnline: true,
          authenticated: false,
          apiKey: charger.apiKey,
          reason: 'BATTERY_NOT_CONNECTED',
          title: "Battery Not Connected",
          message: "The battery isn't connected with the charger. Please connect the battery.",
          error: "The battery isn't connected with the charger. Please connect the battery.",
          pcbStatus: "ONLINE (PCB Authorized with Auth Key)",
          batteryLink: "DISCONNECTED (Interlock Open)",
          status: charger.status,
          charger
        });
      }

      // 3. BOTH verified: PCB with authentication key is ON and battery is verified connected!
      const command = db.queueCommand(chargerId, 'AUTHENTICATE_BATTERY_CONNECT', {
        action: 'START_CHARGING',
        requestedAt: now
      });

      // Battery IS connected! Proceed with beginning charging session
      charger.batteryConnected = true;
      charger.status = 'CHARGING';
      charger.lastSeen = Date.now();

      if (!charger.telemetry) charger.telemetry = {};
      charger.telemetry.battery_connected = true;

      const isAc = charger.isAc === true || db.isAcConnector(charger.connectorType);

      // Starting a new session after a held (fully charged) AC session -> restart kWh from 0
      if (isAc && charger.sessionPendingReset) {
        charger.telemetry.session_energy_kwh = 0.0;
        charger.telemetry.session_duration_min = 0.0;
        if (Number(charger.telemetry.battery_soc) >= 100) charger.telemetry.battery_soc = 0.0;
        charger.sessionPendingReset = false;
      }

      charger.telemetry.status = 'CHARGING';
      if (isAc) {
        const acV = Number(charger.maxVoltage) || 230;
        const acA = Number(charger.maxCurrent) || 32;
        const curV = Number(charger.telemetry.charger_voltage);
        const curA = Number(charger.telemetry.charger_current);
        charger.telemetry.charger_voltage = curV > 100 && curV <= acV * 1.1 ? curV : acV;
        charger.telemetry.charger_current = curA > 0.5 && curA <= acA ? curA : acA;
        charger.telemetry.power_kw = charger.telemetry.power_kw !== undefined && charger.telemetry.power_kw !== null ? Number(charger.telemetry.power_kw) : 0.0;
        charger.telemetry.charging_mode = 'AC SMART // LEVEL 2';
      } else {
        charger.telemetry.charger_voltage = charger.telemetry.charger_voltage > 100 ? charger.telemetry.charger_voltage : 418.5;
        charger.telemetry.charger_current = charger.telemetry.charger_current > 10 ? charger.telemetry.charger_current : 148.2;
        const v = Number(charger.telemetry.charger_voltage);
        const a = Number(charger.telemetry.charger_current);
        charger.telemetry.power_kw = Number((v * a / 1000).toFixed(1));
        charger.telemetry.charging_mode = 'SPORT PLUS // CC FAST';
      }

      charger.telemetry.timestamp = Date.now();
      db.saveChargers();

      broadcast({
        type: 'CHARGER_UPDATED',
        charger
      });

      broadcast({
        type: 'TELEMETRY_UPDATE',
        chargerId: charger.id,
        telemetry: charger.telemetry,
        status: charger.status,
        sessionPendingReset: charger.sessionPendingReset === true
      });

      return res.status(200).json({
        success: true,
        batteryConnected: true,
        authenticated: true,
        commandSent: command,
        message: 'Charging begin.',
        status: charger.status,
        charger
      });
    } else {
      // Turn OFF
      if (isOcppActive) {
        try {
          const activeTx = charger.currentTransactionId || 1;
          const ocppRes = await ocppServer.remoteStop(charger.id, activeTx);
          charger.status = 'ONLINE';
          charger.lastSeen = Date.now();
          if (!charger.telemetry) charger.telemetry = {};
          charger.telemetry.status = 'ONLINE';
          charger.telemetry.power_kw = 0.0;
          charger.telemetry.charger_current = 0.0;
          charger.telemetry.charging_mode = 'STANDBY // READY';
          charger.telemetry.timestamp = Date.now();
          db.saveChargers();

          broadcast({
            type: 'CHARGER_UPDATED',
            charger
          });

          broadcast({
            type: 'TELEMETRY_UPDATE',
            chargerId: charger.id,
            telemetry: charger.telemetry,
            status: charger.status,
            sessionPendingReset: charger.sessionPendingReset === true
          });

          return res.json({
            success: true,
            ocpp: true,
            protocol: 'OCPP 1.6-J',
            message: 'Charger turned OFF successfully via OCPP RemoteStopTransaction.',
            status: charger.status,
            charger
          });
        } catch (err) {
          return res.status(500).json({
            success: false,
            ocpp: true,
            error: err.message,
            message: `OCPP error: ${err.message}`
          });
        }
      }

      charger.status = 'ONLINE';
      charger.lastSeen = Date.now();
      if (!charger.telemetry) charger.telemetry = {};
      charger.telemetry.status = 'ONLINE';
      charger.telemetry.power_kw = 0.0;
      charger.telemetry.charger_current = 0.0;
      charger.telemetry.charging_mode = 'STANDBY // READY';
      charger.telemetry.timestamp = Date.now();
      db.saveChargers();

      broadcast({
        type: 'CHARGER_UPDATED',
        charger
      });

      broadcast({
        type: 'TELEMETRY_UPDATE',
        chargerId: charger.id,
        telemetry: charger.telemetry,
        status: charger.status,
        sessionPendingReset: charger.sessionPendingReset === true
      });

      return res.json({
        success: true,
        message: 'Charger turned OFF successfully.',
        status: charger.status,
        charger
      });
    }
  });

  // Get OCPP status and connection details
  router.get('/:id/ocpp', (req, res) => {
    const charger = db.getChargerById(req.params.id);
    if (!charger) return res.status(404).json({ success: false, error: 'Charger not found' });
    const isConnected = Boolean(ocppServer && (ocppServer.isChargerConnected(charger.id) || ocppServer.isChargerConnected(charger.apiKey)));
    const host = req.headers.host || 'localhost:3000';
    res.json({
      success: true,
      chargerId: charger.id,
      name: charger.name,
      ocpp: {
        connected: isConnected,
        subprotocol: 'ocpp1.6',
        wsUrl: `ws://${host}/ocpp16/${charger.id}`,
        vendor: charger.ocpp?.vendor || 'Generic PCB',
        model: charger.ocpp?.model || 'EVSE-V1',
        firmwareVersion: charger.ocpp?.firmwareVersion || '1.0.0',
        activeTransactionId: charger.currentTransactionId || null,
        lastSeen: charger.lastSeen
      }
    });
  });

  // Remote Reset (Soft/Hard) via OCPP
  router.post('/:id/ocpp/reset', async (req, res) => {
    const { type } = req.body; // 'Soft' or 'Hard'
    try {
      if (!ocppServer || !ocppServer.isChargerConnected(req.params.id)) {
        return res.status(400).json({ success: false, error: 'Charger is not connected via OCPP 1.6-J' });
      }
      const result = await ocppServer.reset(req.params.id, type || 'Soft');
      res.json({ success: true, message: `Reset (${type || 'Soft'}) dispatched to PCB.`, result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Remote Unlock Connector via OCPP
  router.post('/:id/ocpp/unlock', async (req, res) => {
    const { connectorId } = req.body;
    try {
      if (!ocppServer || !ocppServer.isChargerConnected(req.params.id)) {
        return res.status(400).json({ success: false, error: 'Charger is not connected via OCPP 1.6-J' });
      }
      const result = await ocppServer.unlockConnector(req.params.id, connectorId || 1);
      res.json({ success: true, message: 'UnlockConnector dispatched to PCB.', result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Toggle or update battery connection state (for hardware simulation or test suite)
  router.post('/:id/battery-status', (req, res) => {
    const { connected, forcePcb } = req.body;
    const isConn = Boolean(connected);
    const charger = db.getChargerById(req.params.id);
    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found' });
    }

    const pcbOnline = db.isPcbOnline(charger);

    if (isConn && !pcbOnline && !forcePcb) {
      // PCB is not online with authentication key; battery connection cannot be established
      charger.batteryConnected = false;
      if (!charger.telemetry) charger.telemetry = {};
      charger.telemetry.battery_connected = false;
      db.saveChargers();

      return res.status(200).json({
        success: false,
        batteryConnected: false,
        pcbOnline: false,
        apiKey: charger.apiKey,
        message: "The battery isn't connected with the charger. Please connect the battery.",
        error: "No active PCB hardware streaming with this authentication key.",
        charger
      });
    }

    db.setBatteryConnected(charger.id, isConn);

    if (forcePcb) {
      charger.lastSeen = Date.now();
      charger.status = 'ONLINE';
    }

    if (isConn && pcbOnline) {
      if (!charger.telemetry) charger.telemetry = {};
      charger.telemetry.battery_connected = true;
    } else if (!isConn) {
      if (!charger.telemetry) charger.telemetry = {};
      charger.telemetry.battery_connected = false;
    }
    db.saveChargers();

    broadcast({
      type: 'CHARGER_UPDATED',
      charger
    });

    broadcast({
      type: 'TELEMETRY_UPDATE',
      chargerId: charger.id,
      telemetry: charger.telemetry,
      status: charger.status
    });

    res.json({
      success: true,
      batteryConnected: charger.batteryConnected,
      pcbOnline: db.isPcbOnline(charger),
      message: `Battery status updated to ${charger.batteryConnected ? 'CONNECTED' : 'DISCONNECTED'}.`,
      charger
    });
  });

  // Query pending commands for this charger (for PCB polling)
  router.get('/:id/commands', (req, res) => {
    const charger = db.getChargerById(req.params.id);
    if (!charger) return res.status(404).json({ success: false, error: 'Charger not found' });
    const commands = db.getPendingCommands(charger.id);
    res.json({ success: true, chargerId: charger.id, commands });
  });

  // Regenerate key
  router.post('/:id/regenerate-key', (req, res) => {
    const result = db.regenerateApiKey(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Charger not found' });
    }

    broadcast({
      type: 'CHARGER_UPDATED',
      charger: result.charger
    });

    res.json({
      success: true,
      message: 'API key regenerated successfully.',
      oldKey: result.oldKey,
      apiKey: result.newKey,
      charger: result.charger
    });
  });

  // Update credentials
  router.post('/:id/credentials', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const charger = db.updateChargerCredentials(req.params.id, username, password);
    if (!charger) {
      return res.status(404).json({ success: false, error: 'Charger not found' });
    }

    broadcast({
      type: 'CHARGER_UPDATED',
      charger
    });

    res.json({
      success: true,
      message: `Credentials updated for ${charger.name}`,
      chargerId: charger.id,
      username: charger.credentials.username
    });
  });

  return router;
};
