require('dotenv').config();
const pool = require('../config/database');

const addConversationTable = async () => {
  try {
    console.log('Adding conversation memory table...');

    // Conversation memory — NO foreign key, just plain integer
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        patient_phone VARCHAR(20) NOT NULL,
        clinic_id INTEGER,
        whatsapp_number VARCHAR(20),
        role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ conversations table created');

    // Index for fast lookup
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_phone_clinic 
      ON conversations(patient_phone, clinic_id);
    `);
    console.log('✅ Index created');

    // WhatsApp numbers table — NO foreign key
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clinic_whatsapp (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER,
        whatsapp_number_id VARCHAR(100) UNIQUE NOT NULL,
        whatsapp_phone VARCHAR(20) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ clinic_whatsapp table created');

    // Add whatsapp_phone column to patients
    await pool.query(`
      ALTER TABLE patients 
      ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(20) UNIQUE;
    `);
    console.log('✅ patients.whatsapp_phone column added');

    console.log('\n🎉 All WhatsApp tables ready!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

addConversationTable();
