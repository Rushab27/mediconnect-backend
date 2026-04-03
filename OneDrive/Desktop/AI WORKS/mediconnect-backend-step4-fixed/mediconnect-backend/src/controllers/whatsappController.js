const { processWhatsAppMessage } = require('../whatsapp/botBrain');
const pool = require('../config/database');
const crypto = require('crypto');

// ─── VERIFY WEBHOOK (Meta calls this once to verify) ──────────────
const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔐 Webhook verification request received');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully!');
    return res.status(200).send(challenge);
  }

  console.log('❌ Webhook verification failed');
  return res.status(403).json({ error: 'Verification failed' });
};

// ─── RECEIVE MESSAGES (Meta sends all messages here) ──────────────
const receiveMessage = async (req, res) => {
  // Always respond 200 immediately to Meta (they need fast response)
  res.status(200).send('OK');

  try {
    const body = req.body;

    // Verify it's actually from Meta (security check)
    if (body.object !== 'whatsapp_business_account') {
      console.log('⚠️ Not a WhatsApp message, ignoring');
      return;
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    // Skip if no messages (could be status updates)
    if (!messages || messages.length === 0) {
      return;
    }

    const message = messages[0];
    const phoneNumberId = value.metadata?.phone_number_id;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    // Get patient's display name
    const contacts = value?.contacts;
    const patientName = contacts?.[0]?.profile?.name || 'Patient';

    // Extract message content based on type
    const messageType = message.type;
    let messageText = '';
    let audioId = null;
    let imageId = null;

    if (messageType === 'text') {
      messageText = message.text?.body || '';
    } else if (messageType === 'audio') {
      audioId = message.audio?.id;
      messageText = '[VOICE_NOTE]';
    } else if (messageType === 'image') {
      imageId = message.image?.id;
      messageText = '[IMAGE]';
    } else if (messageType === 'interactive') {
      // Button/list reply
      messageText = message.interactive?.button_reply?.title ||
                    message.interactive?.list_reply?.title || '';
    } else {
      // Sticker, document, location etc — not supported yet
      console.log(`⚠️ Unsupported message type: ${messageType}`);
      return;
    }

    console.log(`\n📨 Incoming ${messageType} from ${message.from}: "${messageText}"`);

    // Process the message (runs in background — we already sent 200 to Meta)
    await processWhatsAppMessage({
      from: message.from,
      patientName,
      messageType,
      messageText,
      audioId,
      imageId,
      phoneNumberId,
      accessToken
    });

  } catch (err) {
    console.error('❌ receiveMessage error:', err.message);
  }
};

// ─── CLINIC REGISTERS THEIR WHATSAPP NUMBER ───────────────────────
const registerWhatsappNumber = async (req, res) => {
  const { whatsapp_number_id, whatsapp_phone } = req.body;
  const clinic_id = req.user.clinic_id;

  if (!whatsapp_number_id || !whatsapp_phone) {
    return res.status(400).json({
      success: false,
      message: 'whatsapp_number_id and whatsapp_phone are required'
    });
  }

  try {
    // Check if this number is already registered to another clinic
    const existing = await pool.query(
      'SELECT clinic_id FROM clinic_whatsapp WHERE whatsapp_number_id = $1',
      [whatsapp_number_id]
    );

    if (existing.rows.length > 0 && existing.rows[0].clinic_id !== clinic_id) {
      return res.status(409).json({
        success: false,
        message: 'This WhatsApp number is already registered to another clinic'
      });
    }

    // Save or update
    await pool.query(
      `INSERT INTO clinic_whatsapp (clinic_id, whatsapp_number_id, whatsapp_phone)
       VALUES ($1, $2, $3)
       ON CONFLICT (whatsapp_number_id) 
       DO UPDATE SET whatsapp_phone = $3, is_active = true`,
      [clinic_id, whatsapp_number_id, whatsapp_phone]
    );

    return res.status(200).json({
      success: true,
      message: 'WhatsApp number registered successfully! Your bot is now active.',
      webhook_url: `${process.env.BACKEND_URL}/api/whatsapp/webhook`
    });

  } catch (err) {
    console.error('registerWhatsappNumber error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET WHATSAPP STATUS FOR THIS CLINIC ──────────────────────────
const getWhatsappStatus = async (req, res) => {
  const clinic_id = req.user.clinic_id;

  try {
    const result = await pool.query(
      'SELECT whatsapp_number_id, whatsapp_phone, is_active, created_at FROM clinic_whatsapp WHERE clinic_id = $1',
      [clinic_id]
    );

    return res.status(200).json({
      success: true,
      connected: result.rows.length > 0,
      whatsapp: result.rows[0] || null,
      webhook_url: `${process.env.BACKEND_URL}/api/whatsapp/webhook`
    });

  } catch (err) {
    console.error('getWhatsappStatus error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  verifyWebhook,
  receiveMessage,
  registerWhatsappNumber,
  getWhatsappStatus
};
