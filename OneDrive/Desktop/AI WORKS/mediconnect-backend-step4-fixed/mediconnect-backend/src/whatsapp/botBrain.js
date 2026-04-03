const pool = require('../config/database');
const axios = require('axios');

// ─── STEP 1: Find which clinic owns this WhatsApp number ──────────
const getClinicByWhatsappNumber = async (phoneNumberId) => {
  try {
    const result = await pool.query(
      `SELECT c.*, cw.whatsapp_number_id, cw.whatsapp_phone
       FROM clinics c
       JOIN clinic_whatsapp cw ON c.id = cw.clinic_id
       WHERE cw.whatsapp_number_id = $1 AND cw.is_active = true`,
      [phoneNumberId]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('getClinicByWhatsappNumber error:', err.message);
    return null;
  }
};

// ─── STEP 2: Get or create patient by phone number ────────────────
const getOrCreatePatient = async (phone, name, clinicId) => {
  try {
    // Check if patient exists by whatsapp phone
    let result = await pool.query(
      'SELECT * FROM patients WHERE whatsapp_phone = $1',
      [phone]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Create new patient (whatsapp-only registration)
    result = await pool.query(
      `INSERT INTO patients (full_name, phone, whatsapp_phone, email, password)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (whatsapp_phone) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING *`,
      [
        name || 'WhatsApp Patient',
        phone,
        phone,
        `${phone}@whatsapp.temp`, // temp email
        'whatsapp_user_no_password'  // no password — whatsapp only user
      ]
    );

    return result.rows[0];
  } catch (err) {
    console.error('getOrCreatePatient error:', err.message);
    return null;
  }
};

// ─── STEP 3: Load conversation memory (last 10 messages) ─────────
const getConversationHistory = async (patientPhone, clinicId) => {
  try {
    const result = await pool.query(
      `SELECT role, message FROM conversations
       WHERE patient_phone = $1 AND clinic_id = $2
       ORDER BY created_at DESC
       LIMIT 10`,
      [patientPhone, clinicId]
    );
    // Reverse so oldest message is first
    return result.rows.reverse();
  } catch (err) {
    console.error('getConversationHistory error:', err.message);
    return [];
  }
};

// ─── STEP 4: Save message to conversation memory ──────────────────
const saveMessage = async (patientPhone, clinicId, role, message) => {
  try {
    await pool.query(
      `INSERT INTO conversations (patient_phone, clinic_id, role, message)
       VALUES ($1, $2, $3, $4)`,
      [patientPhone, clinicId, role, message]
    );

    // Keep only last 20 messages per patient per clinic (auto cleanup)
    await pool.query(
      `DELETE FROM conversations
       WHERE patient_phone = $1 AND clinic_id = $2
       AND id NOT IN (
         SELECT id FROM conversations
         WHERE patient_phone = $1 AND clinic_id = $2
         ORDER BY created_at DESC
         LIMIT 20
       )`,
      [patientPhone, clinicId]
    );
  } catch (err) {
    console.error('saveMessage error:', err.message);
  }
};

// ─── STEP 5: Get doctors for this clinic ─────────────────────────
const getClinicDoctors = async (clinicId) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, specialization, consultation_fee, timings
       FROM doctors
       WHERE clinic_id = $1 AND is_active = true`,
      [clinicId]
    );
    return result.rows;
  } catch (err) {
    console.error('getClinicDoctors error:', err.message);
    return [];
  }
};

// ─── STEP 6: Build dynamic AI system prompt ───────────────────────
const buildSystemPrompt = (clinic, doctors, patientName, patientPhone) => {
  const today = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = days[today.getDay()];
  const todayDate = today.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const currentTime = today.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit'
  });

  // Build doctors list dynamically from database
  const doctorsList = doctors.map(d =>
    `- Dr. ${d.full_name} | ${d.specialization} | Fee: ₹${d.consultation_fee} | Timings: ${d.timings || 'As per clinic schedule'}`
  ).join('\n');

  const doctorIds = doctors.map(d =>
    `${d.specialization}: doctor_id=${d.id}`
  ).join(', ');

  return `You are MediBot, the intelligent WhatsApp assistant for ${clinic.clinic_name}.

=== CLINIC INFORMATION ===
Clinic Name: ${clinic.clinic_name}
City: ${clinic.city}
Address: ${clinic.address}
Phone: ${clinic.phone}
Specialization: ${clinic.specialization || 'General'}

=== DOCTORS AT THIS CLINIC ===
${doctorsList || 'No doctors listed yet. Ask patient to call the clinic directly.'}

=== TODAY ===
Today: ${todayName}, ${todayDate}
Current Time: ${currentTime}

=== PATIENT ===
Name: ${patientName}
Phone: ${patientPhone}

=== WHAT YOU CAN DO ===
1. BOOK APPOINTMENT — Collect: date, time, which doctor/department, reason
2. CANCEL APPOINTMENT — Ask which appointment to cancel
3. CHECK AVAILABILITY — Tell about clinic timings and doctors
4. SYMPTOM CHECKER — Based on symptoms suggest which doctor to see
5. CLINIC INFO — Share address, timings, fees
6. GENERAL HEALTH ADVICE — Basic info, when to visit doctor

=== LANGUAGE RULES — CRITICAL ===
Detect the exact language the patient writes in:
- Hindi Devanagari script (मुझे अपॉइंटमेंट चाहिए) → Reply in Hindi Devanagari
- Hinglish/Roman Hindi (mujhe appointment chahiye) → Reply in Hinglish Roman
- Marathi → Reply in Marathi  
- English → Reply in English
- ALWAYS match patient's language exactly
- NEVER switch languages unless patient switches

=== APPOINTMENT BOOKING FLOW ===
Step 1: Ask preferred date
Step 2: Ask morning or evening
Step 3: Ask which doctor or what problem
Step 4: Confirm all details
Step 5: Give confirmation with all details
Step 6: Add booking JSON at end (hidden)

=== IMPORTANT — WHEN BOOKING IS CONFIRMED ===
When patient confirms appointment, add this EXACT format at the very end:
[BOOKING:{"patient_phone":"${patientPhone}","doctor_id":DOCTOR_ID,"clinic_id":${clinic.id},"date":"YYYY-MM-DD","time":"HH:MM","reason":"REASON"}]

Doctor IDs for this clinic: ${doctorIds || 'Use doctor_id: 1'}

=== WHEN CANCELLING ===
[CANCEL:{"patient_phone":"${patientPhone}","clinic_id":${clinic.id},"date":"YYYY-MM-DD","time":"HH:MM"}]

=== TONE ===
- Warm, caring, professional
- Keep messages SHORT — this is WhatsApp not email
- Use line breaks for readability
- Use emojis sparingly
- Never diagnose — always say "Doctor will examine and advise"
- Never give booking confirmation unless patient explicitly says YES/confirm/haan/हाँ

=== IMPORTANT ===
You have memory of previous messages in this conversation.
Use context from previous messages to give relevant responses.
Don't ask for information patient already gave.`;
};

// ─── STEP 7: Call Groq AI ─────────────────────────────────────────
const callGroqAI = async (systemPrompt, conversationHistory, userMessage) => {
  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(m => ({ role: m.role, content: m.message })),
      { role: 'user', content: userMessage }
    ];

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 1024,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return response.data.choices[0].message.content;
  } catch (err) {
    console.error('Groq AI error:', err.response?.data || err.message);
    return null;
  }
};

// ─── STEP 8: Transcribe voice note using Groq Whisper ─────────────
const transcribeVoice = async (audioUrl, accessToken) => {
  try {
    // Download audio from WhatsApp
    const audioResponse = await axios.get(audioUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer'
    });

    const audioBuffer = Buffer.from(audioResponse.data);
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
    form.append('model', 'whisper-large-v3');

    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        timeout: 60000
      }
    );

    return response.data.text || null;
  } catch (err) {
    console.error('Voice transcription error:', err.message);
    return null;
  }
};

// ─── STEP 9: Parse AI response for booking/cancel data ───────────
const parseAIResponse = (aiReply) => {
  let cleanReply = aiReply;
  let bookingData = null;
  let cancelData = null;

  // Extract booking data
  const bookingMatch = aiReply.match(/\[BOOKING:(.*?)\]/s);
  if (bookingMatch) {
    try {
      bookingData = JSON.parse(bookingMatch[1]);
      cleanReply = aiReply.replace(/\[BOOKING:.*?\]/s, '').trim();
    } catch (e) {
      console.error('Booking parse error:', e.message);
    }
  }

  // Extract cancel data
  const cancelMatch = aiReply.match(/\[CANCEL:(.*?)\]/s);
  if (cancelMatch) {
    try {
      cancelData = JSON.parse(cancelMatch[1]);
      cleanReply = aiReply.replace(/\[CANCEL:.*?\]/s, '').trim();
    } catch (e) {
      console.error('Cancel parse error:', e.message);
    }
  }

  return { cleanReply, bookingData, cancelData };
};

// ─── STEP 10: Save appointment to database ────────────────────────
const saveAppointment = async (bookingData, patientId) => {
  try {
    // Check if slot already taken
    const existing = await pool.query(
      `SELECT id FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2
       AND appointment_time = $3 AND status != 'cancelled'`,
      [bookingData.doctor_id, bookingData.date, bookingData.time]
    );

    if (existing.rows.length > 0) {
      return { success: false, message: 'Slot already booked' };
    }

    // Get doctor fee
    const doctor = await pool.query(
      'SELECT consultation_fee FROM doctors WHERE id = $1',
      [bookingData.doctor_id]
    );
    const fee = doctor.rows[0]?.consultation_fee || 0;

    // Save appointment
    const result = await pool.query(
      `INSERT INTO appointments
       (patient_id, doctor_id, clinic_id, appointment_date, appointment_time, reason, fees, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id`,
      [
        patientId,
        bookingData.doctor_id,
        bookingData.clinic_id,
        bookingData.date,
        bookingData.time,
        bookingData.reason || 'WhatsApp Booking',
        fee
      ]
    );

    return { success: true, appointmentId: result.rows[0].id };
  } catch (err) {
    console.error('saveAppointment error:', err.message);
    return { success: false, message: err.message };
  }
};

// ─── STEP 11: Send WhatsApp message ──────────────────────────────
const sendWhatsAppMessage = async (to, message, phoneNumberId, accessToken) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    return true;
  } catch (err) {
    console.error('Send WhatsApp error:', err.response?.data || err.message);
    return false;
  }
};

// ─── MAIN FUNCTION: Process incoming WhatsApp message ─────────────
const processWhatsAppMessage = async (messageData) => {
  const {
    from,           // Patient's phone number
    patientName,    // Patient's WhatsApp display name
    messageType,    // text, audio, image, interactive
    messageText,    // Text content
    audioId,        // Audio file ID (if voice note)
    phoneNumberId,  // Which WhatsApp number received this
    accessToken     // Meta access token
  } = messageData;

  console.log(`\n📱 New message from ${from}: "${messageText}"`);

  try {
    // 1. Find which clinic this WhatsApp number belongs to
    const clinic = await getClinicByWhatsappNumber(phoneNumberId);

    if (!clinic) {
      console.log('⚠️ No clinic found for this WhatsApp number:', phoneNumberId);
      // Send generic reply
      await sendWhatsAppMessage(
        from,
        'Sorry, this service is not configured yet. Please contact the clinic directly.',
        phoneNumberId,
        accessToken
      );
      return;
    }

    console.log(`🏥 Clinic identified: ${clinic.clinic_name}`);

    // 2. Get or create patient
    const patient = await getOrCreatePatient(from, patientName, clinic.id);
    if (!patient) {
      console.error('Could not get/create patient');
      return;
    }

    // 3. Handle voice note — transcribe first
    let finalText = messageText;
    if (messageType === 'audio' && audioId) {
      console.log('🎤 Processing voice note...');

      // Get audio download URL from Meta
      const mediaResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${audioId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const audioUrl = mediaResponse.data.url;

      // Transcribe using Groq Whisper
      const transcription = await transcribeVoice(audioUrl, accessToken);
      if (transcription) {
        finalText = transcription;
        console.log(`🎤 Transcribed: "${finalText}"`);
      } else {
        await sendWhatsAppMessage(
          from,
          'Sorry, I could not understand the voice note. Please type your message.',
          phoneNumberId,
          accessToken
        );
        return;
      }
    }

    // 4. Handle image
    if (messageType === 'image') {
      finalText = 'The patient sent an image. Please ask them to describe their concern in text or visit the clinic.';
    }

    // 5. Load conversation history (memory!)
    const history = await getConversationHistory(from, clinic.id);
    console.log(`💬 Loaded ${history.length} previous messages`);

    // 6. Load clinic's doctors
    const doctors = await getClinicDoctors(clinic.id);

    // 7. Build AI prompt with THIS clinic's data
    const systemPrompt = buildSystemPrompt(clinic, doctors, patientName, from);

    // 8. Save patient's message to memory
    await saveMessage(from, clinic.id, 'user', finalText);

    // 9. Call Groq AI
    console.log('🤖 Calling Groq AI...');
    const aiReply = await callGroqAI(systemPrompt, history, finalText);

    if (!aiReply) {
      await sendWhatsAppMessage(
        from,
        `Sorry, I'm having trouble right now. Please call ${clinic.clinic_name} directly at ${clinic.phone}.`,
        phoneNumberId,
        accessToken
      );
      return;
    }

    // 10. Parse reply for booking/cancel actions
    const { cleanReply, bookingData, cancelData } = parseAIResponse(aiReply);

    // 11. Save appointment if booking detected
    if (bookingData) {
      console.log('📅 Booking detected:', bookingData);
      const saved = await saveAppointment(bookingData, patient.id);

      if (!saved.success) {
        // Slot taken — let AI know in next message (handled naturally)
        console.log('⚠️ Booking failed:', saved.message);
      } else {
        console.log(`✅ Appointment saved! ID: ${saved.appointmentId}`);
      }
    }

    // 12. Handle cancel if detected
    if (cancelData) {
      console.log('❌ Cancel detected:', cancelData);
      await pool.query(
        `UPDATE appointments SET status = 'cancelled'
         WHERE clinic_id = $1 AND patient_id = $2
         AND appointment_date = $3 AND status != 'cancelled'`,
        [cancelData.clinic_id, patient.id, cancelData.date]
      );
    }

    // 13. Save bot reply to memory
    await saveMessage(from, clinic.id, 'assistant', cleanReply);

    // 14. Send reply to patient on WhatsApp
    console.log(`💬 Sending reply to ${from}...`);
    await sendWhatsAppMessage(from, cleanReply, phoneNumberId, accessToken);

    console.log('✅ Message processed successfully!\n');

  } catch (err) {
    console.error('❌ processWhatsAppMessage error:', err.message);
    // Send fallback message
    try {
      await sendWhatsAppMessage(
        from,
        'Sorry, something went wrong. Please try again or call the clinic directly.',
        phoneNumberId,
        accessToken
      );
    } catch (e) {}
  }
};

module.exports = { processWhatsAppMessage };
